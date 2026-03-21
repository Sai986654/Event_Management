import React, { createContext, useEffect, useState, useContext } from 'react';
import { socketService } from '../services/socketService';
import { AuthContext } from './AuthContext';

export const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { isAuthenticated } = useContext(AuthContext);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      socketService.disconnect();
      setConnected(false);
      return;
    }

    const socket = socketService.connect();

    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => setConnected(false);

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    // Set initial state if already connected
    if (socket.connected) setConnected(true);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [isAuthenticated]);

  const value = {
    connected,
    joinEvent: socketService.joinEvent,
    leaveEvent: socketService.leaveEvent,
    emitVendorStatus: socketService.emitVendorStatus,
    emitTaskUpdate: socketService.emitTaskUpdate,
    onVendorStatus: socketService.onVendorStatus,
    onTaskUpdate: socketService.onTaskUpdate,
    onGuestRsvp: socketService.onGuestRsvp,
    onGuestCheckin: socketService.onGuestCheckin,
    onBookingCreated: socketService.onBookingCreated,
    onBookingUpdated: socketService.onBookingUpdated,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};
