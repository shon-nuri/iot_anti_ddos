# devices/notifications.py
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

def push_notification(text: str):
    """
    Отправить всем подключённым через WS сообщение с текстом `text`.
    """
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        "notifications",
        {
            "type": "notify",   # имя handler‐метода в вашем consumer-е
            "text": text,
        }
    )
