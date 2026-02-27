import { Router } from 'express';
import { protect } from '../../middlewares/auth.middleware.js';
import { getAudioForMessage } from './tts.controller.js';

const router = Router();
router.use(protect);

router.post('/get-audio', getAudioForMessage);

export default router;