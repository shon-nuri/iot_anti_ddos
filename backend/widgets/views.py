# backend/widgets/views.py
from __future__ import annotations

from rest_framework import status, viewsets
from rest_framework.decorators import (
    action,
    api_view,
    permission_classes,
)
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Widget, WidgetLog, Temperature
from .serializers import WidgetSerializer, TemperatureSerializer
from .telegram_bot import send_telegram
from django.conf import settings 
# ------------------------------------------------------------------
# helper — send via per‑widget creds if present
# ------------------------------------------------------------------
import logging

logger = logging.getLogger(__name__)

CURRENT_INTERVAL = 5  # seconds

def _tg(widget: Widget, msg: str) -> None:
    cfg = widget.config or {}
    token = cfg.get("telegramToken") or getattr(settings, "TELEGRAM_TOKEN", None)
    chat  = cfg.get("telegramChatId")
    if token and chat:
        send_telegram(msg, token, chat)   # ← send_telegram(token, chat, msg)


# ------------------------------------------------------------------
class WidgetViewSet(viewsets.ModelViewSet):
    """
    CRUD + helper endpoints for widgets.
    Supported wtype: light, door, alarm, temp
    """
    queryset           = Widget.objects.all()
    serializer_class   = WidgetSerializer
    permission_classes = [IsAuthenticated]

    # ——— only widgets of current user
    def get_queryset(self):
        return super().get_queryset().filter(owner=self.request.user)

    # ------------------------------------------------ create ---------
    def create(self, request, *args, **kwargs):
        ser = self.get_serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        widget: Widget = ser.save(owner=request.user)

        # optional instant alert if temp value ≥ 30 °C
        if widget.wtype == "temp":
            v = widget.config.get("value")
            if v is not None and v >= 30:
                _tg(widget, f"🌡️ Температура {v} °C ≥ 30")

        headers = self.get_success_headers(ser.data)
        return Response(ser.data, status=status.HTTP_201_CREATED, headers=headers)

    # ------------------------------------------------ configure ------
    @action(detail=True, methods=["post"])
    def configure(self, request, pk=None):
        w = self.get_object()
        token = request.data.get("telegramToken")
        chat_id = request.data.get("telegramChatId")

        if chat_id:
            w.config["telegramChatId"] = chat_id

        w.config.update(request.data)
        w.save(update_fields=["config"])
        return Response({"status": "ok", "config": w.config})

    # ------------------------------------------------ toggle ---------
    @action(detail=True, methods=["post"])
    def toggle(self, request, pk=None):
        w   = self.get_object()
        cfg = w.config or {}

        # -------- light ---------------------------------------------
        if w.wtype == "light":
            cfg["is_on"] = not cfg.get("is_on", False)

        # -------- door ----------------------------------------------
        elif w.wtype == "door":
            want_open = not cfg.get("is_open", False)
            saved_pwd = cfg.get("password")
            given_pwd = request.data.get("password")

            # closing door → always allow
            if not want_open:
                cfg["is_open"] = False

            # opening door
            else:
                if saved_pwd and saved_pwd != given_pwd:
                    # wrong password
                    cfg["wrongPassAttempts"] = cfg.get("wrongPassAttempts", 0) + 1
                    if cfg["wrongPassAttempts"] >= cfg.get("wrongPassAttemptsThreshold", 3):
                        _tg(w, f"🚨 {cfg['wrongPassAttempts']} неверных паролей у «{w.title}»")
                        cfg["wrongPassAttempts"] = 0
                    w.config = cfg
                    w.save(update_fields=["config"])
                    return Response(
                        {"error": "Неверный пароль"},
                        status=status.HTTP_403_FORBIDDEN,
                    )
                # OK
                cfg["is_open"] = True
                cfg["wrongPassAttempts"] = 0

        # -------- alarm / other ------------------------------------
        else:
            return Response(
                {"error": "toggle not supported for this wtype"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # save + log
        w.config = cfg
        w.save(update_fields=["config"])
        WidgetLog.objects.create(widget=w, event=f"toggled {w.wtype}")
        return Response({"status": "ok", "config": cfg})
    

    # ------------------------------------------------ set_threshold --
    @action(detail=True, methods=["post"])
    def set_threshold(self, request, pk=None):
        w  = self.get_object()
        thr = request.data.get("threshold")
        w.config = {**(w.config or {}), "threshold": thr}
        w.save(update_fields=["config"])
        return Response({"status": "ok"})
    
    def get_queryset(self):
        return (
            super()
            .get_queryset()
            .filter(owner=self.request.user)
            .order_by("id")          #  ← ADDED
        )


# ------------------------------------------------------------------
# plain alert endpoint  →  /api/widgets/alerts/
# ------------------------------------------------------------------
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def alerts(request):
    msg = request.data.get("message", "").strip()
    token = request.data.get("token")      # allow overriding creds
    chat  = request.data.get("chat_id")

    if not msg:
        return Response({"error": "empty message"}, status=400)

    send_telegram(msg, token, chat)
    return Response({"status": "ok"})

api_view(["POST"])
@permission_classes([IsAuthenticated])
def trigger_ddos_alert(request):
    """
    Trigger a DDoS alert for testing purposes.
    """
    msg = "🚨 DDoS alert! 🚨"
    send_telegram(msg)
    return Response({"status": "ok"})

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def interval_api(request):
    """
    GET  → {"interval": <current_seconds>}
    POST → {interval: <new_seconds>}   (min 1 s)
    """
    global CURRENT_INTERVAL

    if request.method == "POST":
        try:
            new_val = int(request.data.get("interval", CURRENT_INTERVAL))
            CURRENT_INTERVAL = max(1, new_val)
            return Response({"interval": CURRENT_INTERVAL})
        except (TypeError, ValueError):
            return Response(
                {"error": "Invalid interval value"},
                status=status.HTTP_400_BAD_REQUEST,
            )

    # GET
    return Response({"interval": CURRENT_INTERVAL})


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def temperature_api(request):
    """
    Global temperature endpoint:
      • GET  – last 30 temperature readings across all widgets
      • POST – append a new temperature reading to the user's temperature widget
    """
    if request.method == "POST":
        # Automatically find the user's temperature widget
        temp_widgets = Widget.objects.filter(owner=request.user, wtype="temp")
        if not temp_widgets.exists():
            return Response({"error": "No temperature widget found"}, status=404)

        if temp_widgets.count() > 1:
            return Response({"error": "Multiple temperature widgets found. Specify widget_id."}, status=400)

        widget = temp_widgets.first()

        data = request.data.copy()
        data["widget"] = widget.id  # FK link
        ser = TemperatureSerializer(data=data)
        ser.is_valid(raise_exception=True)
        rec = ser.save()

        # Trigger widget-level alert
        _check_temperature_alert(widget, rec.value)
        return Response(ser.data)

    # GET
    temps = Temperature.objects.filter(widget__owner=request.user).order_by("-created_at")[:30]
    ser = TemperatureSerializer(temps, many=True)
    return Response(ser.data)


def _check_temperature_alert(widget, value: float) -> None:
    thr = widget.config.get("tempThreshold", 30)
    token = widget.config.get("telegramToken")
    chat = widget.config.get("telegramChatId")

    if not token or not chat:
        logger.warning("Telegram credentials missing for widget %s", widget.id)
        return

    if value >= thr:
        send_telegram(
            f"🌡️ {value} °C ≥ {thr} °C  ({widget.title})",
            token, chat
        )

