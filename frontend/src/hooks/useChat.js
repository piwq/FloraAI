import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import apiClient, { uploadPlantPhoto, sendFloraChatMessage } from '@/services/apiClient';

export const useChat = () => {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        // Вызываем GET /api/chat/
        const response = await apiClient.get('/chat/');
        if (response.data) {
          setMessages(response.data);
        }
      } catch (error) {
        console.error("Ошибка загрузки истории:", error);
      }
    };
    loadHistory();
  }, []);

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
        const response = await sendFloraChatMessage(text, metrics);
        setMessages(prev => [...prev, { role: 'assistant', content: response.data.reply }]);
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