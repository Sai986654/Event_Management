/**
 * Socket.io real-time event control panel setup.
 * Rooms: `event-{eventId}` — clients join a room per event.
 */
const initSocket = (io) => {
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Join an event room for live updates
    socket.on('join-event', (eventId) => {
      socket.join(`event-${eventId}`);
      console.log(`Socket ${socket.id} joined event-${eventId}`);
    });

    // Leave an event room
    socket.on('leave-event', (eventId) => {
      socket.leave(`event-${eventId}`);
    });

    // Vendor status update (arrived, pending, etc.)
    socket.on('vendor:status', (data) => {
      io.to(`event-${data.eventId}`).emit('vendor:status', data);
    });

    // Task completion toggle
    socket.on('task:update', (data) => {
      io.to(`event-${data.eventId}`).emit('task:update', data);
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
};

module.exports = initSocket;
