import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { getChatSessionDetails, uploadPlantPhoto, sendFloraChatMessage } from '@/services/apiClient';

export const useChat = (activeChatId, onNewChatCreated) => {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!activeChatId) {
      setMessages([]);
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
    // 1. ЛОГИКА ОТПРАВКИ ФОТО
    if (file) {
      if (!activeChatId) {
         // 1.А ФОТО В НОВЫЙ ЧАТ (СОЗДАЕТ ЧАТ И АНАЛИЗ)
         setIsLoading(true);
         try {
           const response = await uploadPlantPhoto(file);
           const data = response.data;
           if (data.status === 'COMPLETED' && data.session_id) {
             queryClient.invalidateQueries({ queryKey: ['chatSessions'] });
             if (onNewChatCreated) {
               onNewChatCreated(data.session_id);
             }
           }
         } catch (error) {
           if (error.response?.status === 403 && error.response?.data?.error === 'limit_reached') {
             toast.error(
               (t) => (
                 <div className="flex flex-col gap-2">
                   <span className="font-bold">Достигнут лимит (3/3) 🚫</span>
                   <span className="text-sm">Бесплатные попытки анализа закончились. Оформите Premium для безлимитного доступа!</span>
                   <button
                     onClick={() => {
                       toast.dismiss(t.id);
                       window.location.href = '/tariffs';
                     }}
                     className="bg-accent-ai text-white rounded-lg px-3 py-2 text-sm font-bold mt-2 hover:bg-opacity-90 transition-colors"
                   >
                     Перейти на Premium
                   </button>
                 </div>
               ),
               { duration: 8000 }
             );
           } else {
             toast.error('Ошибка анализа фото. Попробуйте снова.');
           }
         } finally {
           setIsLoading(false);
         }
         return;
      } else {
        // 1.Б ФОТО В СУЩЕСТВУЮЩИЙ ЧАТ (Отправляем просто как сообщение)
        const formData = new FormData();
        formData.append('session_id', activeChatId);
        formData.append('message', text || '');
        formData.append('image', file);

        setIsLoading(true);
        try {
           const apiClient = (await import('@/services/apiClient')).default;
           await apiClient.post('/chat/', formData);
           // Сообщение придет по вебсокету, так что вручную в стейт не добавляем
        } catch (error) {
           toast.error('Ошибка отправки фото в чат.');
        } finally {
           setIsLoading(false);
        }
        return;
      }
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