from rest_framework import viewsets, status, generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from django.core.files.base import ContentFile
from .models import PlantAnalysis, ChatMessage, ChatSession
from .serializers import PlantAnalysisSerializer, UserSerializer, RegisterSerializer
import json, os, urllib.request, requests, base64

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
        username = request.data.get('username')
        message_id = request.data.get('message_id')

        if not telegram_id:
            return Response({"error": "telegram_id обязателен"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            tg_id_int = int(telegram_id)
        except ValueError:
            return Response({"error": "Некорректный ID"}, status=status.HTTP_400_BAD_REQUEST)

        existing_user = User.objects.filter(telegram_id=tg_id_int).exclude(id=request.user.id).first()
        if existing_user:
            if not existing_user.email:
                PlantAnalysis.objects.filter(user=existing_user).update(user=request.user)
                ChatSession.objects.filter(user=existing_user).update(user=request.user)
                existing_user.delete()
            else:
                return Response({"error": "Этот Telegram уже привязан к другому профилю"}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        user.telegram_id = tg_id_int
        user.telegram_username = username
        user.save()

        # ОТПРАВЛЯЕМ НОВУЮ ИНСТРУКЦИЮ В БОТ (ИСПРАВЛЕНО ФОРМАТИРОВАНИЕ)
        bot_token = os.getenv('TELEGRAM_BOT_TOKEN')
        if bot_token:
            import requests
            if message_id:
                try:
                    requests.post(f"https://api.telegram.org/bot{bot_token}/deleteMessage",
                                  json={"chat_id": tg_id_int, "message_id": int(message_id)}, timeout=5)
                except Exception:
                    pass

            msg = (
                "🤝 <b>Профиль FloraAI успешно привязан!</b>\n\n"
                "📸 Отправьте фото растения для анализа.\n"
                "💬 После анализа вы сможете задать вопросы агроному.\n\n"
                "👤 Используйте команду /me для просмотра профиля."
            )
            try:
                # ВАЖНО: parse_mode изменен на HTML
                requests.post(f"https://api.telegram.org/bot{bot_token}/sendMessage",
                              json={"chat_id": tg_id_int, "text": msg, "parse_mode": "HTML"}, timeout=5)
            except Exception:
                pass

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
        telegram_id = request.data.get('telegram_id')
        image = request.FILES.get('original_image')
        user = None

        if telegram_id:
            user, _ = User.objects.get_or_create(
                telegram_id=int(telegram_id),
                defaults={'username': f"tg_{telegram_id}"}
            )
        else:
            user = request.user if request.user.is_authenticated else None

        if not user:
            return Response({"error": "Unauthorized"}, status=401)

        is_linked = bool(user.email)
        if is_linked and not user.is_premium:
            if PlantAnalysis.objects.filter(user=user).count() >= 3:
                return Response({"error": "limit_reached"}, status=403)

        image.seek(0)
        files = {'file': (image.name, image.read(), image.content_type)}

        user_conf = user.yolo_conf if hasattr(user, 'yolo_conf') else 0.25
        user_iou = user.yolo_iou if hasattr(user, 'yolo_iou') else 0.7
        user_imgsz = user.yolo_imgsz if hasattr(user, 'yolo_imgsz') else 640

        data_payload = {
            'conf': user_conf,
            'iou': user_iou,
            'imgsz': user_imgsz
        }

        ml_data = {
            "plant_type": "Неизвестно",
            "leaf_area_cm2": 0,
            "root_length_mm": 0,
            "stem_length_mm": 0
        }
        annotated_image_content = None

        try:
            ml_response = requests.post(
                "http://flora_ml:8001/predict",
                files=files,
                data=data_payload,
                timeout=40
            )
            if ml_response.status_code == 200:
                response_json = ml_response.json()

                img_b64 = response_json.pop('annotated_image_base64', None)
                if img_b64:
                    image_data = base64.b64decode(img_b64)
                    annotated_image_content = ContentFile(image_data, name=f"annotated_{image.name}")

                ml_data = response_json
        except Exception as e:
            print(f"ML Error: {e}")

        image.seek(0)

        analysis = PlantAnalysis.objects.create(
            user=user,
            original_image=image,
            status='COMPLETED',
            metrics=ml_data
        )

        if annotated_image_content:
            analysis.annotated_image.save(annotated_image_content.name, annotated_image_content, save=True)

        session = ChatSession.objects.create(user=user, analysis=analysis)

        bot_reply = (
            f"✅ **Анализ завершен!**\n\n"
            f"🌿 Культура: {analysis.metrics.get('plant_type', 'Неизвестно')}\n"
            f"📏 Площадь листьев: {analysis.metrics.get('leaf_area_cm2', 0)} см²\n"
            f"📏 Длина корня: {analysis.metrics.get('root_length_mm', 0)} мм\n"
            f"📏 Длина стебля: {analysis.metrics.get('stem_length_mm', 0)} мм"
        )

        ChatMessage.objects.create(session=session, role='assistant', content=bot_reply)

        response_data = self.get_serializer(analysis).data
        response_data['session_id'] = session.id
        response_data['bot_reply'] = bot_reply
        response_data['is_linked'] = is_linked

        return Response(response_data, status=201)

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
        session_id = request.data.get('session_id')
        message = request.data.get('message', '')
        telegram_id = request.data.get('telegram_id')

        if not session_id or not message:
            return Response({"error": "Missing parameters"}, status=status.HTTP_400_BAD_REQUEST)

        user = None
        if telegram_id:
            user = User.objects.filter(telegram_id=int(telegram_id)).first()
        elif request.user.is_authenticated:
            user = request.user

        if not user:
            return Response({"error": "Unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)

        session = get_object_or_404(ChatSession, id=session_id, user=user)

        ChatMessage.objects.create(session=session, role='user', content=message)

        metrics = session.analysis.metrics if session.analysis else {}
        system_prompt = (
            f"Ты — профессиональный агроном FloraAI. Данные растения: "
            f"Культура: {metrics.get('plant_type', 'Неизвестно')}, "
            f"Площадь листьев: {metrics.get('leaf_area_cm2', '0')} см2. "
            f"Отвечай кратко, экспертно и давай полезные советы по уходу."
        )

        api_key = os.getenv("YANDEX_API_KEY")
        folder_id = os.getenv("YANDEX_FOLDER_ID")

        if not api_key or not folder_id:
            answer = f"Ответ (Заглушка). Нейросеть отключена. Вы спросили: {message}"
            ChatMessage.objects.create(session=session, role='assistant', content=answer)
            return Response({"reply": answer, "session_id": session.id})

        past_messages = ChatMessage.objects.filter(session=session).order_by('-created_at')[:10]
        past_messages = reversed(past_messages)

        yandex_messages = [{"role": "system", "text": system_prompt}]
        for msg in past_messages:
            yandex_messages.append({"role": msg.role, "text": msg.content})

        url = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion"
        headers = {"Content-Type": "application/json", "Authorization": f"Api-Key {api_key}"}
        data = {
            "modelUri": f"gpt://{folder_id}/yandexgpt/latest",
            "completionOptions": {"temperature": 0.3, "maxTokens": 1000},
            "messages": yandex_messages
        }

        try:
            import urllib.request
            import json
            req = urllib.request.Request(url, headers=headers, data=json.dumps(data).encode())
            with urllib.request.urlopen(req) as res:
                response_json = json.loads(res.read())
                answer = response_json['result']['alternatives'][0]['message']['text']

                # Сохраняем ответ ИИ
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


class BotProfileView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        tg_id = request.query_params.get('telegram_id')
        if not tg_id:
            return Response({"error": "Missing telegram_id"}, status=400)

        user = User.objects.filter(telegram_id=tg_id).first()
        if not user or not user.email:
            return Response({"is_linked": False})

        analyses_count = PlantAnalysis.objects.filter(user=user).count()
        return Response({
            "is_linked": True,
            "email": user.email,
            "username": user.telegram_username,
            "subscription": "PREMIUM" if user.is_premium else "FREE",
            "analyses_count": analyses_count,
            # Отдаем настройки ИИ боту
            "yolo_conf": user.yolo_conf if hasattr(user, 'yolo_conf') else 0.25,
            "yolo_iou": user.yolo_iou if hasattr(user, 'yolo_iou') else 0.7,
            "yolo_imgsz": user.yolo_imgsz if hasattr(user, 'yolo_imgsz') else 640
        })

    def patch(self, request):
        # Метод для сохранения настроек, которые пришлет бот
        tg_id = request.data.get('telegram_id')
        if not tg_id:
            return Response({"error": "Missing telegram_id"}, status=400)

        user = User.objects.filter(telegram_id=tg_id).first()
        if not user:
            return Response({"error": "User not found"}, status=404)

        if 'yolo_conf' in request.data:
            user.yolo_conf = float(request.data['yolo_conf'])
        if 'yolo_iou' in request.data:
            user.yolo_iou = float(request.data['yolo_iou'])
        if 'yolo_imgsz' in request.data:
            user.yolo_imgsz = int(request.data['yolo_imgsz'])

        user.save()
        return Response({"status": "success"})

class BotHistoryView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        tg_id = request.query_params.get('telegram_id')
        if not tg_id:
            return Response({"error": "Missing telegram_id"}, status=400)

        user = User.objects.filter(telegram_id=tg_id).first()
        if not user or not user.email:
            return Response({"history": []})

        sessions = ChatSession.objects.filter(user=user).order_by('-created_at')[:5]

        history = []
        for s in sessions:
            plant_name = "Неизвестное растение"
            if s.analysis and s.analysis.metrics and 'plant_type' in s.analysis.metrics:
                plant_name = s.analysis.metrics['plant_type']

            history.append({
                "id": str(s.id),
                "title": plant_name,
                "date": s.created_at.strftime("%d.%m")
            })

        return Response({"history": history})

class LogoutView(APIView):
    permission_classes = [permissions.AllowAny]
    def post(self, request):
        return Response({"status": "success"})