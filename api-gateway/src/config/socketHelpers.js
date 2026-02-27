export const sendMessageToUser = (io, userSocketMap, targetId, event, data) => {
  const socketId = userSocketMap[targetId];
  if (socketId) {
    io.to(socketId).emit(event, data);
    console.log(`SOCKET SEND: Отправлено событие '${event}' цели ${targetId}`);
    return true;
  }
  console.log(`SOCKET SEND: Цель ${targetId} не в сети, событие '${event}' не отправлено.`);
  return false;
};

export const broadcastActivity = (io, event, data) => {
  io.emit(event, data);
  console.log(`SOCKET BROADCAST: Отправлено событие '${event}' всем.`);
};