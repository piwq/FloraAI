import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import apiClient from '../services/apiClient.js';
import { AuthToggle } from '../components/auth/AuthToggle.jsx';
import { AuthInput } from '../components/auth/AuthInput.jsx';
import { AuthMethodToggle } from '../components/auth/AuthMethodToggle.jsx';
import OtpInput from '../components/auth/OtpInput.jsx';

const isValidIdentifier = (identifier) => {
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
  const isPhone = /^\+7\d{10}$/.test(identifier);
  return isEmail || isPhone;
};

const validateName = (name) => !name?.trim() ? 'Введите ваше имя' : '';
const validatePassword = (pwd) => pwd.length < 6 ? 'Пароль должен быть не менее 6 символов' : '';
const validateBirthDate = (date) => {
  if (!date) return 'Укажите дату рождения';
  const birth = new Date(date);
  const today = new Date(); today.setHours(0,0,0,0);
  if (isNaN(birth.getTime())) return 'Некорректная дата';
  if (birth >= today) return 'Дата не может быть в будущем';
  const year = birth.getFullYear();
  if (year < 1926) return 'Год рождения не ранее 1926';
  if (year > 2020) return 'Год рождения не позже 2020';
  return '';
};
const validateIdentifierField = (value, method) => {
  if (!value) return '';
  if (method === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Некорректный email';
  if (method === 'phone' && !/^\+7\d{10}$/.test(value)) return 'Телефон должен быть в формате +7XXXXXXXXXX';
  return '';
};

export const TelegramConnectPage = () => {
  const [mode, setMode] = useState('login');
  const [authMethod, setAuthMethod] = useState('email');
  const [formData, setFormData] = useState({ email: '', password: '', name: '', birthDate: '' });
  const [isAgreed, setIsAgreed] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [tg, setTg] = useState(null);
  const [appHeight, setAppHeight] = useState('100vh');

  const [registrationStep, setRegistrationStep] = useState(1);
  const [otp, setOtp] = useState('');

  const [errors, setErrors] = useState({});

  useEffect(() => {
    const timer = setTimeout(() => {
      if (window.Telegram && window.Telegram.WebApp) {
        const webApp = window.Telegram.WebApp;
        webApp.ready();
        webApp.expand();
        setTg(webApp);

        const setViewportHeight = () => {
          if (webApp.viewportHeight) {
            setAppHeight(`${webApp.viewportHeight}px`);
          }
        };

        setViewportHeight();
        webApp.onEvent('viewportChanged', setViewportHeight);

        console.log("Telegram SDK инициализирован.");

        return () => {
          webApp.offEvent('viewportChanged', setViewportHeight);
        };
      } else {
        console.error("SDK Telegram не найдено. Убедитесь, что приложение открыто в клиенте Telegram.");
        setError("Это приложение должно быть запущено внутри Telegram.");
      }
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });

    if (name === 'name') setErrors(prev => ({ ...prev, name: validateName(value) }));
    if (name === 'password') setErrors(prev => ({ ...prev, password: validatePassword(value) }));
    if (name === 'birthDate') setErrors(prev => ({ ...prev, birthDate: validateBirthDate(value) }));
  };

  const handleIdentifierChange = (e) => {
    let { value } = e.target;
    if ((mode === 'register' && authMethod === 'phone') || (mode === 'login' && /^[78]/.test(value))) {
        const numbers = value.replace(/\D/g, '');
        if (numbers.startsWith('8')) {
            value = '+7' + numbers.slice(1);
        } else if (numbers.startsWith('7')) {
            value = '+7' + numbers.slice(1);
        } else if (numbers) {
            value = '+' + numbers;
        } else {
            value = '';
        }
        value = value.slice(0, 12);
    }
    setFormData({ ...formData, email: value });

    const err = validateIdentifierField(value, authMethod);
    setErrors(prev => err ? { ...prev, email: err } : ({ ...prev, email: undefined }));
  };

  const handleFinalSubmit = async () => {
    setIsLoading(true);
    setError('');
    try {
      const registerResponse = await apiClient.post('/auth/register', {
        ...formData,
        telegramInitData: tg.initData,
      });
      localStorage.setItem('authToken', registerResponse.data.token);

      await apiClient.post('/telegram/auth-success', { telegramInitData: tg.initData });

      setSuccess('Успешно! Возвращайтесь в чат.');
      setTimeout(() => tg?.close(), 2000);

    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Произошла ошибка при регистрации.';
      setError(errorMessage);
      setRegistrationStep(1);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!tg || !tg.initData) {
      setError('Критическая ошибка: отсутствуют данные Telegram. Пожалуйста, перезапустите Web App.');
      return;
    }

    if (mode === 'login') {
      setIsLoading(true);
      try {
        const loginResponse = await apiClient.post('/auth/login', { email: formData.email, password: formData.password });
        localStorage.setItem('authToken', loginResponse.data.token);

        await apiClient.post('/auth/link-telegram', { telegramInitData: tg.initData });
        await apiClient.post('/telegram/auth-success', { telegramInitData: tg.initData });

        setSuccess('Успешно! Возвращайтесь в чат.');
        setTimeout(() => tg?.close(), 2000);

      } catch (err) {
        const errorMessage = err.response?.data?.error || 'Произошла неизвестная ошибка.';
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (registrationStep === 1) {
      if (!isAgreed) {
          setError('Для регистрации необходимо принять условия соглашения.');
          return;
      }

      const newErrors = {
        name: validateName(formData.name),
        email: validateIdentifierField(formData.email, authMethod),
        password: validatePassword(formData.password),
        birthDate: validateBirthDate(formData.birthDate),
      };
      setErrors(newErrors);

      if (Object.values(newErrors).some(Boolean)) {
        setError('Пожалуйста, исправьте ошибки в форме');
        return;
      }

      setError('');
      setRegistrationStep(2);
    }
  };

  let identifierInputProps;
  if (mode === 'login') {
    identifierInputProps = { placeholder: 'Email или телефон', type: 'text', inputMode: 'text' };
  } else {
    identifierInputProps = authMethod === 'email'
      ? { placeholder: 'Email', type: 'email', inputMode: 'email' }
      : { placeholder: '+7 (999) 999-99-99', type: 'tel', inputMode: 'tel' };
  }

  const hasFieldErrors = Object.values(errors).some(Boolean);

  return (
    <div
      className="flex flex-col items-center justify-start p-4 font-body bg-background text-text-primary overflow-y-auto"
      style={{ height: appHeight }}
    >
      {success ? (
        <p className="text-green-400 text-2xl font-bold my-auto">{success}</p>
      ) : (
        <div className="w-full max-w-xl my-auto">
            <div className="bg-black/20 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-2xl">
                <div className="p-8 md:p-12">
                    <AuthToggle isLogin={mode === 'login'} setIsLogin={(val) => { setMode(val ? 'login' : 'register'); setRegistrationStep(1); setErrors({}); }} />

                    <h2 key={mode} className="font-headings text-4xl font-bold text-center text-white mb-6">
                        {mode === 'login' ? 'Связь с аккаунтом' : 'Создание аккаунта'}
                    </h2>

                    {mode === 'register' && registrationStep === 1 && <AuthMethodToggle method={authMethod} setMethod={setAuthMethod} />}

                    <form onSubmit={handleSubmit} className="mt-6 space-y-6">
                      <AnimatePresence mode="wait">
                        {mode === 'login' || registrationStep === 1 ? (
                          <motion.div key="tg-details-step" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                            {mode === 'register' && (
                              <div>
                                <AuthInput
                                  name="name"
                                  placeholder="Ваше имя"
                                  value={formData.name}
                                  onChange={handleInputChange}
                                  disabled={isLoading}
                                />
                                {errors.name && <p className="text-red-400 text-sm mt-1">{errors.name}</p>}
                              </div>
                            )}

                            <div>
                              <AuthInput
                                name="email"
                                value={formData.email}
                                onChange={handleIdentifierChange}
                                required
                                disabled={isLoading}
                                key={mode === 'login' ? 'login-id' : `register-${authMethod}`}
                                {...identifierInputProps}
                              />
                              {errors.email && <p className="text-red-400 text-sm mt-1">{errors.email}</p>}
                            </div>

                            <div>
                              <AuthInput
                                name="password"
                                type="password"
                                placeholder="Пароль"
                                value={formData.password}
                                onChange={handleInputChange}
                                required
                                disabled={isLoading}
                              />
                              {errors.password && <p className="text-red-400 text-sm mt-1">{errors.password}</p>}
                            </div>

                            {mode === 'register' && (
                              <div>
                                <AuthInput
                                  name="birthDate"
                                  type="date"
                                  placeholder="Дата рождения"
                                  value={formData.birthDate}
                                  onChange={handleInputChange}
                                  disabled={isLoading}
                                />
                                {errors.birthDate && <p className="text-red-400 text-sm mt-1">{errors.birthDate}</p>}
                              </div>
                            )}

                            {mode === 'register' && (
                                <div className="flex items-start space-x-3 pt-2 text-sm">
                                  <input
                                      type="checkbox"
                                      id="agreement"
                                      checked={isAgreed}
                                      onChange={(e) => setIsAgreed(e.target.checked)}
                                      className="mt-1 h-4 w-4 rounded border-white/30 bg-transparent text-accent-ai focus:ring-accent-ai focus:ring-offset-background"
                                  />
                                  <label htmlFor="agreement" className="text-text-secondary">
                                      Я принимаю условия{' '}
                                      <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-accent-ai hover:underline">
                                          Пользовательского соглашения
                                      </a>{' '}
                                      и даю согласие на обработку персональных данных в соответствии с{' '}
                                      <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-accent-ai hover:underline">
                                          Политикой
                                      </a>.
                                  </label>
                                </div>
                            )}

                            {error && <p className="text-red-400 text-center text-sm pt-4">{error}</p>}

                            <div className="pt-4">
                                <button
                                    type="submit"
                                    disabled={isLoading || (mode === 'register' && (hasFieldErrors || !isAgreed))}
                                    className="w-full bg-accent-ai text-white font-bold py-4 px-6 rounded-lg text-lg
                                            transition-all duration-300 ease-in-out
                                            hover:bg-white hover:text-accent-ai hover:shadow-lg hover:shadow-accent-ai/30
                                            transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLoading ? 'Загрузка...' : (mode === 'login' ? 'Войти и связать' : 'Получить код')}
                                </button>
                            </div>
                          </motion.div>
                        ) : (
                          <OtpInput
                            otp={otp}
                            setOtp={setOtp}
                            onConfirm={handleFinalSubmit}
                            isLoading={isLoading}
                          />
                        )}
                      </AnimatePresence>
                    </form>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};