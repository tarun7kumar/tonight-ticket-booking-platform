import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

export const useSocket = () => useContext(SocketContext);

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

export function SocketProvider({ children }) {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    socket.on('connect', () => {
      console.log('🔌 Socket connected');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('🔌 Socket disconnected');
      setIsConnected(false);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, []);

  const joinEvent = (eventId) => {
    socketRef.current?.emit('join-event', eventId);
  };

  const leaveEvent = (eventId) => {
    socketRef.current?.emit('leave-event', eventId);
  };

  const onSeatUpdate = (callback) => {
    socketRef.current?.on('seats-updated', callback);
    return () => socketRef.current?.off('seats-updated', callback);
  };

  return (
    <SocketContext.Provider value={{
      socket: socketRef.current,
      isConnected,
      joinEvent,
      leaveEvent,
      onSeatUpdate,
    }}>
      {children}
    </SocketContext.Provider>
  );
}
