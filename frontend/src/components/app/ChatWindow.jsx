import React, { useEffect, useRef } from 'react';
import { useWebSocket } from '../../hooks/useWebSocket';
import Message from '../chat/Message';
import ChatInput from '../chat/ChatInput';
import apiClient from '../../services/apiClient';

const ChatWindow = ({ session }) => {
  const token = localStorage.getItem('authToken');
  const { messages, setMessages, sendMessage, isTyping } = useWebSocket(session?.id, token);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(() => { scrollToBottom(); }, [messages, isTyping]);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!session?.id) return;

      try {
        const history = await apiClient.get(`/chat/${session.id}/`);

        const analysisMessages = [];
        if (session?.analysis?.original_image) {
          analysisMessages.push({ role: 'user', content: 'Посмотри на это растение.', image: session.analysis.original_image });
        }
        if (session?.analysis?.annotated_image) {
          analysisMessages.push({ role: 'assistant', content: session.analysis.bot_reply || 'Результаты анализа.', image: session.analysis.annotated_image });
        }

        setMessages([...analysisMessages, ...history]);
      } catch (error) {
        console.error("Ошибка загрузки истории:", error);
      }
    };

    fetchHistory();
  }, [session?.id, setMessages]);

  const handleSend = async (text, file) => {
    if (file) {
      const formData = new FormData();
      formData.append('session_id', session.id);
      formData.append('message', text);
      formData.append('image', file);

      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
        await fetch(`${apiUrl}/chat/`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });
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
        {messages.length === 0 && !isTyping && (
          <div className="text-center text-gray-500 mt-10">Загрузка сообщений...</div>
        )}
        {messages.map((msg, idx) => (
          <Message key={idx} role={msg.role} content={msg.content} image={msg.image} />
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