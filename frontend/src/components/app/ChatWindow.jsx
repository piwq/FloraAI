import React, { useRef, useEffect } from 'react';
import { Message } from '../chat/Message';
import { ChatInput } from '../chat/ChatInput';
import { TypingIndicator } from '../chat/TypingIndicator';
import { Loader2, Sparkles } from 'lucide-react';

export const ChatWindow = ({ chatLogic }) => {
  const { messages, isLoading, isHistoryLoading, sendMessage } = chatLogic;
  const messagesEndRef = useRef(null);
  
  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <Sparkles size={64} className="text-accent-ai/50 mb-4"/>
      <h2 className="font-headings text-3xl font-bold mb-2">Добро пожаловать в Морфеус</h2>
      <p className="text-text-secondary max-w-md mb-8">
        Опишите свой сон в поле ниже.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md w-full">
          <div className="bg-surface-2 p-3 rounded-lg text-sm text-text-primary text-left">
            <p className="font-bold">Полет над городом</p>
            <p className="text-xs text-text-secondary">"Мне приснилось, что я летаю..."</p>
          </div>
          <div className="bg-surface-2 p-3 rounded-lg text-sm text-text-primary text-left">
            <p className="font-bold">Опоздание на экзамен</p>
            <p className="text-xs text-text-secondary">"Я опаздывал на важный экзамен..."</p>
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