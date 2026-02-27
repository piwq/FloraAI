import React, { useRef, useEffect } from 'react';
import { Message } from '../chat/Message';
import { ChatInput } from '../chat/ChatInput';
import { TypingIndicator } from '../chat/TypingIndicator';
import { Leaf } from 'lucide-react';

export const ChatWindow = ({ chatLogic }) => {
  const { messages, isLoading, sendMessage } = chatLogic;
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="bg-accent-ai/20 p-4 rounded-full mb-4">
              <Leaf size={48} className="text-accent-ai"/>
            </div>
            <h2 className="font-headings text-3xl font-bold mb-2">Добро пожаловать в FloraAI</h2>
            <p className="text-text-secondary max-w-md">
              Нажмите на скрепку внизу, чтобы загрузить фотографию растения на анализ, или задайте вопрос нашему ИИ-агроному.
            </p>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {messages.map((msg, index) => <Message key={index} {...msg} />)}
            {isLoading && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
      <ChatInput onSendMessage={sendMessage} isLoading={isLoading} />
    </div>
  );
};