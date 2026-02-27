import asyncHandler from 'express-async-handler';
import axios from 'axios';
import fs from 'fs/promises';

const ASR_SERVICE_URL = 'http://asr-service:3020';

export const speechToText = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error('Аудиофайл не предоставлен.');
  }

  const audioPath = req.file.path;
  
  try {
    const audioBuffer = await fs.readFile(audioPath);

    const asrResponse = await axios.post(
      `${ASR_SERVICE_URL}/stt`,
      audioBuffer,
      {
        headers: {
          'Content-Type': 'audio/ogg' 
        }
      }
    );

    res.status(200).json(asrResponse.data);
  } catch (error) {
    console.error('Ошибка при проксировании к ASR-сервису:', error.response ? error.response.data : error.message);
    res.status(502); // 502 Bad Gateway
    throw new Error('Сервис распознавания речи временно недоступен.');
  } finally {
    if (audioPath) {
      await fs.unlink(audioPath);
    }
  }
});