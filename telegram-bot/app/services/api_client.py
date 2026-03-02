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


async def send_chat_message_to_api(telegram_id: int, message: str, session_id: int, photo_bytes: bytes = None,
                                   filename: str = None):
    async with aiohttp.ClientSession() as session:
        data = aiohttp.FormData()
        data.add_field('telegram_id', str(telegram_id))
        data.add_field('session_id', str(session_id))

        if message:
            data.add_field('message', message)

        if photo_bytes:
            data.add_field('image', photo_bytes, filename=filename)

        async with session.post(f"{BASE_URL}/chat/", data=data) as resp:
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

async def update_bot_settings(telegram_id: int, settings: dict):
    """Отправляет новые настройки ИИ на бэкенд"""
    async with aiohttp.ClientSession() as session:
        try:
            payload = {"telegram_id": telegram_id, **settings}
            async with session.patch(f"{BASE_URL}/bot/profile/", json=payload) as resp:
                return resp.status == 200
        except Exception as e:
            print(f"Ошибка обновления настроек: {e}")
            return False

async def delete_bot_session(telegram_id: int, session_id: str):
    """Удаляет конкретный анализ из истории"""
    async with aiohttp.ClientSession() as session:
        try:
            # Отправляем DELETE запрос на бэкенд
            async with session.delete(f"{BASE_URL}/bot/history/?telegram_id={telegram_id}&session_id={session_id}") as resp:
                return resp.status == 200
        except Exception as e:
            print(f"Ошибка удаления: {e}")
            return False

async def set_active_session(telegram_id: int, session_id: int = None):
    async with aiohttp.ClientSession() as session:
        payload = {"telegram_id": telegram_id, "session_id": session_id}
        async with session.post(f"{BASE_URL}/chat/set_active/", json=payload) as resp:
            return resp.status == 200