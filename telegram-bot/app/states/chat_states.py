from aiogram.fsm.state import State, StatesGroup

class ChatStates(StatesGroup):
    active_chat = State()

class SettingsStates(StatesGroup):
    wait_conf = State()
    wait_iou = State()
    wait_imgsz = State()