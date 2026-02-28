import os
import re
from aiogram import Router, F
from aiogram.types import Message, InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo, CallbackQuery
from aiogram.filters import CommandStart, Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from app.services.api_client import upload_photo_to_api, send_chat_message_to_api, get_bot_profile, get_bot_history

router = Router()


class ChatStates(StatesGroup):
    active_chat = State()


def get_webapp_keyboard(tg_id: int, msg_id: int = 0):
    webapp_url = os.getenv('WEBAPP_URL', 'https://your-domain.com')
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


# НОВАЯ ФУНКЦИЯ: Конвертер Markdown -> HTML
def format_llm_to_html(text: str) -> str:
    """Безопасная конвертация Markdown от нейросети в HTML для Telegram"""
    if not text:
        return ""

    # 1. Экранируем опасные для HTML символы
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

    # 2. Выделяем жирный текст (**текст** -> <b>текст</b>)
    text = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', text, flags=re.DOTALL)

    # 3. Выделяем курсив (*текст* -> <i>текст</i>)
    text = re.sub(r'(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)', r'<i>\1</i>', text, flags=re.DOTALL)

    # 4. Заголовки (### Заголовок -> <b>Заголовок</b>)
    text = re.sub(r'^#{1,6}\s+(.*)', r'<b>\1</b>', text, flags=re.MULTILINE)

    # 5. Маркированные списки (заменяем тире на красивые точки)
    text = re.sub(r'^\s*[\-\*]\s+', r'• ', text, flags=re.MULTILINE)

    return text


@router.message(CommandStart())
async def cmd_start(message: Message, state: FSMContext):
    await state.clear()

    profile = await get_bot_profile(message.from_user.id)
    if profile and profile.get('is_linked'):
        text = (
            "🌿 <b>С возвращением в FloraAI!</b>\n\n"
            "📸 Отправьте фото растения для получения анализа.\n"
            "💬 После анализа вы можете обсудить результат с ИИ-агрономом.\n\n"
            "👤 Для просмотра профиля используйте /me"
        )
        await message.answer(text, parse_mode="HTML")
        return

    text = (
        "Привет! Я FloraAI — твой ИИ-агроном. 🌿\n\n"
        "📸 <b>Просто отправь фото растения</b>, чтобы получить моментальный анализ.\n\n"
        "🔗 Чтобы задавать вопросы ИИ после анализа, <b>привяжи свой аккаунт</b>:"
    )
    sent_msg = await message.answer(text, parse_mode="HTML")
    await sent_msg.edit_reply_markup(reply_markup=get_webapp_keyboard(message.from_user.id, sent_msg.message_id))


@router.message(Command("me", "profile"))
async def cmd_me(message: Message, state: FSMContext):
    profile = await get_bot_profile(message.from_user.id)

    if not profile or not profile.get('is_linked'):
        text = (
            "⚠️ <b>Ваш аккаунт не привязан!</b>\n\n"
            "Привяжите профиль через кнопку ниже, чтобы открыть доступ к чату с ИИ и сохранять историю."
        )
        sent_msg = await message.answer(text, parse_mode="HTML")
        await sent_msg.edit_reply_markup(reply_markup=get_webapp_keyboard(message.from_user.id, sent_msg.message_id))
        return

    sub = "💎 Premium" if profile.get('subscription') == "PREMIUM" else "🆓 Бесплатный"
    analyses = profile.get('analyses_count', 0)

    text = (
        f"👤 <b>Профиль FloraAI</b>\n\n"
        f"📧 Email: <code>{profile.get('email')}</code>\n"
        f"⭐ Тариф: <b>{sub}</b>\n"
        f"📊 Анализов сделано: <b>{analyses}</b>\n\n"
        f"Отправьте фото, чтобы начать новый анализ! 🌿"
    )
    await message.answer(text, parse_mode="HTML")

@router.message(Command("history"))
async def cmd_history(message: Message, state: FSMContext):
    data = await get_bot_history(message.from_user.id)

    if not data or not data.get('history'):
        await message.answer("📭 <b>У вас пока нет сохраненной истории.</b>\n\nОтправьте фото первого растения!",
                             parse_mode="HTML")
        return

    history = data['history']

    buttons = []
    for item in history:
        buttons.append([InlineKeyboardButton(
            text=f"🌿 {item['title']} ({item['date']})",
            callback_data=f"session_{item['id']}"  # Вшиваем ID сессии в кнопку
        )])

    kb = InlineKeyboardMarkup(inline_keyboard=buttons)

    await message.answer(
        "📚 <b>Ваша история анализов</b>\n\nВыберите растение, чтобы продолжить диалог с агрономом:",
        reply_markup=kb,
        parse_mode="HTML"
    )


@router.callback_query(F.data.startswith("session_"))
async def process_session_selection(callback: CallbackQuery, state: FSMContext):
    session_id = callback.data.split("_")[1]

    await state.update_data(session_id=session_id)
    await state.set_state(ChatStates.active_chat)

    await callback.message.answer(
        "✅ <b>Чат переключен!</b>\n\nВы вернулись к старому анализу. Теперь ваши сообщения отправляются в контекст этого растения.",
        parse_mode="HTML"
    )
    await callback.answer()

@router.message(F.photo)
async def handle_photo(message: Message, state: FSMContext):
    wait_msg = await message.answer("Анализирую фото... ⏳")

    photo = message.photo[-1]
    file_info = await message.bot.get_file(photo.file_id)
    photo_bytes = await message.bot.download_file(file_info.file_path)

    data, status = await upload_photo_to_api(
        telegram_id=message.from_user.id,
        photo_bytes=photo_bytes.read(),
        filename="plant.jpg"
    )

    await wait_msg.delete()

    if status == 201:
        # ПРИМЕНЯЕМ КОНВЕРТЕР К ОТВЕТУ С ФОТО
        raw_reply = data.get('bot_reply', '✅ Анализ готов!')
        formatted_reply = format_llm_to_html(raw_reply)
        await message.answer(formatted_reply, parse_mode="HTML")

        session_id = data.get('session_id')
        is_linked = data.get('is_linked', False)

        if is_linked and session_id:
            await state.update_data(session_id=session_id)
            await state.set_state(ChatStates.active_chat)
            await message.answer("✍️ Вы можете задать уточняющий вопрос агроному.", parse_mode="HTML")
        else:
            await state.clear()
            text = "💡 Чтобы обсудить этот анализ с ИИ и сохранять историю, привяжите аккаунт!"
            sent_msg = await message.answer(text, parse_mode="HTML")
            await sent_msg.edit_reply_markup(
                reply_markup=get_webapp_keyboard(message.from_user.id, sent_msg.message_id))

    elif status == 403:
        await message.answer(
            "🚫 <b>Лимит анализов исчерпан.</b>\n\nДля безлимитной загрузки фото перейдите на Premium тариф.",
            reply_markup=get_premium_keyboard(),
            parse_mode="HTML"
        )
    else:
        await message.answer("❌ Произошла ошибка на сервере. Попробуйте позже.")


@router.message(ChatStates.active_chat, F.text)
async def handle_text(message: Message, state: FSMContext):
    state_data = await state.get_data()
    session_id = state_data.get('session_id')

    if not session_id:
        await state.clear()
        await message.answer("⚠️ Сессия чата потеряна. Пожалуйста, отправьте новое фото.")
        return

    data, status = await send_chat_message_to_api(
        telegram_id=message.from_user.id,
        message=message.text,
        session_id=session_id
    )

    if status == 200:
        raw_reply = data.get('reply', '...')
        formatted_reply = format_llm_to_html(raw_reply)
        await message.answer(formatted_reply, parse_mode="HTML")
    else:
        await message.answer("❌ Ошибка связи с ИИ. Попробуйте отправить фото заново.")


@router.message(F.text)
async def handle_text_no_session(message: Message):
    text = (
        "⚠️ <b>Чат недоступен.</b>\n\n"
        "Чтобы начать общение с ИИ, сначала <b>отправьте фото растения</b>.\n"
        "Если вы уже отправили фото, но не можете писать — убедитесь, что ваш аккаунт привязан."
    )
    sent_msg = await message.answer(text, parse_mode="HTML")
    await sent_msg.edit_reply_markup(reply_markup=get_webapp_keyboard(message.from_user.id, sent_msg.message_id))