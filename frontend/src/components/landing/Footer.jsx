import React from 'react';
import { Send } from 'lucide-react';

export const Footer = () => {
  return (
    <footer className="py-8 px-4 border-t border-border-color">
      <div className="container mx-auto max-w-5xl flex flex-col sm:flex-row justify-between items-center text-center sm:text-left">
        <p className="text-text-secondary text-sm mb-4 sm:mb-0">
          © {new Date().getFullYear()} Морфеус. Все права защищены.
        </p>
        <a 
          href="https://t.me/DreamMorpheusBot"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 bg-surface-1 px-4 py-2 rounded-lg text-text-primary hover:text-accent-ai hover:bg-surface-2 transition-colors"
        >
          <Send size={18} />
          Наш бот в Telegram
        </a>
      </div>
    </footer>
  );
};