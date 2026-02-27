import asyncHandler from 'express-async-handler';
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import { prisma } from '../../config/prisma.js';
import { telegramService } from '../../services/telegram.service.js';
import { chatService } from '../../services/chat.service.js';
import { sendMessageToUser } from '../../config/socketHelpers.js';
import redisClient from '../../config/redis.js';

const ASR_SERVICE_URL = 'http://asr-service:3020';
const TTS_SERVICE_URL = 'http://tts-service:3010';
const MAX_CHUNK_LENGTH = 240; 

const splitTextIntoChunks = (text) => {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > MAX_CHUNK_LENGTH) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      if (sentence.length > MAX_CHUNK_LENGTH) {
          const words = sentence.split(' ');
          let hardChunk = '';
          for (const word of words) {
              if ((hardChunk + ' ' + word).length > MAX_CHUNK_LENGTH) {
                  chunks.push(hardChunk.trim());
                  hardChunk = word;
              } else {
                  hardChunk += (hardChunk ? ' ' : '') + word;
              }
          }
          if (hardChunk) chunks.push(hardChunk.trim());
          currentChunk = '';
      } else {
        currentChunk = sentence;
      }
    } else {
      currentChunk += sentence;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }
  return chunks.filter(chunk => chunk.length > 0);
};


export const handleAuthSuccess = asyncHandler(async (req, res) => {
    const { telegramInitData } = req.body;
    const io = req.io;
    const userSocketMap = req.userSocketMap; 
    
    const params = new URLSearchParams(telegramInitData);
    const userPayload = JSON.parse(params.get('user'));
    const telegramId = userPayload?.id;

    if (!telegramId) {
        return res.status(400).json({ error: 'Некорректные данные Telegram' });
    }

    const user = await telegramService.findUserByTelegramId(telegramId);

    const finalName = user && user.name 
        ? user.name 
        : (userPayload.first_name || userPayload.username || 'пользователь');

    sendMessageToUser(io, userSocketMap, 'bot', 'user_authed', { 
        telegramId: telegramId.toString(),
        name: finalName, 
    });
    
    res.status(200).json({ message: 'Уведомление отправлено' });
});

export const findTelegramUserHandler = asyncHandler(async (req, res) => {
    const { telegramId } = req.params;
    const user = await telegramService.findUserByTelegramId(telegramId);
    
    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }
    
    const { passwordHash, ...safeUser } = user;
    res.status(200).json(safeUser);
});

export const handleInterpretDream = asyncHandler(async (req, res) => {
    const { telegramId, text } = req.body;
    if (!telegramId || !text) {
        return res.status(400).json({ error: 'telegramId and text are required' });
    }
    const user = await telegramService.findUserByTelegramId(telegramId);
    if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден. Пожалуйста, выполните /start и свяжите аккаунт.' });
    }
    
    const result = await chatService.createNewChat(user.id, text, 'telegram');
    res.status(201).json(result);
});

export const addMessageToTelegramChat = asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const { telegramId, text } = req.body;

    if (!telegramId || !text) {
        return res.status(400).json({ error: 'telegramId and text are required' });
    }

    const user = await telegramService.findUserByTelegramId(telegramId);
    if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден.' });
    }

    const result = await chatService.addMessageToChat(sessionId, user.id, text, 'telegram');
    res.status(200).json(result);
});

export const getHistoryForTelegram = asyncHandler(async (req, res) => {
    const { telegramId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5; 
    
    const user = await telegramService.findUserByTelegramId(telegramId);
    if (!user) {
        return res.status(404).json({ message: 'Пользователь не найден' });
    }

    const result = await chatService.getSessionsByUser(user.id, page, limit);
    res.status(200).json(result);
});


export const getSessionDetailsForTelegram = asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const session = await prisma.chatSession.findUnique({
        where: { id: sessionId },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    
    if (!session) {
        return res.status(404).json({ message: 'Сессия не найдена' });
    }
    
    res.status(200).json(session);
});

export const deleteSessionForTelegram = asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const { telegramId } = req.body;

    if (!telegramId) {
        return res.status(400).json({ error: 'telegramId is required' });
    }

    const user = await telegramService.findUserByTelegramId(telegramId);
    if (!user) {
        res.status(403);
        throw new Error('Доступ запрещен.');
    }

    const session = await prisma.chatSession.findUnique({
        where: { id: sessionId },
        select: { userId: true }, 
    });

    if (!session) {
        return res.status(404).json({ message: 'Сессия не найдена' });
    }

    if (session.userId !== user.id) {
        res.status(403);
        throw new Error('Доступ запрещен.');
    }

    await prisma.chatSession.delete({ where: { id: sessionId } });

    const pattern = `sessions:user-${user.id}:*`;
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
        await redisClient.del(keys);
        console.log(`Deleted cache keys by pattern "${pattern}":`, keys);
    }
    await redisClient.del(`session:${sessionId}`);

    res.status(204).send();
});

export const handleSpeechToText = asyncHandler(async (req, res) => {
    const { telegramId } = req.body;
    if (!req.file || !telegramId) {
        res.status(400);
        throw new Error('Отсутствует аудиофайл или telegramId.');
    }

    const user = await telegramService.findUserByTelegramId(telegramId);
    if (!user || user.subscriptionStatus !== 'PREMIUM') {
        fs.unlinkSync(req.file.path); 
        res.status(403);
        throw new Error('Распознавание речи доступно только для Premium-пользователей.');
    }

    const audioPath = req.file.path;
    try {
        const audioBuffer = fs.readFileSync(audioPath);
        const asrResponse = await axios.post(`${ASR_SERVICE_URL}/stt`, audioBuffer, {
            headers: { 'Content-Type': req.file.mimetype }
        });
        res.status(200).json(asrResponse.data);
    } finally {
        fs.unlinkSync(audioPath); 
    }
});

export const handleTextToSpeech = asyncHandler(async (req, res) => {
    const { telegramId, text } = req.body;
    if (!text || !telegramId) {
        res.status(400);
        throw new Error('Отсутствует текст или telegramId.');
    }
    
    const user = await telegramService.findUserByTelegramId(telegramId);
    if (!user || user.subscriptionStatus !== 'PREMIUM') {
        res.status(403);
        throw new Error('Озвучивание доступно только для Premium-пользователей.');
    }
    
    const cleanText = text.replace(/[*_#`]/g, '');
    const chunks = splitTextIntoChunks(cleanText);
    const audioBuffers = [];

    try {
        for (const chunk of chunks) {
            const ttsResponse = await axios.post(
                `${TTS_SERVICE_URL}/synthesize`,
                { text: chunk, format: 'mp3' },
                { responseType: 'arraybuffer', timeout: 20000 }
            );
            audioBuffers.push(Buffer.from(ttsResponse.data));
        }

        if (audioBuffers.length === 0) {
            throw new Error('Не удалось сгенерировать аудио.');
        }

        const finalAudio = Buffer.concat(audioBuffers);
        
        res.set('Content-Type', 'audio/mpeg'); 
        res.send(finalAudio);

    } catch (error) {
        console.error('Ошибка при синтезе речи для Telegram:', error.message);
        throw new Error('Ошибка при синтезе речи, попробуйте позже.');
    }
});