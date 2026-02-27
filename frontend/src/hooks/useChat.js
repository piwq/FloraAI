import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { uploadPlantPhoto, sendFloraChatMessage, getChatSessionDetails } from '@/services/apiClient';

export const useChat = (activeChatId, onNewChatCreated) => {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [metrics, setMetrics] = useState(null);

  // Загружаем сообщения, если выбран чат в сайдбаре
  useEffect(() => {
    if (!activeChatId) {
      setMessages([]); // Если ID нет - это "Новый чат", экран пуст
      return;
    }

    const loadSessionMessages = async () => {
      try {
        const response = await getChatSessionDetails(activeChatId);
        if (response && response.data) {
          setMessages(response.data);
        }
      } catch (error) {
        console.error("Ошибка загрузки сообщений:", error);
      }
    };
    loadSessionMessages();
  }, [activeChatId]);

  const sendMessage = async (text, file = null) => {
    if (file) {
      setMessages(prev => [...prev, { role: 'user', content: `📎 Отправлено фото: ${file.name}` }]);
      setIsLoading(true);
      try {
        const response = await uploadPlantPhoto(file);
        const data = response.data;
        if (data.status === 'COMPLETED') {
          setMetrics(data.metrics);
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: `✅ **Анализ завершен!**\n\n🌿 Культура: ${data.metrics.plant_type}\n📏 Площадь листьев: ${data.metrics.leaf_area_cm2} см²\n📏 Длина корня: ${data.metrics.root_length_mm} мм\n\nЗадайте вопрос агроному!`
          }]);
        }
      } catch (error) {
        toast.error('Ошибка анализа.');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (text) {
      setMessages(prev => [...prev, { role: 'user', content: text }]);
      setIsLoading(true);
      try {
        const response = await sendFloraChatMessage(text, metrics, activeChatId);
        setMessages(prev => [...prev, { role: 'assistant', content: response.data.reply }]);

        // Если это был первый месседж (Новый чат), бэкенд вернет ID новой сессии.
        // Сообщаем странице, чтобы она переключилась на этот чат
        if (!activeChatId && response.data.session_id && onNewChatCreated) {
          onNewChatCreated(response.data.session_id);
        }
      } catch (error) {
        setMessages(prev => [...prev, { role: 'assistant', content: '❌ Ошибка связи с нейросетью.' }]);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const startNewChat = () => { setMessages([]); setMetrics(null); };

  return { messages, isLoading, isHistoryLoading: false, sendMessage, startNewChat };
};