import React, { useRef, useEffect } from 'react';
import { Message } from '../chat/Message';
import { ChatInput } from '../chat/ChatInput';
import { TypingIndicator } from '../chat/TypingIndicator';
import { Loader2, Sprout } from 'lucide-react';

export const ChatWindow = ({ chatLogic }) => {
  const { messages, isLoading, isHistoryLoading, sendMessage } = chatLogic;
  const messagesEndRef = useRef(null);

  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <Sprout size={64} className="text-accent-ai/80 mb-4"/>
      <h2 className="font-headings text-3xl font-bold mb-2">Добро пожаловать в FloraAI</h2>
      <p className="text-text-secondary max-w-md mb-8">
        Загрузите фото растения для анализа или задайте вопрос нашему ИИ-агроному.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md w-full">
          <div className="bg-surface-2 p-3 rounded-lg text-sm text-text-primary text-left border border-border-color/50">
            <p className="font-bold text-accent-ai">Анализ рукколы</p>
            <p className="text-xs text-text-secondary mt-1">"Измерь площадь листьев и длину корня..."</p>
          </div>
          <div className="bg-surface-2 p-3 rounded-lg text-sm text-text-primary text-left border border-border-color/50">
            <p className="font-bold text-accent-ai">Советы по уходу</p>
            <p className="text-xs text-text-secondary mt-1">"Как часто нужно поливать пшеницу?"</p>
          </div>
      </div>
    </div>
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 && !isHistoryLoading && !isLoading ? (
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
                    <Message
                        key={msg.id || index}
                        {...msg}
                    />
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
      />
    </div>
  );
};