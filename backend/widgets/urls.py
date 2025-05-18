from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import WidgetViewSet, interval_api, trigger_ddos_alert, temperature_api, _check_temperature_alert

router = DefaultRouter()
router.register('widgets', WidgetViewSet, basename='widget')

urlpatterns = [
    path("interval/", interval_api, name="interval"),
    path("ddos/alert/", trigger_ddos_alert, name="trigger_ddos_alert"),
    path("alerts/", _check_temperature_alert, name="alerts"),  
    path("temperature/", temperature_api, name="temperature"),  
    path('', include(router.urls)),
]