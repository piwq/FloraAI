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

        await self.channel_layer.group_send(self.room_group_name,
                                            {'type': 'chat_message', 'role': 'user', 'message': message})
        await self.send_to_telegram(message, 'user')

        # Получаем текст, URL для сайта и физический путь для отправки в ТГ
        ai_reply, ai_img_url, ai_img_path = await self.get_ai_response(message)

        await self.channel_layer.group_send(self.room_group_name,
                                            {'type': 'chat_message', 'role': 'assistant', 'message': ai_reply,
                                             'image': ai_img_url})
        await self.send_to_telegram(ai_reply, 'assistant', ai_img_path)

    async def chat_message(self, event):
        await self.send(
            text_data=json.dumps({'role': event['role'], 'message': event['message'], 'image': event.get('image')}))

    @sync_to_async
    def verify_session_access(self):
        return ChatSession.objects.filter(id=self.session_id, user=self.user).exists()

    @sync_to_async
    def get_ai_response(self, message):
        session = ChatSession.objects.get(id=self.session_id)
        ChatMessage.objects.create(session=session, role='user', content=message)

        # --- ЛОГИКА: ЗАПРОС РАЗМЕТКИ ---
        if "покажи разметку" in message.lower() or "покажи фото" in message.lower():
            last_photo = ChatMessage.objects.filter(session=session, annotated_image__isnull=False).order_by(
                '-created_at').first()
            if last_photo:
                bot_reply = "Вот результаты визуального анализа нейросети:"
                bot_msg = ChatMessage.objects.create(session=session, role='assistant', content=bot_reply)
                bot_msg.image = last_photo.annotated_image  # Достаем из заначки
                bot_msg.save()
                return bot_reply, bot_msg.image.url, bot_msg.image.path
            else:
                bot_reply = "В этом чате еще нет проанализированных фотографий."
                ChatMessage.objects.create(session=session, role='assistant', content=bot_reply)
                return bot_reply, None, None

        # --- ОБЫЧНЫЙ ОТВЕТ GPT ---
        metrics = session.analysis.metrics if session.analysis else {}
        prompt = f"Ты — агроном FloraAI. Данные: {metrics.get('plant_type', 'Неизвестно')}..."
        past = list(reversed(ChatMessage.objects.filter(session=session).order_by('-created_at')[:10]))

        answer = get_agronomist_reply(prompt, past, message)
        ChatMessage.objects.create(session=session, role='assistant', content=answer)
        return answer, None, None

    @sync_to_async
    def send_to_telegram(self, text, role, image_path=None):
        if not self.user.telegram_id: return
        bot_token = os.getenv('TELEGRAM_BOT_TOKEN')
        if not bot_token: return

        prefix = "💻 Вы (с сайта):\n" if role == 'user' else "🧑‍🌾 Агроном:\n"
        try:
            if image_path and os.path.exists(image_path):
                with open(image_path, 'rb') as f:
                    requests.post(f"https://api.telegram.org/bot{bot_token}/sendPhoto",
                                  data={"chat_id": self.user.telegram_id, "caption": f"{prefix}{text}"},
                                  files={"photo": f}, timeout=5)
            else:
                requests.post(f"https://api.telegram.org/bot{bot_token}/sendMessage",
                              json={"chat_id": self.user.telegram_id, "text": f"{prefix}{text}"}, timeout=5)
        except Exception as e:
            print(f"TG Forward Error: {e}")