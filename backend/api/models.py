from django.db import models
from django.contrib.auth.models import AbstractUser


class User(AbstractUser):
    """Кастомная модель пользователя, чтобы легко привязать Telegram и лимиты"""
    telegram_id = models.BigIntegerField(unique=True, null=True, blank=True)
    is_premium = models.BooleanField(default=False)

    def __str__(self):
        return self.username or str(self.telegram_id)


class PlantAnalysis(models.Model):
    """Модель для хранения загруженной фотографии и результатов CV-модели"""
    STATUS_CHOICES = (
        ('PENDING', 'В обработке'),
        ('COMPLETED', 'Завершено'),
        ('FAILED', 'Ошибка'),
    )

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='analyses')
    original_image = models.ImageField(upload_to='plants/originals/')
    result_image = models.ImageField(upload_to='plants/results/', null=True, blank=True)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')

    # Сюда ML-сервис положит JSON с площадью листьев и длиной корней/стеблей
    metrics = models.JSONField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Analysis #{self.id} by {self.user}"


class ChatSession(models.Model):
    """Сессия диалога, привязанная к конкретному анализу растения"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='chat_sessions')
    analysis = models.ForeignKey(PlantAnalysis, on_delete=models.SET_NULL, null=True, blank=True, related_name='chats')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"ChatSession #{self.id} (Analysis #{self.analysis_id})"


class ChatMessage(models.Model):
    """Сообщения внутри сессии чата"""
    ROLE_CHOICES = (
        ('user', 'Пользователь'),
        ('assistant', 'ИИ-Ассистент'),
    )

    session = models.ForeignKey(ChatSession, on_delete=models.CASCADE, related_name='messages')
    role = models.CharField(max_length=15, choices=ROLE_CHOICES)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.role} at {self.created_at}"