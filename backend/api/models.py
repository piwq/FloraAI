from django.db import models
from django.contrib.auth.models import AbstractUser


class User(AbstractUser):
    telegram_id = models.BigIntegerField(unique=True, null=True, blank=True)
    telegram_username = models.CharField(max_length=150, blank=True, null=True)
    is_premium = models.BooleanField(default=False)

    # ДОБАВЛЯЕМ ПОЛЕ ДЛЯ ФРОНТЕНДА
    birth_date = models.DateField(null=True, blank=True)

    def __str__(self):
        return self.username


class PlantAnalysis(models.Model):
    """Результаты анализа растения"""
    STATUS_CHOICES = (
        ('PENDING', 'В обработке'),
        ('COMPLETED', 'Завершено'),
        ('FAILED', 'Ошибка'),
    )

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='analyses')
    original_image = models.ImageField(upload_to='plants/originals/')
    result_image = models.ImageField(upload_to='plants/results/', null=True, blank=True)
    annotated_image = models.ImageField(upload_to='analyses/annotated/', null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    metrics = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Analysis #{self.id} for {self.user.username}"


class ChatSession(models.Model):
    """Сессия диалога"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='chat_sessions')
    # Делаем связь с анализом более явной
    analysis = models.OneToOneField(PlantAnalysis, on_delete=models.CASCADE, null=True, blank=True, related_name='chat')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Chat for Analysis #{self.analysis_id}"


class ChatMessage(models.Model):
    """Сообщения внутри чата"""
    ROLE_CHOICES = (
        ('user', 'Пользователь'),
        ('assistant', 'ИИ-Ассистент'),
    )

    session = models.ForeignKey(ChatSession, on_delete=models.CASCADE, related_name='messages')
    role = models.CharField(max_length=15, choices=ROLE_CHOICES)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)