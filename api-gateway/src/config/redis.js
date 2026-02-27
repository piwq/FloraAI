import { createClient } from 'redis';

const redisClient = createClient({
  url: process.env.REDIS_URL
});

redisClient.on('error', (err) => console.log('Redis Client Error', err));

const connectRedis = async () => {
    try {
        await redisClient.connect();
        console.log('Redis-клиент успешно подключен');
    } catch (error) {
        console.error('Не удалось подключиться к Redis:', error);
    }
};

connectRedis();

export default redisClient;