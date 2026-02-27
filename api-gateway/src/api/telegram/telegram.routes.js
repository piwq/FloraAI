import { Router } from 'express';
import multer from 'multer';
import { 
    findTelegramUserHandler,
    handleInterpretDream,
    handleAuthSuccess,
    getHistoryForTelegram,
    getSessionDetailsForTelegram,
    addMessageToTelegramChat,
    deleteSessionForTelegram,
    handleSpeechToText,
    handleTextToSpeech,
} from './telegram.controller.js';

const router = Router();
const upload = multer({ dest: 'uploads/' });

router.get('/user/:telegramId', findTelegramUserHandler);

router.post('/interpret', handleInterpretDream);
router.post('/interpret/:sessionId', addMessageToTelegramChat);

router.post('/auth-success', handleAuthSuccess);

router.get('/history/:telegramId', getHistoryForTelegram);
router.get('/session/:sessionId', getSessionDetailsForTelegram);
router.delete('/session/:sessionId', deleteSessionForTelegram);

router.post('/stt', upload.single('audio'), handleSpeechToText);
router.post('/tts', handleTextToSpeech);

export default router;