import json, os, urllib.request
from rest_framework import viewsets, status, generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth import get_user_model
from .models import PlantAnalysis, ChatMessage, ChatSession
from .serializers import PlantAnalysisSerializer, UserSerializer, RegisterSerializer

User = get_user_model()


# --- 1. АВТОРИЗАЦИЯ ДЛЯ ВЕБ-САЙТА ---
class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = [permissions.AllowAny]
    serializer_class = RegisterSerializer


class UserProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


# --- 2. АНАЛИЗ ФОТОГРАФИЙ (ЗАГЛУШКА) ---
class PlantAnalysisViewSet(viewsets.ModelViewSet):
    queryset = PlantAnalysis.objects.all()
    serializer_class = PlantAnalysisSerializer

    def create(self, request, *args, **kwargs):
        image = request.FILES.get('original_image')

        # 1. Если пользователь авторизован (на сайте), берем его
        if request.user.is_authenticated:
            user = request.user
        else:
            # 2. Логика для Telegram-бота (если пользователь не вошел через веб)
            telegram_id = request.data.get('telegram_id')

            # Проверяем, что это число, чтобы не упасть с ошибкой ValueError
            if not telegram_id or not str(telegram_id).isdigit():
                return Response(
                    {"error": "telegram_id must be a number for non-authenticated users"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            user, _ = User.objects.get_or_create(
                telegram_id=int(telegram_id),
                defaults={'username': f"user_{telegram_id}"}
            )

        # 3. Создаем анализ
        analysis = PlantAnalysis.objects.create(
            user=user,
            original_image=image,
            status='COMPLETED',
            metrics={
                "plant_type": "Arugula (Руккола)",
                "leaf_area_cm2": 15.4,
                "root_length_mm": 120.5,
                "stem_diameter_mm": 4.2
            }
        )
        serializer = self.get_serializer(analysis)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

# --- 3. ЧАТ С АГРОНОМОМ YANDEX GPT ---
# backend/api/views.py

class ChatAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        # Ищем единственную сессию пользователя (или создаем её)
        session, _ = ChatSession.objects.get_or_create(user=request.user)
        # Получаем сообщения и возвращаем их в формате, который понимает фронтенд
        messages = session.messages.all().order_by('created_at')

        return Response([
            {
                "role": msg.role,
                "content": msg.content  # Убедись, что тут content, а не text
            } for msg in messages
        ])

    def post(self, request):
        user_message = request.data.get('message', '')
        metrics = request.data.get('metrics', {})

        session, _ = ChatSession.objects.get_or_create(user=request.user)

        # СОХРАНЯЕМ СООБЩЕНИЕ ПОЛЬЗОВАТЕЛЯ
        ChatMessage.objects.create(
            session=session,
            role='user',
            content=user_message
        )

        # ... (логика запроса к YandexGPT остается прежней) ...

        try:
            # После получения ответа от Яндекса:
            answer = json.loads(res.read())['result']['alternatives'][0]['message']['text']

            # СОХРАНЯЕМ ОТВЕТ АССИСТЕНТА
            ChatMessage.objects.create(
                session=session,
                role='assistant',
                content=answer
            )
            return Response({"reply": answer})
        except Exception as e:
            return Response({"reply": f"Ошибка: {str(e)}"}, status=500)