import aiohttp
import os

BASE_URL = os.getenv('API_URL', 'http://backend:8000/api')  # Имя контейнера бэкенда в Docker


async def upload_photo_to_api(telegram_id: int, photo_bytes: bytes, filename: str):
    """Отправляет фото на анализ и создает новый чат"""
    async with aiohttp.ClientSession() as session:
        data = aiohttp.FormData()
        data.add_field('telegram_id', str(telegram_id))
        data.add_field('original_image', photo_bytes, filename=filename)

        async with session.post(f"{BASE_URL}/analyses/", data=data) as resp:
            return await resp.json(), resp.status


async def send_chat_message_to_api(telegram_id: int, message: str, session_id: int):
    """Отправляет текст в уже существующий чат (по session_id)"""
    async with aiohttp.ClientSession() as session:
        json_data = {
            "telegram_id": telegram_id,
            "message": message,
            "session_id": session_id
        }
        async with session.post(f"{BASE_URL}/chat/", json=json_data) as resp:
            return await resp.json(), resp.status

async def get_bot_profile(telegram_id: int):
    async with aiohttp.ClientSession() as session:
        try:
            async with session.get(f"{BASE_URL}/bot/profile/?telegram_id={telegram_id}") as resp:
                if resp.status == 200:
                    return await resp.json()
        except Exception as e:
            print(f"Ошибка получения профиля: {e}")
        return None

async def get_bot_history(telegram_id: int):
    async with aiohttp.ClientSession() as session:
        try:
            # ИСПРАВЛЕНО: API_URL заменено на BASE_URL
            async with session.get(f"{BASE_URL}/bot/history/?telegram_id={telegram_id}") as resp:
                if resp.status == 200:
                    return await resp.json()
        except Exception as e:
            print(f"Ошибка получения истории: {e}")
        return None