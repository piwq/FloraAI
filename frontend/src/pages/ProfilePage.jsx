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
    const promise = updateUserProfile(formData);
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
                  <input type="text" id="name" name="name" value={formData.name} onChange={handleFormChange} className="w-full bg-surface-1 rounded p-2 mt-1"/>
                </div>
                <div>
                  <label htmlFor="birthDate" className="text-sm text-text-secondary">Дата рождения</label>
                  <input type="date" id="birthDate" name="birthDate" value={formData.birthDate} onChange={handleFormChange} className="w-full bg-surface-1 rounded p-2 mt-1 text-text-secondary"/>
                </div>
                <button type="submit" className="w-full bg-accent-ai text-white font-bold py-2 px-4 rounded mt-4 hover:opacity-90">Сохранить</button>
              </form>
            </div>

            <div className="space-y-8">
                <div className="bg-surface-2 p-8 rounded-lg border border-border-color">
                    <h2 className="text-2xl font-semibold mb-6">Смена пароля</h2>
                    <form onSubmit={handlePasswordUpdate} className="space-y-4">
                        <input type="password" name="currentPassword" placeholder="Текущий пароль" value={passwordData.currentPassword} onChange={handlePasswordChange} className="w-full bg-surface-1 rounded p-2"/>
                        <input type="password" name="newPassword" placeholder="Новый пароль" value={passwordData.newPassword} onChange={handlePasswordChange} className="w-full bg-surface-1 rounded p-2"/>
                        <button type="submit" className="w-full border border-accent-ai text-accent-ai font-bold py-2 px-4 rounded mt-4 hover:bg-accent-ai hover:text-white transition-colors">Изменить пароль</button>
                    </form>
                </div>
                <div className="bg-surface-2 p-8 rounded-lg border border-border-color">
                    <h2 className="text-2xl font-semibold mb-4">Подписка</h2>
                    <p className="text-lg">Ваш статус: <span className="font-bold text-accent-ai">{user?.subscriptionStatus}</span></p>
                    <p className="text-text-secondary">Осталось толкований: {user?.remainingInterpretations}</p>
                    <Link to="/tariffs">
                <button className="w-full bg-yellow-500 text-black font-bold py-2 px-4 rounded mt-4 hover:opacity-90">
                  Улучшить до Premium
                </button>
              </Link>
                </div>
            <div className="bg-surface-2 p-8 rounded-lg border border-border-color">
                    <h2 className="text-2xl font-semibold mb-4">Интеграции</h2>
                    <a 
                      href="https://t.me/DreamMorpheusBot"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full bg-blue-500 text-white font-bold py-3 px-4 rounded-lg mt-4 hover:bg-blue-600 flex items-center justify-center gap-2 transition-colors"
                    >
                      <Send size={20}/>
                      Открыть в Telegram
                    </a>
                </div>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default ProfilePage;