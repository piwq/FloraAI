import { prisma } from '../config/prisma.js';
import redisClient from '../config/redis.js';
import { getInterpretation } from './ai.service.js';
import { SUBSCRIPTION_STATUS, INTERPRETATION_LIMITS } from '../config/constants.js';
import { sendMessageToUser, broadcastActivity } from '../config/socketHelpers.js';

const chatService = {
  _io: null,
  _userSocketMap: null,

  init(io, userSocketMap) {
    this._io = io;
    this._userSocketMap = userSocketMap;
  },
  
  async _checkAndDecrementInterpretations(userId) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      const error = new Error('Пользователь не найден');
      error.statusCode = 404;
      throw error;
    }

    let hasAccess = false;
    if (user.subscriptionStatus === SUBSCRIPTION_STATUS.PREMIUM) {
      if (user.remainingInterpretations > 0) {
        hasAccess = true;
      }
    } else {
      const cooldownDate = new Date();
      cooldownDate.setDate(cooldownDate.getDate() - INTERPRETATION_LIMITS.FREE_COOLDOWN_DAYS);
      
      if (user.remainingInterpretations > 0 || !user.lastFreeInterpretationAt || user.lastFreeInterpretationAt < cooldownDate) {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      const errorMessage = 'Доступные толкования закончились. Оформите Premium или подождите.';
      
      sendMessageToUser(this._io, this._userSocketMap, userId, 'error_message', {
        type: 'no_interpretations', 
        content: errorMessage
      });
      const error = new Error(errorMessage);
      error.statusCode = 403;
      throw error;
    }
    
    const updateData = {};
    if (user.subscriptionStatus === SUBSCRIPTION_STATUS.PREMIUM) {
      updateData.remainingInterpretations = { decrement: 1 };
    } else {
      if (user.remainingInterpretations > 0) {
        updateData.remainingInterpretations = { decrement: 1 };
      }
      updateData.lastFreeInterpretationAt = new Date();
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });
    await redisClient.del(`user:${userId}`);
    
    return updatedUser;
  },

  async _getInterpretationAndNotify(user, new_message_text, history, previousDreams) {
    try {
      const interpretationResult = await getInterpretation(user, new_message_text, history, previousDreams);
      if (!interpretationResult.success) {
        throw new Error(interpretationResult.message);
      }
      return interpretationResult.data;
    } catch (error) {
      const targetId = user.telegramId ? 'bot' : user.id;
      const payload = user.telegramId 
        ? { telegramId: user.telegramId.toString(), content: error.message || 'Произошла ошибка при обработке сна.' }
        : { content: error.message || 'Произошла ошибка при обработке сна.' };
      const event = user.telegramId ? 'telegram_response' : 'error_message';
      
      sendMessageToUser(this._io, this._userSocketMap, targetId, event, payload);
      throw error;
    }
  },

  async _processNewChat(user, text, previousDreams, source) {
    const aiResponseText = await this._getInterpretationAndNotify(user, text, [], previousDreams);
    if (!aiResponseText) return null;
    
    const session = await prisma.chatSession.create({
      data: {
        userId: user.id,
        title: text.substring(0, 40) + '...',
        messages: {
          createMany: {
            data: [
              { role: 'user', content: text },
              { role: 'assistant', content: aiResponseText },
            ],
          },
        },
      },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });

    const pattern = `sessions:user-${user.id}:*`;
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
        await redisClient.del(keys);
        console.log(`Invalidated cache keys by pattern "${pattern}":`, keys);
    }
    const assistantMessage = session.messages.find(msg => msg.role === 'assistant');
    
    if (source === 'web') {
      const payload = { ...JSON.parse(JSON.stringify(assistantMessage)), sessionId: session.id };
      sendMessageToUser(this._io, this._userSocketMap, user.id, 'new_message', payload);
    }
    
    broadcastActivity(this._io, 'new_activity', { title: session.title });
    return session;
  },

  async _processExistingChat(user, session, text, source) {
    await prisma.message.create({
      data: { sessionId: session.id, role: 'user', content: text },
    });
    
    const aiResponseText = await this._getInterpretationAndNotify(user, text, session.messages, []);
    if (!aiResponseText) return null;

    const assistantMessage = await prisma.message.create({
      data: { sessionId: session.id, role: 'assistant', content: aiResponseText },
    });

    await redisClient.del(`session:${session.id}`);

    if (source === 'web') {
        sendMessageToUser(this._io, this._userSocketMap, user.id, 'new_message', assistantMessage);
    }
    
    broadcastActivity(this._io, 'new_activity', { title: session.title });
    return assistantMessage;
  },

  async createNewChat(userId, text, source) {
    const user = await this._checkAndDecrementInterpretations(userId);

    const previousSessions = await prisma.chatSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 2,
      include: {
        messages: { where: { role: 'user' }, orderBy: { createdAt: 'asc' }, take: 1 },
      },
    });

    const previousDreams = previousSessions.map(s => s.messages[0]?.content).filter(Boolean);

    const session = await this._processNewChat(user, text, previousDreams, source);

    if (!session) {
        return { message: 'Не удалось обработать запрос.' };
    }
    
    const assistantMessage = session.messages.find(msg => msg.role === 'assistant');
    return { 
        message: 'Запрос на толкование сна принят в обработку.',
        sessionId: session.id,
        initialResponse: assistantMessage?.content || ''
    };
  },

  async addMessageToChat(sessionId, userId, text, source) {
    const user = await this._checkAndDecrementInterpretations(userId);

    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: { messages: { orderBy: { createdAt: 'asc' } } }
    });

    if (!session) {
      const error = new Error('Сессия не найдена');
      error.statusCode = 404;
      throw error;
    }
    if (session.userId !== userId) {
      const error = new Error('Доступ запрещен');
      error.statusCode = 403;
      throw error;
    }

    const assistantMessage = await this._processExistingChat(user, session, text, source);
    
    if (!assistantMessage) {
        return { message: 'Не удалось обработать сообщение.' };
    }

    return { 
        message: 'Сообщение принято в обработку.',
        response: assistantMessage.content
    };
  },

  async getSessionsByUser(userId, page, limit) {
    const cacheKey = `sessions:user-${userId}:page-${page}:limit-${limit}`;
    const DEFAULT_EXPIRATION = 300;

    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      return JSON.parse(cachedData);
    }

    const skip = (page - 1) * limit;
    const [sessions, totalCount] = await prisma.$transaction([
      prisma.chatSession.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: { id: true, title: true, createdAt: true },
      }),
      prisma.chatSession.count({ where: { userId } }),
    ]);

    const result = {
      data: sessions,
      pagination: {
        totalItems: totalCount,
        currentPage: page,
        pageSize: limit,
        totalPages: Math.ceil(totalCount / limit),
      },
    };

    await redisClient.setEx(cacheKey, DEFAULT_EXPIRATION, JSON.stringify(result));

    return result;
  },

  async getSessionDetails(sessionId, userId) {
    const cacheKey = `session:${sessionId}`;
    const DEFAULT_EXPIRATION = 3600;

    const cachedSession = await redisClient.get(cacheKey);
    if (cachedSession) {
      const session = JSON.parse(cachedSession);
      if (session.userId !== userId) {
        const error = new Error('Доступ запрещен');
        error.statusCode = 403;
        throw error;
      }
      return session;
    }

    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });

    if (!session) {
      const error = new Error('Сессия чата не найдена');
      error.statusCode = 404;
      throw error;
    }
    if (session.userId !== userId) {
      const error = new Error('Доступ запрещен');
      error.statusCode = 403;
      throw error;
    }

    await redisClient.setEx(cacheKey, DEFAULT_EXPIRATION, JSON.stringify(session));

    return session;
  },

  async deleteSession(sessionId, userId) {
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      select: { userId: true },
    });

    if (!session) {
      const error = new Error('Сессия чата не найдена');
      error.statusCode = 404;
      throw error;
    }

    if (session.userId !== userId) {
      const error = new Error('Доступ запрещен');
      error.statusCode = 403;
      throw error;
    }

    await prisma.chatSession.delete({ where: { id: sessionId } });

    const userSessionsPage1CacheKey = `sessions:user-${userId}:page-1:limit-15`;
    const sessionDetailsCacheKey = `session:${sessionId}`;
    await redisClient.del([userSessionsPage1CacheKey, sessionDetailsCacheKey]);
  },
  
  async getFullSessionsByUserForAdmin(userId, page, limit) {
    const skip = (page - 1) * limit;
    const [sessions, totalCount] = await prisma.$transaction([
      prisma.chatSession.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
      }),
      prisma.chatSession.count({ where: { userId } }),
    ]);

    return {
      data: sessions,
      pagination: {
        totalItems: totalCount,
        currentPage: page,
        pageSize: limit,
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  },
};

export { chatService };