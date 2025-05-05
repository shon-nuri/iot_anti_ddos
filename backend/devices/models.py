from django.db import models
from django.contrib.auth import get_user_model
from django.utils.translation import gettext_lazy as _
from django.contrib.auth.models import User


class Device(models.Model):
    owner      = models.ForeignKey(
        get_user_model(), on_delete=models.CASCADE, related_name="devices"
    )
    name       = models.CharField(max_length=64)
    ip         = models.GenericIPAddressField()
    mac        = models.CharField(max_length=17)
    is_online  = models.BooleanField(default=False)
    is_light_on = models.BooleanField(default=False)
    is_door_open = models.BooleanField(default=False)

    def __str__(self):
        return self.name


class DDoSLog(models.Model):
    ip         = models.GenericIPAddressField()
    timestamp  = models.DateTimeField(auto_now_add=True)
    reason     = models.CharField(max_length=255, default="DDoS protection triggered")
    request_count = models.IntegerField(default=0)

    def __str__(self):
        return f"{self.ip} — {self.timestamp.strftime('%Y-%m-%d %H:%M:%S')}"
    

class Temperature(models.Model):
    value = models.FloatField()
    created_at = models.DateTimeField(auto_now_add=True)


# devices/models.py
class Threshold(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    metric = models.CharField(choices=[("temp","Температура"),("errors","Ошибки")], max_length=20)
    min_value = models.FloatField(null=True, blank=True)
    max_value = models.FloatField(null=True, blank=True)
    auto_block = models.BooleanField(default=False)     # блокировать IP
    notify = models.BooleanField(default=True)         # оповещать
    relay_control = models.BooleanField(default=False) # включать «охлаждение»
