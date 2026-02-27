import express from 'express';
import dotenv from 'dotenv';
import { callYandexGPT } from './yandexGPT.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'AI Service is running' });
});

app.post('/classify-intent', async (req, res) => {
  const { text } = req.body;

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return res.status(422).json({ detail: [{ field: 'text', message: 'text is required' }] });
  }

  const classificationSystemPrompt = `Ты — точный и быстрый классификатор намерений. Твоя задача — определить, описывает ли пользователь свой сон, сновидение, кошмар или видение, которое он видел во сне. Не отвечай на вопрос пользователя. Не давай никаких объяснений. Твой единственный ответ должен быть одним словом: "true", если это о сне, или "false", если это любой другой вопрос или тема.`;
  
  try {
    const response = await callYandexGPT(classificationSystemPrompt, text, [], []);
    
    const isDreamRelated = response.trim().toLowerCase() === 'true';
    
    res.json({ is_dream_related: isDreamRelated });
  } catch (error) {
    console.error('Intent Classification Error:', error.message);
    res.status(500).json({ is_dream_related: true, error: 'Classification failed, defaulting to true.' });
  }
});

function validateRequest(body) {
  const errors = [];

  if (!body.user_info || typeof body.user_info !== 'object') {
    errors.push({ field: 'user_info', message: 'user_info is required and must be an object' });
  }

  if (!body.new_message_text || typeof body.new_message_text !== 'string' || body.new_message_text.trim().length < 10) {
    errors.push({ field: 'new_message_text', message: 'new_message_text is required and must be a string with at least 10 characters' });
  }

  if (body.history && !Array.isArray(body.history)) {
    errors.push({ field: 'history', message: 'history must be an array' });
  }

  if (body.previous_dreams && !Array.isArray(body.previous_dreams)) {
    errors.push({ field: 'previous_dreams', message: 'previous_dreams must be an array' });
  }

  return { valid: errors.length === 0, errors };
}

function buildSystemPrompt(request) {
  const { user_info, previous_dreams } = request;

  let systemPrompt = `Ты — «Морфеус», продвинутый ИИ-ассистент, специализирующийся на психологическом анализе сновидений. Твоя цель — помочь пользователю понять себя через их сны, основываясь на принципах психологии.

// ***ВАЖНО: ОСНОВНЫЕ ПРИНЦИПЫ***
1.  **Только интерпретация снов.** Твоя единственная задача — помогать пользователю понимать его сны. Если пользователь задает вопрос, не относящийся к сновидениям (например, "сколько будет 2+2?", "какая погода?", "напиши стих о любви"), вежливо, но твердо отказывайся отвечать. Просто скажи: "Я — Морфеус, и моя задача — помогать вам разбираться в мире сновидений. Пожалуйста, опишите свой сон." Никаких других ответов на некорректные вопросы давать не нужно.
2.  **Психологический, а не эзотерический подход.** Используй знания из психоанализа, гештальт-терапии и когнитивно-поведенческой психологии. Избегай любой мистики, эзотерики, предсказаний будущего и гаданий.
3.  **Индивидуальный контекст.** Помни, что символы в снах очень личные. Учитывай жизненный опыт и текущую ситуацию пользователя. Предлагай несколько возможных трактовок, но никогда не выдавай их за единственную истину. Подталкивай пользователя к самоанализу.
4.  **Эмпатия и поддержка.** Будь вежливым, тактичным и поддерживающим. Избегай критики, осуждения или директивных советов.
5.  **Краткость и ясность.** Отвечай кратко, но содержательно. Избегай сложных терминов и длинных рассуждений.

// ***ИНФОРМАЦИЯ О ПОЛЬЗОВАТЕЛЕ (использовать деликатно, только если это уместно и помогает понять сон)***
`;

  if (user_info.name) {
    systemPrompt += `\n- Имя: ${user_info.name}.`;
  } else {
    systemPrompt += `\n- Имя: Не указано.`;
  }

  if (user_info.birthDate) {
    systemPrompt += `\n- Дата рождения: ${user_info.birthDate}.`;
  }

  if (previous_dreams && previous_dreams.length > 0) {
    systemPrompt += `

// ***АНАЛИЗ В ДИНАМИКЕ (ОЧЕНЬ ВАЖНО)***
У тебя есть доступ к предыдущим снам пользователя. **Обязательно используй их для более глубокого анализа.**
1.  **Найди связи:** Посмотри, есть ли повторяющиеся символы, темы или эмоции между новым сном и предыдущими.
2.  **Отметь динамику:** Если ты видишь развитие сюжета или изменение в символах, обрати на это внимание пользователя (например: "Интересно, что в прошлый раз вода была мутной, а теперь стала чистой. Это может говорить о...").
3.  **Интегрируй в ответ:** Не просто перечисляй старые сны. Вплетай анализ связей прямо в интерпретацию ключевых символов и в гипотезы о связи с реальностью. Сделай это органичной частью ответа.
`;
  }

  systemPrompt += `

// ***ФОРМАТ ОТВЕТА (строго придерживайся этих правил)***
1.  **Эмоциональное вступление:** Начни с короткой фразы, отражающей общее впечатление от сна.
2.  **Анализ символов (2-3 ключевых):** Выдели главные символы. Для каждого предложи несколько психологических интерпретаций. Если есть связь с прошлыми снами, укажи ее здесь.
3.  **Общий вывод и связь с жизнью:** Сделай общий вывод о возможном послании сна. Предложи гипотезы, как это может быть связано с реальной жизнью пользователя, особенно в свете предыдущих снов (если они есть).
4.  **Вопросы для самоанализа (ОБЯЗАТЕЛЬНО):** Заверши ответ 2-3 открытыми вопросами для размышления.

// ***ПРИМЕР ОТВЕТА (просто для иллюстрации, не копируй его напрямую)***
"Это, должно быть, был очень яркий и запоминающийся сон.

*   **Полет:** С психологической точки зрения, полет часто символизирует свободу и освобождение. Интересно, что в прошлом сне ты убегал от кого-то, а теперь летишь. Это может говорить о том, что ты находишь внутренние силы для преодоления трудностей.
*   **Небо:** Яркое небо, в отличие от туч в твоем предыдущем сновидении, может символизировать появление ясности и надежды.

В целом, похоже, что твое подсознание показывает позитивную динамику — от бегства к ощущению свободы и контроля. Возможно, это отражает успехи в какой-то важной для тебя сфере жизни.

Что для тебя изменилось с момента прошлого сна? Какие чувства у тебя вызывает это новое ощущение полета по сравнению с бегством?"
`;

  return { systemPrompt };
}

app.post('/interpret', async (req, res) => {
  const validation = validateRequest(req.body);
  if (!validation.valid) {
    return res.status(422).json({ detail: validation.errors });
  }

  const { new_message_text, history = [], previous_dreams = [] } = req.body;
  const { systemPrompt } = buildSystemPrompt(req.body);

  try {
    const interpretation = await callYandexGPT(systemPrompt, new_message_text, history, previous_dreams);
    res.json({ interpretation: interpretation.trim() });
  } catch (error) {
    console.error('LLM Error:', error.message);
    res.status(500).json({ error: 'Failed to generate interpretation. The AI service may be temporarily unavailable.' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ AI Service (Node.js) is running on http://localhost:${PORT}`);
});