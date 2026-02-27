import io
from aiogram import Router, F, Bot
from aiogram.filters import CommandStart
from aiogram.types import Message
from aiogram.fsm.context import FSMContext

from app.states.chat_states import PlantChatStates
from app.services.api_client import upload_plant_photo, send_chat_message
from app.keyboards.reply_keyboards import get_webapp_keyboard

router = Router()


@router.message(CommandStart())
async def cmd_start(message: Message, state: FSMContext):
    # Приветствие и кнопка Web App остаются
    await message.answer(
        "🌱 Добро пожаловать в FloraAI!\n\n"
        "Я помогу проанализировать ваши растения.\n"
        "Отправьте мне фотографию пшеницы или рукколы прямо сейчас:",
        reply_markup=get_webapp_keyboard()
    )
    # Переводим бота в режим ожидания фото
    await state.set_state(PlantChatStates.waiting_for_photo)


@router.message(PlantChatStates.waiting_for_photo, F.photo)
async def handle_photo(message: Message, bot: Bot, state: FSMContext):
    msg = await message.answer("🔍 Сегментирую изображение... Вычисляю площадь листьев.")

    # Скачиваем картинку в память
    file_io = io.BytesIO()
    await bot.download(message.photo[-1], destination=file_io)
    photo_bytes = file_io.getvalue()

    # Отправляем в Django
    result = await upload_plant_photo(message.from_user.id, photo_bytes)

    if result and 'metrics' in result:
        m = result['metrics']
        text = (
            f"✅ <b>Анализ завершен!</b>\n\n"
            f"🌿 Культура: <b>{m.get('plant_type', 'Неизвестно')}</b>\n"
            f"📏 Площадь листьев: <b>{m.get('leaf_area_cm2')} см²</b>\n"
            f"📏 Длина корня: <b>{m.get('root_length_mm')} мм</b>\n\n"
            f"<i>Теперь вы можете задавать мне любые вопросы по этому растению!</i>"
        )
        await msg.edit_text(text, parse_mode="HTML")
        # Переводим в режим текстового чата с агрономом
        await state.set_state(PlantChatStates.chatting_about_plant)
    else:
        await msg.edit_text("❌ Ошибка при анализе. Попробуйте еще раз.")


@router.message(PlantChatStates.waiting_for_photo)
async def require_photo(message: Message):
    await message.answer("Пожалуйста, сначала отправьте картинку растения (скрепка 📎).")


@router.message(PlantChatStates.chatting_about_plant, F.text)
async def handle_chat(message: Message):
    # Здесь юзер задает вопросы по проанализированному фото
    msg = await message.answer("Рассуждаю...")
    reply = await send_chat_message(message.from_user.id, message.text)
    await msg.edit_text(reply)

@router.message()
async def echo_all(message: Message, state: FSMContext):
    current_state = await state.get_state()
    await message.answer(f"Я получил сообщение, но не знаю что с ним делать.\nТвое текущее состояние: {current_state}")