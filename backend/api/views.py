from rest_framework import viewsets, status, generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from .models import PlantAnalysis, ChatMessage, ChatSession
from .serializers import PlantAnalysisSerializer, UserSerializer, RegisterSerializer
import json, os, urllib.request
import requests

User = get_user_model()


# --- 1. АВТОРИЗАЦИЯ И ПРОФИЛЬ ---
class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = [permissions.AllowAny]
    serializer_class = RegisterSerializer


class UserProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user

    def update(self, request, *args, **kwargs):
        # Копируем данные, чтобы можно было их изменить
        data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)

        # Если юзер очистил дату, в БД пишем None
        if data.get('birthDate') == '':
            data['birthDate'] = None

        serializer = self.get_serializer(self.get_object(), data=data, partial=True)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(serializer.data)


class ChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        current_password = request.data.get('currentPassword')
        new_password = request.data.get('newPassword')

        if not current_password or not new_password:
            return Response({"error": "Укажите текущий и новый пароли"}, status=status.HTTP_400_BAD_REQUEST)

        if not user.check_password(current_password):
            return Response({"error": "Неверный текущий пароль"}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save()
        return Response({"status": "success", "message": "Пароль успешно изменен"})


class LinkTelegramView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        telegram_id = request.data.get('telegram_id')
        if not telegram_id:
            return Response({"error": "telegram_id обязателен"}, status=status.HTTP_400_BAD_REQUEST)

        # Проверка уникальности
        if User.objects.filter(telegram_id=telegram_id).exclude(id=request.user.id).exists():
            return Response({"error": "Этот Telegram уже привязан к другому аккаунту"},
                            status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        user.telegram_id = int(telegram_id)
        user.save()

        bot_token = os.getenv('TELEGRAM_BOT_TOKEN')
        if bot_token:
            msg_text = "✅ **Аккаунт успешно привязан!**\n\nТеперь вам доступно общение с ИИ-агрономом после анализа фото. Все ваши чаты будут синхронизированы с сайтом.\n\nОжидаю ваше фото для анализа! 🌿"
            url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
            try:
                requests.post(url, json={"chat_id": telegram_id, "text": msg_text, "parse_mode": "Markdown"})
            except Exception as e:
                print(f"Ошибка отправки уведомления в ТГ: {e}")

        return Response({"status": "success"})

class MockSubscribeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        user.is_premium = True
        user.save()
        return Response({"status": "success", "message": "Premium подписка успешно активирована!"})


# --- 2. АНАЛИЗ ФОТОГРАФИЙ ---
class PlantAnalysisViewSet(viewsets.ModelViewSet):
    queryset = PlantAnalysis.objects.all()
    serializer_class = PlantAnalysisSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        if self.request.user.is_authenticated:
            return PlantAnalysis.objects.filter(user=self.request.user).order_by('-created_at')
        return PlantAnalysis.objects.none()

    def create(self, request, *args, **kwargs):
        is_from_bot = 'telegram_id' in request.data
        user = request.user

        if not is_from_bot and user.is_authenticated and not user.is_premium:
            if PlantAnalysis.objects.filter(user=user).count() >= 3:
                return Response({"error": "limit_reached"}, status=403)

        if user.is_authenticated and not user.is_premium:
            analysis_count = PlantAnalysis.objects.filter(user=user).count()
            if analysis_count >= 3:
                return Response({
                    "error": "limit_reached",
                    "message": "Лимит бесплатных анализов исчерпан."
                }, status=status.HTTP_403_FORBIDDEN)

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
        response_data['bot_reply'] = bot_reply
        return Response(response_data, status=status.HTTP_201_CREATED)


# --- 3. ЧАТ С АГРОНОМОМ YANDEX GPT ---
class ChatAPIView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        if not request.user.is_authenticated:
            return Response(status=status.HTTP_401_UNAUTHORIZED)
        sessions = ChatSession.objects.filter(user=request.user).order_by('-created_at')
        return Response([
            {
                "id": s.id,
                "title": f"{s.analysis.metrics.get('plant_type', 'Растение')} (Анализ #{s.analysis.id})" if s.analysis else "Новый чат",
                "created_at": s.created_at
            } for s in sessions
        ])

    def post(self, request):
        user = request.user
        telegram_id = request.data.get('telegram_id')

        if not user.is_authenticated:
            if telegram_id:
                user = get_object_or_404(User, telegram_id=int(telegram_id))
            else:
                return Response({"error": "Требуется авторизация"}, status=status.HTTP_401_UNAUTHORIZED)

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

class MockSubscribeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        user.is_premium = True
        user.save()
        return Response({"status": "success", "message": "Premium подписка успешно активирована!"})