from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    DeviceViewSet, ShieldView, UserMeView,
    block_ip, DDoSLogView
)
from rest_framework_simplejwt.views import TokenRefreshView
from .view_auth import EmailTokenObtainView, SignUpView
from .views_discover import NetworkDiscoveryView
from widgets import urls as widgets_urls

router = DefaultRouter()
router.register(r"devices", DeviceViewSet, basename="device")


urlpatterns = [
    path("", include(router.urls)),     
    path("shield/toggle/", ShieldView.as_view()),
    path("shield/block/", block_ip),
    path("auth/token/", EmailTokenObtainView.as_view()),
    path("auth/refresh/", TokenRefreshView.as_view()),   
    path("auth/signup/",  SignUpView.as_view()),   # ← сюда
    path("users/me/", UserMeView.as_view()),
    path("discover/", NetworkDiscoveryView.as_view()),
    path("ddos/logs/", DDoSLogView.as_view()),           
    path("", include(widgets_urls)),
]
