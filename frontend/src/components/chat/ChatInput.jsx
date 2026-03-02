import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Image as ImageIcon, Loader2 } from 'lucide-react';

export const ChatInput = ({ onSendMessage, isLoading, hasImage, onOpenLab }) => {
  const [message, setMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

  // Глобальный перехват Ctrl+V (работает всегда)
  useEffect(() => {
    const handleGlobalPaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          const file = new File([blob], "pasted-photo.png", { type: items[i].type });
          setSelectedFile(file);
          break;
        }
      }
    };
    document.addEventListener('paste', handleGlobalPaste);
    return () => document.removeEventListener('paste', handleGlobalPaste);
  }, []);

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if ((message.trim() || selectedFile) && !isLoading) {
      onSendMessage(message, selectedFile);
      setMessage('');
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // --- СОСТОЯНИЕ 1: ФОТО ВЫБРАНО И ГОТОВО К ОТПРАВКЕ (Превью) ---
  if (selectedFile) {
    return (
      <div className="bg-surface-2 border-t border-border-color p-6 flex flex-col items-center justify-center min-h-[160px]">
        <div className="w-full max-w-md bg-surface-1 p-6 rounded-2xl border border-accent-ai shadow-lg animate-fade-in-down text-center">
          <ImageIcon size={32} className="mx-auto text-accent-ai mb-3" />
          <p className="text-text-primary font-medium mb-6 truncate px-4">{selectedFile.name}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={removeFile}
              disabled={isLoading}
              className="px-5 py-2.5 bg-surface-2 text-text-secondary rounded-xl hover:text-red-500 transition-colors disabled:opacity-50"
            >
              Отмена
            </button>
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="px-5 py-2.5 bg-accent-ai text-white rounded-xl hover:bg-opacity-90 transition-colors flex items-center gap-2 font-bold disabled:opacity-50 shadow-md"
            >
              {isLoading ? <Loader2 size={20} className="animate-spin"/> : <Send size={20}/>}
              Анализировать
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- СОСТОЯНИЕ 2: ОБЫЧНАЯ ПАНЕЛЬ (Адаптируется под наличие фото в истории) ---
  return (
    <div className="bg-surface-2 border-t border-border-color p-4">
      <form onSubmit={handleSubmit} className="flex items-end gap-2 max-w-4xl mx-auto relative">

        {/* Невидимый инпут для файлов */}
        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />

        {/* ДИНАМИЧЕСКАЯ КНОПКА СЛЕВА */}
        {!hasImage ? (
          // Если фото еще нет - показываем СКРЕПКУ
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-3 bg-surface-1 text-text-secondary hover:text-accent-ai border border-border-color rounded-xl transition-all flex-shrink-0 flex items-center justify-center shadow-sm"
            title="Прикрепить фото растения"
          >
            <Paperclip size={24} />
          </button>
        ) : (
          // Если фото есть - показываем ЛАБОРАТОРИЮ
          <button
            type="button"
            onClick={onOpenLab}
            className="p-3 bg-green-50 text-green-600 hover:bg-green-100 border border-green-200 rounded-xl transition-all flex-shrink-0 flex items-center gap-2 shadow-sm"
            title="Открыть лабораторию ИИ"
          >
            <span className="text-xl">🔬</span>
            <span className="hidden sm:inline font-bold">Лаборатория</span>
          </button>
        )}

        {/* ТЕКСТОВОЕ ПОЛЕ ВВОДА */}
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={hasImage ? "Спросите агронома о вашем растении..." : "Сначала отправьте фото растения (Скрепка или Ctrl+V)"}
          className="flex-1 bg-surface-1 text-text-primary rounded-xl p-3 max-h-32 min-h-[50px] resize-none focus:outline-none focus:ring-1 focus:ring-accent-ai border border-border-color disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isLoading || !hasImage}
          rows={1}
        />

        <button
          type="submit"
          disabled={isLoading || (!message.trim() && !selectedFile) || !hasImage}
          className="bg-accent-ai text-white p-3 rounded-xl hover:bg-opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 shadow-sm"
        >
          <Send size={20} />
        </button>
      </form>
    </div>
  );
};

export default ChatInput;