import os
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
from aiogram.types.web_app_info import WebAppInfo
from aiogram.utils.keyboard import InlineKeyboardBuilder


def get_webapp_keyboard(tg_id: int, msg_id: int = 0) -> InlineKeyboardMarkup:
    webapp_url = os.getenv('WEBAPP_URL', 'https://your-domain.com')
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🌿 Привязать профиль",
                              web_app=WebAppInfo(url=f"{webapp_url}/telegram-connect?tg_id={tg_id}&msg_id={msg_id}"))]
    ])


def get_premium_keyboard() -> InlineKeyboardMarkup:
    webapp_url = os.getenv('WEBAPP_URL', 'https://your-domain.com')
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="💎 Оформить Premium", web_app=WebAppInfo(url=f"{webapp_url}/tariffs"))]
    ])


# ==========================================
# 🔥 НОВЫЕ КЛАВИАТУРЫ (Адаптированные под FloraAI)
# ==========================================

def get_profile_keyboard(subscription_status: str) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.button(text="📚 Моя история анализов", callback_data="show_history")
    if subscription_status != "PREMIUM":
        webapp_url = os.getenv('WEBAPP_URL', 'https://your-domain.com')
        builder.button(text="💎 Повысить до Premium", web_app=WebAppInfo(url=f"{webapp_url}/tariffs"))
    builder.adjust(1)
    return builder.as_markup()


def get_paginated_history_keyboard(history_list: list, current_page: int = 1,
                                   per_page: int = 5) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()

    total_pages = max(1, (len(history_list) + per_page - 1) // per_page)
    start_idx = (current_page - 1) * per_page
    end_idx = start_idx + per_page

    # Кнопки с анализами
    for session in history_list[start_idx:end_idx]:
        callback_data = f"session_{session['id']}_page_{current_page}"
        builder.row(InlineKeyboardButton(text=f"🌿 {session['title']} ({session['date']})", callback_data=callback_data))

    # Кнопки пагинации
    pagination_buttons = []
    if current_page > 1:
        pagination_buttons.append(
            InlineKeyboardButton(text="⬅️ Назад", callback_data=f"history_page_{current_page - 1}"))
    if current_page < total_pages:
        pagination_buttons.append(
            InlineKeyboardButton(text="Вперед ➡️", callback_data=f"history_page_{current_page + 1}"))

    if pagination_buttons:
        builder.row(*pagination_buttons)

    return builder.as_markup()


def get_session_view_keyboard(session_id: str, current_page: int) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.button(text="💬 Продолжить диалог с ИИ", callback_data=f"activate_chat_{session_id}")
    builder.button(text="🗑️ Удалить этот анализ", callback_data=f"confirm_delete_{session_id}_{current_page}")
    builder.button(text="⬅️ Назад к истории", callback_data=f"history_page_{current_page}")
    builder.adjust(1)
    return builder.as_markup()


def get_confirm_delete_keyboard(session_id: str, current_page: int) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.button(text="✅ Да, удалить", callback_data=f"delete_session_{session_id}_{current_page}")
    builder.button(text="❌ Нет, оставить", callback_data=f"session_{session_id}_page_{current_page}")
    builder.adjust(2)
    return builder.as_markup()


# --- Оставляем настройки ИИ ---
def get_settings_keyboard(conf: float, iou: float, imgsz: int) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.button(text=f"🎯 Уверенность (Conf): {conf}", callback_data="set_conf")
    builder.button(text=f"🔗 Перекрытие (IoU): {iou}", callback_data="set_iou")
    builder.button(text=f"🖼 Детализация (ImgSz): {imgsz}", callback_data="set_imgsz")
    builder.button(text="❌ Закрыть", callback_data="close_settings")
    builder.adjust(1)
    return builder.as_markup()


def get_back_settings_keyboard() -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.button(text="🔙 Назад", callback_data="back_settings")
    return builder.as_markup()