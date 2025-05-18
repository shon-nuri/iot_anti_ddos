# widgets/telegram_bot.py   (replace the whole file)

import logging, requests
from django.conf import settings

log = logging.getLogger(__name__)

def send_telegram(msg: str,
                  token: str | None = None,
                  chat_id: str | None = None) -> bool:
    """
    Send *msg* to Telegram.  
    If token / chat_id are not supplied we fall back to project‑wide
    TELEGRAM_TOKEN  /  TELEGRAM_CHAT_ID from settings.py
    """
    token   = token   or getattr(settings, "TELEGRAM_TOKEN",   "")
    chat_id = chat_id or getattr(settings, "TELEGRAM_CHAT_ID", "")

    if not token or not chat_id:          # nothing configured → silently skip
        log.warning("🔕 telegram skipped – token/chat_id missing")
        return False

    url  = f"https://api.telegram.org/bot{token}/sendMessage"
    data = {"chat_id": chat_id, "text": msg}
    try:
        r = requests.post(url, data=data, timeout=5)
        r.raise_for_status()
        return True
    except Exception as e:
        log.error("telegram failed: %s", e)
        return False
