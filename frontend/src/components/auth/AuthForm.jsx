import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { loginUser, registerUser } from '@/services/apiClient';
import { AuthToggle } from './AuthToggle';
import { AuthInput } from './AuthInput';

const AuthForm = () => {
  const [isLogin, setIsLogin] = useState(true);
  // Используем username вместо name
  const [formData, setFormData] = useState({ username: '', email: '', password: '' });
  const [isAgreed, setIsAgreed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (isLogin) {
      setIsLoading(true);
      try {
        const response = await loginUser({ email: formData.email, password: formData.password });
        toast.success('С возвращением!');
        login(response.data.access); // БЕРЕМ .access
        navigate('/app');
      } catch (err) {
        const errorMessage = err.response?.data?.detail || 'Неверный логин или пароль.';
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setIsLoading(false);
      }
    } else {
      if (!isAgreed) return toast.error('Примите условия соглашения.');
      setIsLoading(true);
      try {
        await registerUser(formData);
        const loginResponse = await loginUser({ email: formData.email, password: formData.password });
        toast.success('Аккаунт успешно создан!');
        login(loginResponse.data.access); // БЕРЕМ .access
        navigate('/app');
      } catch (err) {
        const errorMessage = err.response?.data?.username?.[0] || 'Ошибка при регистрации.';
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="w-full max-w-xl bg-black/20 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-2xl">
      <div className="p-8 md:p-12">
        <AuthToggle isLogin={isLogin} setIsLogin={setIsLogin} />

        <motion.h2 className="font-headings text-5xl font-bold text-center text-white mb-6">
          {isLogin ? 'С возвращением' : 'Присоединяйтесь'}
        </motion.h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          {!isLogin && (
            <AuthInput
              name="username"
              type="text"
              placeholder="Имя пользователя"
              value={formData.username}
              onChange={handleInputChange}
              required
            />
          )}
          <AuthInput
            name="email"
            type="email"
            placeholder="Email"
            value={formData.email}
            onChange={handleInputChange}
            required
          />
          <AuthInput
            name="password"
            type="password"
            placeholder="Пароль"
            value={formData.password}
            onChange={handleInputChange}
            required
          />

          {!isLogin && (
            <div className="flex items-start space-x-3 pt-2">
              <input
                type="checkbox"
                id="agreement"
                checked={isAgreed}
                onChange={(e) => setIsAgreed(e.target.checked)}
                className="mt-1 h-4 w-4 rounded bg-transparent text-accent-ai"
              />
              <label htmlFor="agreement" className="text-text-secondary text-sm">
                Я принимаю условия использования
              </label>
            </div>
          )}

          {error && <p className="text-red-400 text-center text-sm">{error}</p>}

          <button
            type="submit"
            disabled={isLoading || (!isLogin && !isAgreed)}
            className="w-full bg-accent-ai text-white font-bold py-4 px-6 rounded-lg text-lg hover:bg-white hover:text-accent-ai transition-all disabled:opacity-50"
          >
            {isLogin ? 'Войти' : 'Зарегистрироваться'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AuthForm;