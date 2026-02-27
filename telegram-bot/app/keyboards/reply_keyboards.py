from aiogram.types import ReplyKeyboardMarkup, KeyboardButton, WebAppInfo
import os


def get_webapp_keyboard():
    # Берем URL фронтенда из переменной окружения или ставим дефолт для локала
    webapp_url = os.getenv('WEBAPP_URL', 'https://your-domain.com')

    keyboard = ReplyKeyboardMarkup(
        keyboard=[
            [
                KeyboardButton(
                    text="🌿 Открыть FloraAI App",
                    web_app=WebAppInfo(url=webapp_url)
                )
            ]
        ],
        resize_keyboard=True
    )
    return keyboard