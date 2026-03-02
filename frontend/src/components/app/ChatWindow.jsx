import React, { useEffect, useRef, useState } from 'react';
import { useWebSocket } from '../../hooks/useWebSocket';
import Message from '../chat/Message';
import ChatInput from '../chat/ChatInput';
import apiClient from '../../services/apiClient';

const ChatWindow = ({ activeChatId, chatLogic }) => {
  const session = chatLogic?.currentSession;

  // Надежно получаем ID чата из разных источников:
  // 1. activeChatId - при клике в сайдбаре
  // 2. session?.session_id - при создании нового анализа с фото
  // 3. session?.id - запасной вариант
  const currentChatId = activeChatId || session?.session_id || session?.id;

  const token = localStorage.getItem('authToken');
  const { messages, setMessages, sendMessage, isTyping } = useWebSocket(currentChatId, token);
  const messagesEndRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(() => { scrollToBottom(); }, [messages, isTyping]);

  useEffect(() => {
    const fetchHistory = async () => {
      // Если ID нет (это совершенно новый пустой чат), отменяем загрузку
      if (!currentChatId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const response = await apiClient.get(`/chat/${currentChatId}/`);

        // Гарантируем, что работаем с массивом
        const history = Array.isArray(response.data) ? response.data : (response.data?.messages || []);

        // --- УБРАЛИ ЛОГИКУ СКЛЕИВАНИЯ analysisMessages ---
        // Теперь бэкенд сам присылает фото в массиве history!

        setMessages(history); // Просто кладем историю как есть
      } catch (error) {
        console.error("Ошибка загрузки истории:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [currentChatId, setMessages]); // Убрали session из зависимостей

  const handleSend = async (text, file) => {
    if (file) {
      const formData = new FormData();
      formData.append('session_id', currentChatId);
      formData.append('message', text);
      formData.append('image', file);

      try {
        await apiClient.post('/chat/', formData);
      } catch (error) {
        console.error("Ошибка отправки фото:", error);
      }
    } else {
      sendMessage(text);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 rounded-lg shadow-sm">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Статус загрузки */}
        {isLoading && (
          <div className="text-center text-gray-500 mt-10">Загрузка сообщений... ⏳</div>
        )}

        {/* Заглушка для пустого чата */}
        {!isLoading && messages.length === 0 && !isTyping && (
          <div className="text-center text-gray-500 mt-10">История пуста. Задайте вопрос агроному! 🌿</div>
        )}

        {/* Сами сообщения */}
        {messages.map((msg, idx) => (
          <Message key={idx} id={msg.id} role={msg.role} content={msg.content} image={msg.image} annotations={msg.annotations || []}/>
        ))}

        {isTyping && <div className="text-gray-400 text-sm italic">Агроном печатает...</div>}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-4 border-t border-gray-200 dark:border-gray-800">
        <ChatInput onSendMessage={handleSend} isLoading={isTyping} />
      </div>
    </div>
  );
};

export default ChatWindow;