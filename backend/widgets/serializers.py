from rest_framework import serializers
from .models import Widget, WidgetLog, Temperature

class WidgetSerializer(serializers.ModelSerializer):
    class Meta:
        model = Widget
        fields = "__all__"
        extra_kwargs = {
            "owner": {"read_only": True},
        }

class TemperatureSerializer(serializers.ModelSerializer):
    class Meta:
        model = Temperature
        fields = ['id', 'widget', 'value', 'created_at']
        extra_kwargs = {
            'widget': {'required': False}
        }

class WidgetLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = WidgetLog
        fields = ["id", "widget", "event", "timestamp"]