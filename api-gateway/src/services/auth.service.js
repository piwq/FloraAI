import { prisma } from '../config/prisma.js';
import redisClient from '../config/redis.js';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { JWT_EXPIRATION } from '../config/constants.js';

const isEmail = (str) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);

const formatPhoneNumber = (phone) => {
    let cleaned = ('' + phone).replace(/\D/g, '');
    if (cleaned.startsWith('8')) {
        cleaned = '7' + cleaned.slice(1);
    }
    if (cleaned.startsWith('7') && cleaned.length === 11) {
        return `+${cleaned}`;
    }
    if (cleaned.length === 10) {
        return `+7${cleaned}`;
    }
    return phone;
};

const registerUser = async (identifier, password, name, birthDate, telegramInitData) => {
  const isIdentifierEmail = isEmail(identifier);
  
  let whereClause;
  let createData = {
    passwordHash: await bcrypt.hash(password, await bcrypt.genSalt(10)),
    name: name || null,
    birthDate: birthDate ? new Date(birthDate) : null,
  };

  if (isIdentifierEmail) {
    whereClause = { email: identifier };
    createData.email = identifier;
  } else {
    const formattedPhone = formatPhoneNumber(identifier);
    whereClause = { phone: formattedPhone };
    createData.phone = formattedPhone;
  }

  const existingUser = await prisma.user.findUnique({ where: whereClause });
  
  if (existingUser) {
    const error = new Error(`Пользователь с таким ${isIdentifierEmail ? 'email' : 'телефоном'} уже существует`);
    error.statusCode = 409;
    throw error;
  }

  const newUser = await prisma.user.create({ data: createData });

  if (telegramInitData) {
    try {
      console.log(`AUTH: Попытка привязки Telegram к новому пользователю ${newUser.id}`);
      await linkTelegramAccount(newUser.id, telegramInitData);
    } catch (linkError) {
      console.error(`AUTH ERROR: Не удалось привязать Telegram к новому пользователю ${newUser.id}`, linkError);
    }
  }

  const { passwordHash: _, ...userWithoutPassword } = newUser;

  const payload = { userId: newUser.id, identifier: newUser.email || newUser.phone };
  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: JWT_EXPIRATION,
  });

  return { user: userWithoutPassword, token };
};

const loginUser = async (identifier, password) => {
  const isIdentifierEmail = isEmail(identifier);
  
  let whereClause = isIdentifierEmail 
    ? { email: identifier } 
    : { phone: formatPhoneNumber(identifier) };
  
  const user = await prisma.user.findUnique({ where: whereClause });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    const error = new Error('Неверный логин или пароль');
    error.statusCode = 401;
    throw error;
  }

  const payload = { userId: user.id, identifier: user.email || user.phone };
  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: JWT_EXPIRATION,
  });

  return { token, userId: user.id };
};


const linkTelegramAccount = async (userId, telegramInitData) => {
  const params = new URLSearchParams(telegramInitData);
  const hash = params.get('hash');
  const userPayload = JSON.parse(params.get('user'));
  const telegramId = userPayload?.id;
  const authDate = params.get('auth_date');

  if (!hash || !telegramId || !authDate) {
    const error = new Error('Некорректные или неполные данные инициализации от Telegram.');
    error.statusCode = 400;
    throw error;
  }

  const dataToCheck = [];
  for (const [key, value] of params.entries()) {
    if (key !== 'hash') {
      dataToCheck.push(`${key}=${value}`);
    }
  }

  dataToCheck.sort();
  const dataCheckString = dataToCheck.join('\n');

  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(process.env.TELEGRAM_BOT_TOKEN)
    .digest();

  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  if (calculatedHash !== hash) {
    const error = new Error('Верификация данных Telegram не пройдена. Поддельный запрос.');
    error.statusCode = 403;
    throw error;
  }
  
  const authTimestamp = parseInt(authDate);
  const nowTimestamp = Math.floor(Date.now() / 1000);
  if (nowTimestamp - authTimestamp > 3600) {
    const error = new Error('Данные Telegram устарели. Пожалуйста, перезапустите Web App.');
    error.statusCode = 400;
    throw error;
  }
  
  console.log(`AUTH: Начинаю привязку telegramId ${telegramId} к пользователю ${userId}`);

  const conflictingUser = await prisma.user.findUnique({
    where: { telegramId: BigInt(telegramId) },
  });

  if (conflictingUser && conflictingUser.id !== userId) {
    console.error(`AUTH ERROR: telegramId ${telegramId} уже используется пользователем ${conflictingUser.id}`);
    const error = new Error('Этот аккаунт Telegram уже привязан к другому профилю.');
    error.statusCode = 409;
    throw error;
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, telegramId: true },
  });

  if (!currentUser) {
    const error = new Error('Пользователь для привязки не найден.');
    error.statusCode = 404;
    throw error;
  }
  
  if (currentUser.telegramId === BigInt(telegramId)) {
      console.log(`AUTH: telegramId ${telegramId} уже был привязан к пользователю ${userId}. Обновление не требуется.`);
      return prisma.user.findUnique({ 
        where: { id: userId },
        select: {
            id: true,
            email: true,
            name: true,
            telegramId: true,
            phone: true 
        }
    });
  }

  const dataToUpdate = {
    telegramId: BigInt(telegramId),
  };

  if (!currentUser.name && (userPayload.first_name || userPayload.username)) {
    dataToUpdate.name = userPayload.first_name || userPayload.username;
  }

  console.log(`AUTH: Обновляю пользователя ${userId}, устанавливаю telegramId = ${telegramId}`);
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: dataToUpdate,
    select: {
        id: true,
        email: true,
        name: true,
        telegramId: true,
        phone: true 
    }
  });

  return updatedUser;
};

const getUserById = async (userId) => {
    const cacheKey = `user:${userId}`;
    const DEFAULT_EXPIRATION = 300; 

    const cachedUser = await redisClient.get(cacheKey);
    if (cachedUser) {
        console.log(`CACHE HIT для ключа: ${cacheKey}`);
        return JSON.parse(cachedUser);
    }

    console.log(`CACHE MISS для ключа: ${cacheKey}`);
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true, email: true, phone: true, name: true, birthDate: true,
            subscriptionStatus: true, remainingInterpretations: true, createdAt: true,
        },
    });

    if (!user) {
        const error = new Error('Пользователь не найден');
        error.statusCode = 404;
        throw error;
    }

    await redisClient.setEx(cacheKey, DEFAULT_EXPIRATION, JSON.stringify(user));

    return user;
};

const updateUser = async (userId, updateData) => {
    if (Object.keys(updateData).length === 0) {
        const error = new Error('Не передано полей для обновления.');
        error.statusCode = 400;
        throw error;
    }
    
    const userToUpdate = {};
    if (updateData.name) userToUpdate.name = updateData.name;
    if (updateData.birthDate) userToUpdate.birthDate = new Date(updateData.birthDate);

    const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: userToUpdate,
        select: {
            id: true,
            email: true,
            phone: true, 
            name: true,
            birthDate: true,
            subscriptionStatus: true,
            remainingInterpretations: true,
            createdAt: true,
        },
    });

    await redisClient.del(`user:${userId}`);

    return updatedUser;
};

const changeUserPassword = async (userId, currentPassword, newPassword) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    const error = new Error('Пользователь не найден');
    error.statusCode = 404;
    throw error;
  }

  const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isMatch) {
    const error = new Error('Неверный текущий пароль');
    error.statusCode = 401;
    throw error;
  }

  const salt = await bcrypt.genSalt(10);
  const newPasswordHash = await bcrypt.hash(newPassword, salt);

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: newPasswordHash },
  });
};

const logoutUser = async (token) => {
  const decoded = jwt.decode(token);
  if (!decoded || !decoded.exp) {
    return;
  }
  
  const expiresAt = decoded.exp;
  const now = Math.floor(Date.now() / 1000);
  const remainingSeconds = expiresAt - now;

  if (remainingSeconds <= 0) {
    return;
  }

  const blocklistKey = `blocklist:${token}`;
  await redisClient.setEx(blocklistKey, remainingSeconds, 'true');
};


export const authService = {
  registerUser,
  loginUser,
  getUserById,
  updateUser,
  changeUserPassword,
  logoutUser,
  linkTelegramAccount,
};