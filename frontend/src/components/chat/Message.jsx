import React from 'react';
import { User, Sprout } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export const Message = ({ role, content }) => {
  const isUser = role === 'user';

  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`flex max-w-[85%] sm:max-w-[75%] ${isUser ? 'flex-row-reverse' : 'flex-row'} items-start gap-3`}>

        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1
          ${isUser ? 'bg-surface-2 text-text-secondary border border-border-color' : 'bg-accent-ai text-white shadow-lg shadow-accent-ai/20'}`}
        >
          {isUser ? <User size={16} /> : <Sprout size={18} />}
        </div>

        <div className={`p-4 rounded-2xl ${isUser ? 'bg-surface-2 border border-border-color text-text-primary rounded-tr-sm' : 'bg-surface-1 border border-border-color text-text-primary rounded-tl-sm'}`}>
          <div className="prose prose-invert max-w-none prose-p:leading-relaxed prose-pre:my-0">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        </div>

      </div>
    </div>
  );
};