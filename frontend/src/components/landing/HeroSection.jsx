import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Send } from 'lucide-react';

export const HeroSection = () => {
  return (
    <section className="min-h-screen flex flex-col justify-center items-center text-center px-4">
      <motion.h1 
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
        className="font-headings text-4xl sm:text-5xl md:text-7xl font-bold text-text-primary mb-6"
      >
        Умный анализ растений с помощью ИИ
      </motion.h1>
      <motion.p
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
        className="max-w-2xl text-base sm:text-lg text-text-secondary mb-10"
      >
        FloraAI анализирует фотографии ваших культур, чтобы предоставить точные метрики роста и персональные советы по уходу от цифрового агронома.
      </motion.p>

      <div className="flex flex-col items-center gap-4">
        <Link to="/auth">
          <motion.button
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.6, type: "spring", stiffness: 120 }}
              className="bg-accent-ai text-white font-bold py-3 px-8 rounded-lg text-lg hover:scale-105 transition-transform"
          >
              Начать бесплатно
          </motion.button>
        </Link>

        <motion.a
          href="https://t.me/FloraAIBot"
          target="_blank"
          rel="noopener noreferrer"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="flex items-center gap-2 text-text-secondary hover:text-accent-ai transition-colors"
        >
          <Send size={18} />
          Попробовать в Telegram
        </motion.a>
      </div>
    </section>
  );
};