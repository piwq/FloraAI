import { prisma } from '../config/prisma.js';
import { SUBSCRIPTION_STATUS, INTERPRETATION_LIMITS } from '../config/constants.js';
import redisClient from '../config/redis.js';
import { sendMessageToUser } from '../config/socketHelpers.js';
import { chatService } from './chat.service.js';

const upgradeToPremium = async (userId) => {
  const userBeforeUpdate = await prisma.user.findUnique({
    where: { id: userId },
    select: { telegramId: true }
  });

  if (!userBeforeUpdate) {
    throw new Error('Пользователь не найден');
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      subscriptionStatus: SUBSCRIPTION_STATUS.PREMIUM,
      remainingInterpretations: INTERPRETATION_LIMITS.PREMIUM_DAILY_COUNT,
    },
    select: {
        id: true, email: true, name: true, birthDate: true,
        subscriptionStatus: true, remainingInterpretations: true, createdAt: true,
        telegramId: true, 
    },
  });
  await redisClient.del(`user:${userId}`);

  if (updatedUser.telegramId) {
    const io = chatService._io;
    const userSocketMap = chatService._userSocketMap;

    if (io && userSocketMap) {
        sendMessageToUser(io, userSocketMap, 'bot', 'user_upgraded_to_premium', {
            telegramId: updatedUser.telegramId.toString(),
            name: updatedUser.name || 'Пользователь',
        });
    } else {
        console.error("SOCKET ERROR: io или userSocketMap не инициализированы в chatService. Не могу отправить уведомление о Premium.");
    }
  }

  return updatedUser;
};

export const paymentService = {
  upgradeToPremium,
};