import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, Square, Gem } from 'lucide-react'; 
import { useQuery } from '@tanstack/react-query';   
import { useNavigate } from 'react-router-dom';    
import { motion } from 'framer-motion';         
import apiClient from '@/services/apiClient';
import toast from 'react-hot-toast';

export const ChatInput = ({ onSendMessage, isLoading }) => {
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const textareaRef = useRef(null);
  const navigate = useNavigate();
  const { data: userData } = useQuery({ 
      queryKey: ['userProfile'],
      staleTime: 1000 * 60 * 5 
  });
  const isPremium = userData?.subscriptionStatus === 'PREMIUM';

  const showPremiumToast = () => {
    toast.custom(
      (t) => (
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className={`max-w-md w-full bg-surface-2 shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}
        >
          <div className="flex-1 w-0 p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0 pt-0.5">
                <Gem className="h-6 w-6 text-yellow-400" />
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm font-medium text-text-primary">Функция для Premium</p>
                <p className="mt-1 text-sm text-text-secondary">Распознавание речи доступно в Premium-подписке.</p>
              </div>
            </div>
          </div>
          <div className="flex border-l border-border-color">
            <button
              onClick={() => { navigate('/tariffs'); toast.dismiss(t.id); }}
              className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-accent-ai hover:text-text-primary focus:outline-none"
            >
              Улучшить
            </button>
          </div>
        </motion.div>
      ), { position: 'bottom-center' }
    );
  };

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);
  
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [text]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (text.trim() && !isLoading) {
      onSendMessage(text);
      setText('');
    }
  };

  const startRecording = async () => {
    if (!isPremium) {
      showPremiumToast();
      return;
    }

    const mimeTypes = [
        'audio/webm; codecs=opus',
        'audio/ogg; codecs=opus',  
        'audio/webm',             
        'audio/mp4',              
    ];

    const supportedMimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type));

    if (!supportedMimeType) {
        toast.error('Ваш браузер не поддерживает запись аудио.');
        console.error("No supported MIME type found for MediaRecorder");
        return;
    }
    console.log("Using supported MIME type:", supportedMimeType);

    setIsRecording(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: supportedMimeType });
      mediaRecorderRef.current = recorder;

      const localAudioChunks = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          localAudioChunks.push(event.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());

        if (localAudioChunks.length === 0) return;

        const audioBlob = new Blob(localAudioChunks, { type: supportedMimeType });
        const formData = new FormData();
        
        const fileExtension = supportedMimeType.split('/')[1].split(';')[0];
        formData.append('audio', audioBlob, `recording.${fileExtension}`);
        
        try {
          toast.loading('Распознавание речи...');
          const response = await apiClient.post('/asr/stt', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          toast.dismiss();
          if (response.data.text && response.data.text.trim().length > 0) {
            onSendMessage(response.data.text);
          } else {
            toast.error('Не удалось распознать речь.');
          }
        } catch (error) {
          toast.dismiss();
          toast.error('Ошибка при отправке аудио.');
          console.error(error);
        }
      };

      recorder.start();

    } catch (error) {
      toast.error('Не удалось получить доступ к микрофону.');
      setIsRecording(false); 
      console.error(error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleVoiceInput = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <div className="px-4 sm:px-6 pb-6 pt-4 bg-background">
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-3 bg-surface-2 p-2 rounded-2xl border border-border-color transition-all
                   focus-within:border-accent-ai focus-within:ring-2 focus-within:ring-accent-ai/30"
      >
        <button type="button" onClick={handleVoiceInput} className="p-2 text-text-secondary hover:text-accent-ai transition-colors rounded-full">
          {isRecording 
            ? <Square size={24} className="text-red-500 animate-pulse" /> 
            : <Mic size={24} />
          }
        </button>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
          placeholder="Опишите ваш сон или задайте вопрос..."
          disabled={isLoading}
          rows={1}
          className="flex-1 bg-transparent resize-none outline-none text-text-primary placeholder:text-text-secondary max-h-48 py-2"
        />
        <button
          type="submit"
          disabled={!text.trim() || isLoading}
          className="p-2 rounded-full bg-accent-ai text-white transition-opacity
                     disabled:opacity-50 disabled:cursor-not-allowed enabled:hover:opacity-90"
        >
          <Send size={24} />
        </button>
      </form>
    </div>
  );
};