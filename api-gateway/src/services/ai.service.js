import axios from 'axios';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL;

export const getInterpretation = async (user, new_message_text, history = [], previousDreams = []) => {
  try {
    if (history.length === 0) {
      try {
        const classificationResponse = await axios.post(`${AI_SERVICE_URL}/classify-intent`, {
          text: new_message_text
        });
        
        if (classificationResponse.data && !classificationResponse.data.is_dream_related) {
          const politeRefusal = "Я — Морфеус, толкователь снов. Моя задача — помогать вам разбираться в мире сновидений. Я не могу отвечать на вопросы, не связанные со снами. Пожалуйста, опишите свой сон.";
          return { success: true, data: politeRefusal };
        }
      } catch (classificationError) {
        console.error("Ошибка при вызове классификатора намерений. Пропускаем проверку.", classificationError.message);
      }
    }
    const userInfoPayload = {
      name: user.name || 'Пользователь',
    };
    if (user.birthDate) {
      userInfoPayload.birthDate = user.birthDate.toISOString().split('T')[0];
    }
    
    const sanitizedHistory = history.map(msg => ({
        role: msg.role,
        content: msg.content
    }));

    const requestBody = {
      user_info: userInfoPayload,
      new_message_text: new_message_text,
      history: sanitizedHistory,
      previous_dreams: previousDreams,
    };

    const response = await axios.post(`${AI_SERVICE_URL}/interpret`, requestBody);
    return { success: true, data: response.data.interpretation };

  } catch (error) {
    console.error('Ошибка при обращении к AI-сервису:', error.message);

    if (error.response && error.response.status === 422) {
      const validationErrors = error.response.data.detail;
      if (validationErrors && validationErrors.length > 0) {
        const firstError = validationErrors[0];
        
        if (firstError.field === 'new_message_text') {
          return { success: false, message: 'Текст сна должен быть подходящей длины (не менее 10 символов).' };
        }
        return { success: false, message: `Ошибка в данных: ${firstError.msg}` };
      }
    }
    return { success: false, message: 'К сожалению, сервис интерпретации снов временно недоступен. Попробуйте позже.' };
  }
};