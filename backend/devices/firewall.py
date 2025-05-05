# devices/firewall.py
import time
from .models import DDoSLog
from widgets.telegram_bot import send_telegram     # ← добавили

# ------------------ конфиг ------------------
MAX_REQUESTS_PER_MINUTE = 30       # лимит
BAN_DURATION_SECONDS    = 300      # бан, сек
# --------------------------------------------

# «память» внутри процесса
requests_per_ip: dict[str, list] = {}   # ip -> [first_ts, counter]
banned_ips      : dict[str, float] = {} # ip -> ban_until_ts

def check_request(ip_address: str) -> bool:
    """True — можно обслуживать запрос; False — IP заблокирован"""
    now = time.time()

    # 1) уже забанен?
    ban_until = banned_ips.get(ip_address)
    if ban_until:
        if now < ban_until:
            return False
        # бан истёк
        banned_ips.pop(ip_address, None)

    # 2) учёт запросов
    bucket = requests_per_ip.get(ip_address)
    if not bucket:
        requests_per_ip[ip_address] = [now, 1]
        return True

    first_ts, count = bucket
    if now - first_ts > 60:                 # окно прошло
        requests_per_ip[ip_address] = [now, 1]
        return True

    # ещё в том же минутном окне
    count += 1
    requests_per_ip[ip_address][1] = count

    if count > MAX_REQUESTS_PER_MINUTE:
        # --- превышен лимит — баним IP ---
        banned_ips[ip_address] = now + BAN_DURATION_SECONDS

        # лог в БД
        DDoSLog.objects.create(
            ip=ip_address,
            reason="Превышен лимит запросов",
            request_count=count,
        )

        # Telegram‑уведомление
        send_telegram(
            f"🚨 DDoS‑щит: IP <code>{ip_address}</code> "
            f"заблокирован (>{MAX_REQUESTS_PER_MINUTE} req/min)"
        )

        print(f"[FIREWALL] Забанен IP: {ip_address}")
        return False

    return True
