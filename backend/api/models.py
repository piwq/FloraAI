from django.db import models
from django.contrib.auth.models import AbstractUser


class User(AbstractUser):
    telegram_id = models.BigIntegerField(unique=True, null=True, blank=True)
    active_tg_session_id = models.IntegerField(null=True, blank=True)
    telegram_username = models.CharField(max_length=150, blank=True, null=True)
    is_premium = models.BooleanField(default=False)

    yolo_conf = models.FloatField(default=0.25, verbose_name="Уверенность (Confidence)")
    yolo_iou = models.FloatField(default=0.7, verbose_name="Порог перекрытия (IoU)")
    yolo_imgsz = models.IntegerField(default=1024, verbose_name="Размер фото для ИИ")

    color_leaf = models.CharField(max_length=7, default='#16A34A', verbose_name="Цвет листьев")  # Зеленый
    color_root = models.CharField(max_length=7, default='#9333EA', verbose_name="Цвет корней")  # Фиолетовый
    color_stem = models.CharField(max_length=7, default='#2563EB', verbose_name="Цвет стеблей")  # Синий

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
    image = models.ImageField(upload_to='chat_images/', null=True, blank=True)
    #annotated_image = models.ImageField(upload_to='chat_annotated/', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

class MessageAnnotation(models.Model):
    """История генераций разметок для конкретного сообщения"""
    message = models.ForeignKey(ChatMessage, on_delete=models.CASCADE, related_name='annotations')
    image = models.ImageField(upload_to='chat_annotated_history/')
    conf = models.FloatField(verbose_name="Уверенность (Confidence)")
    iou = models.FloatField(verbose_name="Порог перекрытия (IoU)")
    imgsz = models.IntegerField(verbose_name="Размер фото для ИИ")
    created_at = models.DateTimeField(auto_now_add=True)

    color_leaf = models.CharField(max_length=7, default='#16A34A')
    color_root = models.CharField(max_length=7, default='#9333EA')
    color_stem = models.CharField(max_length=7, default='#2563EB')

    class Meta:
        # Сортируем так, чтобы новые разметки всегда были первыми
        ordering = ['-created_at']

    def __str__(self):
        return f"Annotation for Msg #{self.message_id} (conf={self.conf}, iou={self.iou})"