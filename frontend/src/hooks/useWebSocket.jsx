import { useEffect, useRef, useState, useCallback } from 'react';

const MAX_RECONNECT_DELAY = 8000;
const INITIAL_RECONNECT_DELAY = 1000;

export const useWebSocket = (sessionId, token) => {
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const ws = useRef(null);
  const reconnectDelay = useRef(INITIAL_RECONNECT_DELAY);
  const reconnectTimer = useRef(null);
  const intentionalClose = useRef(false);

  const connect = useCallback(() => {
    if (!sessionId || !token) return;
    if (ws.current && ws.current.readyState <= WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = import.meta.env.VITE_WS_URL || `${protocol}//${window.location.host}`;

    const socket = new WebSocket(`${wsUrl}/ws/chat/${sessionId}/?token=${token}`);

    socket.onopen = () => {
      console.log('WebSocket Connected');
      setIsConnected(true);
      reconnectDelay.current = INITIAL_RECONNECT_DELAY;
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.role) {
        setMessages((prev) => [...prev, { role: data.role, content: data.message, image: data.image }]);
        if (data.role === 'assistant') {
          setIsTyping(false);
        }
      }
    };

    socket.onclose = () => {
      console.log('WebSocket Disconnected');
      setIsConnected(false);
      ws.current = null;

      // Реконнект с экспоненциальным backoff, если не закрыли намеренно
      if (!intentionalClose.current) {
        reconnectTimer.current = setTimeout(() => {
          console.log(`WebSocket reconnecting (delay: ${reconnectDelay.current}ms)...`);
          reconnectDelay.current = Math.min(reconnectDelay.current * 2, MAX_RECONNECT_DELAY);
          connect();
        }, reconnectDelay.current);
      }
    };

    socket.onerror = (err) => {
      console.error('WebSocket error:', err);
      socket.close();
    };

    ws.current = socket;
  }, [sessionId, token]);

  useEffect(() => {
    intentionalClose.current = false;
    connect();

    return () => {
      intentionalClose.current = true;
      clearTimeout(reconnectTimer.current);
      if (ws.current) ws.current.close();
    };
  }, [connect]);

  const sendMessage = useCallback((content) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ message: content }));
      setIsTyping(true);
    }
  }, []);

  return { messages, setMessages, sendMessage, isTyping, isConnected };
};
