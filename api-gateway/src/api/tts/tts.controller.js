import asyncHandler from 'express-async-handler';
import axios from 'axios';
import { prisma } from '../../config/prisma.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';

const TTS_SERVICE_URL = 'http://tts-service:3010';
const MAX_CHUNK_LENGTH = 240;
const STORAGE_DIR = path.resolve(process.cwd(), 'storage/tts');

fs.mkdir(STORAGE_DIR, { recursive: true });

const splitTextIntoChunks = (text) => {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > MAX_CHUNK_LENGTH) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      if (sentence.length > MAX_CHUNK_LENGTH) {
          const words = sentence.split(' ');
          let hardChunk = '';
          for (const word of words) {
              if ((hardChunk + word).length > MAX_CHUNK_LENGTH) {
                  chunks.push(hardChunk.trim());
                  hardChunk = word + ' ';
              } else {
                  hardChunk += word + ' ';
              }
          }
          chunks.push(hardChunk.trim());
      } else {
        currentChunk = sentence;
      }
    } else {
      currentChunk += sentence;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }
  return chunks.filter(chunk => chunk.length > 0);
};


export const getAudioForMessage = asyncHandler(async (req, res) => {
  const { id: userId, subscriptionStatus } = req.user;
  const { messageId } = req.body;

  if (subscriptionStatus !== 'PREMIUM') {
    res.status(403); 
    throw new Error('Озвучивание доступно только для Premium-пользователей.');
  }

  const message = await prisma.message.findFirst({
    where: { id: messageId, session: { userId: userId } },
  });

  if (!message) {
    res.status(404);
    throw new Error('Сообщение не найдено или у вас нет к нему доступа.');
  }

  if (message.audioUrls && message.audioUrls.length > 0) {
    console.log(`CACHE HIT for message ${messageId}`);
    return res.status(200).json({ urls: message.audioUrls });
  }

  console.log(`CACHE MISS for message ${messageId}. Synthesizing...`);
  
  const cleanText = message.content.replace(/[*_#`]/g, '');
  const chunks = splitTextIntoChunks(cleanText);
  const newUrls = [];

  for (const chunk of chunks) {
    try {
      const ttsResponse = await axios.post(
        `${TTS_SERVICE_URL}/synthesize`,
        { text: chunk, format: 'mp3' },
        { responseType: 'arraybuffer', timeout: 20000 }
      );
      
      const filename = `${uuidv4()}.mp3`;
      const filePath = path.join(STORAGE_DIR, filename);
      await fs.writeFile(filePath, ttsResponse.data);
      
      const publicUrl = `/storage/tts/${filename}`;
      newUrls.push(publicUrl);

    } catch (error) {
      console.error('Ошибка при синтезе чанка:', error.message);
      throw new Error('Ошибка при синтезе речи, попробуйте позже.');
    }
  }

  await prisma.message.update({
    where: { id: message.id },
    data: { audioUrls: newUrls },
  });

  res.status(200).json({ urls: newUrls });
});