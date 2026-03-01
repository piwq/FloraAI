import json
import os
import requests
from channels.generic.websocket import AsyncWebsocketConsumer
from asgiref.sync import sync_to_async
from django.contrib.auth import get_user_model
from .models import ChatSession, ChatMessage
from .services.yandex_gpt_client import get_agronomist_reply

User = get_user_model()


class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope['user']
        if not self.user.is_authenticated:
            await self.close()
            return

        self.session_id = self.scope['url_route']['kwargs']['session_id']

        if not await self.verify_session_access():
            await self.close()
            return

        self.room_group_name = f'chat_{self.session_id}'
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)
        message = data['message']

        # 1. Показываем на сайте
        await self.channel_layer.group_send(
            self.room_group_name,
            {'type': 'chat_message', 'role': 'user', 'message': message}
        )

        # 2. Пытаемся отправить в ТГ (С ЛОГАМИ)
        await self.send_to_telegram(message, 'user')

        # 3. Идем к ИИ
        ai_reply = await self.get_ai_response(message)

        # 4. Показываем на сайте
        await self.channel_layer.group_send(
            self.room_group_name,
            {'type': 'chat_message', 'role': 'assistant', 'message': ai_reply}
        )

        # 5. Пытаемся отправить в ТГ (С ЛОГАМИ)
        await self.send_to_telegram(ai_reply, 'assistant')

    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            'role': event['role'],
            'message': event['message'],
            'image': event.get('image')
        }))

    @sync_to_async
    def verify_session_access(self):
        return ChatSession.objects.filter(id=self.session_id, user=self.user).exists()

    @sync_to_async
    def get_ai_response(self, message):
        user = User.objects.get(id=self.user.id)
        session = ChatSession.objects.get(id=self.session_id, user=user)

        ChatMessage.objects.create(session=session, role='user', content=message)

        metrics = session.analysis.metrics if session.analysis else {}
        prompt = (
            f"Ты — профессиональный агроном FloraAI. Данные растения: "
            f"Культура: {metrics.get('plant_type', 'Неизвестно')}, "
            f"Площадь листьев: {metrics.get('leaf_area_cm2', '0')} см2."
        )

        past = list(reversed(ChatMessage.objects.filter(session=session).order_by('-created_at')[:10]))
        answer = get_agronomist_reply(prompt, past, message)

        ChatMessage.objects.create(session=session, role='assistant', content=answer)
        return answer

    @sync_to_async
    def send_to_telegram(self, text, role):
        try:
            bot_token = os.getenv('TELEGRAM_BOT_TOKEN')
            if not bot_token:
                print("❌ [TG] ОШИБКА: TELEGRAM_BOT_TOKEN не найден в окружении бэкенда!")
                return

            user = User.objects.get(id=self.user.id)
            if not user.telegram_id:
                print(
                    f"❌ [TG] ОШИБКА: У пользователя (ID: {user.id}, Email: {user.email}) НЕТ привязанного telegram_id в базе данных!")
                return

            prefix = "💻 Вы (с сайта):\n" if role == 'user' else "🧑‍🌾 Агроном:\n"

            print(f"🔄 [TG] Отправляю сообщение в ТГ (Chat ID: {user.telegram_id})...")

            response = requests.post(
                f"https://api.telegram.org/bot{bot_token}/sendMessage",
                json={"chat_id": user.telegram_id, "text": f"{prefix}{text}"},
                timeout=5
            )

            if response.status_code != 200:
                print(f"❌ [TG] ОШИБКА ОТ API TELEGRAM: {response.text}")
            else:
                print(f"✅ [TG] УСПЕХ: Сообщение успешно доставлено в Telegram!")

        except Exception as e:
            print(f"❌ [TG] КРИТИЧЕСКАЯ ОШИБКА В КОДЕ: {e}")