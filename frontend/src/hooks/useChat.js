import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import apiClient, { getChatSessionDetails } from '@/services/apiClient';


export const useChat = (activeChatId, onNewChatCreated) => {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(activeChatId);
  
  const queryClient = useQueryClient(); 
  const socketRef = useRef(null);

  const { data: sessionDetails, isLoading: isHistoryLoading } = useQuery({
    queryKey: ['chatSession', activeChatId], 
    queryFn: () => getChatSessionDetails(activeChatId),
    enabled: !!activeChatId, 
    select: (data) => data?.data, 
  });

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    socketRef.current = io({ auth: { token } });
    
    socketRef.current.on('connect', () => console.log('Socket.IO: Connected'));
    socketRef.current.on('disconnect', () => console.log('Socket.IO: Disconnected'));

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []); 

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    socket.off('new_message');
    socket.off('error_message');

    const handleNewMessage = (payload) => {
      if (payload.sessionId === currentSessionId || !currentSessionId) {
        setMessages(prev => [...prev, { role: 'assistant', content: payload.content }]);

        if (!currentSessionId && payload.sessionId) {
          setCurrentSessionId(payload.sessionId);
          if (onNewChatCreated) {
            onNewChatCreated(payload.sessionId);
          }
        }

        setIsLoading(false);
        queryClient.invalidateQueries({ queryKey: ['chatSessions'] });
      }
    };

    const handleErrorMessage = (error) => {
      if (error.type === 'no_interpretations') {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: error.content,
          action: 'subscribe'
        }]);
      } else {
        toast.error(error.content || 'Произошла ошибка.');
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `Произошла системная ошибка: ${error.content}` 
        }]);
      }
      setIsLoading(false);
    };

    socket.on('new_message', handleNewMessage);
    socket.on('error_message', handleErrorMessage);

    return () => {
        socket.off('new_message', handleNewMessage);
        socket.off('error_message', handleErrorMessage);
    }
  }, [currentSessionId, queryClient, onNewChatCreated]);

  useEffect(() => {
    if (sessionDetails) {
      setMessages(sessionDetails.messages);
      setCurrentSessionId(sessionDetails.id);
      document.title = `${sessionDetails.title} | Морфеус`;
    }
  }, [sessionDetails]);

  useEffect(() => {
    if (activeChatId !== currentSessionId) {
      setCurrentSessionId(activeChatId);
      if (activeChatId === null) {
        setMessages([]);
        document.title = 'Морфеус - ИИ Сонник';
      }
    }
  }, [activeChatId, currentSessionId]);

  const sendMessage = async (text) => {
    const userMessage = { role: 'user', content: text };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      if (currentSessionId) {
        await apiClient.post(`/chat/${currentSessionId}/messages`, { text });
      } else {
        const response = await apiClient.post('/chat', { text });
        if (response.data && response.data.sessionId) {
          const newSessionId = response.data.sessionId;
          setCurrentSessionId(newSessionId);
          if (onNewChatCreated) {
            onNewChatCreated(newSessionId);
          }
        }
      }
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      queryClient.invalidateQueries({ queryKey: ['chatSessions'] });
    } catch (error) {
      setIsLoading(false);

      if (error.response?.status !== 403) {
          const errorMessage = error.response?.data?.error || 'Не удалось отправить сообщение.';
          toast.error(errorMessage);
          setMessages(prev => prev.slice(0, -1));
      }
    }
  };

  const startNewChat = () => {
    setCurrentSessionId(null);
    setMessages([]);
    document.title = 'Морфеус - ИИ Сонник';
  };

  return { messages, isLoading, isHistoryLoading, sendMessage, startNewChat };
};