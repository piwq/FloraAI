import React from 'react';
import { motion } from 'framer-motion';

const OtpInput = ({ otp, setOtp, onConfirm, isLoading }) => {
  const handleInputChange = (e) => {
    const value = e.target.value.replace(/\D/g, '');
    if (value.length <= 6) {
      setOtp(value);
    }
  };

  return (
    <motion.div
      key="otp-step"
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      transition={{ duration: 0.5 }}
      className="space-y-8"
    >
      <div className="text-center">
        <h3 className="font-headings text-2xl font-bold text-white mb-2">Подтверждение</h3>
        <p className="text-text-secondary">
          Мы (условно) отправили код на ваш email/телефон.
        </p>
      </div>

      <div className="relative">
        <div className="flex justify-center gap-3" onClick={() => document.getElementById('otp-input').focus()}>
          {Array(6).fill(0).map((_, index) => (
            <div
              key={index}
              className="w-12 h-14 bg-surface-1 border-2 border-white/20 rounded-lg flex items-center justify-center text-2xl font-bold"
            >
              {otp[index] || ''}
            </div>
          ))}
        </div>
        <input
          id="otp-input"
          type="tel"
          inputMode="numeric"
          value={otp}
          onChange={handleInputChange}
          maxLength={6}
          className="absolute top-0 left-0 w-full h-full opacity-0"
          autoFocus
        />
      </div>
      
      <p className="text-center text-sm text-accent-ai font-bold">
        Подсказка: Введите любые 6 цифр
      </p>

      <div className="pt-2">
        <button
          type="button" 
          onClick={onConfirm}
          disabled={isLoading || otp.length !== 6}
          className="w-full bg-accent-ai text-white font-bold py-4 px-6 rounded-lg text-lg
                     transition-all duration-300 ease-in-out
                     hover:bg-white hover:text-accent-ai
                     transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Регистрация...' : 'Подтвердить'}
        </button>
      </div>
    </motion.div>
  );
};

export default OtpInput;