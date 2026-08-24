const { Server } = require('socket.io');
const env = require('./env');

let io = null;

/**
 * Initialize Socket.IO with the HTTP server
 * @param {import('http').Server} httpServer
 * @returns {import('socket.io').Server}
 */
const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: env.FRONTEND_URL,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // Client joins an event room to receive seat updates
    socket.on('join-event', (eventId) => {
      const room = `event:${eventId}`;
      socket.join(room);
      console.log(`👤 ${socket.id} joined room ${room}`);
    });

    // Client leaves an event room
    socket.on('leave-event', (eventId) => {
      const room = `event:${eventId}`;
      socket.leave(room);
      console.log(`👤 ${socket.id} left room ${room}`);
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
    });
  });

  return io;
};

/**
 * Get the Socket.IO instance
 * @returns {import('socket.io').Server}
 */
const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO not initialized. Call initSocket() first.');
  }
  return io;
};

/**
 * Emit seat status updates to all clients in an event room
 * @param {number} eventId
 * @param {Array} updatedSeats - Array of { id, status, held_by }
 */
const emitSeatUpdate = (eventId, updatedSeats) => {
  if (io) {
    io.to(`event:${eventId}`).emit('seats-updated', {
      eventId,
      seats: updatedSeats,
      timestamp: new Date().toISOString(),
    });
  }
};

module.exports = { initSocket, getIO, emitSeatUpdate };
