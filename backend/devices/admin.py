from django.contrib import admin
from .models import Device, DDoSLog

admin.site.register(Device)

@admin.register(DDoSLog)
class DDoSLogAdmin(admin.ModelAdmin):
    list_display = ("ip", "timestamp", "reason", "request_count")
    list_filter  = ("timestamp", "reason")