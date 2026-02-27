import { prisma } from '../config/prisma.js';
import { chatService } from './chat.service.js';

const findUserByTelegramId = async (telegramId) => {
  if (!telegramId) return null;
  return prisma.user.findUnique({ where: { telegramId: BigInt(telegramId) } });
};

const interpretDreamForTelegram = async (telegramId, text, source) => {
    const user = await findUserByTelegramId(telegramId);
    if (!user) {
        const error = new Error('Пользователь Telegram не найден или не связан с аккаунтом.');
        error.statusCode = 404;
        throw error;
    }
    await chatService.createNewChat(user.id, text, source);
    return { message: "Запрос принят." };
};

export const telegramService = {
  findUserByTelegramId,
  interpretDreamForTelegram,
};