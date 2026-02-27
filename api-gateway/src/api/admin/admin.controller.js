import asyncHandler from 'express-async-handler';
import { prisma } from '../../config/prisma.js';
import { validationResult } from 'express-validator';
import { chatService } from '../../services/chat.service.js';

export const getAllUsers = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;
  const { search } = req.query; 

  const whereCondition = search
    ? {
        OR: [
          { email: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
        ],
      }
    : {}; 

  const [users, totalCount] = await prisma.$transaction([
    prisma.user.findMany({
      where: whereCondition,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, email: true, name: true, role: true, 
        status: true,
        subscriptionStatus: true, remainingInterpretations: true, createdAt: true,
      },
    }),
    prisma.user.count({ where: whereCondition }),
  ]);

  res.status(200).json({
    data: users,
    pagination: { totalItems: totalCount, currentPage: page, pageSize: limit, totalPages: Math.ceil(totalCount / limit) },
  });
});

export const setUserStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !['ACTIVE', 'BANNED'].includes(status)) {
    res.status(400);
    throw new Error("Необходимо передать корректный статус: 'ACTIVE' или 'BANNED'.");
  }

  const updatedUser = await prisma.user.update({
    where: { id },
    data: { status },
  });

  res.status(200).json(updatedUser);
});

export const getUserSessions = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 15;

  const result = await chatService.getFullSessionsByUserForAdmin(id, page, limit);

  res.status(200).json(result);
});

export const addInterpretations = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400);
    throw new Error(errors.array()[0].msg);
  }
  const { id } = req.params;
  const { amount } = req.body;

  if (!amount || typeof amount !== 'number' || amount <= 0) {
    res.status(400);
    throw new Error('Необходимо указать корректное количество попыток (amount).');
  }

  const userExists = await prisma.user.findUnique({ where: { id } });
  if (!userExists) {
    res.status(404);
    throw new Error('Пользователь с таким ID не найден.');
  }

  const updatedUser = await prisma.user.update({
    where: { id },
    data: {
      remainingInterpretations: {
        increment: amount,
      },
    },
  });

  res.status(200).json(updatedUser);
});