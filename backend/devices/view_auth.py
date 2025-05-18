from rest_framework_simplejwt.views import TokenObtainPairView
from .serializers import EmailTokenObtainPairSerializer
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView
from django.contrib.auth import get_user_model, password_validation
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
User = get_user_model()

class EmailTokenObtainView(TokenObtainPairView):
    serializer_class = EmailTokenObtainPairSerializer

class SignUpView(APIView):
    """
    POST  {email,password}  →  access / refresh / user‑info
    (username is **not** required or returned any longer)
    """
    permission_classes = [AllowAny]

    def post(self, request):
        email    = request.data.get("email", "").strip().lower()
        password = request.data.get("password", "")

        # ─── validation ───────────────────────────────────────────────
        if not (email and password):
            return Response(
                {"detail": "Email и пароль обязательны"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if User.objects.filter(email=email).exists():
            return Response(
                {"detail": "E‑mail уже зарегистрирован"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            password_validation.validate_password(password)
        except Exception as e:
            # e is a list of ValidationError objects
            return Response({"detail": list(e)}, status=400)

        # ─── create user (assumes your custom User uses email as USERNAME_FIELD) ─
        user = User.objects.create_user(username=email, email=email, password=password)

        # ─── Issue JWT pair right away ────────────────────────────────
        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "user": {"id": user.id, "email": user.email},
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            },
            status=201,
        )