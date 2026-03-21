import { io } from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

let socket = null;

export const socketService = {
  connect: () => {
    if (socket?.connected) return socket;

    socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
    });

    return socket;
  },

  disconnect: () => {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  },

  getSocket: () => socket,

  // Room management
  joinEvent: (eventId) => {
    if (socket?.connected) {
      socket.emit('join-event', eventId);
    }
  },

  leaveEvent: (eventId) => {
    if (socket?.connected) {
      socket.emit('leave-event', eventId);
    }
  },

  // Emit: vendor status update
  emitVendorStatus: (eventId, vendorId, status) => {
    if (socket?.connected) {
      socket.emit('vendor:status', { eventId, vendorId, status });
    }
  },

  // Emit: task update
  emitTaskUpdate: (eventId, taskId, completed) => {
    if (socket?.connected) {
      socket.emit('task:update', { eventId, taskId, completed });
    }
  },

  // Listen helpers
  onVendorStatus: (callback) => {
    socket?.on('vendor:status', callback);
    return () => socket?.off('vendor:status', callback);
  },

  onTaskUpdate: (callback) => {
    socket?.on('task:update', callback);
    return () => socket?.off('task:update', callback);
  },

  onGuestRsvp: (callback) => {
    socket?.on('guest:rsvp', callback);
    return () => socket?.off('guest:rsvp', callback);
  },

  onGuestCheckin: (callback) => {
    socket?.on('guest:checkin', callback);
    return () => socket?.off('guest:checkin', callback);
  },

  onBookingCreated: (callback) => {
    socket?.on('booking:created', callback);
    return () => socket?.off('booking:created', callback);
  },

  onBookingUpdated: (callback) => {
    socket?.on('booking:updated', callback);
    return () => socket?.off('booking:updated', callback);
  },
};
