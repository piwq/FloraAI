import { validationResult } from 'express-validator';
import asyncHandler from 'express-async-handler';
import { chatService } from '../../services/chat.service.js';

export const createChatSession = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400);
    throw new Error(errors.array()[0].msg);
  }

  const { text } = req.body;
  const userId = req.user.id;
  
  const result = await chatService.createNewChat(userId, text, 'web'); 
  
  res.status(202).json(result);
});

export const addMessageToSession = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400);
    throw new Error(errors.array()[0].msg);
  }

  const { sessionId } = req.params;
  const { text } = req.body;
  const userId = req.user.id;

  const result = await chatService.addMessageToChat(sessionId, userId, text, 'web');
  
  res.status(202).json(result);
});

export const getUserChatSessions = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 15;
  
  const result = await chatService.getSessionsByUser(userId, page, limit);
  
  res.status(200).json(result);
});

export const getChatSessionById = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const userId = req.user.id;

  const session = await chatService.getSessionDetails(sessionId, userId);
  
  res.status(200).json(session);
});

export const deleteChatSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const userId = req.user.id;

  await chatService.deleteSession(sessionId, userId);

  res.sendStatus(204); 
});