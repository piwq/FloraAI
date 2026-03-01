import { useEffect, useRef, useState, useCallback } from 'react';

export const useWebSocket = (sessionId, token) => {
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const ws = useRef(null);

  useEffect(() => {
    if (!sessionId || !token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = import.meta.env.VITE_WS_URL || `${protocol}//${window.location.host}`;

    ws.current = new WebSocket(`${wsUrl}/ws/chat/${sessionId}/?token=${token}`);
    ws.current.onopen = () => console.log('WebSocket Connected');

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.role) {
            setMessages((prev) => [...prev, { role: data.role, content: data.message, image: data.image }]);
            if (data.role === 'assistant') {
              setIsTyping(false);
            }
          }
        };

    ws.current.onclose = () => console.log('WebSocket Disconnected');

    return () => {
      if (ws.current) ws.current.close();
    };
  }, [sessionId, token]);

  const sendMessage = useCallback((content) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ message: content }));
      setMessages((prev) => [...prev, { role: 'user', content }]);
      setIsTyping(true); // Включаем "Агроном печатает..."
    }
  }, []);

  return { messages, setMessages, sendMessage, isTyping };
};