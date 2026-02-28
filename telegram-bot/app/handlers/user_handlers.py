import os
import io
from aiogram import Router, F
from aiogram.types import Message, InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
from aiogram.filters import CommandStart, Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from app.services.api_client import upload_photo_to_api, send_chat_message_to_api, get_bot_profile

router = Router()


class ChatStates(StatesGroup):
    active_chat = State()  # Состояние активного диалога с ИИ


def get_webapp_keyboard(tg_id: int, msg_id: int):
    webapp_url = os.getenv('WEBAPP_URL', 'https://your-domain.com')
    # Передаем и tg_id, и msg_id в URL!
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(
            text="🌿 Привязать профиль FloraAI",
            web_app=WebAppInfo(url=f"{webapp_url}/telegram-connect?tg_id={tg_id}&msg_id={msg_id}")
        )]
    ])

def get_premium_keyboard():
    webapp_url = os.getenv('WEBAPP_URL', 'https://your-domain.com')
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(
            text="💎 Оформить Premium",
            web_app=WebAppInfo(url=f"{webapp_url}/tariffs")
        )]
    ])


@router.message(CommandStart())
async def cmd_start(message: Message, state: FSMContext):
    await state.clear()

    profile = await get_bot_profile(message.from_user.id)
    if profile and profile.get('is_linked'):
        text = (
            "🌿 **С возвращением в FloraAI!**\n\n"
            "📸 Отправьте фото растения для получения анализа.\n"
            "💬 После анализа вы можете обсудить результат с ИИ-агрономом.\n\n"
            "👤 Для просмотра профиля используйте /me"
        )
        await message.answer(text)
        return

    text = (
        "Привет! Я FloraAI — твой ИИ-агроном. 🌿\n\n"
        "📸 **Просто отправь фото растения**, чтобы получить моментальный анализ.\n\n"
        "🔗 Чтобы задавать вопросы ИИ после анализа, **привяжи свой аккаунт**:"
    )
    sent_msg = await message.answer(text)
    await sent_msg.edit_reply_markup(reply_markup=get_webapp_keyboard(message.from_user.id, sent_msg.message_id))

@router.message(F.photo)
async def handle_photo(message: Message, state: FSMContext):
    wait_msg = await message.answer("Анализирую фото... ⏳")

    photo = message.photo[-1]
    file_info = await message.bot.get_file(photo.file_id)
    photo_bytes = await message.bot.download_file(file_info.file_path)

    # Отправляем фото на бэкенд
    data, status = await upload_photo_to_api(
        telegram_id=message.from_user.id,
        photo_bytes=photo_bytes.read(),
        filename="plant.jpg"
    )

    await wait_msg.delete()

    if status == 201:
        # 1. Выводим результат анализа
        await message.answer(data.get('bot_reply', '✅ Анализ готов!'))

        session_id = data.get('session_id')
        is_linked = data.get('is_linked', False)

        # 2. Проверяем, можно ли продолжать чат
        if is_linked and session_id:
            # Юзер привязан -> Включаем режим чата
            await state.update_data(session_id=session_id)
            await state.set_state(ChatStates.active_chat)
            await message.answer("✍️ Вы можете задать уточняющий вопрос агроному.")
        else:
            # Юзер не привязан -> Сбрасываем стейт и просим привязаться
            await state.clear()
            await message.answer(
                "💡 Чтобы обсудить этот анализ с ИИ и сохранять историю, привяжите аккаунт!",
                reply_markup=get_webapp_keyboard(message.from_user.id)
            )

    elif status == 403:
        # Обработка лимита (3 фото для привязанных без Premium)
        await message.answer(
            "🚫 **Лимит анализов исчерпан.**\n\nДля безлимитной загрузки фото перейдите на Premium тариф.",
            reply_markup=get_premium_keyboard()
        )
    else:
        await message.answer("❌ Произошла ошибка на сервере. Попробуйте позже.")


# Обрабатываем текст ТОЛЬКО если пользователь находится в состоянии ChatStates.active_chat
@router.message(ChatStates.active_chat, F.text)
async def handle_text(message: Message, state: FSMContext):
    state_data = await state.get_data()
    session_id = state_data.get('session_id')

    if not session_id:
        await state.clear()
        await message.answer("⚠️ Сессия чата потеряна. Пожалуйста, отправьте новое фото.")
        return

    # Отправляем текст в YandexGPT через наш API
    data, status = await send_chat_message_to_api(
        telegram_id=message.from_user.id,
        message=message.text,
        session_id=session_id
    )

    if status == 200:
        await message.answer(data.get('reply', '...'))
    else:
        await message.answer("❌ Ошибка связи с ИИ. Попробуйте отправить фото заново.")


# Ловим текст, если юзер пытается писать без фото или без привязки
@router.message(F.text)
async def handle_text_no_session(message: Message):
    await message.answer(
        "⚠️ **Чат недоступен.**\n\n"
        "Чтобы начать общение с ИИ, сначала **отправьте фото растения**.\n"
        "Если вы уже отправили фото, но не можете писать — убедитесь, что ваш аккаунт привязан.",
        reply_markup=get_webapp_keyboard(message.from_user.id)
    )


@router.message(Command("me", "profile"))
async def cmd_me(message: Message):
    profile = await get_bot_profile(message.from_user.id)

    if not profile or not profile.get('is_linked'):
        await message.answer(
            "⚠️ **Ваш аккаунт не привязан!**\n\n"
            "Привяжите профиль через команду /start, чтобы открыть доступ к чату с ИИ и сохранять историю."
        )
        return

    sub = "💎 Premium" if profile.get('subscription') == "PREMIUM" else "🆓 Бесплатный"
    analyses = profile.get('analyses_count', 0)

    text = (
        f"👤 **Профиль FloraAI**\n\n"
        f"📧 Email: `{profile.get('email')}`\n"
        f"⭐ Тариф: **{sub}**\n"
        f"📊 Анализов сделано: **{analyses}**\n\n"
        f"Отправьте фото, чтобы начать новый анализ! 🌿"
    )
    await message.answer(text, parse_mode="Markdown")