from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenRefreshView
from devices.view_auth import EmailTokenObtainView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("devices.urls")),  # 👈 именно так
    path("api/auth/token/", EmailTokenObtainView.as_view()),
    path("api/auth/refresh/", TokenRefreshView.as_view()),  # 👈 refresh отдельно
]
