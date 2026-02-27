import React, { useState, useEffect } from 'react'; 
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { mockSubscribeToPremium } from '@/services/apiClient';
import { Header } from '@/components/app/Header';
import { CreditCard, Lock } from 'lucide-react';

const PaymentPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [cardData, setCardData] = useState({ number: '', expiry: '', cvv: '' });
  const [tg, setTg] = useState(null); 

  useEffect(() => {
    if (window.Telegram && window.Telegram.WebApp) {
      const webApp = window.Telegram.WebApp;
      webApp.ready(); 
      setTg(webApp);
      console.log("Telegram Web App SDK инициализирован.");
    }
  }, []);

  const mutation = useMutation({
    mutationFn: mockSubscribeToPremium,
    onSuccess: () => {
      toast.success('Оплата прошла успешно! Добро пожаловать в Premium.', { duration: 3000 });
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      setTimeout(() => {
        if (tg) {
          console.log("Закрытие Telegram Web App...");
          tg.close();
        } else {
          navigate('/profile');
        }
      }, 2000);
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Не удалось оформить подписку.');
    }
  });

  const handleInputChange = (e) => {
    setCardData({ ...cardData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <div className="h-screen w-screen flex flex-col font-body bg-background text-text-primary">
      <Header />
      <main className="flex-1 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-surface-2 p-8 rounded-2xl border border-border-color"
        >
          <div className="text-center mb-8">
            <h1 className="font-headings text-3xl font-bold">Оформление Premium</h1>
            <p className="text-text-secondary mt-2">
              Сумма к оплате: <span className="text-white font-bold">299 ₽</span> / месяц
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="number" className="text-sm font-medium text-text-secondary">Номер карты</label>
              <div className="relative mt-1">
                <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={20} />
                <input
                  type="text"
                  id="number"
                  name="number"
                  placeholder="0000 0000 0000 0000"
                  value={cardData.number}
                  onChange={handleInputChange}
                  className="w-full bg-surface-1 rounded-lg p-3 pl-10 border border-transparent focus:border-accent-ai focus:outline-none"
                  disabled={mutation.isLoading}
                />
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label htmlFor="expiry" className="text-sm font-medium text-text-secondary">Срок действия</label>
                <input
                  type="text"
                  id="expiry"
                  name="expiry"
                  placeholder="ММ / ГГ"
                  value={cardData.expiry}
                  onChange={handleInputChange}
                  className="w-full bg-surface-1 rounded-lg p-3 mt-1 border border-transparent focus:border-accent-ai focus:outline-none"
                  disabled={mutation.isLoading}
                />
              </div>
              <div className="flex-1">
                <label htmlFor="cvv" className="text-sm font-medium text-text-secondary">CVV</label>
                <input
                  type="text"
                  id="cvv"
                  name="cvv"
                  placeholder="123"
                  value={cardData.cvv}
                  onChange={handleInputChange}
                  className="w-full bg-surface-1 rounded-lg p-3 mt-1 border border-transparent focus:border-accent-ai focus:outline-none"
                  disabled={mutation.isLoading}
                />
              </div>
            </div>
            
            <div className="pt-4">
              <button
                type="submit"
                disabled={mutation.isLoading}
                className="w-full bg-accent-ai text-white font-bold py-3 px-6 rounded-lg text-lg
                           transition-all duration-300 ease-in-out
                           hover:opacity-90 disabled:opacity-50"
              >
                {mutation.isLoading ? 'Обработка...' : 'Оплатить 299 ₽'}
              </button>
            </div>
          </form>

          <div className="flex items-center justify-center text-text-secondary mt-6 text-sm">
            <Lock size={14} className="mr-2" />
            <span>Безопасное соединение</span>
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default PaymentPage;