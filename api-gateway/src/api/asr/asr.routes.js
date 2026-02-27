import { Router } from 'express';
import multer from 'multer';
import { protect } from '../../middlewares/auth.middleware.js';
import { speechToText } from './asr.controller.js';

const router = Router();
const upload = multer({ dest: 'uploads/' }); 

router.post('/stt', protect, upload.single('audio'), speechToText);

export default router;