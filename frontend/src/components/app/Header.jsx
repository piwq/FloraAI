import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { User, LogOut, Menu } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';
import apiClient from '@/services/apiClient';

export const Header = ({ onToggleSidebar }) => {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const { isAuthenticated, logout } = useAuth(); // Достаем статус авторизации
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    try {
      await apiClient.post('/auth/logout');
      toast.success('Вы успешно вышли из системы.');
    } catch (e) {
      console.error(e);
    } finally {
      logout();
      navigate('/');
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="flex-shrink-0 flex items-center justify-between px-4 md:px-6 py-3 border-b border-border-color z-30 bg-background/80 backdrop-blur-md">
      <div className="flex items-center gap-4">
        {onToggleSidebar && isAuthenticated && (
            <button onClick={onToggleSidebar} className="p-2 -ml-2 text-text-secondary md:hidden">
                <Menu size={24} />
            </button>
        )}
        <Link to={isAuthenticated ? "/app" : "/"} className="font-headings text-2xl font-bold text-accent-ai flex items-center gap-2">
          <span>🌿</span> FloraAI
        </Link>
      </div>

      <nav className="hidden md:flex items-center space-x-6 text-text-secondary">
        {isAuthenticated && <Link to="/app" className="hover:text-text-primary transition-colors">Анализ</Link>}
        <Link to="/about" className="hover:text-text-primary transition-colors">О нас</Link>
        <Link to="/tariffs" className="hover:text-text-primary transition-colors">Тарифы</Link>
      </nav>

      <div className="flex items-center">
        {isAuthenticated ? (
          <div className="relative" ref={menuRef}>
            <button onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)} className="p-2 rounded-full hover:bg-surface-1 transition-colors">
              <User className="text-text-secondary hover:text-accent-ai transition-colors" />
            </button>
            {isProfileMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-surface-2 border border-border-color rounded-lg shadow-lg p-2 z-20 animate-fade-in-down">
                <Link to="/profile" onClick={() => setIsProfileMenuOpen(false)} className="flex items-center px-4 py-2 text-sm text-text-primary hover:bg-surface-1 rounded transition-colors">
                  <User size={16} className="mr-2"/> Профиль
                </Link>
                <button onClick={handleLogout} className="flex items-center w-full px-4 py-2 text-sm text-red-400 hover:bg-surface-1 rounded transition-colors">
                  <LogOut size={16} className="mr-2"/> Выйти
                </button>
              </div>
            )}
          </div>
        ) : (
          location.pathname !== '/auth' && (
            <Link to="/auth" className="bg-accent-ai text-white font-bold py-2 px-6 rounded-lg hover:bg-opacity-90 transition-colors">
              Войти
            </Link>
          )
        )}
      </div>
    </header>
  );
};