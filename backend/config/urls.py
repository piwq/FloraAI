from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from api.views import ChatAPIView
from .views import PlantAnalysisViewSet

router = DefaultRouter()
router.register(r'analyses', PlantAnalysisViewSet, basename='analyses')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/chat/', ChatAPIView.as_view(), name='chat'),
    path('api/chat/', ChatAPIView.as_view(), name='chat_api'),
]
