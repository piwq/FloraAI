import json, os, requests
from channels.generic.websocket import AsyncWebsocketConsumer
from asgiref.sync import sync_to_async
from .models import ChatSession, ChatMessage
from .services.yandex_gpt_client import get_agronomist_reply


class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope['user']

        if not self.user.is_authenticated:
            await self.close()
            return

        self.session_id = self.scope['url_route']['kwargs']['session_id']

        has_access = await self.verify_session_access()
        if not has_access:
            await self.close()
            return

        self.room_group_name = f'chat_{self.session_id}'
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)

        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data):
        text_data_json = json.loads(text_data)
        message = text_data_json['message']

        # 1. Отправляем сообщение пользователя в веб-сокет (на сайт)
        await self.channel_layer.group_send(
            self.room_group_name,
            {'type': 'chat_message', 'role': 'user', 'message': message}
        )

        # --- НОВОЕ: Дублируем вопрос пользователя в ТГ ---
        await self.send_to_telegram(message, 'user')

        # 2. Идем в базу и к ИИ
        ai_reply = await self.get_ai_response(message)

        # 3. Отправляем ответ ИИ в веб-сокет (на сайт)
        await self.channel_layer.group_send(
            self.room_group_name,
            {'type': 'chat_message', 'role': 'assistant', 'message': ai_reply}
        )

        # --- НОВОЕ: Дублируем ответ ИИ в ТГ ---
        await self.send_to_telegram(ai_reply, 'assistant')

    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            'role': event['role'],
            'message': event['message']
        }))


    @sync_to_async
    def verify_session_access(self):
        try:
            ChatSession.objects.get(id=self.session_id, user=self.user)
            return True
        except ChatSession.DoesNotExist:
            return False

    @sync_to_async
    def get_ai_response(self, message):
        session = ChatSession.objects.get(id=self.session_id)

        ChatMessage.objects.create(session=session, role='user', content=message)

        metrics = session.analysis.metrics if session.analysis else {}
        system_prompt = (
            f"Ты — профессиональный агроном FloraAI. Данные растения: "
            f"Культура: {metrics.get('plant_type', 'Неизвестно')}, "
            f"Площадь листьев: {metrics.get('leaf_area_cm2', '0')} см2. "
            f"Отвечай кратко, экспертно и давай полезные советы по уходу."
        )

        past_messages = list(reversed(ChatMessage.objects.filter(session=session).order_by('-created_at')[:10]))

        answer = get_agronomist_reply(system_prompt, past_messages, message)

        ChatMessage.objects.create(session=session, role='assistant', content=answer)

        return answer

    @sync_to_async
    def send_to_telegram(self, text, role):
        if not self.user.telegram_id:
            return

        bot_token = os.getenv('TELEGRAM_BOT_TOKEN')
        if not bot_token:
            return

        if role == 'user':
            prefix = f"💻 <b>Вы (с сайта, чат #{self.session_id}):</b>\n"
        else:
            prefix = f"🧑‍🌾 <b>Агроном (ответ на сайте):</b>\n"

        try:
            requests.post(
                f"https://api.telegram.org/bot{bot_token}/sendMessage",
                json={
                    "chat_id": self.user.telegram_id,
                    "text": f"{prefix}{text}",
                    "parse_mode": "HTML"
                },
                timeout=5
            )
        except Exception as e:
            print(f"Ошибка отправки в ТГ: {e}")