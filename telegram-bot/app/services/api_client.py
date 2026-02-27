import os
import aiohttp

API_BASE_URL = os.getenv('API_BASE_URL', 'http://backend:8000/api')


async def upload_plant_photo(telegram_id: int, photo_bytes: bytes, filename="plant.jpg"):
    """Отправляет картинку на Django и получает моковые замеры"""
    async with aiohttp.ClientSession() as session:
        data = aiohttp.FormData()
        data.add_field('telegram_id', str(telegram_id))
        data.add_field('original_image', photo_bytes, filename=filename, content_type='image/jpeg')

        url = f"{API_BASE_URL}/analyses/"
        try:
            async with session.post(url, data=data) as response:
                if response.status in (200, 201):
                    return await response.json()
                print(f"Ошибка API: {response.status}")
                return None
        except Exception as e:
            print(f"Ошибка соединения: {e}")
            return None


async def send_chat_message(telegram_id: int, text: str):
    """Позже здесь будет отправка текста в YandexGPT через Django"""
    # Пока делаем заглушку для теста диалога
    return f"Вы спросили: «{text}». Я агроном FloraAI, скоро тут будет ответ от нейросети!"