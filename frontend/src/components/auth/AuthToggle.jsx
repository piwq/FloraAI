import React from 'react';
import { motion } from 'framer-motion';

export const AuthToggle = ({ isLogin, setIsLogin }) => {
  return (
    <div className="bg-surface-1 p-1 rounded-full flex w-full max-w-xs mx-auto mb-8 relative">
      <button
        onClick={() => setIsLogin(true)}
        className="w-1/2 py-2.5 text-sm font-bold z-10 transition-colors duration-300"
      >
        Вход
      </button>
      <button
        onClick={() => setIsLogin(false)}
        className="w-1/2 py-2.5 text-sm font-bold z-10 transition-colors duration-300"
      >
        Регистрация
      </button>
      <motion.div
        className="absolute top-1 left-1 bottom-1 w-1/2 bg-accent-ai rounded-full z-0"
        initial={false}
        animate={{ x: isLogin ? '0%' : '100%' }}
        transition={{ type: 'spring', stiffness: 200, damping: 25 }}
      />
    </div>
  );
};