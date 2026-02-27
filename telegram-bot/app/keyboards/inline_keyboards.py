from aiogram.types import InlineKeyboardButton, WebAppInfo
from aiogram.utils.keyboard import InlineKeyboardBuilder

WEB_APP_URL = "https://morpheusantihype.icu"

def get_onboarding_keyboard():
    builder = InlineKeyboardBuilder()
    connect_url = f"{WEB_APP_URL}/telegram-connect" 
    builder.button(
        text="➡️ Войти / Зарегистрироваться", 
        web_app=WebAppInfo(url=connect_url)
    )
    return builder.as_markup()

def get_profile_keyboard(subscription_status: str):
    builder = InlineKeyboardBuilder()
    builder.button(text="📖 Моя история снов", callback_data="show_history")
    if subscription_status != "PREMIUM":
        tariffs_url = f"{WEB_APP_URL}/tariffs"
        builder.button(
            text="💎 Повысить до Premium",
            web_app=WebAppInfo(url=tariffs_url)
        )
    builder.adjust(1)
    return builder.as_markup()

def create_history_keyboard(history_data: dict):
    builder = InlineKeyboardBuilder()
    
    pagination = history_data.get('pagination', {})
    current_page = pagination.get('currentPage', 1)
    total_pages = pagination.get('totalPages', 1)
    
    for session in history_data.get('data', []):
        callback_data = f"session_{session['id']}_page_{current_page}"
        builder.row(
            InlineKeyboardButton(text=f"📜 {session['title']}", callback_data=callback_data)
        )
    
    pagination_buttons = []
    if current_page > 1:
        pagination_buttons.append(
            InlineKeyboardButton(text="⬅️ Назад", callback_data=f"history_page_{current_page - 1}")
        )
    if current_page < total_pages:
        pagination_buttons.append(
            InlineKeyboardButton(text="Вперед ➡️", callback_data=f"history_page_{current_page + 1}")
        )
    
    if pagination_buttons:
        builder.row(*pagination_buttons)

    return builder.as_markup()

def get_session_view_keyboard(session_id: str, current_page: int):
    builder = InlineKeyboardBuilder()
    builder.button(text="🗑️ Удалить этот сон", callback_data=f"confirm_delete_{session_id}_{current_page}")
    builder.button(text="⬅️ Назад к истории", callback_data=f"history_page_{current_page}")
    builder.adjust(1)
    return builder.as_markup()

def get_confirm_delete_keyboard(session_id: str, current_page: int): 
    builder = InlineKeyboardBuilder()
    builder.button(text="✅ Да, удалить", callback_data=f"delete_{session_id}_{current_page}")
    builder.button(text="❌ Нет, оставить", callback_data=f"session_{session_id}_page_{current_page}")
    return builder.as_markup()

def get_premium_feature_keyboard():
    builder = InlineKeyboardBuilder()
    tariffs_url = f"{WEB_APP_URL}/tariffs"
    builder.button(
        text="💎 Улучшить до Premium",
        web_app=WebAppInfo(url=tariffs_url)
    )
    return builder.as_markup()

def get_tts_keyboard(message_id: int):
    builder = InlineKeyboardBuilder()
    builder.button(text="🔊 Озвучить", callback_data=f"tts_{message_id}")
    return builder.as_markup()