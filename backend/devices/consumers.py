# devices/consumers.py
from channels.generic.websocket import AsyncJsonWebsocketConsumer

class NotificationConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        await self.accept()
        await self.channel_layer.group_add("notifications", self.channel_name)

    async def disconnect(self, code):
        await self.channel_layer.group_discard("notifications", self.channel_name)

    async def notify(self, event):
        # сюда приходит event{"type":"notify","text":..}
        await self.send_json({"message": event["text"]})
