import express from 'express';
import 'dotenv/config';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const port = process.env.PORT || 3020;
const TEMP_DIR = path.join(process.cwd(), 'temp');

fs.mkdir(TEMP_DIR, { recursive: true });

const fixDuplicateText = (text) => {
    if (typeof text !== 'string' || text.length === 0) {
        return text;
    }
    const trimmedText = text.trim();
    const mid = Math.floor(trimmedText.length / 2);

    if (trimmedText.length % 2 === 0) {
        const firstHalf = trimmedText.substring(0, mid);
        const secondHalf = trimmedText.substring(mid);
        if (firstHalf === secondHalf) {
            console.log(`ОБНАРУЖЕН И ИСПРАВЛЕН ДУБЛИКАТ: "${trimmedText}" -> "${firstHalf}"`);
            return firstHalf;
        }
    }
    
    if (trimmedText.length % 2 !== 0) {
        const firstHalf = trimmedText.substring(0, mid);
        const secondHalf = trimmedText.substring(mid + 1);
         if (firstHalf === secondHalf && trimmedText[mid] === ' ') {
            console.log(`ОБНАРУЖЕН И ИСПРАВЛЕН ДУБЛИКАТ (с пробелом): "${trimmedText}" -> "${firstHalf}"`);
            return firstHalf;
        }
    }

    return trimmedText; 
};

app.use(express.raw({ type: 'audio/*', limit: '10mb' }));

app.post('/stt', async (req, res) => {
  if (!req.body || req.body.length === 0) {
    return res.status(400).json({ error: 'Тело запроса с аудиоданными пусто.' });
  }

  const inputId = uuidv4();
  const contentType = req.headers['content-type'] || 'audio/webm';
  const inputExtension = contentType.split('/')[1].split(';')[0];
  
  const inputPath = path.join(TEMP_DIR, `${inputId}.${inputExtension}`);
  const outputPath = path.join(TEMP_DIR, `${inputId}-converted.ogg`);
  
  try {
    // 1. Всегда сохраняем полученный аудиофайл во временный файл
    await fs.writeFile(inputPath, req.body);
    console.log(`Получен файл ${inputPath} (${contentType})`);

    // 2. Всегда прогоняем его через FFMPEG для нормализации/конвертации в OGG Opus
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .toFormat('ogg')
        .audioCodec('libopus')
        .on('error', (err) => {
          console.error('Ошибка FFMPEG:', err.message);
          reject(new Error('Не удалось обработать аудиофайл.'));
        })
        .on('end', () => {
          console.log(`Файл успешно нормализован в ${outputPath}`);
          resolve();
        })
        .save(outputPath);
    });

    // 3. Читаем сконвертированный/нормализованный OGG файл
    const convertedAudioBuffer = await fs.readFile(outputPath);

    // 4. Отправляем эталонный файл в Яндекс
    const yandexUrl = 'https://stt.api.cloud.yandex.net/speech/v1/stt:recognize?lang=ru-RU&format=oggopus&sampleRateHertz=48000';
    const headers = {
      'Authorization': `Api-Key ${process.env.YANDEX_API_KEY}`,
      'Content-Type': 'audio/ogg',
    };

    const yandexResponse = await fetch(yandexUrl, {
      method: 'POST',
      headers: headers,
      body: convertedAudioBuffer,
    });

    const responseData = await yandexResponse.json();

    if (!yandexResponse.ok) {
        throw new Error(`Yandex API Error (${yandexResponse.status}): ${JSON.stringify(responseData)}`);
    }

    const originalText = responseData.result;
    const fixedText = fixDuplicateText(originalText);
    res.json({ text: fixedText });

  } catch (error) {
    console.error('Ошибка в ASR сервисе:', error.message);
    res.status(502).json({ error: 'Ошибка при обращении к сервису распознавания.', details: error.message });
  } finally {
    // 5. Удаляем оба временных файла
    await fs.unlink(inputPath).catch(err => console.error(`Не удалось удалить временный файл ${inputPath}:`, err.message));
    await fs.unlink(outputPath).catch(err => console.error(`Не удалось удалить временный файл ${outputPath}:`, err.message));
  }
});

app.get('/', (req, res) => {
    res.status(200).send('ASR Service is running.');
});

app.listen(port, '0.0.0.0', () => {
  console.log(`ASR Service запущен на http://localhost:${port}`);
});