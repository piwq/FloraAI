import json
import re
import os
import aiohttp
from typing import Optional
from io import BytesIO

from aiogram import Bot, Router, F
from aiogram.enums import ChatAction, ParseMode
from aiogram.exceptions import TelegramBadRequest
from aiogram.filters import CommandStart, StateFilter
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message, WebAppInfo, Voice, BufferedInputFile

from app.services.redis_client import redis_client
from app.keyboards.inline_keyboards import (
    create_history_keyboard,
    get_profile_keyboard,
    get_onboarding_keyboard,
    get_session_view_keyboard,
    get_confirm_delete_keyboard,
    get_premium_feature_keyboard,
    get_tts_keyboard
)
from app.keyboards.reply_keyboards import get_main_menu, get_dialog_menu
from app.services.api_client import api_client
from app.states import ChatStates

TTS_CACHE_TTL = 3 * 24 * 60 * 60
router = Router()
WEB_APP_URL = "https://morpheusantihype.icu"

def escape_markdown_v2(text: str) -> str:
    if not isinstance(text, str):
        return ""
    escape_chars = r"_*[]()~`>#+-=|{}.!"
    return re.sub(f"([{re.escape(escape_chars)}])", r"\\\1", text)

def format_message_to_html(text: str) -> str:
    if not isinstance(text, str):
        return ""
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    text = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', text)
    text = re.sub(r'_(.*?)_', r'<i>\1</i>', text)
    text = re.sub(r'\*(.*?)\*', r'<i>\1</i>', text)
    text = re.sub(r'#+\s*(.*)', r'<b>\1</b>', text)
    text = re.sub(r'^\s*-\s', '• ', text, flags=re.MULTILINE)
    return text

@router.message(CommandStart())
async def command_start_handler(message: Message, state: FSMContext):
    await state.clear()
    telegram_id = message.from_user.id
    user_data = await api_client.find_user_by_telegram_id(telegram_id)

    if user_data:
        await message.answer(
            f"С возвращением, {user_data.get('name', message.from_user.first_name)}! Что будем делать?",
            reply_markup=get_main_menu(),
        )
    else:
        await message.answer(
            "Привет! Чтобы пользоваться сонником, пожалуйста, войди или зарегистрируйся на нашем сайте. Это нужно сделать один раз.",
            reply_markup=get_onboarding_keyboard(),
        )

@router.message(F.text == "👤 Профиль", StateFilter(None))
async def profile_button_handler(message: Message, bot: Bot):
    await bot.send_chat_action(chat_id=message.chat.id, action=ChatAction.TYPING)
    telegram_id = message.from_user.id
    profile_data = await api_client.find_user_by_telegram_id(telegram_id)

    if profile_data:
        sub_status_raw = profile_data.get("subscriptionStatus")
        status = "Premium" if sub_status_raw == "PREMIUM" else "Бесплатный"
        attempts = profile_data.get("remainingInterpretations", 0)
        name = escape_markdown_v2(profile_data.get("name", "Не указано"))

        text_lines = [
            f"👤 *Твой профиль*",
            f"**Имя:** {name}",
            f"**Статус:** `{status}`",
            f"**Осталось толкований:** `{attempts}`",
        ]

        if (status == "Бесплатный" and attempts == 0 and profile_data.get("lastFreeInterpretationAt")):
            text_lines.append(
                "\n_Следующее бесплатное толкование будет доступно через 3 дня после последнего использования\\._"
            )

        markup = get_profile_keyboard(sub_status_raw)
        await message.answer(
            "\n".join(text_lines),
            parse_mode=ParseMode.MARKDOWN_V2,
            reply_markup=markup,
        )
    else:
        await message.answer(
            "Не удалось загрузить данные профиля. Возможно, нужно снова связать аккаунт.",
            reply_markup=get_onboarding_keyboard(),
        )

@router.callback_query(F.data == "show_history")
async def history_button_handler(callback: CallbackQuery, bot: Bot):
    await bot.send_chat_action(chat_id=callback.message.chat.id, action=ChatAction.TYPING)
    telegram_id = callback.from_user.id
    history_data = await api_client.get_history(telegram_id, page=1)

    if history_data and history_data.get("data"):
        text = "Вот твоя история снов. Нажми на сон, чтобы посмотреть полную переписку."
        markup = create_history_keyboard(history_data)
        await callback.message.answer(text, reply_markup=markup)
    else:
        await callback.message.answer(
            "Твоя история снов пока пуста. Расскажи мне свой первый сон!"
        )
    await callback.answer()

@router.message(F.text == "▶️ Начать диалог", StateFilter(None))
async def start_dialog_handler(message: Message, state: FSMContext):
    telegram_id = message.from_user.id
    user_data = await api_client.find_user_by_telegram_id(telegram_id)

    if user_data:
        await state.set_state(ChatStates.in_dialogue)
        await message.answer(
            "Я готов слушать. Опиши свой сон, и я помогу его разгадать.",
            reply_markup=get_dialog_menu(),
        )
    else:
        await message.answer(
            "Сначала нужно связать твой аккаунт. Пожалуйста, войди или зарегистрируйся.",
            reply_markup=get_onboarding_keyboard(),
        )

@router.message(F.text == "⏹️ Завершить диалог", StateFilter(ChatStates.in_dialogue))
async def end_dialog_handler(message: Message, state: FSMContext):
    await state.clear()
    await message.answer(
        "Диалог завершен. Если захочешь обсудить другой сон, просто нажми 'Начать диалог'.",
        reply_markup=get_main_menu(),
    )

@router.message(F.voice, StateFilter(ChatStates.in_dialogue))
async def voice_message_handler(message: Message, state: FSMContext, bot: Bot):
    telegram_id = message.from_user.id
    user_data = await api_client.find_user_by_telegram_id(telegram_id)

    if not user_data:
        await state.clear()
        await message.answer(
            "Произошла ошибка: твой аккаунт не найден. Пожалуйста, нажми /start и свяжи аккаунт заново.",
            reply_markup=get_main_menu(),
        )
        return

    if user_data.get("subscriptionStatus") != "PREMIUM":
        await message.answer(
            "🎙️ Распознавание речи доступно только в Premium-подписке.",
            reply_markup=get_premium_feature_keyboard()
        )
        return

    file_info = await bot.get_file(message.voice.file_id)
    file_path = f"temp_{telegram_id}.ogg"
    await bot.download_file(file_info.file_path, destination=file_path)

    await bot.send_chat_action(chat_id=message.chat.id, action=ChatAction.TYPING)
    
    response = await api_client.recognize_voice(telegram_id, file_path)
    
    os.remove(file_path)

    if response and response.get("text"):
        recognized_text = response.get("text")
        
        message_data = message.model_dump()
        
        message_data['text'] = recognized_text
        
        new_message = Message(**message_data)

        await dialogue_message_handler(message=new_message, state=state, bot=bot)
    else:
        error_text = "Прости, не смог распознать твою речь. Попробуй еще раз."
        if response and response.get("error"):
            error_text = response.get("error")
        await message.answer(error_text)


@router.message(StateFilter(ChatStates.in_dialogue))
async def dialogue_message_handler(message: Message, state: FSMContext, bot: Bot):
    telegram_id = message.from_user.id
    user_data = await api_client.find_user_by_telegram_id(telegram_id)
    if not user_data:
        await state.clear()
        await message.answer(
            "Произошла ошибка: твой аккаунт не найден. Пожалуйста, нажми /start и свяжи аккаунт заново.",
            reply_markup=get_main_menu(),
        )
        return

    await bot.send_chat_action(chat_id=message.chat.id, action=ChatAction.TYPING)

    data = await state.get_data()
    session_id = data.get("session_id")

    async def handle_interpretations_exhausted():
        sub_status = user_data.get("subscriptionStatus", "FREE")
        is_premium = sub_status == "PREMIUM"

        if is_premium:
            text = (
                "У тебя закончились толкования на сегодня.\n\n"
                "В <b>00:00 по МСК</b> тебе будет доступно <b>20 новых толкований</b>."
            )
            await message.answer(text, parse_mode=ParseMode.HTML)
        else:
            text = (
                "У тебя закончились бесплатные толкования снов.\n\n"
                "Следующее бесплатное толкование будет доступно <b>через 3 дня</b>.\n\n"
                "Или оформи <b>Premium</b> — и толкуй сколько угодно!"
            )
            await message.answer(text, parse_mode=ParseMode.HTML, reply_markup=get_premium_feature_keyboard())

        await state.clear()
        await message.answer("Диалог завершен.", reply_markup=get_main_menu())
        return True  # Ошибка обработана

    if not session_id:
        response = await api_client.send_dream(telegram_id, message.text)

        if response and response.get("sessionId"):
            await state.update_data(session_id=response["sessionId"])
            raw_text = response.get("initialResponse", "Интересный сон... Дай мне подумать.")
            formatted_text = format_message_to_html(raw_text)
            sent_message = await bot.send_message(message.chat.id, formatted_text, parse_mode=ParseMode.HTML)
            await sent_message.edit_reply_markup(reply_markup=get_tts_keyboard(sent_message.message_id))
        else:
            if isinstance(response, dict) and "Доступные толкования закончились" in response.get("error", ""):
                await handle_interpretations_exhausted()
                return
            else:
                error_msg = response.get("error", "Прости, не смог начать толкование. Попробуй позже.")
                await message.answer(error_msg)
                await state.clear()
                await message.answer("Диалог завершен.", reply_markup=get_main_menu())

    else:
        response = await api_client.send_follow_up(session_id, telegram_id, message.text)
        if response and response.get("response"):
            raw_text = response.get("response")
            formatted_text = format_message_to_html(raw_text)
            sent_message = await bot.send_message(message.chat.id, formatted_text, parse_mode=ParseMode.HTML)
            await sent_message.edit_reply_markup(reply_markup=get_tts_keyboard(sent_message.message_id))
        else:
            if isinstance(response, dict) and "Доступные толкования закончились" in response.get("error", ""):
                await handle_interpretations_exhausted()
                return
            else:
                error_msg = response.get("error", "Прости, не смог обработать твой вопрос. Попробуй еще раз.")
                await message.answer(error_msg)
                
@router.callback_query(F.data.startswith("tts_"))
async def tts_callback_handler(callback: CallbackQuery, bot: Bot):
    message_id = int(callback.data.split("_")[1])
    telegram_id = callback.from_user.id
    redis_key = f"tts_cache:{callback.message.chat.id}:{message_id}"
    
    if await redis_client.get(redis_key):
        await callback.answer("Это сообщение уже было озвучено.", show_alert=True)
        return

    user_data = await api_client.find_user_by_telegram_id(telegram_id)
    if not user_data:
        await callback.answer("Не удалось найти ваш профиль.", show_alert=True)
        return

    if user_data.get("subscriptionStatus") != "PREMIUM":
        await callback.answer("🔊 Озвучивание доступно только для Premium-пользователей.", show_alert=True)
        return

    text_to_synthesize = callback.message.text
    if not text_to_synthesize:
        await callback.answer("Не удалось получить текст для озвучивания.", show_alert=True)
        return

    await bot.send_chat_action(chat_id=callback.message.chat.id, action=ChatAction.RECORD_VOICE)
    
    audio_data = await api_client.synthesize_speech(telegram_id, text_to_synthesize)

    if audio_data and isinstance(audio_data, bytes):
        voice_file = BufferedInputFile(audio_data, filename="voice.ogg")
        await callback.message.answer_voice(voice=voice_file)
        await redis_client.setex(redis_key, TTS_CACHE_TTL, "1")
        try:
            await callback.message.edit_reply_markup(reply_markup=None)
        except TelegramBadRequest:
            pass
        await callback.answer()
    else:
        await callback.answer("Не удалось озвучить сообщение.", show_alert=True)


@router.callback_query(F.data.startswith("history_page_"))
async def pagination_handler(callback: CallbackQuery, bot: Bot):
    page = int(callback.data.split("_")[-1])
    telegram_id = callback.from_user.id

    await bot.send_chat_action(chat_id=callback.message.chat.id, action=ChatAction.TYPING)
    history_data = await api_client.get_history(telegram_id, page=page)

    if history_data and history_data.get("data"):
        text = "Вот твоя история снов. Нажми на сон, чтобы посмотреть полную переписку."
        markup = create_history_keyboard(history_data)
        try:
            await callback.message.edit_text(text, reply_markup=markup)
        except TelegramBadRequest:
            await callback.answer("Изменений нет")
    else:
        await callback.message.edit_text("История снов пуста.")
    await callback.answer()

@router.callback_query(F.data.startswith("session_"))
async def session_view_handler(callback: CallbackQuery, bot: Bot):
    try:
        parts = callback.data.split("_")   
        session_id = parts[1]
        page = int(parts[3])
    except (ValueError, IndexError):
        await callback.answer("Ошибка в данных.", show_alert=True)
        return

    await bot.send_chat_action(chat_id=callback.message.chat.id, action=ChatAction.TYPING)
    session_data = await api_client.get_session_details(session_id)

    if session_data and session_data.get("messages"):
        title = session_data.get("title", "")
        safe_title = title.replace("<", "&lt;").replace(">", "&gt;")
        
        chat_log_parts = [f"📜 <b>Сон: {safe_title}</b>\n"]

        for msg in session_data["messages"]:
            role = "Вы" if msg["role"] == "user" else "Морфеус"
            content = format_message_to_html(msg["content"])
            chat_log_parts.append(f"<b>{role}:</b>\n{content}\n")

        full_text = "\n".join(chat_log_parts)
        
        await callback.message.edit_text(
            full_text,
            parse_mode=ParseMode.HTML, 
            reply_markup=get_session_view_keyboard(session_id, page),
        )
    else:
        await callback.answer("Не удалось загрузить данные этого сна.", show_alert=True)
    await callback.answer()

@router.callback_query(F.data.startswith("confirm_delete_"))
async def confirm_delete_handler(callback: CallbackQuery):
    try:
        _, _, session_id, page_str = callback.data.split("_")
        page = int(page_str)
    except (ValueError, IndexError):
        await callback.answer("Ошибка в данных.", show_alert=True)
        return

    await callback.message.edit_text(
        "Вы уверены, что хотите удалить этот сон? Это действие необратимо.",
        reply_markup=get_confirm_delete_keyboard(session_id, page)
    )
    await callback.answer()

@router.callback_query(F.data.startswith("delete_"))
async def delete_session_handler(callback: CallbackQuery):
    try:
        _, session_id, _ = callback.data.split("_")
    except (ValueError, IndexError):
        await callback.answer("Ошибка в данных.", show_alert=True)
        return

    telegram_id = callback.from_user.id
    
    await callback.message.edit_text("Удаляю сон...")
    response_code = await api_client.delete_session(session_id, telegram_id)
    if response_code == 204:
         await callback.message.edit_text("✅ Сон успешно удален.")
    else:
         await callback.message.edit_text(f"❌ Ошибка: Не удалось удалить сон (код: {response_code}).")
    await callback.answer()