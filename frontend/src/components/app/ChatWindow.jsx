import React, { useEffect, useRef, useState } from 'react';
import { useWebSocket } from '../../hooks/useWebSocket';
import Message from '../chat/Message';
import ChatInput from '../chat/ChatInput';
import apiClient from '../../services/apiClient';
import AILabModal from '../chat/AILabModal';

const ChatWindow = ({ activeChatId, chatLogic }) => {
  const session = chatLogic?.currentSession;

  // Надежно получаем ID чата из разных источников:
  const currentChatId = activeChatId || session?.session_id || session?.id;

  const token = localStorage.getItem('authToken');
  const { messages, setMessages, sendMessage, isTyping } = useWebSocket(currentChatId, token);
  const messagesEndRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);

  const [showLabModal, setShowLabModal] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => { scrollToBottom(); }, [messages, isTyping]);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!currentChatId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const response = await apiClient.get(`/chat/${currentChatId}/`);
        const history = Array.isArray(response.data) ? response.data : (response.data?.messages || []);
        setMessages(history);
      } catch (error) {
        console.error("Ошибка загрузки истории:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [currentChatId, setMessages]);

  // 🔥 ВОТ ПРАВИЛЬНАЯ И ИСПРАВЛЕННАЯ ФУНКЦИЯ ОТПРАВКИ 🔥
  const handleSend = async (text, file) => {
    // Вся сложная логика "куда отправлять фото" теперь живет в хуке chatLogic
    await chatLogic.sendMessage(text, file);
  };

  const imageMsg = messages.find(m => m.image);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 rounded-lg shadow-sm">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {isLoading && (
          <div className="text-center text-gray-500 mt-10">Загрузка сообщений... ⏳</div>
        )}

        {!isLoading && messages.length === 0 && !isTyping && (
          <div className="text-center text-gray-500 mt-10">История пуста. Задайте вопрос агроному! 🌿</div>
        )}

        {messages.map((msg, idx) => (
          <Message key={idx} id={msg.id} role={msg.role} content={msg.content} image={msg.image} annotations={msg.annotations || []}/>
        ))}

        {isTyping && <div className="text-gray-400 text-sm italic">Агроном печатает...</div>}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-4 border-t border-gray-200 dark:border-gray-800">
        <ChatInput
          onSendMessage={handleSend}
          isLoading={isTyping || chatLogic.isLoading}
          hasImage={!!imageMsg}
          onOpenLab={() => setShowLabModal(true)}
        />
      </div>
      {imageMsg && (
        <AILabModal
          isOpen={showLabModal}
          onClose={() => setShowLabModal(false)}
          messageId={imageMsg.id}
          initialImage={imageMsg.image}
          initialAnnotations={imageMsg.annotations || []}
        />
      )}
    </div>
  );
};

export default ChatWindow;