from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()

class Widget(models.Model):
    WIDGET_TYPES = [
        ('light', 'Light'),
        ('door',  'Door'),
        ('alarm', 'Alarm'),
        ('temp',  'Temperature'),
    ]
    owner = models.ForeignKey(User, on_delete=models.CASCADE)
    title = models.CharField(max_length=50)
    wtype = models.CharField(max_length=10, choices=WIDGET_TYPES)
    config = models.JSONField(default=dict)
    created = models.DateTimeField(auto_now_add=True)

class Temperature(models.Model):
    widget = models.ForeignKey(
        'Widget', 
        on_delete=models.CASCADE,
        related_name='temperatures',
        null=True,
        blank=True
    )
    value = models.FloatField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

class WidgetLog(models.Model):
    widget = models.ForeignKey(Widget, on_delete=models.CASCADE)
    event = models.CharField(max_length=100)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']