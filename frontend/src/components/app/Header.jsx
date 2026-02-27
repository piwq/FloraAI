// Добавляем useEffect в импорт
import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, LogOut, Menu } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';
import apiClient from '@/services/apiClient';

export const Header = ({ onToggleSidebar }) => {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    const promise = apiClient.post('/auth/logout');
    
    toast.promise(promise, {
      loading: 'Выходим...',
      success: 'Вы успешно вышли из системы.',
      error: 'Произошла ошибка при выходе.',
    }).finally(() => {
      logout();
      navigate('/');
    });
  };

  // Закрытие меню при клике вне его
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);


  return (
    <header className="flex-shrink-0 flex items-center justify-between px-4 md:px-6 py-3 border-b border-border-color z-30 bg-background">
      <div className="flex items-center gap-4">
        {onToggleSidebar && (
            <button onClick={onToggleSidebar} className="p-2 -ml-2 text-text-secondary md:hidden">
                <Menu size={24} />
            </button>
        )}
        <Link to="/app" className="font-headings text-2xl font-bold text-text-primary">
          Морфеус
        </Link>
      </div>

      <nav className="hidden md:flex items-center space-x-6 text-text-secondary">
        <Link to="/app" className="hover:text-text-primary transition-colors">Главная</Link>
        <Link to="/about" className="hover:text-text-primary transition-colors">О нас</Link>
        <Link to="/tariffs" className="hover:text-text-primary transition-colors">Тарифы</Link>
      </nav>

      <div className="relative" ref={menuRef}>
        <button onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)} className="p-2 rounded-full hover:bg-surface-1 transition-colors">
          <User className="text-text-secondary" />
        </button>
        {isProfileMenuOpen && (
          <div 
            className="absolute right-0 mt-2 w-48 bg-surface-2 rounded-lg shadow-lg p-2 z-20 animate-fade-in-down"
          >
            <Link to="/profile" onClick={() => setIsProfileMenuOpen(false)} className="flex items-center px-4 py-2 text-sm text-text-primary hover:bg-surface-1 rounded">
              <User size={16} className="mr-2"/> Профиль
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center w-full px-4 py-2 text-sm text-red-400 hover:bg-surface-1 rounded"
            >
              <LogOut size={16} className="mr-2"/> Выйти
            </button>
          </div>
        )}
      </div>
    </header>
  );
};