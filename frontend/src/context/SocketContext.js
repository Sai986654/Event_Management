import React, { createContext, useEffect, useState, useContext, useRef } from 'react';
import { socketService } from '../services/socketService';
import { AuthContext } from './AuthContext';

export const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { isAuthenticated, user } = useContext(AuthContext);
  const [connected, setConnected] = useState(false);
  const joinedUserRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated) {
      if (joinedUserRef.current != null) {
        socketService.leaveUser(joinedUserRef.current);
        joinedUserRef.current = null;
      }
      socketService.disconnect();
      setConnected(false);
      return;
    }

    const socket = socketService.connect();

    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => setConnected(false);

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    if (socket.connected) setConnected(true);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      return;
    }
    const uid = user.id;
    socketService.joinUser(uid);
    joinedUserRef.current = uid;
    return () => {
      socketService.leaveUser(uid);
      joinedUserRef.current = null;
    };
  }, [isAuthenticated, user?.id]);

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
    onNotificationNew: socketService.onNotificationNew,
    joinUser: socketService.joinUser,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};
