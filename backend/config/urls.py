from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from api.views import ChatAPIView, PlantAnalysisViewSet, RegisterView, UserProfileView, ChatDetailAPIView
from rest_framework_simplejwt.views import TokenObtainPairView

router = DefaultRouter()
router.register(r'analyses', PlantAnalysisViewSet, basename='analyses')

urlpatterns = [
    path('admin/', admin.site.urls),

    # Роуты для авторизации (React)
    path('api/auth/register', RegisterView.as_view(), name='auth_register'),
    path('api/auth/login', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/me', UserProfileView.as_view(), name='auth_me'),

    # Роуты функционала бота и чата
    path('api/', include(router.urls)),
    path('api/chat/', ChatAPIView.as_view(), name='chat'),
    path('api/chat/<int:session_id>/', ChatDetailAPIView.as_view(), name='chat-detail'),
]