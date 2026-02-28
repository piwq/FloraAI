import React, { useRef, useEffect } from 'react';
import { Message } from '../chat/Message';
import { ChatInput } from '../chat/ChatInput';
import { TypingIndicator } from '../chat/TypingIndicator';
import { Loader2, Sprout } from 'lucide-react';

export const ChatWindow = ({ chatLogic }) => {
  const { messages, isLoading, isHistoryLoading, sendMessage } = chatLogic;
  const messagesEndRef = useRef(null);

  const isNewChat = messages.length === 0;

  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center h-full text-center p-8 animate-fade-in-down">
      <div className="w-24 h-24 bg-accent-ai/10 rounded-full flex items-center justify-center mb-6">
        <Sprout size={48} className="text-accent-ai"/>
      </div>
      <h2 className="font-headings text-3xl font-bold mb-3">Ваш цифровой Агроном</h2>
      <p className="text-text-secondary max-w-md text-lg">
        Загрузите фотографию растения ниже, чтобы получить анализ метрик роста и персональные рекомендации по уходу.
      </p>
    </div>
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        {isNewChat && !isHistoryLoading && !isLoading ? (
          <EmptyState />
        ) : (
          <div className="p-6 space-y-6">
            {isHistoryLoading ? (
              <div className="flex justify-center items-center h-full pt-20">
                <Loader2 className="animate-spin text-accent-ai" size={32}/>
              </div>
            ) : (
              <>
                {messages.map((msg, index) => (
                    <Message key={msg.id || index} {...msg} />
                ))}
                {isLoading && <TypingIndicator />}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <ChatInput
        onSendMessage={sendMessage}
        isLoading={isLoading || isHistoryLoading}
        requirePhotoFirst={isNewChat}
      />
    </div>
  );
};