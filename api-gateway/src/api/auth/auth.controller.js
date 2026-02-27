import { validationResult } from 'express-validator';
import asyncHandler from 'express-async-handler';
import { authService } from '../../services/auth.service.js';

export const register = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email: identifier, password, name, birthDate, telegramInitData } = req.body;
  
  const result = await authService.registerUser(
    identifier,
    password, 
    name, 
    birthDate, 
    telegramInitData
  );

  res.status(201).json({
    message: 'Пользователь успешно зарегистрирован',
    ...result,
  });
});

export const login = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email: identifier, password } = req.body;
  const result = await authService.loginUser(identifier, password);

  res.status(200).json({
    message: 'Вход выполнен успешно',
    ...result,
  });
});

export const getMe = asyncHandler(async (req, res) => {
  const user = await authService.getUserById(req.user.id);
  res.status(200).json(user);
});

export const updateUserProfile = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400);
    throw new Error(errors.array()[0].msg);
  }

  const updatedUser = await authService.updateUser(req.user.id, req.body);
  res.status(200).json(updatedUser);
});

export const changePassword = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400);
    throw new Error(errors.array()[0].msg);
  }

  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id;

  await authService.changeUserPassword(userId, currentPassword, newPassword);

  res.status(200).json({ message: 'Пароль успешно изменен.' });
});

export const logout = asyncHandler(async (req, res) => {
  const token = req.headers.authorization.split(' ')[1];
  
  await authService.logoutUser(token);
  
  res.status(200).json({ message: 'Выход выполнен успешно' });
});

export const linkTelegramHandler = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { telegramInitData } = req.body; 

  if (!telegramInitData) {
    res.status(400);
    throw new Error('Отсутствуют данные инициализации Telegram.');
  }

  await authService.linkTelegramAccount(userId, telegramInitData);
  
  res.status(200).json({ message: 'Аккаунт Telegram успешно привязан.' });
});