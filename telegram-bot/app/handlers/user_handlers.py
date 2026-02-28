import os
import io
from aiogram import Router, F
from aiogram.types import Message, InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
from aiogram.filters import CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from app.services.api_client import upload_photo_to_api, send_chat_message_to_api

router = Router()


class ChatStates(StatesGroup):
    active_chat = State()  # Храним session_id активного чата


def get_webapp_keyboard(tg_id: int):
    # Получаем ссылку из .env файла (по умолчанию ставим заглушку с https, чтобы не падало)
    webapp_url = os.getenv('WEBAPP_URL', 'https://google.com')

    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(
            text="🌿 Открыть профиль на сайте",
            web_app=WebAppInfo(url=f"{webapp_url}/telegram-connect?tg_id={tg_id}")
        )]
    ])


def get_premium_keyboard():
    webapp_url = os.getenv('WEBAPP_URL', 'https://google.com')
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(
            text="💎 Оформить Premium",
            web_app=WebAppInfo(url=f"{webapp_url}/tariffs")
        )]
    ])


@router.message(CommandStart())
async def cmd_start(message: Message, state: FSMContext):
    await state.clear()  # Сбрасываем старый чат
    text = (
        "Добро пожаловать в FloraAI 🌿!\n\n"
        "Чтобы начать новый чат и получить анализ растения, **отправьте мне фотографию**.\n\n"
        "Вы можете привязать этот бот к своему профилю на сайте, нажав кнопку ниже."
    )
    # Если здесь будет ошибка, бот упадет, но теперь мы передаем https-ссылку
    await message.answer(text, reply_markup=get_webapp_keyboard(message.from_user.id))


@router.message(F.photo)
async def handle_photo(message: Message, state: FSMContext):
    msg = await message.answer("Фото получено. Выполняю анализ, подождите немного... ⏳")

    # Скачиваем фото в память
    photo = message.photo[-1]
    file_info = await message.bot.get_file(photo.file_id)
    photo_bytes = await message.bot.download_file(file_info.file_path)

    # Отправляем на бэкенд
    data, status = await upload_photo_to_api(
        telegram_id=message.from_user.id,
        photo_bytes=photo_bytes.read(),
        filename="plant.jpg"
    )

    await msg.delete()  # Удаляем старое сообщение

    if status == 201:
        session_id = data.get('session_id')
        bot_reply = data.get('bot_reply', 'Анализ завершен!')

        # Сохраняем ID чата в состояние юзера!
        await state.update_data(session_id=session_id)
        await state.set_state(ChatStates.active_chat)

        await message.answer(bot_reply)
    elif status == 403 and data.get('error') == 'limit_reached':
        # --- ОБРАБАТЫВАЕМ ЛИМИТ ФОТО ДЛЯ БЕСПЛАТНЫХ ПОЛЬЗОВАТЕЛЕЙ ---
        await message.answer(
            "🚫 **Лимит бесплатных анализов исчерпан (3/3).**\n\n"
            "Чтобы продолжить загружать новые фотографии, оформите Premium подписку на нашем сайте.",
            reply_markup=get_premium_keyboard()
        )
    else:
        await message.answer("Произошла ошибка при анализе фото. Попробуйте еще раз.")


@router.message(F.text)
async def handle_text(message: Message, state: FSMContext):
    state_data = await state.get_data()
    session_id = state_data.get('session_id')

    if not session_id:
        await message.answer("⚠️ Сначала отправьте фотографию растения, чтобы начать новый чат!")
        return

    data, status = await send_chat_message_to_api(
        telegram_id=message.from_user.id,
        message=message.text,
        session_id=session_id
    )

    if status == 200:
        await message.answer(data.get('reply', '...'))
    elif status == 403:
        await message.answer("🚫 У вас нет доступа к этому чату, или лимит исчерпан.",
                             reply_markup=get_premium_keyboard())
    else:
        await message.answer(data.get('error', 'Произошла ошибка связи с нейросетью.'))