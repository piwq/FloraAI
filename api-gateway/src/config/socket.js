import jwt from 'jsonwebtoken';
import statusStore from './statusStore.js';

const userSocketMap = {}; 

export const initializeSocket = (io) => {
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;

    if (token === process.env.INTERNAL_SERVICE_SECRET) {
      socket.isBot = true;
      socket.isAuthed = true;
      return next();
    }

    if (token) {
      jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
          socket.isAuthed = false;
          console.log(`SOCKET: Неудачная попытка подключения с невалидным токеном.`);
          return next(); 
        }
        socket.userId = decoded.userId;
        socket.isAuthed = true;
        next();
      });
    } else {
      socket.isAuthed = false;
      next();
    }
  });

  io.on('connection', (socket) => {
    if (socket.isBot) {
      console.log(`SOCKET: Бот подключился с ID сокета ${socket.id}`);
      userSocketMap['bot'] = socket.id;
      socket.on('bot_status', (data) => {
        statusStore.bot.status = data.status || 'UNKNOWN';
        statusStore.bot.message = data.message || 'Status update received';
        statusStore.bot.lastHeartbeat = new Date();
      });

      socket.on('bot_heartbeat', (data) => {
        statusStore.bot.lastHeartbeat = new Date();
        statusStore.bot.status = 'UP';
      });
    } else if (socket.isAuthed && socket.userId) {
      console.log(`SOCKET: Авторизованный пользователь ${socket.userId} подключился с ID сокета ${socket.id}`);
      userSocketMap[socket.userId] = socket.id;
    } else {
      console.log(`SOCKET: Гостевое (неавторизованное) соединение установлено с ID сокета ${socket.id}`);
    }

    socket.on('disconnect', () => {
      if (socket.isBot) {
        delete userSocketMap['bot'];
        console.log(`SOCKET: Бот отключился.`);
        statusStore.bot.status = 'DOWN';
        statusStore.bot.message = 'Bot has disconnected';
      } else if (socket.isAuthed && socket.userId) {
        if (userSocketMap[socket.userId] === socket.id) {
            delete userSocketMap[socket.userId];
            console.log(`SOCKET: Пользователь ${socket.userId} отключился.`);
        }
      } else {
        console.log(`SOCKET: Гостевое соединение ${socket.id} отключилось.`);
      }
    });
  });

  return { io, userSocketMap };
};