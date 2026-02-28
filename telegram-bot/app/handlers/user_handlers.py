@router.message(CommandStart())
async def cmd_start(message: Message, state: FSMContext):
    await state.clear()  # Начинаем новый чат по команде /start
    text = (
        "Привет! Я FloraAI — твой ИИ-агроном. 🌿\n\n"
        "📸 **Просто отправь фото растения**, чтобы получить моментальный анализ.\n\n"
        "🔗 Чтобы задавать вопросы ИИ после анализа, **привяжи свой аккаунт**:"
    )
    await message.answer(text, reply_markup=get_webapp_keyboard(message.from_user.id))


@router.message(F.photo)
async def handle_photo(message: Message, state: FSMContext):
    wait_msg = await message.answer("Анализирую фото... ⏳")

    photo = message.photo[-1]
    file_info = await message.bot.get_file(photo.file_id)
    photo_bytes = await message.bot.download_file(file_info.file_path)

    # Отправляем на бэкенд telegram_id
    data, status = await upload_photo_to_api(
        telegram_id=message.from_user.id,
        photo_bytes=photo_bytes.read(),
        filename="plant.jpg"
    )

    await wait_msg.delete()

    if status == 201:
        # Анализ всегда успешен
        await message.answer(data.get('bot_reply', '✅ Анализ готов!'))

        # Если бэкенд прислал session_id — значит юзер ПРИВЯЗАН и можно чатить
        session_id = data.get('session_id')
        if session_id:
            await state.update_data(session_id=session_id)
            await state.set_state(ChatStates.active_chat)
        else:
            # Юзер НЕ ПРИВЯЗАН
            await message.answer(
                "💡 Чтобы обсудить этот анализ с ИИ, привяжите аккаунт.",
                reply_markup=get_webapp_keyboard(message.from_user.id)
            )
    else:
        await message.answer("Ошибка связи с сервером.")


@router.message(F.text)
async def handle_text(message: Message, state: FSMContext):
    # Проверяем, есть ли активная сессия в FSM
    state_data = await state.get_data()
    session_id = state_data.get('session_id')

    if not session_id:
        await message.answer(
            "⚠️ **Чат недоступен.**\n\n"
            "Чтобы общаться с ИИ, нужно сначала отправить фото растения. "
            "Если вы уже отправили фото, но чат не начался — привяжите аккаунт!",
            reply_markup=get_webapp_keyboard(message.from_user.id)
        )
        return

    # Если сессия есть, шлем сообщение
    data, status = await send_chat_message_to_api(
        telegram_id=message.from_user.id,
        message=message.text,
        session_id=session_id
    )

    if status == 200:
        await message.answer(data.get('reply'))
    else:
        await message.answer("Произошла ошибка. Попробуйте начать заново через /start")