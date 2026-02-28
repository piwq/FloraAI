import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '@/context/AuthContext';
import { loginUser, registerUser } from '@/services/apiClient';
import { AuthToggle } from './AuthToggle';
import { AuthInput } from './AuthInput';
import OtpInput from './OtpInput';

const isValidIdentifier = (identifier) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
};

const AuthForm = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', birthDate: '' });
  const [isAgreed, setIsAgreed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [registrationStep, setRegistrationStep] = useState(1);
  const [otp, setOtp] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleInputChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleFinalSubmit = async () => {
    setIsLoading(true);
    try {
      await registerUser({
        username: formData.email,
        email: formData.email,
        password: formData.password,
        name: formData.name,
        birthDate: formData.birthDate
      });
      const loginResponse = await loginUser({ email: formData.email, password: formData.password });
      toast.success('Аккаунт успешно создан!');
      login(loginResponse.data.access);
      navigate('/app');
    } catch (err) {
      const errorMsg = err.response?.data?.username?.[0] || err.response?.data?.error || 'Ошибка при регистрации. Возможно, Email уже занят.';
      toast.error(errorMsg);
      setRegistrationStep(1);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLogin) {
      if (!formData.email || !formData.password) {
        toast.error('Введите Email и пароль');
        return;
      }
      setIsLoading(true);
      try {
        const response = await loginUser({ email: formData.email, password: formData.password });
        toast.success('С возвращением!');
        login(response.data.access);
        navigate('/app');
      } catch (err) {
        const errorMsg = err.response?.data?.detail || 'Неверный Email или пароль.';
        toast.error(errorMsg);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (registrationStep === 1) {
      if (!isAgreed) {
        toast.error('Необходимо согласиться с условиями.');
        return;
      }
      if (!isValidIdentifier(formData.email)) {
        toast.error('Введите корректный Email.');
        return;
      }
      setRegistrationStep(2);
    }
  };

  return (
    <div className="w-full max-w-xl bg-surface-2/80 backdrop-blur-2xl rounded-2xl border border-border-color shadow-2xl">
      <div className="p-8 md:p-12">
        <AuthToggle isLogin={isLogin} setIsLogin={(val) => { setIsLogin(val); setRegistrationStep(1); }} />

        <h2 className="font-headings text-4xl md:text-5xl font-bold text-center text-white mb-6">
          {isLogin ? 'С возвращением' : 'Начать анализ'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <AnimatePresence mode="wait">
            {registrationStep === 1 ? (
              <motion.div key="step1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
                {!isLogin && (
                  <AuthInput name="name" type="text" placeholder="Имя (как к вам обращаться?)" value={formData.name} onChange={handleInputChange} required />
                )}
                <AuthInput name="email" type="email" placeholder="Email" value={formData.email} onChange={handleInputChange} required />
                <AuthInput name="password" type="password" placeholder="Пароль" value={formData.password} onChange={handleInputChange} required />

                {!isLogin && (
                  <>
                    <AuthInput name="birthDate" type="date" value={formData.birthDate} onChange={handleInputChange} required />
                    <div className="flex items-start space-x-3 pt-2">
                      <input type="checkbox" id="agreement" checked={isAgreed} onChange={(e) => setIsAgreed(e.target.checked)} className="mt-1 h-4 w-4 accent-accent-ai" />
                      <label htmlFor="agreement" className="text-text-secondary text-sm">
                        Я принимаю условия <Link to="/terms" className="text-accent-ai hover:underline">Пользовательского соглашения</Link> и даю согласие на обработку данных.
                      </label>
                    </div>
                  </>
                )}

                <button type="submit" disabled={isLoading} className="w-full bg-accent-ai text-white font-bold py-4 rounded-lg hover:bg-opacity-90 transition-all disabled:opacity-50">
                  {isLoading ? 'Загрузка...' : (isLogin ? 'Войти' : 'Продолжить')}
                </button>
              </motion.div>
            ) : (
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                <OtpInput otp={otp} setOtp={setOtp} onConfirm={handleFinalSubmit} isLoading={isLoading} />
              </motion.div>
            )}
          </AnimatePresence>
        </form>
      </div>
    </div>
  );
};

export default AuthForm;