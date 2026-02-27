import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.YANDEX_API_KEY;
const MODEL_URI = process.env.YANDEX_MODEL_URI;

export async function callYandexGPT(systemPrompt, newMessageText, history, previousDreams) {
  if (!API_KEY || !MODEL_URI) {
    throw new Error('Yandex API Key or Model URI is not configured in .env file.');
  }

  const url = 'https://llm.api.cloud.yandex.net/foundationModels/v1/completion';
  const messages = [{
    role: 'system',
    text: systemPrompt
  }];

  history.forEach(msg => {
    const role = msg.role === 'assistant' ? 'assistant' : 'user';
    messages.push({ role, text: msg.content });
  });

  let finalUserMessage = '';

  if (previousDreams.length > 0) {
    finalUserMessage += `Проанализируй мой новый сон, учитывая контекст моих предыдущих сновидений. Вот они:\n`;
    previousDreams.forEach((dream) => {
        finalUserMessage += `- "${dream.substring(0, 100)}..."\n`;
    });
    finalUserMessage += `\n---\n\nМой новый сон: "${newMessageText}"\n\nПроведи параллели, если они есть.`;
  } else {
    finalUserMessage = newMessageText;
  }

  messages.push({
    role: 'user',
    text: finalUserMessage
  });


  const data = {
    modelUri: MODEL_URI,
    completionOptions: {
      stream: false,
      temperature: 0.6,
      maxTokens: 1500
    },
    messages
  };

  try {
    const response = await axios.post(url, data, {
      headers: {
        'Authorization': `Api-Key ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.data.result && response.data.result.alternatives && response.data.result.alternatives.length > 0) {
      return response.data.result.alternatives[0].message.text;
    } else {
      throw new Error('Invalid response structure from YandexGPT API');
    }
  } catch (error) {
    console.error('YandexGPT API Error:', error.response?.data?.error || error.message);
    throw new Error('Failed to get a valid response from YandexGPT');
  }
}