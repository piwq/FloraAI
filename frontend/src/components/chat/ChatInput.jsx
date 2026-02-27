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
    }
    e.target.value = null; // сброс для повторной загрузки
  };

  // --- ФУНКЦИЯ CTRL+V ---
  const handlePaste = (e) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        onSendMessage(null, file);
        toast.success("Изображение вставлено!");
        break;
      }
    }
  };

  return (
    <div className="px-4 sm:px-6 pb-6 pt-4 bg-background">
      <form onSubmit={handleSubmit} className="flex items-center gap-3 bg-surface-2 p-2 rounded-2xl border border-border-color focus-within:border-accent-ai transition-colors">

        <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 text-text-secondary hover:text-accent-ai rounded-full" disabled={isLoading}>
          <Paperclip size={24} />
        </button>
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />

        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPaste={handlePaste} // Подключаем вставку
          placeholder="Напишите сообщение или вставьте фото (Ctrl+V)..."
          disabled={isLoading}
          className="flex-1 bg-transparent outline-none text-text-primary placeholder:text-text-secondary py-2 px-1"
        />

        <button type="submit" disabled={!text.trim() || isLoading} className="p-2 rounded-full bg-accent-ai text-white disabled:opacity-50 hover:scale-105 active:scale-95 transition-transform">
          <Send size={24} />
        </button>
      </form>
    </div>
  );
};