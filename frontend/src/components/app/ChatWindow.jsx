import React, { useEffect, useRef } from 'react';
import { useWebSocket } from '../../hooks/useWebSocket';
import Message from '../chat/Message';
import ChatInput from '../chat/ChatInput';

const ChatWindow = ({ session }) => {
  const token = localStorage.getItem('access');
  const { messages, setMessages, sendMessage, isTyping } = useWebSocket(session?.id, token);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(() => { scrollToBottom(); }, [messages, isTyping]);

  useEffect(() => {
    const fetchHistory = async () => {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
      const response = await fetch(`${apiUrl}/chat/${session.id}/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) return;
      const history = await response.json();

      const analysisMessages = [];
      if (session?.analysis?.original_image) {
        analysisMessages.push({
          role: 'user',
          content: 'Посмотри на это растение.',
          image: session.analysis.original_image
        });
      }
      if (session?.analysis?.annotated_image) {
        analysisMessages.push({
          role: 'assistant',
          content: session.analysis.bot_reply || 'Вот результаты моего анализа.',
          image: session.analysis.annotated_image
        });
      }

      setMessages([...analysisMessages, ...history]);
    };

    if (session?.id) fetchHistory();
  }, [session?.id, token, setMessages]);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 rounded-lg shadow-sm">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <Message key={idx} role={msg.role} content={msg.content} image={msg.image} />
        ))}
        {isTyping && (
          <div className="text-gray-400 text-sm italic">Агроном печатает...</div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-gray-200 dark:border-gray-800">
        <ChatInput onSend={sendMessage} disabled={isTyping} />
      </div>
    </div>
  );
};

export default ChatWindow;