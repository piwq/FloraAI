import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Sparkles, Gem, Volume2, Loader2, Play, Square } from 'lucide-react';
import { Link } from 'react-router-dom'; 
import apiClient from '@/services/apiClient';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const API_BASE_URL = "https://morpheusantihype.icu";

export const Message = ({ id, role, content, action }) => {
  const isUser = role === 'user';
  const navigate = useNavigate();
  const { data: userData } = useQuery({ 
      queryKey: ['userProfile'],
      staleTime: 1000 * 30
  });
  const isPremium = userData?.subscriptionStatus === 'PREMIUM';
  
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const audioQueueRef = useRef([]);
  const currentAudioRef = useRef(null);
  const isStoppingRef = useRef(false);



  useEffect(() => {
    return () => {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
      }
      audioQueueRef.current.forEach(URL.revokeObjectURL);
    };
  }, []);

  const playNextInQueue = () => {
    if (isStoppingRef.current) {
        setIsPlaying(false);
        isStoppingRef.current = false;
        return;
    }
      
    if (audioQueueRef.current.length > 0) {
      const audioUrl = audioQueueRef.current.shift();
      const audio = new Audio(audioUrl);
      currentAudioRef.current = audio;
      audio.play();
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl); 
        playNextInQueue();
      };
    } else {
      setIsPlaying(false); 
    }
  };

  const handlePlayAudio = async () => {
    if (!isPremium) {
      toast.custom(
        (t) => (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`max-w-md w-full bg-surface-2 shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}
          >
            <div className="flex-1 w-0 p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0 pt-0.5">
                  <Gem className="h-6 w-6 text-yellow-400" />
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-sm font-medium text-text-primary">
                    Функция для Premium
                  </p>
                  <p className="mt-1 text-sm text-text-secondary">
                    Озвучивание текста доступно в Premium-подписке.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex border-l border-border-color">
              <button
                onClick={() => {
                  navigate('/tariffs');
                  toast.dismiss(t.id);
                }}
                className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-accent-ai hover:text-text-primary focus:outline-none"
              >
                Улучшить
              </button>
            </div>
          </motion.div>
        ), { position: 'bottom-center' }
      );
      return; 
    }
    setIsLoading(true);
    setIsPlaying(true);
    isStoppingRef.current = false;

    try {
      const response = await apiClient.post('/tts/get-audio', { messageId: id });
      if (response && response.data && Array.isArray(response.data.urls)) {
    const absoluteUrls = response.data.urls.map(relativeUrl => `${API_BASE_URL}${relativeUrl}`);
    audioQueueRef.current = absoluteUrls;

    if (isStoppingRef.current) {
        setIsLoading(false);
        setIsPlaying(false);
        return;
    }

    setIsLoading(false);
    playNextInQueue();
    } else {
        throw new Error("Получен некорректный ответ от сервера.");
    }

    } catch (error) {
      toast.error('Не удалось озвучить сообщение.');
      console.error("Ошибка получения аудио:", error);
      setIsLoading(false);
      setIsPlaying(false);
    }
  };

  const handleStopAudio = () => {
    isStoppingRef.current = true;
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.src = '';
    }
    audioQueueRef.current.forEach(URL.revokeObjectURL);
    audioQueueRef.current = [];
    setIsPlaying(false);
    setIsLoading(false);
  };

  const markdownComponents = {
    p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
    strong: ({ node, ...props }) => <strong className="font-bold" {...props} />,
    em: ({ node, ...props }) => <em className="italic" {...props} />,
    ul: ({ node, ...props }) => <ul className="list-disc list-inside space-y-1 my-2" {...props} />,
    ol: ({ node, ...props }) => <ol className="list-decimal list-inside space-y-1 my-2" {...props} />,
    li: ({ node, ...props }) => <li className="pl-2" {...props} />,
  };

  return (
    <motion.div key={id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={`flex items-start gap-3 w-full ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center">
          <Sparkles className="text-accent-ai" size={18} />
        </div>
      )}
      <div 
        className={`prose prose-invert max-w-[85%] sm:max-w-xl rounded-2xl px-4 py-3 shadow-md
                   ${isUser 
                     ? 'bg-gradient-user text-white rounded-br-none' 
                     : 'bg-surface-2 text-text-primary rounded-bl-none'}`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={markdownComponents}
          >
            {content}
          </ReactMarkdown>
        )}

        {action === 'subscribe' && (
          <div className="mt-4">
            <Link 
              to="/tariffs"
              className="flex items-center justify-center w-full bg-yellow-500 text-black font-bold py-2 px-4 rounded-lg
                         hover:opacity-90 transition-opacity transform hover:scale-105"
            >
              <Gem size={16} className="mr-2" />
              Оформить Premium
            </Link>
          </div>
        )}
      {!isUser && content && (
        <div className="flex-shrink-0 self-center">
          <button
            onClick={isPlaying || isLoading ? handleStopAudio : handlePlayAudio}
            className="p-2 text-text-secondary hover:text-accent-ai transition-colors rounded-full"
            title={isPlaying ? "Остановить" : "Озвучить"}
          >
            {isLoading ? <Loader2 className="animate-spin" size={18} /> : 
             isPlaying ? <Square size={18} /> : 
             <Volume2 size={18} />}
          </button>
        </div>
      )}
      </div>
       {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center">
          <User className="text-text-secondary" size={18} />
        </div>
      )}
    </motion.div>
  );
};