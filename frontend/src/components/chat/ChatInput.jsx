import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, X, Image as ImageIcon, Loader2 } from 'lucide-react';

export const ChatInput = ({ onSendMessage, isLoading, requirePhotoFirst }) => {
  const [message, setMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // Глобальный перехват Ctrl+V (работает, даже если никуда не кликать)
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

  // Обработчики Drag & Drop
  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        setSelectedFile(file);
      }
    }
  };

  // --- СОСТОЯНИЕ 1: НОВЫЙ ЧАТ (ТОЛЬКО ФОТО) ---
  if (requirePhotoFirst) {
    return (
      <div className="bg-surface-2 border-t border-border-color p-6 flex flex-col items-center justify-center min-h-[220px]">
        {selectedFile ? (
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
                className="px-5 py-2.5 bg-accent-ai text-white rounded-xl hover:bg-opacity-90 transition-colors flex items-center gap-2 font-bold disabled:opacity-50"
              >
                {isLoading ? <Loader2 size={20} className="animate-spin"/> : <Send size={20}/>}
                Анализировать
              </button>
            </div>
          </div>
        ) : (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`w-full max-w-2xl border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200 ease-in-out
              ${isDragging ? 'border-accent-ai bg-accent-ai/10 scale-[1.02]' : 'border-border-color hover:border-accent-ai hover:bg-surface-1/50'}`}
          >
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
            <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors ${isDragging ? 'bg-accent-ai/20 text-accent-ai' : 'bg-surface-1 text-text-secondary'}`}>
                <ImageIcon size={32} />
            </div>
            <p className="text-xl font-bold text-text-primary mb-2">
              Перетащите фото растения сюда
            </p>
            <p className="text-text-secondary">
              или нажмите для выбора файла. <br className="md:hidden" /> Можно вставить через <kbd className="bg-surface-1 px-2 py-1 rounded text-xs ml-1">Ctrl + V</kbd>
            </p>
          </div>
        )}
      </div>
    );
  }

  // --- СОСТОЯНИЕ 2: ОБЫЧНЫЙ ЧАТ (ТЕКСТ + СКРЕПКА) ---
  return (
    <div className="bg-surface-2 border-t border-border-color p-4">
      {selectedFile && (
        <div className="mb-3 flex items-center gap-2 bg-surface-1 p-2 rounded-lg border border-accent-ai/50 max-w-fit animate-fade-in-down">
          <span className="text-sm text-text-primary truncate max-w-[200px]">{selectedFile.name}</span>
          <button type="button" onClick={removeFile} className="text-text-secondary hover:text-red-500 transition-colors">
            <X size={16} />
          </button>
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex items-end gap-2 max-w-4xl mx-auto relative">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-3 text-text-secondary hover:text-accent-ai transition-colors flex-shrink-0"
          disabled={isLoading}
          title="Прикрепить фото"
        >
          <Paperclip size={24} />
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept="image/*"
        />
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Спросите агронома о вашем растении (или вставьте фото Ctrl+V)..."
          className="flex-1 bg-surface-1 text-text-primary rounded-xl p-3 max-h-32 min-h-[50px] resize-none focus:outline-none focus:ring-1 focus:ring-accent-ai border border-border-color"
          disabled={isLoading}
          rows={1}
        />
        <button
          type="submit"
          disabled={isLoading || (!message.trim() && !selectedFile)}
          className="bg-accent-ai text-white p-3 rounded-xl hover:bg-opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
        >
          <Send size={20} />
        </button>
      </form>
    </div>
  );
};