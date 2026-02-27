import { Router } from 'express';
import authRoutes from './auth/auth.routes.js';
import chatRoutes from './chat/chat.routes.js';
import adminRoutes from './admin/admin.routes.js';
import telegramRoutes from './telegram/telegram.routes.js';
import paymentRoutes from './payment/payment.routes.js';
import ttsRoutes from './tts/tts.routes.js';
import asrRoutes from './asr/asr.routes.js';

import statusStore from '../config/statusStore.js'; 
import { prisma } from '../config/prisma.js';     
import redisClient from '../config/redis.js';

const router = Router();

router.get('/health', async (req, res) => {
    try {
        const components = {
            server: { status: 'UP' },
            database: { status: 'UP' },
            redis: { status: 'UP' },
            bot: { status: 'UNKNOWN' }
        };

        await prisma.$queryRaw`SELECT 1`;
        await redisClient.ping();

        const botStatus = { ...statusStore.bot };
        if (botStatus.status === 'UP') {
            const now = new Date();
            const lastHeartbeat = botStatus.lastHeartbeat;
            if (lastHeartbeat && (now - lastHeartbeat) > 45000) {
                botStatus.status = 'DEGRADED';
                botStatus.message = 'Bot is connected, but heartbeat is delayed.';
            }
        }
        components.bot = botStatus;
        const isSystemDown = Object.values(components).some(c => c.status === 'DOWN');
        const systemStatus = isSystemDown ? 'DOWN' : 'UP';

        res.status(isSystemDown ? 503 : 200).json({ 
            status: systemStatus, 
            components 
        });

    } catch (error) {
        console.error('Health check failed:', error);
        res.status(503).json({ 
            status: 'DOWN', 
            error: error.message 
        });
    }
});

router.use('/auth', authRoutes);
router.use('/chat', chatRoutes);
router.use('/admin', adminRoutes);
router.use('/telegram', telegramRoutes);
router.use('/payment', paymentRoutes);
router.use('/tts', ttsRoutes);
router.use('/asr', asrRoutes);

export default router;