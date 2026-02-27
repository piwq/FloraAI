from aiogram.fsm.state import State, StatesGroup

class PlantChatStates(StatesGroup):
    waiting_for_photo = State()
    chatting_about_plant = State()