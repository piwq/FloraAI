import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query'; 
import toast from 'react-hot-toast'; 
import { Header } from '@/components/app/Header';
import { Sidebar } from '@/components/app/Sidebar';
import { ChatWindow } from '@/components/app/ChatWindow';
import { useChat } from '@/hooks/useChat';
import { ConfirmDeleteModal } from '@/components/app/ConfirmDeleteModal'; 
import { deleteChatSession } from '@/services/apiClient';

export const AppPage = () => {
  const [activeChatId, setActiveChatId] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const chatLogic = useChat(activeChatId, setActiveChatId);
  const queryClient = useQueryClient();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [chatToDelete, setChatToDelete] = useState(null); 
  const deleteMutation = useMutation({
    mutationFn: deleteChatSession,
    onSuccess: () => {
      toast.success('Чат успешно удален!');
      queryClient.invalidateQueries({ queryKey: ['chatSessions'] });
      if (chatToDelete?.id === activeChatId) {
        setActiveChatId(null);
        chatLogic.startNewChat();
      }
      handleCloseDeleteModal();
    },
    onError: () => {
      toast.error('Не удалось удалить чат.');
    },
  });

  const handleOpenDeleteModal = (id, title) => {
    setChatToDelete({ id, title });
    setIsDeleteModalOpen(true);
  };

  const handleCloseDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setChatToDelete(null);
  };

  const handleConfirmDelete = () => {
    if (chatToDelete) {
      deleteMutation.mutate(chatToDelete.id);
    }
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <div className="h-screen w-screen flex flex-col font-body bg-background text-text-primary">
      <Header onToggleSidebar={toggleSidebar} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          onNewChat={() => {
            chatLogic.startNewChat();
            setActiveChatId(null);
            setIsSidebarOpen(false);
          }}
          activeChatId={activeChatId}
          setActiveChatId={(id) => {
            setActiveChatId(id);
            setIsSidebarOpen(false);
          }}
        onDeleteChat={handleOpenDeleteModal} 
        />
        <main className="flex-1 flex flex-col">
          <ChatWindow
            chatLogic={chatLogic}
          />
        </main>
      </div>

      {isSidebarOpen && (
        <div
          onClick={toggleSidebar}
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
        />
      )}
      
      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={handleCloseDeleteModal}
        onConfirm={handleConfirmDelete}
        isLoading={deleteMutation.isLoading}
        title="Удалить чат?"
        message={`Вы уверены, что хотите навсегда удалить чат "${chatToDelete?.title}"? Это действие необратимо.`}
      />
    </div>
  );
};