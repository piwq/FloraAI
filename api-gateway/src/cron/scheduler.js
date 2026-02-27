import cron from 'node-cron';
import { prisma } from '../config/prisma.js';
import { SUBSCRIPTION_STATUS, INTERPRETATION_LIMITS } from '../config/constants.js';

const resetPremiumLimits = async () => {
  console.log('CRON: Запуск задачи сброса дневных лимитов для Premium...');
  try {
    const result = await prisma.user.updateMany({
      where: {
        subscriptionStatus: SUBSCRIPTION_STATUS.PREMIUM,
      },
      data: {
        remainingInterpretations: INTERPRETATION_LIMITS.PREMIUM_DAILY_COUNT,
      },
    });
    console.log(`CRON: Лимиты сброшены для ${result.count} Premium-пользователей.`);
  } catch (error) {
    console.error('CRON: Ошибка при сбросе лимитов:', error);
  }
};

export const startSchedulers = () => {
  cron.schedule('0 0 * * *', resetPremiumLimits, {
    scheduled: true,
    timezone: "Europe/Moscow",
  });
  console.log('Планировщик сброса лимитов запущен (00:00 по МСК).');
};