import asyncio
import logging
import os
from aiogram import Bot, Dispatcher
from aiogram.fsm.storage.memory import MemoryStorage
from dotenv import load_dotenv

# Импортируем наши обработчики и клавиатуры
from app.handlers import user_handlers
from app.keyboards.reply_keyboards import get_webapp_keyboard

# Загружаем переменные окружения
load_dotenv()


async def main():
    # Настройка логирования
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(levelname)s - %(name)s - %(message)s",
    )

    bot_token = os.getenv("BOT_TOKEN")
    if not bot_token:
        raise ValueError("BOT_TOKEN not found in .env file")

    # Инициализация бота и диспетчера
    bot = Bot(token=bot_token)
    dp = Dispatcher(storage=MemoryStorage())

    # Регистрируем роутеры (обработчики)
    dp.include_router(user_handlers.router)

    logging.info("FloraAI Bot started")

    # Запуск polling
    try:
        await dp.start_polling(bot)
    finally:
        await bot.session.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        logging.info("Bot stopped")