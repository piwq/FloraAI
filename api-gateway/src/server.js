import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';

BigInt.prototype.toJSON = function() {
  return this.toString();
};

dotenv.config();

import statusStore from './config/statusStore.js';
import { initializeSocket } from './config/socket.js';
import { prisma } from './config/prisma.js';
import redisClient from './config/redis.js';
import apiRoutes from './api/index.js';
import { startSchedulers } from './cron/scheduler.js';
import { errorHandler } from './middlewares/error.middleware.js';
import { sanitizeInput } from './middlewares/sanitization.middleware.js';
import { AUTH_RATE_LIMITER } from './config/constants.js';
import { chatService } from './services/chat.service.js';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.set('trust proxy', 1);

const httpServer = http.createServer(app);

const allowedOrigins = ['http://localhost', 'http://127.0.0.1', 'https://morpheusantihype.icu'];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true, 
};

const io = new Server(httpServer, {
  cors: corsOptions
});

const { userSocketMap } = initializeSocket(io);
chatService.init(io, userSocketMap);

// Middlewares
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json());

fs.mkdirSync('uploads', { recursive: true });

app.use(express.text());
app.use(sanitizeInput);

// Middleware 
app.use((req, res, next) => {
    req.io = io;
    req.userSocketMap = userSocketMap;
    next();
});

// Rate limiter
const authLimiter = rateLimit({
  windowMs: AUTH_RATE_LIMITER.WINDOW_MS,
  max: AUTH_RATE_LIMITER.MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много попыток входа. Пожалуйста, попробуйте позже.' },
});

// Роуты
app.get('/', (req, res) => { res.json({ message: 'API Морфеус работает' }) });
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

const staticPath = path.resolve(process.cwd(), 'storage');
app.use('/storage', express.static(staticPath));

app.use('/api/auth', authLimiter);
app.use('/api', apiRoutes);

app.use(errorHandler);

httpServer.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
  startSchedulers();
});


const gracefulShutdown = (signal) => {
  console.log(`\nПолучен сигнал ${signal}. Начинаю завершение...`);
  
  server.close(async () => {
    console.log('HTTP-сервер закрыт.');
    
    io.close();
    console.log('WebSocket-сервер закрыт.');

    try {
      await redisClient.quit();
      console.log('Redis-клиент отключен.');
    } catch (err) {
      console.error('Ошибка при отключении Redis:', err);
    }
    
    try {
      await prisma.$disconnect();
      console.log('Prisma-клиент отключен.');
    } catch (err) {
      console.error('Ошибка при отключении Prisma:', err);
    }
    
    console.log('Завершение работы.');
    process.exit(0);
  });
  

  setTimeout(() => {
    console.error('Не удалось закрыть все соединения вовремя. Принудительное завершение.');
    process.exit(1);
  }, 10000); 
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));