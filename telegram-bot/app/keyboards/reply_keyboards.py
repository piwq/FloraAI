from aiogram.types import ReplyKeyboardMarkup, KeyboardButton
from aiogram.utils.keyboard import ReplyKeyboardBuilder

def get_main_menu():
    builder = ReplyKeyboardBuilder()
    builder.row(
        KeyboardButton(text="▶️ Начать диалог"),
        KeyboardButton(text="👤 Профиль")
    )
    return builder.as_markup(resize_keyboard=True)

def get_dialog_menu():
    builder = ReplyKeyboardBuilder()
    builder.row(
        KeyboardButton(text="⏹️ Завершить диалог")
    )
    return builder.as_markup(resize_keyboard=True)