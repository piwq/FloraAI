import Fastify from 'fastify';
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const config = {
  port: Number(process.env.PORT) || 3010,
  yandex: {
    apiKey: process.env.YANDEX_API_KEY?.trim(),
    folderId: process.env.YANDEX_FOLDER_ID?.trim(),
    apiUrl: 'https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize',
  },
  limits: {
    maxTextLength: 249,
    requestTimeout: 20000,
  },
  defaults: {
    voice: 'ermil', 
    emotion: 'neutral',
    speed: 1.0,
    format: 'mp3',
    lang: 'ru-RU',
    sampleRate: 48000,
  }
};

if (!config.yandex.apiKey || !config.yandex.folderId) {
  console.error('ОШИБКА: YANDEX_API_KEY и YANDEX_FOLDER_ID обязательны в .env');
  process.exit(1);
}

const yandexApiClient = axios.create({
  baseURL: config.yandex.apiUrl,
  headers: {
    'Authorization': `Api-Key ${config.yandex.apiKey}`,
    'x-folder-id': config.yandex.folderId,
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  responseType: 'arraybuffer',
  timeout: config.limits.requestTimeout,
});


const app = Fastify({ logger: true });

const synthesizeSchema = {
  body: {
    type: 'object',
    required: ['text'],
    properties: {
      text: { type: 'string', maxLength: config.limits.maxTextLength },
      voice: { type: 'string', default: config.defaults.voice },
      emotion: { type: 'string', default: config.defaults.emotion },
      speed: { type: 'number', default: config.defaults.speed },
      format: { type: 'string', enum: ['mp3', 'ogg_opus'], default: config.defaults.format },
    },
  },
};

app.post('/synthesize', { schema: synthesizeSchema }, async (req, reply) => {
  const { text, voice, emotion, speed, format } = req.body;

  const params = new URLSearchParams({
    text,
    lang: config.defaults.lang,
    voice,
    emotion,
    speed,
    format,
    sampleRateHertz: config.defaults.sampleRate,
  });

  try {
    const res = await yandexApiClient.post('', params.toString());

    reply.header('Content-Type', format === 'ogg_opus' ? 'audio/ogg' : 'audio/mpeg');
    return reply.send(res.data); 

  } catch (err) {
    const status = err.response?.status || 500;
    const body = err.response?.data ? Buffer.from(err.response.data).toString('utf-8') : err.message;
    app.log.error(`Yandex TTS error ${status}: ${body}`);
    
    return reply.code(502).send({ error: 'Сервис синтеза речи временно недоступен.' });
  }
});

app.get('/', () => ({ status: 'ok', service: 'Yandex TTS REST v1' }));

app.listen({ port: config.port, host: '0.0.0.0' }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
});