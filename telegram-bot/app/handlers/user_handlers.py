import os, aiohttp, re
from aiogram import Router, F
from aiogram.types import Message, InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo, CallbackQuery, BufferedInputFile
from aiogram.filters import CommandStart, Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from app.services.api_client import upload_photo_to_api, send_chat_message_to_api, get_bot_profile, get_bot_history, update_bot_settings

router = Router()


class ChatStates(StatesGroup):
    active_chat = State()

class SettingsStates(StatesGroup):
    wait_conf = State()
    wait_iou = State()
    wait_imgsz = State()

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
        raw_reply = data.get('bot_reply', '✅ Анализ готов!')
        formatted_reply = format_llm_to_html(raw_reply)

        # --- НОВАЯ ЛОГИКА: ИЩЕМ И ОТПРАВЛЯЕМ КАРТИНКУ ---
        annotated_image_url = data.get('annotated_image')

        if annotated_image_url:
            # Превращаем относительный путь Django во внутренний URL Docker
            if annotated_image_url.startswith('/'):
                annotated_image_url = f"http://backend:8000{annotated_image_url}"
            elif 'localhost' in annotated_image_url or '127.0.0.1' in annotated_image_url:
                annotated_image_url = annotated_image_url.replace('localhost', 'backend').replace('127.0.0.1', 'backend')

            try:
                # Скачиваем картинку из бэкенда
                async with aiohttp.ClientSession() as session:
                    async with session.get(annotated_image_url) as resp:
                        if resp.status == 200:
                            image_bytes = await resp.read()
                            # Формируем файл для Telegram
                            input_file = BufferedInputFile(image_bytes, filename="annotated_plant.jpg")
                            # Отправляем фото, а текст помещаем в описание (caption)
                            await message.answer_photo(photo=input_file, caption=formatted_reply, parse_mode="HTML")
                        else:
                            # Заглушка, если картинка не скачалась
                            await message.answer(formatted_reply, parse_mode="HTML")
            except Exception as e:
                print(f"Ошибка загрузки фото: {e}")
                await message.answer(formatted_reply, parse_mode="HTML")
        else:
            # Если картинки нет в ответе, шлем просто текст
            await message.answer(formatted_reply, parse_mode="HTML")
        # ------------------------------------------------

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


def get_settings_keyboard(conf, iou, imgsz):
    """Генерирует клавиатуру настроек с текущими значениями"""
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=f"🎯 Уверенность (Conf): {conf}", callback_data="set_conf")],
        [InlineKeyboardButton(text=f"🔗 Перекрытие (IoU): {iou}", callback_data="set_iou")],
        [InlineKeyboardButton(text=f"🖼 Детализация (ImgSz): {imgsz}", callback_data="set_imgsz")],
        [InlineKeyboardButton(text="❌ Закрыть", callback_data="close_settings")]
    ])


@router.message(Command("settings"))
async def cmd_settings(message: Message, state: FSMContext):
    await state.clear()
    profile = await get_bot_profile(message.from_user.id)
    if not profile or not profile.get('is_linked'):
        await message.answer("⚠️ <b>Сначала привяжите профиль!</b>\n\nБез профиля настройки ИИ не сохранятся.",
                             parse_mode="HTML")
        return

    conf = profile.get('yolo_conf', 0.25)
    iou = profile.get('yolo_iou', 0.7)
    imgsz = profile.get('yolo_imgsz', 640)

    kb = get_settings_keyboard(conf, iou, imgsz)
    text = (
        "🎛 <b>Настройки нейросети FloraAI</b>\n\n"
        "Нажмите на параметр, чтобы изменить его значение:"
    )
    await message.answer(text, reply_markup=kb, parse_mode="HTML")


# --- ОБРАБОТЧИКИ НАЖАТИЙ НА КНОПКИ ---

@router.callback_query(F.data.startswith("set_"))
async def process_setting_click(callback: CallbackQuery, state: FSMContext):
    setting_type = callback.data.split("_")[1]  # conf, iou, imgsz

    back_kb = InlineKeyboardMarkup(
        inline_keyboard=[[InlineKeyboardButton(text="🔙 Назад", callback_data="back_settings")]])

    if setting_type == "conf":
        await state.set_state(SettingsStates.wait_conf)
        await callback.message.edit_text(
            "🎯 <b>Уверенность (Conf)</b>\n\nВведите число от 0.05 до 0.95 (например: 0.25):", reply_markup=back_kb,
            parse_mode="HTML")
    elif setting_type == "iou":
        await state.set_state(SettingsStates.wait_iou)
        await callback.message.edit_text("🔗 <b>Перекрытие (IoU)</b>\n\nВведите число от 0.1 до 0.9 (например: 0.7):",
                                         reply_markup=back_kb, parse_mode="HTML")
    elif setting_type == "imgsz":
        await state.set_state(SettingsStates.wait_imgsz)
        await callback.message.edit_text("🖼 <b>Детализация (ImgSz)</b>\n\nВведите 480, 640 или 1024:",
                                         reply_markup=back_kb, parse_mode="HTML")

    await callback.answer()


@router.callback_query(F.data == "back_settings")
async def back_to_settings(callback: CallbackQuery, state: FSMContext):
    # Если нажали "Назад", отменяем состояние ввода и показываем меню заново
    await cmd_settings(callback.message, state)
    await callback.message.delete()
    await callback.answer()


@router.callback_query(F.data == "close_settings")
async def close_settings(callback: CallbackQuery, state: FSMContext):
    await state.clear()
    await callback.message.delete()
    await callback.answer("Настройки закрыты")


# --- ОБРАБОТЧИКИ ВВОДА ПОЛЬЗОВАТЕЛЯ ---

@router.message(SettingsStates.wait_conf, F.text)
async def handle_new_conf(message: Message, state: FSMContext):
    try:
        val = float(message.text.replace(",", "."))
        if not (0.05 <= val <= 0.95): raise ValueError
        await update_bot_settings(message.from_user.id, {"yolo_conf": val})
        await message.answer("✅ Настройка Conf успешно обновлена!")
        await cmd_settings(message, state)
    except ValueError:
        await message.answer("❌ Ошибка! Введите число от 0.05 до 0.95:")


@router.message(SettingsStates.wait_iou, F.text)
async def handle_new_iou(message: Message, state: FSMContext):
    try:
        val = float(message.text.replace(",", "."))
        if not (0.1 <= val <= 0.9): raise ValueError
        await update_bot_settings(message.from_user.id, {"yolo_iou": val})
        await message.answer("✅ Настройка IoU успешно обновлена!")
        await cmd_settings(message, state)
    except ValueError:
        await message.answer("❌ Ошибка! Введите число от 0.1 до 0.9:")


@router.message(SettingsStates.wait_imgsz, F.text)
async def handle_new_imgsz(message: Message, state: FSMContext):
    try:
        val = int(message.text)
        if val not in [480, 640, 1024]: raise ValueError
        await update_bot_settings(message.from_user.id, {"yolo_imgsz": val})
        await message.answer("✅ Настройка ImgSz успешно обновлена!")
        await cmd_settings(message, state)
    except ValueError:
        await message.answer("❌ Ошибка! Введите 480, 640 или 1024:")

@router.message(F.text)
async def handle_text_no_session(message: Message):
    text = (
        "⚠️ <b>Чат недоступен.</b>\n\n"
        "Чтобы начать общение с ИИ, сначала <b>отправьте фото растения</b>.\n"
        "Если вы уже отправили фото, но не можете писать — убедитесь, что ваш аккаунт привязан."
    )
    sent_msg = await message.answer(text, parse_mode="HTML")
    await sent_msg.edit_reply_markup(reply_markup=get_webapp_keyboard(message.from_user.id, sent_msg.message_id))