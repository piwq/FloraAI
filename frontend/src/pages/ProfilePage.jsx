import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Header } from '@/components/app/Header'; 
import { getUserProfile, updateUserProfile, changePassword } from '@/services/apiClient';
import toast from 'react-hot-toast';
import { Send } from 'lucide-react';
import { Link } from 'react-router-dom';

const ProfilePage = () => {
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({ name: '', birthDate: '' });
  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '' });
  const [isLoading, setIsLoading] = useState(true);

  // Получаем сегодняшнюю дату в формате YYYY-MM-DD для ограничения максимальной даты
  const todayDateStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await getUserProfile();
        setUser(response.data);
        setFormData({
          name: response.data.name || '',
          birthDate: response.data.birthDate ? response.data.birthDate.split('T')[0] : '',
        });
      } catch (error) {
        toast.error('Не удалось загрузить профиль.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchUser();
  }, []);

  const handleFormChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  const handlePasswordChange = (e) => setPasswordData({ ...passwordData, [e.target.name]: e.target.value });

  const handleProfileUpdate = async (e) => {
    e.preventDefault();

    // Валидация даты рождения
    if (formData.birthDate) {
      const selectedYear = new Date(formData.birthDate).getFullYear();
      const selectedDate = new Date(formData.birthDate);
      const today = new Date();

      if (selectedYear < 1926) {
        toast.error('Год рождения не может быть раньше 1926.');
        return;
      }
      if (selectedDate > today) {
        toast.error('Дата рождения не может быть в будущем.');
        return;
      }
    }

    const promise = updateUserProfile(formData).then(res => {
        // Обновляем локальное состояние имени, если оно изменилось
        setUser(prev => ({ ...prev, name: res.data.name }));
        return res;
    });

    toast.promise(promise, {
      loading: 'Сохранение...',
      success: 'Профиль успешно обновлен!',
      error: 'Ошибка при обновлении профиля.',
    });
  };

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    try {
        await changePassword(passwordData);
        toast.success('Пароль успешно изменен!');
        setPasswordData({ currentPassword: '', newPassword: '' });
    } catch (error) {
        toast.error(error.response?.data?.error || 'Ошибка при смене пароля.');
    }
  };

  if (isLoading) return <div className="text-center p-8 text-4xl">Загрузка профиля...</div>;

  const isPremium = user?.subscriptionStatus === 'PREMIUM';

  return (
    <div className="h-screen w-screen flex flex-col font-body bg-background text-text-primary">
      <Header />
      <main className="flex-1 overflow-y-auto p-4 sm:p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto"
        >
          <h1 className="font-headings text-3xl sm:text-4xl font-bold mb-8">Мой профиль</h1>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

            {/* ЛЕВЫЙ БЛОК: Личные данные */}
            <div className="bg-surface-2 p-8 rounded-lg border border-border-color">
              <h2 className="text-2xl font-semibold mb-6">Личные данные</h2>
              <form onSubmit={handleProfileUpdate} className="space-y-4">
                <div>
                  <label className="text-sm text-text-secondary">
                    {user?.email ? 'Email' : 'Телефон'}
                  </label>
                  <p className="text-lg">{user?.email || user?.phone}</p>
                </div>
                <div>
                  <label htmlFor="name" className="text-sm text-text-secondary">Имя</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleFormChange}
                    className="w-full bg-surface-1 border border-border-color focus:border-accent-ai focus:ring-1 focus:ring-accent-ai rounded-lg p-3 mt-1 outline-none transition-colors"
                  />
                </div>
                <div>
                  <label htmlFor="birthDate" className="text-sm text-text-secondary">Дата рождения</label>
                  <input
                    type="date"
                    id="birthDate"
                    name="birthDate"
                    value={formData.birthDate}
                    onChange={handleFormChange}
                    min="1926-01-01"
                    max={todayDateStr}
                    className="w-full bg-surface-1 border border-border-color focus:border-accent-ai focus:ring-1 focus:ring-accent-ai rounded-lg p-3 mt-1 text-text-primary outline-none transition-colors [color-scheme:dark]"
                  />
                </div>
                <button type="submit" className="w-full bg-accent-ai text-white font-bold py-3 px-4 rounded-lg mt-4 hover:opacity-90 transition-colors">
                  Сохранить
                </button>
              </form>
            </div>

            {/* ПРАВЫЙ БЛОК: Пароль, Подписка, Интеграции */}
            <div className="space-y-8">

                <div className="bg-surface-2 p-8 rounded-lg border border-border-color">
                    <h2 className="text-2xl font-semibold mb-6">Смена пароля</h2>
                    <form onSubmit={handlePasswordUpdate} className="space-y-4">
                        <input
                          type="password"
                          name="currentPassword"
                          placeholder="Текущий пароль"
                          value={passwordData.currentPassword}
                          onChange={handlePasswordChange}
                          className="w-full bg-surface-1 border border-border-color focus:border-accent-ai focus:ring-1 focus:ring-accent-ai rounded-lg p-3 outline-none transition-colors"
                        />
                        <input
                          type="password"
                          name="newPassword"
                          placeholder="Новый пароль"
                          value={passwordData.newPassword}
                          onChange={handlePasswordChange}
                          className="w-full bg-surface-1 border border-border-color focus:border-accent-ai focus:ring-1 focus:ring-accent-ai rounded-lg p-3 outline-none transition-colors"
                        />
                        <button type="submit" className="w-full border border-accent-ai text-accent-ai font-bold py-3 px-4 rounded-lg mt-4 hover:bg-accent-ai hover:text-white transition-colors">
                          Изменить пароль
                        </button>
                    </form>
                </div>

                <div className="bg-surface-2 p-8 rounded-lg border border-border-color">
                    <h2 className="text-2xl font-semibold mb-4">Подписка</h2>
                    <p className="text-lg">Ваш статус: <span className="font-bold text-accent-ai">{user?.subscriptionStatus}</span></p>
                    <p className="text-text-secondary">Осталось анализов: {user?.remainingInterpretations}</p>

                    {/* Логика блокировки кнопки Premium */}
                    {isPremium ? (
                      <button disabled className="w-full bg-surface-1 text-text-primary font-bold py-3 px-4 rounded-lg mt-4 opacity-50 cursor-not-allowed">
                        Вы уже Premium
                      </button>
                    ) : (
                      <Link to="/tariffs">
                        <button className="w-full bg-accent-ai text-white font-bold py-3 px-4 rounded-lg mt-4 hover:opacity-90 transition-colors">
                          Улучшить до Premium
                        </button>
                      </Link>
                    )}
                </div>

                <div className="bg-surface-2 p-8 rounded-lg border border-border-color">
                    <h2 className="text-2xl font-semibold mb-4">Интеграции</h2>
                    {/* Проверяем наличие telegramTag, который прилетает из сериализатора */}
                    {user?.telegramTag ? (
                        <div className="flex items-center justify-between p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white">
                                    <Send size={20} />
                                </div>
                                <div>
                                    <p className="text-sm text-text-secondary leading-none mb-1">Telegram привязан</p>
                                    <p className="text-lg font-bold text-text-primary">@{user.telegramTag}</p>
                                </div>
                            </div>
                            <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-md uppercase font-bold tracking-wider">Active</span>
                        </div>
                    ) : (
                        <a
                          href={`https://t.me/FloraAI_hackaton_bot?start=auth`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full bg-blue-500 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 hover:bg-blue-600 transition-colors"
                        >
                          <Send size={20}/>
                          Привязать Telegram
                        </a>
                    )}
                </div>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default ProfilePage;