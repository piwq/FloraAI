import React from 'react';
import { Link } from 'react-router-dom';
import { Plus, Settings, MessageSquare, User, Info, Gem, Send, Trash2, Sprout } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getChatSessions, getUserProfile } from '@/services/apiClient';
import { SidebarSkeleton } from './SidebarSkeleton';

export const Sidebar = ({ isOpen, onNewChat, activeChatId, setActiveChatId, onDeleteChat }) => {
  const { data: sessionsData, isLoading: isLoadingSessions } = useQuery({
    queryKey: ['chatSessions'],
    queryFn: getChatSessions,
    select: (res) => res.data, // ИСПРАВЛЕНО: было res.data.data
  });

  const { data: userData } = useQuery({
    queryKey: ['userProfile'],
    queryFn: () => getUserProfile().then(res => res.data),
    staleTime: 1000 * 60 * 5,
  });

  return (
    <aside className={`w-[280px] bg-surface-2 flex flex-col p-4 border-r border-border-color flex-shrink-0
                       fixed top-0 left-0 h-full z-40 transform transition-transform duration-300 ease-in-out
                       md:relative md:translate-x-0 md:h-auto
                       ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
    >
      <div className="flex-grow flex flex-col overflow-y-auto overflow-x-hidden">
        {/* Кнопка "Новый анализ" (вместо Новый чат) */}
        <button
          onClick={onNewChat}
          className="flex items-center justify-center w-full bg-green-600 text-white font-bold py-3 px-4 rounded-lg
                           hover:bg-green-700 transition-colors mb-6 flex-shrink-0">
          <Plus size={20} className="mr-2" /> Новый анализ
        </button>

        <div className="flex-grow overflow-y-auto pr-2 -mr-2">
          {/* Изменили заголовок */}
          <h3 className="text-sm text-text-secondary font-semibold mb-2 px-2 flex items-center gap-2">
            <Sprout size={16} /> Ваши растения
          </h3>

          {isLoadingSessions && <SidebarSkeleton />}

          {!isLoadingSessions && sessionsData?.length > 0 && (
            <ul className="space-y-1">
              {sessionsData.map(chat => (
                <li key={chat.id} className="group flex items-center gap-1">
                  <button
                    onClick={() => setActiveChatId(chat.id)}
                    className={`flex items-center flex-grow min-w-0 text-left pl-4 py-2.5 rounded-lg text-sm truncate transition-colors
                                      ${activeChatId === chat.id
                                        ? 'bg-green-500/20 text-text-primary'
                                        : 'text-text-secondary hover:bg-surface-1'}`}
                  >
                    {activeChatId === chat.id && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 bg-green-500 rounded-r-full"></div>
                    )}
                    <MessageSquare size={16} className="mr-3 flex-shrink-0"/>
                    <span className="truncate">{chat.title}</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteChat(chat.id, chat.title);
                    }}
                    className="p-1 text-text-secondary hover:text-red-500 rounded-md
                              opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                    title="Удалить чат"
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-border-color flex-shrink-0">
            <ul className="space-y-1">
                <li>
                    <Link to="/about" className="flex items-center px-4 py-2.5 rounded-lg text-sm text-text-secondary hover:bg-surface-1">
                        <Info size={16} className="mr-3" /> О FloraAI
                    </Link>
                </li>
                <li>
                    <Link to="/tariffs" className="flex items-center px-4 py-2.5 rounded-lg text-sm text-text-secondary hover:bg-surface-1">
                        <Gem size={16} className="mr-3" /> Тарифы
                    </Link>
                </li>
                <li>
                    {/* Изменили ссылку на бота */}
                    <a href="https://t.me/FloraAIBot" target="_blank" rel="noopener noreferrer" className="flex items-center px-4 py-2.5 rounded-lg text-sm text-text-secondary hover:bg-surface-1">
                        <Send size={16} className="mr-3 text-blue-400" /> Telegram бот
                    </a>
                </li>
            </ul>
        </div>
      </div>

      <div className="pt-4 mt-2 border-t border-border-color flex-shrink-0">
        <Link to="/profile" className="flex items-center justify-between p-2 rounded-lg hover:bg-surface-1 transition-colors group">
          <div className="flex items-center overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-green-500 flex-shrink-0 flex items-center justify-center mr-3">
              <User size={16} className="text-white"/>
            </div>
            <span className="text-text-primary font-medium truncate">
              {userData?.name || userData?.email || 'Профиль'}
            </span>
          </div>
          <Settings size={20} className="text-text-secondary group-hover:text-text-primary transition-colors flex-shrink-0"/>
        </Link>
      </div>
    </aside>
  );
};