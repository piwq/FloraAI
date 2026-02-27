import json, os, urllib.request
from rest_framework import viewsets, status, generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
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


# --- 2. АНАЛИЗ ФОТОГРАФИЙ ---
class PlantAnalysisViewSet(viewsets.ModelViewSet):
    queryset = PlantAnalysis.objects.all()
    serializer_class = PlantAnalysisSerializer

    def create(self, request, *args, **kwargs):
        image = request.FILES.get('original_image')

        if request.user.is_authenticated:
            user = request.user
        else:
            telegram_id = request.data.get('telegram_id')
            if not telegram_id or not str(telegram_id).isdigit():
                return Response(
                    {"error": "telegram_id must be a number for non-authenticated users"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            user, _ = User.objects.get_or_create(
                telegram_id=int(telegram_id),
                defaults={'username': f"user_{telegram_id}"}
            )

        # 1. Создаем анализ
        analysis = PlantAnalysis.objects.create(
            user=user, original_image=image, status='COMPLETED',
            metrics={"plant_type": "Arugula (Руккола)", "leaf_area_cm2": 15.4, "root_length_mm": 120.5, "stem_diameter_mm": 4.2}
        )

        # 2. Создаем сессию чата
        session = ChatSession.objects.create(user=user, analysis=analysis)

        # 3. СОХРАНЯЕМ СТАРТОВЫЕ СООБЩЕНИЯ В БАЗУ!
        ChatMessage.objects.create(session=session, role='user', content=f"📎 Отправлено фото: {image.name}")
        bot_reply = (
            f"✅ **Анализ завершен!**\n\n"
            f"🌿 Культура: {analysis.metrics['plant_type']}\n"
            f"📏 Площадь листьев: {analysis.metrics['leaf_area_cm2']} см²\n"
            f"📏 Длина корня: {analysis.metrics['root_length_mm']} мм\n\n"
            f"Задайте вопрос агроному!"
        )
        ChatMessage.objects.create(session=session, role='assistant', content=bot_reply)

        # 4. Возвращаем данные анализа + ID новой сессии
        serializer = self.get_serializer(analysis)
        response_data = serializer.data
        response_data['session_id'] = session.id
        return Response(response_data, status=status.HTTP_201_CREATED)


# --- 3. ЧАТ С АГРОНОМОМ YANDEX GPT ---
class ChatAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """Отдает список чатов для Сайдбара"""
        sessions = ChatSession.objects.filter(user=request.user).order_by('-created_at')
        return Response([
            {
                "id": s.id,
                "title": f"{s.analysis.metrics.get('plant_type', 'Растение')} (Анализ #{s.analysis.id})" if s.analysis else "Новый чат",
                "created_at": s.created_at
            } for s in sessions
        ])

    def post(self, request):
        """Отправляет текстовое сообщение в существующий чат"""
        user_message = request.data.get('message', '')
        session_id = request.data.get('session_id')

        # Теперь текстовое сообщение без session_id (без фото) отправить нельзя
        if not session_id:
            return Response({"error": "Чат можно начать только с отправки фото."}, status=status.HTTP_400_BAD_REQUEST)

        session = get_object_or_404(ChatSession, id=session_id, user=request.user)
        ChatMessage.objects.create(session=session, role='user', content=user_message)

        # Берем метрики напрямую из базы, фронтенду больше не нужно их присылать!
        metrics = session.analysis.metrics if session.analysis else {}
        system_prompt = (
            f"Ты — профессиональный агроном FloraAI. Данные растения: "
            f"Культура: {metrics.get('plant_type', 'Неизвестно')}, "
            f"Площадь листьев: {metrics.get('leaf_area_cm2', '0')} см2. "
            f"Отвечай кратко и давай советы по уходу."
        )

        api_key = os.getenv("YANDEX_API_KEY")
        folder_id = os.getenv("YANDEX_FOLDER_ID")

        if not api_key or not folder_id:
            answer = f"Ответ (Заглушка). Нейросеть отключена. Вы спросили: {user_message}"
            ChatMessage.objects.create(session=session, role='assistant', content=answer)
            return Response({"reply": answer, "session_id": session.id})

        url = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion"
        headers = {"Content-Type": "application/json", "Authorization": f"Api-Key {api_key}"}
        data = {
            "modelUri": f"gpt://{folder_id}/yandexgpt/latest",
            "completionOptions": {"temperature": 0.3, "maxTokens": 1000},
            "messages": [{"role": "system", "text": system_prompt}, {"role": "user", "text": user_message}]
        }

        try:
            req = urllib.request.Request(url, headers=headers, data=json.dumps(data).encode())
            with urllib.request.urlopen(req) as res:
                response_json = json.loads(res.read())
                answer = response_json['result']['alternatives'][0]['message']['text']
                ChatMessage.objects.create(session=session, role='assistant', content=answer)
                return Response({"reply": answer, "session_id": session.id})
        except Exception as e:
            return Response({"reply": f"⚠️ Ошибка связи с Яндекс: {str(e)}"}, status=500)


# --- 4. ИСТОРИЯ КОНКРЕТНОГО ЧАТА ---
class ChatDetailAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, session_id):
        session = get_object_or_404(ChatSession, id=session_id, user=request.user)
        messages = session.messages.all().order_by('created_at')
        return Response([
            {"role": m.role, "content": m.content} for m in messages
        ])

    def delete(self, request, session_id):
        session = get_object_or_404(ChatSession, id=session_id, user=request.user)

        session.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)