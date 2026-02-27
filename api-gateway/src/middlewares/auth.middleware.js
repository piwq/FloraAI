import jwt from 'jsonwebtoken';
import asyncHandler from 'express-async-handler';
import redisClient from '../config/redis.js'
import { prisma } from '../config/prisma.js';

export const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];

      const blocklistKey = `blocklist:${token}`;
      const isBlocked = await redisClient.get(blocklistKey);
      
      if (isBlocked) {
        res.status(401);
        throw new Error('Не авторизован, токен недействителен (logout)');
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await prisma.user.findUnique({ where: { id: decoded.userId } });

      if (!user || user.status === 'BANNED') {
        res.status(403);
        throw new Error('Доступ запрещен. Аккаунт неактивен или заблокирован.');
      }
      
      req.user = user; 
      next();
    } catch (error) {
      res.status(401);
      throw new Error('Не авторизован, токен не прошел проверку');
    }
  }

  if (!token) {
    res.status(401);
    throw new Error('Не авторизован, токен отсутствует');
  }
});

export const admin = asyncHandler(async (req, res, next) => {
  if (req.user && req.user.role === 'ADMIN') {
    next();
  } else {
    res.status(403);
    throw new Error('Доступ запрещен. Требуются права администратора.');
  }
});