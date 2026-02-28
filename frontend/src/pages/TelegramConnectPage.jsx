import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Loader2, AlertCircle } from 'lucide-react';
import { linkTelegram } from '@/services/apiClient';
import { useAuth } from '@/context/AuthContext';
import AuthForm from '@/components/auth/AuthForm';

export const TelegramConnectPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, logout, isLoading: isAuthLoading } = useAuth();
  const [isLinking, setIsLinking] = useState(false);
  const [linkError, setLinkError] = useState(null); // Состояние для хранения ошибки

  const telegramId = searchParams.get('tg_id');

  const performLink = async () => {
    if (!telegramId) {
      setLinkError('ID телеграма не найден в ссылке. Попробуйте зайти из бота заново.');
      return;
    }

    setIsLinking(true);
    setLinkError(null);
    try {
      await linkTelegram(telegramId);
      toast.success('Telegram успешно привязан!');
      navigate('/app');
    } catch (error) {
      const msg = error.response?.data?.error || 'Ошибка привязки аккаунта.';
      setLinkError(msg);
      toast.error(msg);
    } finally {
      setIsLinking(false);
    }
  };

  useEffect(() => {
    // Пытаемся привязать только если авторизован, есть ID и мы еще не в процессе/ошибке
    if (isAuthenticated && telegramId && !isLinking && !linkError) {
      performLink();
    }
  }, [isAuthenticated, telegramId]);

  if (isAuthLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="animate-spin text-accent-ai" size={48} /></div>;
  }

  if (!isAuthenticated || linkError) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="mb-8 text-center max-w-md">
          <h1 className="text-2xl font-bold text-white mb-2 font-headings">
            {linkError ? 'Упс! Произошла ошибка' : 'Почти готово! 🌿'}
          </h1>
          <p className="text-text-secondary mb-4">
            {linkError ? linkError : 'Войдите в аккаунт FloraAI, чтобы завершить привязку бота.'}
          </p>

          {linkError && (
            <button
              onClick={() => { setLinkError(null); logout(); }}
              className="text-accent-ai underline text-sm hover:opacity-80"
            >
              Попробовать другой аккаунт
            </button>
          )}
        </div>

        {!linkError && <AuthForm />}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="bg-surface-1 p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-border-color">
        <Loader2 className="animate-spin mx-auto text-accent-ai mb-6" size={48} />
        <h1 className="text-2xl font-bold text-text-primary mb-2 font-headings">Привязываем ваш Telegram...</h1>
        <p className="text-text-secondary text-sm">Это займет всего секунду.</p>
      </div>
    </div>
  );
};

export default TelegramConnectPage;