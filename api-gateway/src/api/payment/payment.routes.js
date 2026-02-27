import { Router } from 'express';
import { protect } from '../../middlewares/auth.middleware.js';
import { mockSubscribe } from './payment.controller.js';

const router = Router();

router.post('/mock-subscribe', protect, mockSubscribe);

export default router;