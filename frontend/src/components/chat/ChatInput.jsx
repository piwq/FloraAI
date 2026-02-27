import React, { useState, useRef } from 'react';
import { Send, Paperclip } from 'lucide-react';
import toast from 'react-hot-toast';

export const ChatInput = ({ onSendMessage, isLoading }) => {
  const [text, setText] = useState('');
  const fileInputRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (text.trim() && !isLoading) {
      onSendMessage(text);
      setText('');
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      onSendMessage(null, file);
    } else if (file) {
      toast.error("Выберите изображение (JPG, PNG).");
    }
    e.target.value = null;
  };

  return (
    <div className="px-4 sm:px-6 pb-6 pt-4 bg-background">
      <form onSubmit={handleSubmit} className="flex items-center gap-3 bg-surface-2 p-2 rounded-2xl border border-border-color focus-within:border-accent-ai">

        <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 text-text-secondary hover:text-accent-ai rounded-full" disabled={isLoading}>
          <Paperclip size={24} />
        </button>
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />

        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Загрузите фото или задайте вопрос..."
          disabled={isLoading}
          className="flex-1 bg-transparent outline-none text-text-primary placeholder:text-text-secondary py-2"
        />

        <button type="submit" disabled={!text.trim() || isLoading} className="p-2 rounded-full bg-accent-ai text-white disabled:opacity-50">
          <Send size={24} />
        </button>
      </form>
    </div>
  );
};