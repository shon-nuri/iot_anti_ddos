# devices/views.py
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import viewsets, permissions, status
from rest_framework.views import APIView    
from .models import Device, DDoSLog
from .serializers import DeviceSerializer, TemperatureSerializer
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.decorators import api_view, permission_classes
from .firewall import check_request  # Импортируем функцию проверки IP
import subprocess
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json
from .models import Temperature
from .notifications import push_notification
from .telegram_bot import send_telegram
from .models import Threshold
from django.utils.timezone import now


class DeviceViewSet(viewsets.ModelViewSet):
    queryset = Device.objects.all()
    serializer_class = DeviceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return self.queryset.filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    def list(self, request, *args, **kwargs):
        client_ip = self.get_client_ip(request)
        if not check_request(client_ip):
            return Response(
                {"detail": "Ваш IP временно заблокирован из-за подозрительной активности."},
                status=status.HTTP_429_TOO_MANY_REQUESTS
            )
        return super().list(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        client_ip = self.get_client_ip(request)
        if not check_request(client_ip):
            return Response(
                {"detail": "Ваш IP временно заблокирован из-за подозрительной активности."},
                status=status.HTTP_429_TOO_MANY_REQUESTS
            )
        return super().create(request, *args, **kwargs)

    def get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip
    
    @action(detail=True, methods=["post"])
    def toggle_light(self, request, pk=None):
        device = self.get_object()
        device.is_light_on = not device.is_light_on
        device.save()
        return Response({"is_light_on": device.is_light_on})

    @action(detail=True, methods=["post"])
    def toggle_door(self, request, pk=None):
        device = self.get_object()
        device.is_door_open = not device.is_door_open
        device.save()
        return Response({"is_door_open": device.is_door_open})
    

class ShieldView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        enabled = request.data.get("enabled", True)
        # TODO: shell-script / iptables apply here
        # for демо просто логируем
        print("Shield status:", enabled)
        return Response({"status": "ok", "enabled": enabled})


class UserMeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        return Response({
            "id": user.id,
            "email": user.email,
        })
    
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def block_ip(request):
    ip = request.data.get("ip")
    if not ip:
        return Response({"error": "IP адрес не передан"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        # 🚀 Блокируем через iptables
        subprocess.run(["sudo", "iptables", "-A", "INPUT", "-s", ip, "-j", "DROP"], check=True)
        return Response({"status": f"IP {ip} заблокирован"})
    except subprocess.CalledProcessError as e:
        return Response({"error": f"Ошибка блокировки: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class DDoSLogView(APIView):

    def get(self, request):
        logs = DDoSLog.objects.all().order_by("-timestamp")[:100]
        return Response([
            {
                "ip": log.ip,
                "time": log.timestamp,
                "reason": log.reason,
                "count": log.request_count
            } for log in logs
        ])
    
