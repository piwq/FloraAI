import React, { useState, useRef } from 'react';
import { Send, Paperclip, X } from 'lucide-react';

export const ChatInput = ({ onSendMessage, isLoading, requirePhotoFirst }) => {
  const [message, setMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
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
      handleSubmit(e);
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

  // Если требуется фото (новый чат) и фото еще не выбрано, блокируем текст
  const isTextDisabled = isLoading || (requirePhotoFirst && !selectedFile);

  return (
    <div className="bg-surface-2 border-t border-border-color p-4">
      {selectedFile && (
        <div className="mb-3 flex items-center gap-2 bg-surface-1 p-2 rounded-lg border border-accent-ai/50 max-w-fit">
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
          className={`p-3 transition-colors flex-shrink-0 ${requirePhotoFirst && !selectedFile ? 'text-accent-ai animate-pulse' : 'text-text-secondary hover:text-accent-ai'}`}
          disabled={isLoading}
          title="Прикрепить фото растения"
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
          placeholder={requirePhotoFirst && !selectedFile ? "Сначала прикрепите фото (скрепка слева)..." : "Спросите агронома о вашем растении..."}
          className={`flex-1 bg-surface-1 text-text-primary rounded-xl p-3 max-h-32 min-h-[50px] resize-none focus:outline-none focus:ring-1 focus:ring-accent-ai border border-border-color ${isTextDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          disabled={isTextDisabled}
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