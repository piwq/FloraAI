import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Send } from 'lucide-react';
import { linkTelegram } from '@/services/apiClient';

export const TelegramConnectPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isConnecting, setIsConnecting] = useState(false);
  const telegramId = searchParams.get('tg_id'); // ID берем из URL (Mini App)

  useEffect(() => {
    // В реальном Mini App можно достать ID так:
    // const tg = window.Telegram?.WebApp;
    // const tgId = tg?.initDataUnsafe?.user?.id;
  }, []);

  const handleConnect = async () => {
    if (!telegramId) {
      toast.error('Telegram ID не найден в ссылке.');
      return;
    }
    setIsConnecting(true);
    try {
      await linkTelegram(telegramId);
      toast.success('Успешно! Ваш Telegram привязан.');
      navigate('/app');
    } catch (error) {
      toast.error('Ошибка привязки аккаунта.');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="bg-surface-1 p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-border-color">
        <div className="w-16 h-16 bg-blue-500/20 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <Send size={32} className="-ml-1" />
        </div>
        <h1 className="text-2xl font-bold text-text-primary mb-4">Привязка Telegram</h1>
        <p className="text-text-secondary mb-8">
          Свяжите ваш аккаунт в Telegram с профилем на сайте, чтобы ваши чаты и анализы синхронизировались.
        </p>
        <button
          onClick={handleConnect}
          disabled={isConnecting}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-xl transition-colors disabled:opacity-50"
        >
          {isConnecting ? 'Подключение...' : 'Подтвердить привязку'}
        </button>
      </div>
    </div>
  );
};
export default TelegramConnectPage;