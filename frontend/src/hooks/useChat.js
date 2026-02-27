import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { uploadPlantPhoto, sendFloraChatMessage, getChatSessionDetails } from '@/services/apiClient';

export const useChat = (activeChatId, onNewChatCreated) => {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient(); // Для мгновенного обновления сайдбара

  // Загружаем сообщения, если выбран чат в сайдбаре
  useEffect(() => {
    if (!activeChatId) {
      setMessages([]); // Начинаем с чистого листа
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
    // 1. ЛОГИКА ОТПРАВКИ ФОТО (СОЗДАЕТ ЧАТ)
    if (file) {
      setIsLoading(true);
      try {
        const response = await uploadPlantPhoto(file);
        const data = response.data;
        if (data.status === 'COMPLETED' && data.session_id) {
          // Обновляем список чатов в сайдбаре
          queryClient.invalidateQueries({ queryKey: ['chatSessions'] });
          // Передаем ID нового чата в AppPage -> он сам подтянет историю через useEffect
          if (onNewChatCreated) {
            onNewChatCreated(data.session_id);
          }
        }
      } catch (error) {
        toast.error('Ошибка анализа.');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // 2. ЛОГИКА ОТПРАВКИ ТЕКСТА
    if (text) {
      if (!activeChatId) {
        toast.error('Сначала загрузите фото растения (нажмите на скрепку)!');
        return;
      }

      setMessages(prev => [...prev, { role: 'user', content: text }]);
      setIsLoading(true);
      try {
        const response = await sendFloraChatMessage(text, null, activeChatId);
        setMessages(prev => [...prev, { role: 'assistant', content: response.data.reply }]);
      } catch (error) {
        setMessages(prev => [...prev, { role: 'assistant', content: '❌ Ошибка связи с нейросетью.' }]);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const startNewChat = () => {
    if (onNewChatCreated) onNewChatCreated(null);
  };

  return { messages, isLoading, sendMessage, startNewChat };
};