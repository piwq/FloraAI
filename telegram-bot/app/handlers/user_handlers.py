import os, aiohttp, re
from aiogram import Router, F
from aiogram.types import Message, InlineKeyboardMarkup, InlineKeyboardButton, CallbackQuery, \
    BufferedInputFile
from aiogram.filters import CommandStart, Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup

from app.services.api_client import (
    upload_photo_to_api, send_chat_message_to_api, get_bot_profile,
    get_bot_history, update_bot_settings, delete_bot_session, set_active_session
)

from app.keyboards.inline_keyboards import (
    get_profile_keyboard, get_paginated_history_keyboard,
    get_session_view_keyboard, get_confirm_delete_keyboard,
    get_webapp_keyboard, get_premium_keyboard
)

router = Router()


class ChatStates(StatesGroup):
    active_chat = State()


class SettingsStates(StatesGroup):
    wait_conf = State()
    wait_iou = State()
    wait_imgsz = State()



def format_llm_to_html(text: str) -> str:
    """Безопасная конвертация Markdown от нейросети в HTML для Telegram"""
    if not text:
        return ""
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    text = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', text, flags=re.DOTALL)
    text = re.sub(r'(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)', r'<i>\1</i>', text, flags=re.DOTALL)
    text = re.sub(r'^#{1,6}\s+(.*)', r'<b>\1</b>', text, flags=re.MULTILINE)
    text = re.sub(r'^\s*[\-\*]\s+', r'• ', text, flags=re.MULTILINE)
    return text


@router.message(CommandStart())
async def cmd_start(message: Message, state: FSMContext):
    await state.clear()
    await set_active_session(message.from_user.id, None)
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

    sub = profile.get('subscription', 'FREE')
    sub_text = "💎 Premium" if sub == "PREMIUM" else "🆓 Бесплатный"
    analyses = profile.get('analyses_count', 0)

    text = (
        f"👤 <b>Профиль FloraAI</b>\n\n"
        f"📧 Email: <code>{profile.get('email')}</code>\n"
        f"⭐ Тариф: <b>{sub_text}</b>\n"
        f"📊 Анализов сделано: <b>{analyses}</b>\n\n"
        f"Отправьте фото, чтобы начать новый анализ! 🌿"
    )
    await message.answer(text, reply_markup=get_profile_keyboard(sub), parse_mode="HTML")


@router.callback_query(F.data == "show_history")
async def process_show_history(callback: CallbackQuery, state: FSMContext):
    await cmd_history_func(callback.message, state, page=1, edit_message=True)
    await callback.answer()


@router.message(Command("history"))
async def cmd_history_command(message: Message, state: FSMContext):
    await cmd_history_func(message, state, page=1, edit_message=False)


async def cmd_history_func(message: Message, state: FSMContext, page: int = 1, edit_message: bool = False):
    data = await get_bot_history(message.chat.id)

    if not data or not data.get('history'):
        text = "📭 <b>У вас пока нет сохраненной истории.</b>\n\nОтправьте фото первого растения!"
        if edit_message:
            await message.edit_text(text, parse_mode="HTML")
        else:
            await message.answer(text, parse_mode="HTML")
        return

    text = "📚 <b>Ваша история анализов</b>\n\nВыберите растение:"
    kb = get_paginated_history_keyboard(data['history'], current_page=page)

    if edit_message:
        await message.edit_text(text, reply_markup=kb, parse_mode="HTML")
    else:
        await message.answer(text, reply_markup=kb, parse_mode="HTML")


@router.callback_query(F.data.startswith("history_page_"))
async def process_history_page(callback: CallbackQuery, state: FSMContext):
    page = int(callback.data.split("_")[2])
    await cmd_history_func(callback.message, state, page=page, edit_message=True)
    await callback.answer()


@router.callback_query(F.data.startswith("session_"))
async def process_session_selection(callback: CallbackQuery, state: FSMContext):
    parts = callback.data.split("_")
    session_id = parts[1]
    page = int(parts[3]) if len(parts) > 3 else 1

    text = f"🌿 <b>Выбрано растение (Анализ #{session_id})</b>\n\nЧто вы хотите сделать?"
    await callback.message.edit_text(text, reply_markup=get_session_view_keyboard(session_id, page), parse_mode="HTML")
    await callback.answer()


@router.callback_query(F.data.startswith("activate_chat_"))
async def process_activate_chat(callback: CallbackQuery, state: FSMContext):
    session_id = callback.data.split("_")[2]
    await state.update_data(session_id=session_id)
    await state.set_state(ChatStates.active_chat)
    await set_active_session(callback.from_user.id, session_id)

    await callback.message.edit_text(
        "✅ <b>Чат переключен!</b>\n\nВы вернулись к старому анализу. Теперь ваши сообщения отправляются в контекст этого растения.",
        parse_mode="HTML")
    await callback.answer()


@router.callback_query(F.data.startswith("confirm_delete_"))
async def confirm_delete(callback: CallbackQuery, state: FSMContext):
    parts = callback.data.split("_")
    session_id = parts[2]
    page = int(parts[3]) if len(parts) > 3 else 1

    await callback.message.edit_text("⚠️ Вы уверены, что хотите удалить этот анализ из истории?",
                                     reply_markup=get_confirm_delete_keyboard(session_id, page))
    await callback.answer()


@router.callback_query(F.data.startswith("delete_session_"))
async def delete_session(callback: CallbackQuery, state: FSMContext):
    parts = callback.data.split("_")
    session_id = parts[2]
    page = int(parts[3]) if len(parts) > 3 else 1

    await delete_bot_session(callback.from_user.id, session_id)
    await cmd_history_func(callback.message, state, page=page, edit_message=True)
    await callback.answer("🗑️ Анализ удален!")


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

        annotated_image_url = data.get('annotated_image')

        if annotated_image_url:
            if annotated_image_url.startswith('/'):
                annotated_image_url = f"http://backend:8000{annotated_image_url}"
            elif 'localhost' in annotated_image_url or '127.0.0.1' in annotated_image_url:
                annotated_image_url = annotated_image_url.replace('localhost', 'backend').replace('127.0.0.1',
                                                                                                  'backend')

            try:
                async with aiohttp.ClientSession() as session:
                    async with session.get(annotated_image_url) as resp:
                        if resp.status == 200:
                            image_bytes = await resp.read()
                            input_file = BufferedInputFile(image_bytes, filename="annotated_plant.jpg")
                            await message.answer_photo(photo=input_file, caption=formatted_reply, parse_mode="HTML")
                        else:
                            await message.answer(formatted_reply, parse_mode="HTML")
            except Exception as e:
                print(f"Ошибка загрузки фото: {e}")
                await message.answer(formatted_reply, parse_mode="HTML")
        else:
            await message.answer(formatted_reply, parse_mode="HTML")

        session_id = data.get('session_id')
        is_linked = data.get('is_linked', False)

        if is_linked and session_id:
            await state.update_data(session_id=session_id)
            await state.set_state(ChatStates.active_chat)
            await set_active_session(message.from_user.id, session_id)
            await message.answer("✍️ Вы можете задать уточняющий вопрос агроному.", parse_mode="HTML")
        else:
            await state.clear()
            await set_active_session(message.from_user.id, None)
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


@router.message(ChatStates.active_chat, F.photo)
async def handle_chat_photo(message: Message, state: FSMContext):
    state_data = await state.get_data()
    session_id = state_data.get('session_id')

    if not session_id:
        await state.clear()
        await message.answer("⚠️ Сессия чата потеряна. Пожалуйста, отправьте новое фото.")
        return

    wait_msg = await message.answer("Пересылаю фото в чат... ⏳")

    photo = message.photo[-1]
    file_info = await message.bot.get_file(photo.file_id)
    photo_bytes = await message.bot.download_file(file_info.file_path)

    # Пересылаем в активный чат с подписью (или без неё)
    data, status = await send_chat_message_to_api(
        telegram_id=message.from_user.id,
        message=message.caption or "",
        session_id=session_id,
        photo_bytes=photo_bytes.read(),
        filename="chat_photo.jpg"
    )

    await wait_msg.delete()

    if status == 200:
        raw_reply = data.get('reply', '...')
        formatted_reply = format_llm_to_html(raw_reply)
        image_url = data.get('image_url')

        # Если АПИ вернул ссылку на разметку (или результат), скачиваем её
        if image_url:
            dl_msg = await message.answer("Скачиваю разметку... ⏳")
            async with aiohttp.ClientSession() as http_session:
                async with http_session.get(image_url) as resp:
                    if resp.status == 200:
                        img_bytes = await resp.read()
                        await message.answer_photo(
                            photo=BufferedInputFile(img_bytes, filename="markup.jpg"),
                            caption=formatted_reply,
                            parse_mode="HTML"
                        )
                    else:
                        await message.answer(formatted_reply, parse_mode="HTML")
            await dl_msg.delete()
        else:
            await message.answer(formatted_reply, parse_mode="HTML")
    else:
        await message.answer("❌ Ошибка связи с сервером.")


@router.message(ChatStates.active_chat, F.text)
async def handle_text(message: Message, state: FSMContext):
    state_data = await state.get_data()
    session_id = state_data.get('session_id')

    if not session_id:
        await state.clear()
        await set_active_session(message.from_user.id, None)
        await message.answer("⚠️ Сессия чата потеряна. Пожалуйста, отправьте новое фото.")
        return

    wait_msg = await message.answer("Агроном печатает... ⏳")

    data, status = await send_chat_message_to_api(
        telegram_id=message.from_user.id,
        message=message.text,
        session_id=session_id
    )

    await wait_msg.delete()

    if status == 200:
        raw_reply = data.get('reply', '...')
        formatted_reply = format_llm_to_html(raw_reply)
        image_url = data.get('image_url')

        # Если мы написали "покажи разметку", АПИ вернет image_url
        if image_url:
            dl_msg = await message.answer("Загружаю фото... ⏳")
            async with aiohttp.ClientSession() as http_session:
                async with http_session.get(image_url) as resp:
                    if resp.status == 200:
                        img_bytes = await resp.read()
                        await message.answer_photo(
                            photo=BufferedInputFile(img_bytes, filename="markup.jpg"),
                            caption=formatted_reply,
                            parse_mode="HTML"
                        )
                    else:
                        await message.answer(formatted_reply, parse_mode="HTML")
            await dl_msg.delete()
        else:
            await message.answer(formatted_reply, parse_mode="HTML")
    else:
        await message.answer("❌ Ошибка связи с ИИ. Попробуйте отправить сообщение заново.")

def get_settings_keyboard(conf, iou, imgsz):
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=f"🎯 Уверенность (Conf): {conf}", callback_data="set_conf")],
        [InlineKeyboardButton(text=f"🔗 Перекрытие (IoU): {iou}", callback_data="set_iou")],
        [InlineKeyboardButton(text=f"🖼 Детализация (ImgSz): {imgsz}", callback_data="set_imgsz")],
        [InlineKeyboardButton(text="❌ Закрыть", callback_data="close_settings")]
    ])


@router.message(Command("settings"))
async def cmd_settings(message: Message, state: FSMContext):
    await state.clear()
    await set_active_session(message.from_user.id, None)
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


@router.callback_query(F.data.startswith("set_"))
async def process_setting_click(callback: CallbackQuery, state: FSMContext):
    setting_type = callback.data.split("_")[1]

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
    await cmd_settings(callback.message, state)
    await callback.message.delete()
    await callback.answer()


@router.callback_query(F.data == "close_settings")
async def close_settings(callback: CallbackQuery, state: FSMContext):
    await state.clear()
    await set_active_session(callback.from_user.id, None)
    await callback.message.delete()
    await callback.answer("Настройки закрыты")


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