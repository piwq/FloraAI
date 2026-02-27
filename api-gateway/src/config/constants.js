// Статусы подписки
export const SUBSCRIPTION_STATUS = {
  FREE: 'FREE',
  PREMIUM: 'PREMIUM',
};

// Лимиты на интерпретацию
export const INTERPRETATION_LIMITS = {
  // Количество стартовых бесплатных попыток для нового пользователя
  FREE_INITIAL_COUNT: 3,
  
  // Количество ежедневных попыток для Premium-пользователя
  PREMIUM_DAILY_COUNT: 20,
  
  // Количество дней кулдауна для бесплатного пользователя
  FREE_COOLDOWN_DAYS: 3,
};

// Срок жизни JWT токена
export const JWT_EXPIRATION = '7d';

// Настройки Rate Limiter для аутентификации
export const AUTH_RATE_LIMITER = {
  // Окно в миллисекундах
  WINDOW_MS: 15 * 60 * 1000,
  
  // Максимальное количество запросов с одного IP за время WINDOW_MS
  MAX_REQUESTS: 20,
};