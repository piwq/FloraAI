import React, { useState, useEffect } from 'react';
import { ChatWindow } from '../components/ChatWindow';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL.replace('/api', '');

export const HomePage = () => {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    
    if (token) {
      const newSocket = io(SOCKET_URL, {
        auth: { token }
      });
      setSocket(newSocket);
      
      return () => newSocket.disconnect();
    }
  }, []); 

  return (
    <div className="bg-gray-900 text-white min-h-screen flex flex-col items-center justify-center p-4 font-sans">
      <header className="mb-4 text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-purple-300 drop-shadow-lg">ИИ Сонник "Морфей"</h1>
        <p className="text-gray-400 mt-2">Раскрой тайны своего подсознания</p>
      </header>
      <main className="w-full max-w-2xl bg-gray-800 rounded-lg shadow-xl flex flex-col h-[75vh] md:h-[80vh]">
        {socket 
          ? <ChatWindow socket={socket} /> 
          : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-gray-500">Для начала работы необходимо войти или зарегистрироваться...</p>
            </div>
          )
        }
      </main>
    </div>
  );
};