from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView
from api.views import (
    ChatAPIView, PlantAnalysisViewSet, RegisterView,
    UserProfileView, ChatDetailAPIView, LinkTelegramView,
    ChangePasswordView, MockSubscribeView, BotProfileView, BotHistoryView, LogoutView, SetActiveSessionView
)
from django.conf import settings
from django.conf.urls.static import static

router = DefaultRouter()
router.register(r'analyses', PlantAnalysisViewSet, basename='analyses')

urlpatterns = [
    path('admin/', admin.site.urls),

    # Роуты авторизации и профиля
    path('api/auth/register', RegisterView.as_view(), name='auth_register'),
    path('api/auth/login', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/me', UserProfileView.as_view(), name='auth_me'),
    path('api/auth/change-password', ChangePasswordView.as_view(), name='change_password'),
    path('api/auth/logout/', LogoutView.as_view(), name='auth_logout'),

    # Роуты бота, чата и оплаты
    path('api/', include(router.urls)),
    path('api/chat/', ChatAPIView.as_view(), name='chat'),
    path('api/chat/<int:session_id>/', ChatDetailAPIView.as_view(), name='chat-detail'),
    path('api/auth/telegram/link/', LinkTelegramView.as_view(), name='link-telegram'),
    path('api/payment/mock-subscribe', MockSubscribeView.as_view(), name='mock-subscribe'),
    path('api/bot/profile/', BotProfileView.as_view(), name='bot-profile'),
    path('api/bot/history/', BotHistoryView.as_view(), name='bot-history'),
    path('chat/set_active/', SetActiveSessionView.as_view(), name='set_active_session'),
]

# ВАЖНО: Учим Django раздавать медиафайлы (картинки)!
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)