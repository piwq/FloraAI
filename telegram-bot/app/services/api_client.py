import os
import aiohttp

API_BASE_URL = os.getenv('API_BASE_URL', 'http://backend:8000/api')


async def upload_plant_photo(telegram_id: int, photo_bytes: bytes, filename="plant.jpg"):
    async with aiohttp.ClientSession() as session:
        data = aiohttp.FormData()
        data.add_field('telegram_id', str(telegram_id))
        data.add_field('original_image', photo_bytes, filename=filename, content_type='image/jpeg')

        url = f"{API_BASE_URL}/analyses/"
        async with session.post(url, data=data) as response:
            return await response.json()

async def send_chat_message(telegram_id: int, text: str, metrics: dict):
    """Отправляет вопрос и контекст (метрики) на бэкенд к YandexGPT"""
    async with aiohttp.ClientSession() as session:
        url = f"{API_BASE_URL}/chat/"
        payload = {
            "telegram_id": telegram_id,
            "message": text,
            "metrics": metrics
        }
        try:
            async with session.post(url, json=payload) as response:
                if response.status in (200, 201):
                    data = await response.json()
                    return data.get("reply", "Пустой ответ от ИИ.")
                return f"Ошибка API: {response.status}"
        except Exception as e:
            return f"Ошибка соединения: {e}"

async def send_chat_message(telegram_id: int, text: str, metrics: dict):
    async with aiohttp.ClientSession() as session:
        url = f"{API_BASE_URL}/chat/"
        payload = {"message": text, "metrics": metrics}
        async with session.post(url, json=payload) as response:
            data = await response.json()
            return data.get("reply", "Ошибка ответа ИИ")