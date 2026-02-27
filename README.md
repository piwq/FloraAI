# Morpheus Project

ИИ-толкователь снов на базе YandexGPT. Микросервисная архитектура с веб-интерфейсом и Telegram-ботом.

---

## О проекте

**Morpheus** — это интеллектуальный сервис для психологического анализа сновидений. Проект разработан в рамках **всероссийского хакатона «Кибер102»**, который проходил **с 14 по 16 ноября 2025 года**. Хакатон проводился на базе в городе Стерлитамак (Республика Башкортостан) с возможностью дистанционного участия для команд со всей России. На реализацию задач давалось **48 часов**.

### Что умеет Morpheus?

Morpheus помогает пользователям понять свои сны через призму психологии. Сервис использует искусственный интеллект для анализа символов, эмоций и сюжетов сновидений, предлагая персонализированные интерпретации.

---

## Как это работает (простым языком)

### Для пользователя через сайт:

1. **Регистрация** — пользователь создаёт аккаунт, указывая email или номер телефона
2. **Описание сна** — в текстовом поле пользователь описывает свой сон своими словами
3. **Получение толкования** — через несколько секунд ИИ-ассистент «Морфеус» отвечает:
   - Анализирует ключевые символы сна (вода, полёт, дом и т.д.)
   - Предлагает возможные психологические интерпретации
   - Связывает символы с возможными жизненными ситуациями
   - Задаёт вопросы для самоанализа
4. **Диалог** — пользователь может задавать уточняющие вопросы по своему сну
5. **История** — все толкования сохраняются, к ним можно вернуться в любой момент

### Для пользователя через Telegram-бота:

1. **Запуск бота** — пользователь находит бота в Telegram и нажимает «Старт»
2. **Привязка аккаунта** — бот предлагает войти через веб-приложение для синхронизации данных
3. **Начало диалога** — нажатие кнопки «Начать диалог» переводит в режим общения
4. **Отправка сна** — можно написать текстом или (для Premium) записать голосовое сообщение
5. **Ответ Морфеуса** — бот присылает толкование, которое можно прослушать (Premium)
6. **Просмотр истории** — через меню «Профиль» → «История снов»

### Что особенного:

- **Контекст предыдущих снов** — ИИ помнит ваши прошлые сны и находит связи между ними
- **Психологический подход** — никакой мистики и гаданий, только научный анализ
- **Голосовой ввод** — можно рассказать сон голосом, система распознает речь
- **Озвучка ответов** — толкования можно прослушать голосом

### Система подписок:

| | Бесплатно | Premium |
|---|---|---|
| Стартовые толкования | 3 | 20 в день |
| После исчерпания | 1 раз в 3 дня | Сброс каждую ночь |
| Голосовой ввод | — | Да |
| Озвучка ответов | — | Да |

---

## Содержание (техническая документация)

1. [Стек технологий](#стек-технологий)
2. [Архитектура системы](#архитектура-системы)
3. [База данных](#база-данных-prisma)
4. [Детальное описание сервисов](#детальное-описание-сервисов)
   - [API Gateway](#1-api-gateway)
   - [AI Service](#2-ai-service)
   - [TTS Service](#3-tts-service)
   - [ASR Service](#4-asr-service)
   - [Telegram Bot](#5-telegram-bot)
5. [Ключевые механизмы](#ключевые-механизмы)
6. [API Endpoints](#api-endpoints)
7. [Запуск проекта](#запуск-проекта)
8. [Структура проекта](#структура-проекта)

---

## Стек технологий

| Компонент | Технологии |
|-----------|------------|
| **API Gateway** | Express.js 5, Socket.IO 4, Prisma ORM, JWT, Helmet, express-rate-limit |
| **AI Service** | Node.js, Express, YandexGPT API (foundationModels/v1/completion) |
| **TTS Service** | Fastify, Yandex SpeechKit TTS API |
| **ASR Service** | Express, Yandex SpeechKit STT API, FFmpeg (fluent-ffmpeg) |
| **Telegram Bot** | Python 3.11, aiogram 3.x, python-socketio, aiohttp |
| **Frontend** | React 18, Vite, TailwindCSS, React Query |
| **Database** | PostgreSQL 15, Redis 7 |
| **Infra** | Docker Compose, node-cron |

---

## Архитектура системы

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              КЛИЕНТЫ                                         │
├─────────────────────────────────┬───────────────────────────────────────────┤
│     Web Frontend (:80)          │           Telegram Bot                     │
│     React + Vite                │           aiogram 3.x + Socket.IO          │
└───────────────┬─────────────────┴───────────────────┬───────────────────────┘
                │ HTTP + WebSocket                    │ WebSocket (python-socketio)
                │                                     │
                ▼                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         API GATEWAY (:3001)                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Express.js + Socket.IO Server                                          ││
│  │  ├── REST API (/api/auth, /api/chat, /api/telegram, /api/payment)      ││
│  │  ├── WebSocket Events (telegram_response, user_authed, new_message)    ││
│  │  ├── JWT Authentication + Redis Token Blocklist                        ││
│  │  ├── Rate Limiting (20 req/15min для /api/auth)                        ││
│  │  └── CORS (localhost, morpheusantihype.icu)                            ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└──────────┬──────────────────┬──────────────────┬──────────────────┬─────────┘
           │                  │                  │                  │
           ▼                  ▼                  ▼                  ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────┐
│  AI Service      │ │  TTS Service     │ │  ASR Service     │ │ PostgreSQL   │
│  (:3002)         │ │  (:3010)         │ │  (:3020)         │ │ (:5433)      │
│                  │ │                  │ │                  │ │              │
│  YandexGPT       │ │  Yandex TTS      │ │  Yandex STT      │ │ Prisma ORM   │
│  - /interpret    │ │  - /synthesize   │ │  - /stt          │ │              │
│  - /classify-    │ │                  │ │  FFmpeg          │ │ Redis (:6379)│
│    intent        │ │                  │ │  конвертация     │ │ Кэширование  │
└──────────────────┘ └──────────────────┘ └──────────────────┘ └──────────────┘
```

### Потоки данных

**Web-клиент → Толкование сна:**
```
1. Frontend отправляет POST /api/chat/new с текстом сна
2. API Gateway проверяет JWT токен
3. chat.service проверяет лимиты пользователя
4. ai.service вызывает /classify-intent для проверки релевантности
5. Если текст о сне → вызов /interpret с контекстом предыдущих снов
6. Ответ сохраняется в PostgreSQL (ChatSession + Message)
7. WebSocket событие 'new_message' отправляется клиенту
```

**Telegram-бот → Толкование сна:**
```
1. Пользователь отправляет текст в бот
2. user_handlers.py через api_client вызывает /api/telegram/interpret
3. telegram.service находит пользователя по telegramId
4. chat.service обрабатывает запрос (аналогично web)
5. Ответ отправляется через WebSocket событие 'telegram_response'
6. bot.py получает событие и отправляет сообщение в Telegram
```

---

## База данных (Prisma)

### Схема моделей

```prisma
// Пользователь системы
model User {
  id                       String             @id @default(uuid())
  email                    String?            @unique
  phone                    String?            @unique
  passwordHash             String?
  name                     String?
  birthDate                DateTime?          @db.Date
  telegramId               BigInt?            @unique  // Связь с Telegram

  // Подписка
  subscriptionStatus       SubscriptionStatus @default(FREE)
  subscriptionExpiresAt    DateTime?
  remainingInterpretations Int                @default(3)  // Счетчик лимитов
  lastFreeInterpretationAt DateTime?          // Для cooldown FREE

  // Роли и статус
  role                     UserRole           @default(USER)
  status                   UserStatus         @default(ACTIVE)  // BANNED блокирует доступ

  chatSessions             ChatSession[]
  payments                 Payment[]
}

// Сессия диалога (один сон = одна сессия)
model ChatSession {
  id        String    @id @default(uuid())
  userId    String
  title     String    // Первые 40 символов сна
  createdAt DateTime  @default(now())

  user      User      @relation(...)
  messages  Message[]

  @@index([userId])  // Индекс для быстрого поиска по пользователю
}

// Сообщение в диалоге
model Message {
  id        String      @id @default(uuid())
  sessionId String
  role      MessageRole // 'user' | 'assistant'
  content   String      @db.Text
  audioUrls String[]    @default([])  // URL аудио-версий (TTS)
  createdAt DateTime    @default(now())

  session   ChatSession @relation(...)

  @@index([sessionId])
}

// Платежи
model Payment {
  id                String        @id @default(uuid())
  userId            String
  amount            Decimal       @db.Decimal(10, 2)
  currency          String        @default("RUB")
  status            PaymentStatus @default(PENDING)  // PENDING → COMPLETED/FAILED
  provider          String        @default("robokassa")
  providerPaymentId String?       @unique
}

enum SubscriptionStatus { FREE, PREMIUM }
enum MessageRole { user, assistant }
enum PaymentStatus { PENDING, COMPLETED, FAILED }
enum UserRole { USER, ADMIN }
enum UserStatus { ACTIVE, BANNED }
```

### Почему так реализовано

1. **telegramId как BigInt** — Telegram ID может превышать MAX_SAFE_INTEGER в JavaScript
2. **Разделение email/phone** — Пользователь может регистрироваться любым способом
3. **remainingInterpretations + lastFreeInterpretationAt** — Комбинированная система лимитов
4. **Индексы на userId и sessionId** — Ускорение основных запросов
5. **status: BANNED** — Мягкая блокировка без удаления данных

---

## Детальное описание сервисов

### 1. API Gateway

Центральный сервис, координирующий все взаимодействия.

#### 1.1 WebSocket авторизация (`socket.js`)

```javascript
io.use((socket, next) => {
  const token = socket.handshake.auth.token;

  // Вариант 1: Внутренний сервис (Telegram-бот)
  if (token === process.env.INTERNAL_SERVICE_SECRET) {
    socket.isBot = true;
    socket.isAuthed = true;
    return next();
  }

  // Вариант 2: JWT токен пользователя
  if (token) {
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        socket.isAuthed = false;
        return next();  // Разрешаем подключение, но без авторизации
      }
      socket.userId = decoded.userId;
      socket.isAuthed = true;
      next();
    });
  } else {
    socket.isAuthed = false;
    next();  // Гостевое подключение
  }
});

// Маппинг для адресной доставки сообщений
const userSocketMap = {};

io.on('connection', (socket) => {
  if (socket.isBot) {
    userSocketMap['bot'] = socket.id;  // Бот всегда под ключом 'bot'
  } else if (socket.isAuthed && socket.userId) {
    userSocketMap[socket.userId] = socket.id;  // userId → socketId
  }
});
```

**Зачем:**
- Бот авторизуется через секретный ключ, не требуя JWT
- Гостевые подключения разрешены для просмотра публичной активности
- `userSocketMap` позволяет отправлять сообщения конкретному пользователю

#### 1.2 JWT Middleware с Redis Blocklist (`auth.middleware.js`)

```javascript
export const protect = asyncHandler(async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  // Проверка на logout (токен в blocklist)
  const isBlocked = await redisClient.get(`blocklist:${token}`);
  if (isBlocked) {
    throw new Error('Токен недействителен (logout)');
  }

  // Стандартная JWT верификация
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  // Проверка статуса пользователя
  const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
  if (!user || user.status === 'BANNED') {
    throw new Error('Аккаунт заблокирован');
  }

  req.user = user;
  next();
});
```

**Logout с blocklist:**
```javascript
const logoutUser = async (token) => {
  const decoded = jwt.decode(token);
  const remainingSeconds = decoded.exp - Math.floor(Date.now() / 1000);

  if (remainingSeconds > 0) {
    // Храним токен в blocklist до его естественного истечения
    await redisClient.setEx(`blocklist:${token}`, remainingSeconds, 'true');
  }
};
```

**Зачем Redis blocklist:**
- JWT stateless — нельзя "отозвать" токен
- Blocklist позволяет инвалидировать токены при logout
- TTL = оставшееся время жизни токена (экономия памяти)

#### 1.3 Система лимитов (`chat.service.js`)

```javascript
const INTERPRETATION_LIMITS = {
  FREE_INITIAL_COUNT: 3,      // Стартовые попытки
  PREMIUM_DAILY_COUNT: 20,    // Дневной лимит Premium
  FREE_COOLDOWN_DAYS: 3,      // Кулдаун для FREE
};

async _checkAndDecrementInterpretations(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  let hasAccess = false;

  if (user.subscriptionStatus === 'PREMIUM') {
    // Premium: просто проверяем счетчик
    hasAccess = user.remainingInterpretations > 0;
  } else {
    // FREE: счетчик ИЛИ прошел кулдаун
    const cooldownDate = new Date();
    cooldownDate.setDate(cooldownDate.getDate() - INTERPRETATION_LIMITS.FREE_COOLDOWN_DAYS);

    hasAccess = user.remainingInterpretations > 0 ||  // Есть стартовые
                !user.lastFreeInterpretationAt ||      // Никогда не использовал
                user.lastFreeInterpretationAt < cooldownDate;  // Кулдаун прошел
  }

  if (!hasAccess) {
    // Уведомление через WebSocket
    sendMessageToUser(io, userSocketMap, userId, 'error_message', {
      type: 'no_interpretations',
      content: 'Лимит исчерпан'
    });
    throw error;
  }

  // Декремент счетчика
  const updateData = {};
  if (user.subscriptionStatus === 'PREMIUM') {
    updateData.remainingInterpretations = { decrement: 1 };
  } else {
    if (user.remainingInterpretations > 0) {
      updateData.remainingInterpretations = { decrement: 1 };
    }
    updateData.lastFreeInterpretationAt = new Date();  // Обновляем время последнего использования
  }

  await prisma.user.update({ where: { id: userId }, data: updateData });
  await redisClient.del(`user:${userId}`);  // Инвалидация кэша
}
```

**Логика FREE:**
- 3 начальных толкования (remainingInterpretations)
- После исчерпания — 1 толкование раз в 3 дня (cooldown)
- `lastFreeInterpretationAt` отслеживает время последнего использования

**Логика PREMIUM:**
- 20 толкований в день
- Сброс в 00:00 по МСК через cron

#### 1.4 Cron-задача сброса лимитов (`scheduler.js`)

```javascript
import cron from 'node-cron';

const resetPremiumLimits = async () => {
  const result = await prisma.user.updateMany({
    where: { subscriptionStatus: 'PREMIUM' },
    data: { remainingInterpretations: INTERPRETATION_LIMITS.PREMIUM_DAILY_COUNT }
  });
  console.log(`Лимиты сброшены для ${result.count} Premium-пользователей`);
};

export const startSchedulers = () => {
  // Каждый день в 00:00 по московскому времени
  cron.schedule('0 0 * * *', resetPremiumLimits, {
    timezone: "Europe/Moscow"
  });
};
```

#### 1.5 Redis кэширование

**Кэш профиля пользователя:**
```javascript
const getUserById = async (userId) => {
  const cacheKey = `user:${userId}`;

  const cached = await redisClient.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  await redisClient.setEx(cacheKey, 300, JSON.stringify(user));  // TTL 5 минут

  return user;
};
```

**Кэш списка сессий с пагинацией:**
```javascript
const getSessionsByUser = async (userId, page, limit) => {
  const cacheKey = `sessions:user-${userId}:page-${page}:limit-${limit}`;

  const cached = await redisClient.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const [sessions, totalCount] = await prisma.$transaction([
    prisma.chatSession.findMany({ where: { userId }, skip: (page-1)*limit, take: limit }),
    prisma.chatSession.count({ where: { userId } })
  ]);

  const result = { data: sessions, pagination: { totalItems: totalCount, ... } };
  await redisClient.setEx(cacheKey, 300, JSON.stringify(result));

  return result;
};
```

**Инвалидация при изменениях:**
```javascript
// При создании новой сессии
const pattern = `sessions:user-${userId}:*`;
const keys = await redisClient.keys(pattern);
if (keys.length > 0) await redisClient.del(keys);

// При удалении сессии
await redisClient.del([
  `sessions:user-${userId}:page-1:limit-15`,
  `session:${sessionId}`
]);
```

#### 1.6 Telegram WebApp авторизация (`auth.service.js`)

Валидация `initData` от Telegram Mini App:

```javascript
const linkTelegramAccount = async (userId, telegramInitData) => {
  const params = new URLSearchParams(telegramInitData);
  const hash = params.get('hash');
  const userPayload = JSON.parse(params.get('user'));
  const authDate = params.get('auth_date');

  // 1. Формируем строку для проверки
  const dataToCheck = [];
  for (const [key, value] of params.entries()) {
    if (key !== 'hash') dataToCheck.push(`${key}=${value}`);
  }
  dataToCheck.sort();
  const dataCheckString = dataToCheck.join('\n');

  // 2. Вычисляем HMAC-SHA256
  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(process.env.TELEGRAM_BOT_TOKEN)
    .digest();

  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  // 3. Сравниваем хэши
  if (calculatedHash !== hash) {
    throw new Error('Верификация Telegram не пройдена');
  }

  // 4. Проверяем свежесть данных (1 час)
  if (Date.now() / 1000 - parseInt(authDate) > 3600) {
    throw new Error('Данные устарели');
  }

  // 5. Проверяем конфликты (telegramId уже привязан к другому аккаунту)
  const conflictingUser = await prisma.user.findUnique({
    where: { telegramId: BigInt(userPayload.id) }
  });
  if (conflictingUser && conflictingUser.id !== userId) {
    throw new Error('Telegram уже привязан к другому аккаунту');
  }

  // 6. Обновляем пользователя
  await prisma.user.update({
    where: { id: userId },
    data: {
      telegramId: BigInt(userPayload.id),
      name: currentUser.name || userPayload.first_name  // Заполняем имя если пусто
    }
  });
};
```

**Алгоритм валидации (по документации Telegram):**
1. Собираем все поля кроме `hash` в формате `key=value`
2. Сортируем по алфавиту и соединяем через `\n`
3. Генерируем secret key: HMAC-SHA256('WebAppData', BOT_TOKEN)
4. Вычисляем HMAC-SHA256(secret_key, data_check_string)
5. Сравниваем с полученным hash

---

### 2. AI Service

Сервис взаимодействия с YandexGPT.

#### 2.1 Классификация намерений (`/classify-intent`)

```javascript
app.post('/classify-intent', async (req, res) => {
  const { text } = req.body;

  const classificationPrompt = `Ты — точный и быстрый классификатор намерений.
Твоя задача — определить, описывает ли пользователь свой сон, сновидение, кошмар или видение.
Не отвечай на вопрос. Не давай объяснений.
Твой ответ: "true" если это о сне, "false" если это любой другой вопрос.`;

  const response = await callYandexGPT(classificationPrompt, text, [], []);
  const isDreamRelated = response.trim().toLowerCase() === 'true';

  res.json({ is_dream_related: isDreamRelated });
});
```

**Использование в API Gateway (`ai.service.js`):**
```javascript
export const getInterpretation = async (user, text, history, previousDreams) => {
  // Классификация только для НОВЫХ сессий (history.length === 0)
  if (history.length === 0) {
    const classification = await axios.post(`${AI_SERVICE_URL}/classify-intent`, { text });

    if (!classification.data.is_dream_related) {
      return {
        success: true,
        data: "Я — Морфеус, толкователь снов. Пожалуйста, опишите свой сон."
      };
    }
  }

  // Если о сне — вызываем /interpret
  const response = await axios.post(`${AI_SERVICE_URL}/interpret`, { ... });
  return { success: true, data: response.data.interpretation };
};
```

**Зачем:**
- Фильтрация нерелевантных запросов ("какая погода?", "2+2=?")
- Экономия токенов YandexGPT
- Не применяется к продолжению диалога (history > 0)

#### 2.2 Толкование снов (`/interpret`)

**Системный промпт (`buildSystemPrompt`):**
```javascript
function buildSystemPrompt(request) {
  const { user_info, previous_dreams } = request;

  let systemPrompt = `Ты — «Морфеус», ИИ-ассистент для психологического анализа сновидений.

// ***ОСНОВНЫЕ ПРИНЦИПЫ***
1. **Только интерпретация снов.** Отказывайся отвечать на нерелевантные вопросы.
2. **Психологический подход.** Психоанализ, гештальт, КПТ. Без мистики и гаданий.
3. **Индивидуальный контекст.** Символы личные. Предлагай варианты, не истины.
4. **Эмпатия и поддержка.** Без критики и осуждения.
5. **Краткость и ясность.**

// ***ИНФОРМАЦИЯ О ПОЛЬЗОВАТЕЛЕ***
- Имя: ${user_info.name || 'Не указано'}
${user_info.birthDate ? `- Дата рождения: ${user_info.birthDate}` : ''}`;

  // Добавляем контекст предыдущих снов если есть
  if (previous_dreams?.length > 0) {
    systemPrompt += `

// ***АНАЛИЗ В ДИНАМИКЕ (ВАЖНО)***
Есть доступ к предыдущим снам. **Обязательно используй для анализа:**
1. Найди связи: повторяющиеся символы, темы, эмоции
2. Отметь динамику: изменения в символах между снами
3. Интегрируй в ответ органично`;
  }

  systemPrompt += `

// ***ФОРМАТ ОТВЕТА***
1. Эмоциональное вступление
2. Анализ 2-3 ключевых символов
3. Общий вывод и связь с жизнью
4. 2-3 вопроса для самоанализа (ОБЯЗАТЕЛЬНО)`;

  return { systemPrompt };
}
```

**Вызов YandexGPT (`yandexGPT.js`):**
```javascript
export async function callYandexGPT(systemPrompt, newMessageText, history, previousDreams) {
  const messages = [{ role: 'system', text: systemPrompt }];

  // Добавляем историю диалога
  history.forEach(msg => {
    messages.push({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      text: msg.content
    });
  });

  // Формируем сообщение с контекстом предыдущих снов
  let finalUserMessage = newMessageText;
  if (previousDreams.length > 0) {
    finalUserMessage = `Проанализируй мой новый сон, учитывая предыдущие:\n`;
    previousDreams.forEach(dream => {
      finalUserMessage += `- "${dream.substring(0, 100)}..."\n`;
    });
    finalUserMessage += `\n---\n\nМой новый сон: "${newMessageText}"\n\nПроведи параллели.`;
  }

  messages.push({ role: 'user', text: finalUserMessage });

  const response = await axios.post(
    'https://llm.api.cloud.yandex.net/foundationModels/v1/completion',
    {
      modelUri: MODEL_URI,  // gpt://folder-id/yandexgpt-lite
      completionOptions: {
        stream: false,
        temperature: 0.6,  // Баланс креативности и точности
        maxTokens: 1500
      },
      messages
    },
    { headers: { 'Authorization': `Api-Key ${API_KEY}` } }
  );

  return response.data.result.alternatives[0].message.text;
}
```

**Зачем передавать предыдущие сны:**
- Анализ динамики (повторяющиеся символы)
- Персонализация интерпретации
- Более глубокий психологический анализ

---

### 3. TTS Service

Синтез речи через Yandex SpeechKit.

```javascript
const config = {
  yandex: {
    apiUrl: 'https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize',
  },
  limits: { maxTextLength: 249 },  // Ограничение API
  defaults: {
    voice: 'ermil',      // Мужской голос
    emotion: 'neutral',
    speed: 1.0,
    format: 'mp3',
    lang: 'ru-RU',
    sampleRate: 48000,
  }
};

app.post('/synthesize', { schema: synthesizeSchema }, async (req, reply) => {
  const { text, voice, emotion, speed, format } = req.body;

  const params = new URLSearchParams({
    text,
    lang: config.defaults.lang,
    voice: voice || config.defaults.voice,
    emotion: emotion || config.defaults.emotion,
    speed: speed || config.defaults.speed,
    format: format || config.defaults.format,
    sampleRateHertz: config.defaults.sampleRate,
  });

  const response = await yandexApiClient.post('', params.toString());

  reply.header('Content-Type', format === 'ogg_opus' ? 'audio/ogg' : 'audio/mpeg');
  return reply.send(response.data);  // Возвращаем бинарные аудиоданные
});
```

**Особенности:**
- Лимит 249 символов на запрос (ограничение Yandex)
- Поддержка mp3 и ogg_opus форматов
- Fastify для высокой производительности

---

### 4. ASR Service

Распознавание речи через Yandex SpeechKit.

```javascript
app.post('/stt', async (req, res) => {
  const inputId = uuidv4();
  const contentType = req.headers['content-type'];
  const inputPath = path.join(TEMP_DIR, `${inputId}.${extension}`);
  const outputPath = path.join(TEMP_DIR, `${inputId}-converted.ogg`);

  // 1. Сохраняем входящий файл
  await fs.writeFile(inputPath, req.body);

  // 2. Конвертируем в OGG Opus через FFmpeg
  await new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .toFormat('ogg')
      .audioCodec('libopus')
      .on('end', resolve)
      .on('error', reject)
      .save(outputPath);
  });

  // 3. Отправляем в Yandex STT
  const audioBuffer = await fs.readFile(outputPath);
  const response = await fetch(
    'https://stt.api.cloud.yandex.net/speech/v1/stt:recognize?lang=ru-RU&format=oggopus&sampleRateHertz=48000',
    {
      method: 'POST',
      headers: {
        'Authorization': `Api-Key ${YANDEX_API_KEY}`,
        'Content-Type': 'audio/ogg',
      },
      body: audioBuffer,
    }
  );

  const { result } = await response.json();

  // 4. Исправляем баг дублирования текста
  const fixedText = fixDuplicateText(result);

  res.json({ text: fixedText });

  // 5. Очистка временных файлов
  await fs.unlink(inputPath);
  await fs.unlink(outputPath);
});

// Баг Yandex STT: иногда дублирует текст ("привет привет")
const fixDuplicateText = (text) => {
  const mid = Math.floor(text.length / 2);
  if (text.substring(0, mid) === text.substring(mid)) {
    return text.substring(0, mid);
  }
  return text;
};
```

**Зачем FFmpeg:**
- Telegram отправляет голосовые в формате OGG Opus
- Браузеры могут отправлять WebM, WAV и другие форматы
- FFmpeg нормализует всё в единый формат для Yandex

---

### 5. Telegram Bot

Бот на aiogram 3.x с FSM (Finite State Machine).

#### 5.1 Архитектура бота (`bot.py`)

```python
import socketio
from aiogram import Bot, Dispatcher
from aiogram.fsm.storage.memory import MemoryStorage

sio = socketio.AsyncClient()
bot_instance = Bot(token=BOT_TOKEN)

# WebSocket события от API Gateway
@sio.event
async def telegram_response(data):
    """Получение ответа AI для отправки пользователю"""
    telegram_id = int(data['telegramId'])
    content = format_for_telegram(data['content'])
    await bot_instance.send_message(chat_id=telegram_id, text=content, parse_mode=ParseMode.HTML)

@sio.event
async def user_upgraded_to_premium(data):
    """Уведомление о покупке Premium"""
    telegram_id = int(data['telegramId'])
    await bot_instance.send_message(
        chat_id=telegram_id,
        text="🎉 Твой статус обновлен до Premium!"
    )

@sio.event
async def user_authed(data):
    """Уведомление об успешной привязке аккаунта"""
    telegram_id = int(data['telegramId'])
    await bot_instance.send_message(
        chat_id=telegram_id,
        text=f"Отлично, {data.get('name')}! Аккаунт успешно связан.",
        reply_markup=get_main_menu()
    )

async def main():
    storage = MemoryStorage()
    dp = Dispatcher(storage=storage)
    dp.include_router(user_handlers.router)

    # Запуск параллельно: WebSocket + Polling
    socket_task = asyncio.create_task(run_socketio())
    polling_task = asyncio.create_task(dp.start_polling(bot_instance))

    await asyncio.gather(socket_task, polling_task)

async def run_socketio():
    """Подключение к API Gateway с реконнектом"""
    while True:
        try:
            await sio.connect(
                API_URL,
                auth={'token': INTERNAL_SERVICE_SECRET},
                transports=['websocket']
            )
            await sio.wait()
        except socketio.exceptions.ConnectionError:
            await asyncio.sleep(5)  # Реконнект через 5 секунд
```

#### 5.2 FSM для диалога (`user_handlers.py`)

```python
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.filters import StateFilter

class ChatStates(StatesGroup):
    in_dialogue = State()  # Пользователь в режиме диалога

# Начало диалога
@router.message(F.text == "▶️ Начать диалог", StateFilter(None))
async def start_dialog_handler(message: Message, state: FSMContext):
    user_data = await api_client.find_user_by_telegram_id(message.from_user.id)

    if user_data:
        await state.set_state(ChatStates.in_dialogue)
        await message.answer("Я готов слушать. Опиши свой сон.", reply_markup=get_dialog_menu())
    else:
        await message.answer("Сначала нужно связать аккаунт.", reply_markup=get_onboarding_keyboard())

# Обработка сообщений в диалоге
@router.message(StateFilter(ChatStates.in_dialogue))
async def dialogue_message_handler(message: Message, state: FSMContext, bot: Bot):
    telegram_id = message.from_user.id
    data = await state.get_data()
    session_id = data.get("session_id")

    await bot.send_chat_action(chat_id=message.chat.id, action=ChatAction.TYPING)

    if not session_id:
        # Новый сон → создаём сессию
        response = await api_client.send_dream(telegram_id, message.text)

        if response and response.get("sessionId"):
            await state.update_data(session_id=response["sessionId"])
            formatted = format_message_to_html(response.get("initialResponse"))
            sent = await bot.send_message(message.chat.id, formatted, parse_mode=ParseMode.HTML)
            await sent.edit_reply_markup(reply_markup=get_tts_keyboard(sent.message_id))
        else:
            # Обработка ошибки лимитов
            if "Доступные толкования закончились" in response.get("error", ""):
                await handle_interpretations_exhausted(message, state, user_data)
    else:
        # Продолжение диалога
        response = await api_client.send_follow_up(session_id, telegram_id, message.text)
        formatted = format_message_to_html(response.get("response"))
        sent = await bot.send_message(message.chat.id, formatted, parse_mode=ParseMode.HTML)
        await sent.edit_reply_markup(reply_markup=get_tts_keyboard(sent.message_id))

# Завершение диалога
@router.message(F.text == "⏹️ Завершить диалог", StateFilter(ChatStates.in_dialogue))
async def end_dialog_handler(message: Message, state: FSMContext):
    await state.clear()
    await message.answer("Диалог завершен.", reply_markup=get_main_menu())
```

**Зачем FSM:**
- Отслеживание состояния пользователя (в диалоге / не в диалоге)
- Хранение `session_id` между сообщениями
- Предотвращение случайных действий

#### 5.3 Голосовые сообщения (Premium)

```python
@router.message(F.voice, StateFilter(ChatStates.in_dialogue))
async def voice_message_handler(message: Message, state: FSMContext, bot: Bot):
    telegram_id = message.from_user.id
    user_data = await api_client.find_user_by_telegram_id(telegram_id)

    # Проверка Premium
    if user_data.get("subscriptionStatus") != "PREMIUM":
        await message.answer(
            "🎙️ Распознавание речи доступно только в Premium.",
            reply_markup=get_premium_feature_keyboard()
        )
        return

    # Скачивание голосового сообщения
    file_info = await bot.get_file(message.voice.file_id)
    file_path = f"temp_{telegram_id}.ogg"
    await bot.download_file(file_info.file_path, destination=file_path)

    await bot.send_chat_action(chat_id=message.chat.id, action=ChatAction.TYPING)

    # Распознавание через ASR Service
    response = await api_client.recognize_voice(telegram_id, file_path)
    os.remove(file_path)

    if response and response.get("text"):
        # Создаём фейковое текстовое сообщение и передаём в обработчик
        message_data = message.model_dump()
        message_data['text'] = response.get("text")
        new_message = Message(**message_data)
        await dialogue_message_handler(message=new_message, state=state, bot=bot)
    else:
        await message.answer("Не смог распознать речь. Попробуй еще раз.")
```

#### 5.4 TTS (озвучка ответов)

```python
TTS_CACHE_TTL = 3 * 24 * 60 * 60  # 3 дня

@router.callback_query(F.data.startswith("tts_"))
async def tts_callback_handler(callback: CallbackQuery, bot: Bot):
    message_id = int(callback.data.split("_")[1])
    redis_key = f"tts_cache:{callback.message.chat.id}:{message_id}"

    # Проверка кэша (не озвучивать повторно)
    if await redis_client.get(redis_key):
        await callback.answer("Это сообщение уже было озвучено.", show_alert=True)
        return

    # Проверка Premium
    user_data = await api_client.find_user_by_telegram_id(callback.from_user.id)
    if user_data.get("subscriptionStatus") != "PREMIUM":
        await callback.answer("🔊 Озвучивание доступно только для Premium.", show_alert=True)
        return

    text = callback.message.text
    await bot.send_chat_action(chat_id=callback.message.chat.id, action=ChatAction.RECORD_VOICE)

    # Синтез речи через TTS Service
    audio_data = await api_client.synthesize_speech(callback.from_user.id, text)

    if audio_data and isinstance(audio_data, bytes):
        voice_file = BufferedInputFile(audio_data, filename="voice.ogg")
        await callback.message.answer_voice(voice=voice_file)

        # Кэшируем на 3 дня
        await redis_client.setex(redis_key, TTS_CACHE_TTL, "1")

        # Убираем кнопку TTS
        await callback.message.edit_reply_markup(reply_markup=None)
```

---

## Ключевые механизмы

### Полный flow толкования сна

```
┌──────────────────────────────────────────────────────────────────────────┐
│ 1. Пользователь отправляет текст сна                                      │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 2. API Gateway: protect middleware                                        │
│    - Проверка JWT токена                                                 │
│    - Проверка blocklist в Redis                                          │
│    - Проверка статуса пользователя (не BANNED)                           │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 3. chat.service._checkAndDecrementInterpretations                        │
│    - Проверка лимитов (FREE/PREMIUM)                                     │
│    - Декремент счетчика                                                  │
│    - Инвалидация кэша user:{id}                                          │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 4. ai.service.getInterpretation                                          │
│    - POST /classify-intent → проверка "это о сне?"                       │
│    - Если нет → возврат вежливого отказа                                 │
│    - Если да → продолжаем                                                │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 5. Загрузка предыдущих снов                                              │
│    - prisma.chatSession.findMany (последние 2 сессии)                    │
│    - Извлечение первого user-сообщения из каждой                         │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 6. POST /interpret → AI Service                                          │
│    - Формирование системного промпта с контекстом                        │
│    - Вызов YandexGPT API                                                 │
│    - temperature: 0.6, maxTokens: 1500                                   │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 7. Сохранение в БД                                                       │
│    - CREATE ChatSession (title = первые 40 символов)                     │
│    - CREATE Message (role: user)                                         │
│    - CREATE Message (role: assistant)                                    │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 8. Инвалидация кэша и уведомление                                        │
│    - redis.del(sessions:user-{id}:*)                                     │
│    - WebSocket: emit('new_message', {...})                               │
│    - WebSocket: emit('new_activity', {title}) → всем                     │
└──────────────────────────────────────────────────────────────────────────┘
```

### Уведомление о Premium через WebSocket

```javascript
// payment.service.js
const upgradeToPremium = async (userId) => {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      subscriptionStatus: 'PREMIUM',
      remainingInterpretations: INTERPRETATION_LIMITS.PREMIUM_DAILY_COUNT,
    }
  });

  await redisClient.del(`user:${userId}`);

  // Если привязан Telegram — уведомляем бота
  if (user.telegramId) {
    sendMessageToUser(io, userSocketMap, 'bot', 'user_upgraded_to_premium', {
      telegramId: user.telegramId.toString(),
      name: user.name,
    });
  }
};

// bot.py
@sio.event
async def user_upgraded_to_premium(data):
    await bot_instance.send_message(
        chat_id=int(data['telegramId']),
        text="🎉 Поздравляем, твой статус обновлен до Premium!"
    )
```

---

## API Endpoints

### Аутентификация (`/api/auth`)

| Method | Endpoint | Описание | Rate Limit |
|--------|----------|----------|------------|
| POST | `/register` | Регистрация (email/phone + password) | 20/15min |
| POST | `/login` | Авторизация → JWT токен | 20/15min |
| POST | `/logout` | Инвалидация токена | - |
| GET | `/me` | Профиль текущего пользователя | - |
| PUT | `/me` | Обновление профиля (name, birthDate) | - |
| PUT | `/me/password` | Смена пароля | - |
| POST | `/link-telegram` | Привязка Telegram (initData) | - |

### Чат (`/api/chat`)

| Method | Endpoint | Описание |
|--------|----------|----------|
| POST | `/new` | Новое толкование (source: web) |
| POST | `/:sessionId/message` | Продолжение диалога |
| GET | `/sessions` | Список сессий (page, limit) |
| GET | `/sessions/:id` | Детали сессии с сообщениями |
| DELETE | `/sessions/:id` | Удаление сессии |

### Telegram API (`/api/telegram`)

| Method | Endpoint | Описание |
|--------|----------|----------|
| GET | `/user/:telegramId` | Поиск пользователя по Telegram ID |
| POST | `/interpret` | Новое толкование (telegramId, text) |
| POST | `/interpret/:sessionId` | Продолжение диалога |
| GET | `/history/:telegramId` | История сессий |
| GET | `/session/:id` | Детали сессии |
| DELETE | `/session/:id` | Удаление сессии |
| POST | `/tts` | Синтез речи (proxy) |
| POST | `/stt` | Распознавание речи (proxy) |

### Платежи (`/api/payment`)

| Method | Endpoint | Описание |
|--------|----------|----------|
| POST | `/upgrade` | Апгрейд до Premium |

---

## Запуск проекта

### Требования

- Docker & Docker Compose
- Node.js 18+ (для локальной разработки)
- Python 3.11+ (для локальной разработки бота)

### Быстрый старт

```bash
# 1. Клонирование
git clone https://github.com/3r0ha/morpheus-project.git
cd morpheus-project

# 2. Конфигурация (скопировать и заполнить .env файлы)
cp api-gateway/.env.example api-gateway/.env
cp ai-service/app/.env.example ai-service/app/.env
cp tts-service/.env.example tts-service/.env
cp asr-service/.env.example asr-service/.env
cp telegram-bot/.env.example telegram-bot/.env

# 3. Запуск
docker-compose up -d

# 4. Миграции БД
docker exec morpheus_api_gateway npx prisma migrate deploy

# 5. Логи
docker-compose logs -f api-gateway
docker-compose logs -f telegram-bot
```

### Переменные окружения

**api-gateway/.env:**
```env
DATABASE_URL=postgresql://antihype:NischiyHype123@postgres-db:5432/sonnik_db
REDIS_URL=redis://redis-cache:6379
JWT_SECRET=your-super-secret-jwt-key
AI_SERVICE_URL=http://ai-service:3002
TTS_SERVICE_URL=http://tts-service:3010
ASR_SERVICE_URL=http://asr-service:3020
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
INTERNAL_SERVICE_SECRET=your-internal-secret
```

**ai-service/app/.env:**
```env
YANDEX_API_KEY=your-yandex-api-key
YANDEX_MODEL_URI=gpt://your-folder-id/yandexgpt-lite
```

**tts-service/.env:**
```env
YANDEX_API_KEY=your-yandex-api-key
YANDEX_FOLDER_ID=your-folder-id
```

**asr-service/.env:**
```env
YANDEX_API_KEY=your-yandex-api-key
```

**telegram-bot/.env:**
```env
BOT_TOKEN=your-telegram-bot-token
API_BASE_URL=http://api-gateway:3001/api
INTERNAL_SERVICE_SECRET=your-internal-secret
REDIS_HOST=redis-cache
```

---

## Структура проекта

```
morpheus-project/
├── api-gateway/
│   ├── src/
│   │   ├── api/                      # REST endpoints
│   │   │   ├── auth/                 # Регистрация, логин, профиль
│   │   │   ├── chat/                 # Сессии, сообщения
│   │   │   ├── telegram/             # API для бота
│   │   │   ├── payment/              # Апгрейд Premium
│   │   │   └── admin/                # Админ-панель
│   │   ├── config/
│   │   │   ├── socket.js             # WebSocket инициализация и авторизация
│   │   │   ├── socketHelpers.js      # sendMessageToUser, broadcastActivity
│   │   │   ├── redis.js              # Redis клиент
│   │   │   ├── prisma.js             # Prisma клиент
│   │   │   ├── constants.js          # INTERPRETATION_LIMITS, JWT_EXPIRATION
│   │   │   └── statusStore.js        # Состояние бота (UP/DOWN)
│   │   ├── services/
│   │   │   ├── auth.service.js       # Регистрация, логин, Telegram link
│   │   │   ├── chat.service.js       # Лимиты, создание сессий, кэширование
│   │   │   ├── ai.service.js         # Вызов AI Service
│   │   │   ├── telegram.service.js   # Поиск по telegramId
│   │   │   └── payment.service.js    # upgradeToPremium + WS уведомление
│   │   ├── middlewares/
│   │   │   ├── auth.middleware.js    # protect (JWT + blocklist)
│   │   │   ├── error.middleware.js   # Глобальный обработчик ошибок
│   │   │   └── sanitization.middleware.js
│   │   ├── cron/
│   │   │   └── scheduler.js          # Сброс лимитов Premium в 00:00 МСК
│   │   └── server.js                 # Точка входа
│   └── prisma/
│       └── schema.prisma             # Модели БД
│
├── ai-service/
│   └── app/
│       ├── index.js                  # /interpret, /classify-intent
│       └── yandexGPT.js              # Вызов YandexGPT API
│
├── tts-service/
│   └── server.js                     # /synthesize → Yandex TTS
│
├── asr-service/
│   └── src/
│       └── index.js                  # /stt → FFmpeg → Yandex STT
│
├── telegram-bot/
│   ├── bot.py                        # Main: Dispatcher + Socket.IO client
│   └── app/
│       ├── handlers/
│       │   └── user_handlers.py      # FSM, команды, callbacks
│       ├── keyboards/
│       │   ├── inline_keyboards.py   # Кнопки под сообщениями
│       │   └── reply_keyboards.py    # Главное меню
│       ├── services/
│       │   ├── api_client.py         # HTTP клиент к API Gateway
│       │   └── redis_client.py       # Redis для TTS кэша
│       └── states/
│           └── chat_states.py        # ChatStates.in_dialogue
│
├── frontend/
│   └── src/
│       ├── components/               # React компоненты
│       ├── pages/                    # Страницы
│       ├── services/                 # API клиент
│       └── context/                  # Auth context
│
├── docker-compose.yml
└── README.md
```

---

## Лицензия

MIT
