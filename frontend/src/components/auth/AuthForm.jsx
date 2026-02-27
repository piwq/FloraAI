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
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
  const isPhone = /^\+7\d{10}$/.test(identifier);
  return isEmail || isPhone;
};

const AuthForm = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [authMethod] = useState('email');
  const [formData, setFormData] = useState({ name: '', email: '', password: '', birthDate: '' });
  const [isAgreed, setIsAgreed] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [registrationStep, setRegistrationStep] = useState(1);
  const [otp, setOtp] = useState('');
  const [errors, setErrors] = useState({});
  const { login } = useAuth();
  const navigate = useNavigate();

  const validateBirthDate = (date) => {
    if (!date) return 'Укажите дату рождения';

    const birth = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (isNaN(birth.getTime())) return 'Некорректный формат даты рождения';
    if (birth >= today) return 'Дата рождения не должна быть будущей';

    const birthYear = birth.getFullYear();
    if (birthYear < 1926) return 'Дата рождения должна быть не раньше 1926 года';
    if (birthYear > 2020) return 'Дата рождения должна быть не позже 2020 года';

    return '';
  };

  const validatePassword = (password) => {
    if (password.length < 6) return 'Пароль должен содержать минимум 6 символов';
    return '';
  };

  const validateIdentifier = (identifier, method) => {
    if (!identifier) return '';
    if (method === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) {
      return 'Неверный адрес электронной почты';
    }
    if (method === 'phone' && !/^\+7\d{10}$/.test(identifier)) {
      return 'Номер телефона должен быть в формате +7XXXXXXXXXX';
    }
    return '';
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });

    let newErrors = { ...errors };
    if (value) {
      switch (name) {
        case 'birthDate':
          newErrors.birthDate = validateBirthDate(value);
          break;
        case 'password':
          newErrors.password = validatePassword(value);
          break;
        case 'email':
          newErrors.email = validateIdentifier(value, authMethod);
          break;
        default:
          break;
      }
    } else {
      delete newErrors[name];
    }
    setErrors(newErrors);
  };

  const handleIdentifierChange = (e) => {
    let { value } = e.target;
    if ((!isLogin && authMethod === 'phone') || (isLogin && /^[78]/.test(value))) {
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
    if (value) {
      setErrors({ ...errors, email: validateIdentifier(value, authMethod) });
    } else {
      const newErrors = { ...errors };
      delete newErrors.email;
      setErrors(newErrors);
    }
  };

  const handleFinalSubmit = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await registerUser(formData);
      toast.success('Аккаунт успешно создан!');
      login(response.data.token);
      navigate('/app');
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Произошла ошибка при регистрации.';
      setError(errorMessage);
      toast.error(errorMessage);
      setRegistrationStep(1);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setErrors({});

    if (isLogin) {
      setIsLoading(true);
      try {
        const response = await loginUser({ email: formData.email, password: formData.password });
        toast.success('С возвращением!');
        login(response.data.token);
        navigate('/app');
      } catch (err) {
        const errorMessage = err.response?.data?.error || 'Неверный логин или пароль.';
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (registrationStep === 1) {
      if (!isAgreed) {
        toast.error('Необходимо согласиться с условиями использования.');
        return;
      }
      if (!isValidIdentifier(formData.email)) {
        toast.error('Введите корректный адрес электронной почты или номер телефона.');
        return;
      }
      const birthError = validateBirthDate(formData.birthDate);
      if (birthError) {
        setErrors({ ...errors, birthDate: birthError });
        toast.error(birthError);
        return;
      }
      const passwordError = validatePassword(formData.password);
      if (passwordError) {
        setErrors({ ...errors, password: passwordError });
        toast.error(passwordError);
        return;
      }
      if (!formData.name.trim()) {
        setError('Поле имени не может быть пустым');
        return;
      }
      setRegistrationStep(2);
      return;
    }
  };

  return (
    <div className="w-full max-w-xl bg-black/20 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-2xl">
      <div className="p-8 md:p-12">
        <AuthToggle isLogin={isLogin} setIsLogin={(val) => { setIsLogin(val); setRegistrationStep(1); }} />

        <motion.h2
          key={isLogin ? 'login-title' : 'register-title'}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="font-headings text-5xl font-bold text-center text-white mb-6"
        >
          {isLogin ? 'С возвращением' : 'Присоединяйтесь'}
        </motion.h2>

        <form onSubmit={handleSubmit} className="space-y-8">
          <AnimatePresence mode="wait">
            {registrationStep === 1 ? (
              <motion.div
                key="form-fields"
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 50 }}
                transition={{ duration: 0.5 }}
                className="space-y-6"
              >
                {!isLogin && (
                  <div>
                    <AuthInput
                      name="name"
                      type="text"
                      placeholder="Имя"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      key="name-input"
                    />
                    {formData.name && !formData.name.trim() && <p className="text-red-400 text-sm mt-1">Поле имени не должно содержать только пробелы</p>}
                  </div>
                )}
                <div>
                  <AuthInput
                    name="email"
                    type="text"
                    placeholder={isLogin ? "Email или телефон" : authMethod === 'email' ? "Email" : "Телефон"}
                    value={formData.email}
                    onChange={handleIdentifierChange}
                    required
                    key={isLogin ? 'login-id' : `register-${authMethod}`}
                  />
                  {formData.email && errors.email && <p className="text-red-400 text-sm mt-1">{errors.email}</p>}
                </div>
                <div>
                  <AuthInput
                    name="password"
                    type="password"
                    placeholder="Пароль"
                    value={formData.password}
                    onChange={handleInputChange}
                    required
                    key="password-input"
                  />
                  {formData.password && errors.password && <p className="text-red-400 text-sm mt-1">{errors.password}</p>}
                </div>

                {!isLogin && (
                  <div>
                    <AuthInput
                      name="birthDate"
                      type="date"
                      placeholder="Дата рождения"
                      value={formData.birthDate}
                      onChange={handleInputChange}
                      key="birthdate-input"
                    />
                    {formData.birthDate && errors.birthDate && <p className="text-red-400 text-sm mt-1">{errors.birthDate}</p>}
                  </div>
                )}

                {!isLogin && (
                  <motion.div
                    key="agreement-checkbox"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                    className="flex items-start space-x-3 pt-2"
                  >
                    <input
                      type="checkbox"
                      id="agreement"
                      checked={isAgreed}
                      onChange={(e) => setIsAgreed(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-white/30 bg-transparent text-accent-ai focus:ring-accent-ai focus:ring-offset-background"
                    />
                    <label htmlFor="agreement" className="text-text-secondary text-sm">
                      Я принимаю условия{' '}
                      <Link to="/terms" target="_blank" rel="noopener noreferrer" className="text-accent-ai hover:underline">
                        Пользовательского соглашения
                      </Link>{' '}
                      и даю согласие на обработку персональных данных в соответствии с{' '}
                      <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="text-accent-ai hover:underline">
                        Политикой
                      </Link>.
                    </label>
                  </motion.div>
                )}

                {error && <p className="text-red-400 text-center text-sm pt-4">{error}</p>}

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={isLoading || (!isLogin && (!isAgreed || !formData.name.trim() || !isValidIdentifier(formData.email) || !formData.password || !formData.birthDate || !!errors.birthDate || !!errors.password || !!errors.email))}
                    className="w-full bg-accent-ai text-white font-bold py-4 px-6 rounded-lg text-lg transition-all duration-300 ease-in-out hover:bg-white hover:text-accent-ai transform hover:-translate-y-1 disabled:opacity-50"
                  >
                    {isLogin ? 'Войти' : 'Получить код'}
                  </button>
                  {(!isLogin && (!isAgreed || !formData.name.trim() || !isValidIdentifier(formData.email) || !formData.password || !formData.birthDate || !!errors.birthDate || !!errors.password || !!errors.email)) && <p className="text-red-400 text-center text-sm mt-2">Не все условия заполнения соблюдены</p>}
                  {(!isLogin && formData.email && isValidIdentifier(formData.email) && formData.password && !errors.password && formData.birthDate && !errors.birthDate && !formData.name.trim()) && <p className="text-red-400 text-center text-sm mt-2">Поле имени не может быть пустым</p>}
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
  );
};

export default AuthForm;