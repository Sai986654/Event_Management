import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { AuthContext } from './AuthContext';

const API_BASE = (process.env.EXPO_PUBLIC_API_URL || 'https://event-management-9i4d.onrender.com/api').replace(/\/api\/?$/, '');

export const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user } = useContext(AuthContext);
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [unreadChat, setUnreadChat] = useState(0);

  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setConnected(false);
      }
      return;
    }

    const socket = io(API_BASE, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join-user', user.id);
    });

    socket.on('disconnect', () => setConnected(false));

    // Live chat notifications
    socket.on('chat:message', () => {
      setUnreadChat((prev) => prev + 1);
    });

    socket.on('chat:new-thread', () => {
      setUnreadChat((prev) => prev + 1);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [user]);

  const joinChat = useCallback((threadId) => {
    socketRef.current?.emit('join-chat', threadId);
  }, []);

  const leaveChat = useCallback((threadId) => {
    socketRef.current?.emit('leave-chat', threadId);
  }, []);

  const clearUnreadChat = useCallback(() => setUnreadChat(0), []);

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef.current,
        connected,
        unreadChat,
        clearUnreadChat,
        joinChat,
        leaveChat,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};
