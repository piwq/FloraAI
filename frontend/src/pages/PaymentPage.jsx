import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CreditCard, CheckCircle, ArrowLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { mockSubscribeToPremium } from '@/services/apiClient';

const PaymentPage = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const handlePayment = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      await mockSubscribeToPremium();
      // КРИТИЧНО: принудительно обновляем кэш пользователя во всем приложении
      await queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      toast.success('Подписка Premium успешно оформлена!');
      navigate('/profile');
    } catch (error) {
      toast.error('Ошибка при оплате.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <Link to="/tariffs" className="absolute top-8 left-8 text-text-secondary hover:text-accent-ai transition-colors flex items-center gap-2">
        <ArrowLeft size={20} /> Назад
      </Link>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-surface-2 p-8 rounded-2xl border border-border-color shadow-2xl"
      >
        <div className="flex justify-center mb-6 text-accent-ai">
          <CreditCard size={48} />
        </div>
        <h1 className="font-headings text-3xl font-bold text-center mb-2">Оформление Premium</h1>
        <p className="text-text-secondary text-center mb-8">299₽ / месяц</p>

        <form onSubmit={handlePayment} className="space-y-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1">Номер карты (Тестовая оплата)</label>
            <input
              type="text"
              placeholder="0000 0000 0000 0000"
              className="w-full bg-surface-1 border border-border-color rounded-lg p-3 text-text-primary focus:outline-none focus:border-accent-ai"
              required
            />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm text-text-secondary mb-1">Срок действия</label>
              <input
                type="text"
                placeholder="ММ/ГГ"
                className="w-full bg-surface-1 border border-border-color rounded-lg p-3 text-text-primary focus:outline-none focus:border-accent-ai"
                required
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm text-text-secondary mb-1">CVC</label>
              <input
                type="password"
                placeholder="***"
                maxLength="3"
                className="w-full bg-surface-1 border border-border-color rounded-lg p-3 text-text-primary focus:outline-none focus:border-accent-ai"
                required
              />
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={isProcessing}
              className="w-full bg-accent-ai hover:opacity-90 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isProcessing ? 'Обработка...' : <><CheckCircle size={20} /> Оплатить 299₽</>}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default PaymentPage;