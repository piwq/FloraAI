import json, os, urllib.request
from rest_framework import viewsets, status, generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth import get_user_model
from .models import PlantAnalysis, ChatMessage, ChatSession
from .serializers import PlantAnalysisSerializer, UserSerializer, RegisterSerializer
from django.shortcuts import get_object_or_404

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

        analysis = PlantAnalysis.objects.create(
            user=user, original_image=image, status='COMPLETED',
            metrics={"plant_type": "Arugula (Руккола)", "leaf_area_cm2": 15.4, "root_length_mm": 120.5,
                     "stem_diameter_mm": 4.2}
        )

        ChatSession.objects.create(user=user, analysis=analysis)

        serializer = self.get_serializer(analysis)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

class ChatAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """Отдает список чатов для Сайдбара (не сами сообщения)"""
        sessions = ChatSession.objects.filter(user=request.user).order_by('-created_at')
        return Response([
            {
                "id": s.id,
                "title": f"Анализ #{s.analysis.id} ({s.analysis.metrics.get('plant_type', 'Растение')})" if s.analysis else "Новый чат",
                "created_at": s.created_at
            } for s in sessions
        ])

    def post(self, request):
        """Отправляет сообщение. Если нет session_id — создает новый чат"""
        user_message = request.data.get('message', '')
        metrics = request.data.get('metrics', {})
        session_id = request.data.get('session_id')

        if session_id:
            session = get_object_or_404(ChatSession, id=session_id, user=request.user)
        else:
            session = ChatSession.objects.create(user=request.user)

        # Сохраняем вопрос юзера
        ChatMessage.objects.create(session=session, role='user', content=user_message)

        system_prompt = (
            f"Ты — профессиональный агроном FloraAI. Данные растения: "
            f"Культура: {metrics.get('plant_type', 'Неизвестно')}, "
            f"Площадь листьев: {metrics.get('leaf_area_cm2', '0')} см2, "
            f"Длина корня: {metrics.get('root_length_mm', '0')} мм. "
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

                # Сохраняем ответ ИИ
                ChatMessage.objects.create(session=session, role='assistant', content=answer)
                return Response({"reply": answer, "session_id": session.id})
        except Exception as e:
            return Response({"reply": f"⚠️ Ошибка связи с Яндекс: {str(e)}"}, status=500)

class ChatDetailAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, session_id):
        messages = ChatMessage.objects.filter(session_id=session_id, session__user=request.user).order_by('created_at')
        return Response([{"role": m.role, "content": m.content} for m in messages])

class ChatDetailAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, session_id):
        session = get_object_or_404(ChatSession, id=session_id, user=request.user)
        messages = session.messages.all().order_by('created_at')
        return Response([
            {"role": m.role, "content": m.content} for m in messages
        ])