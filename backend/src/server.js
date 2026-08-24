const http = require('http');
const express = require('express');
const cors = require('cors');
const env = require('./config/env');
const { initSocket } = require('./config/socket');
const { errorHandler } = require('./middleware/errorHandler');
const { startScheduler } = require('./services/scheduler.service');

// Import routes
const authRoutes = require('./routes/auth.routes');
const venueRoutes = require('./routes/venue.routes');
const eventRoutes = require('./routes/event.routes');
const bookingRoutes = require('./routes/booking.routes');
const waitlistRoutes = require('./routes/waitlist.routes');

// Initialize Express app
const app = express();

// Create HTTP server (needed for Socket.IO)
const server = http.createServer(app);

// Initialize Socket.IO
initSocket(server);

// ─── Middleware ───────────────────────────────────────────
app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging in development
if (env.NODE_ENV === 'development') {
  app.use((req, _res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// ─── API Routes ──────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/venues', venueRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/waitlist', waitlistRoutes);

// ─── Health Check ────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: env.NODE_ENV,
  });
});

// ─── API Documentation Endpoint ──────────────────────────
app.get('/api', (_req, res) => {
  res.json({
    message: 'Ticket Booking Platform API',
    version: '1.0.0',
    endpoints: {
      auth: {
        'POST /api/auth/register': 'Register (customer/organiser)',
        'POST /api/auth/login': 'Login',
        'GET /api/auth/me': 'Get current user (auth required)',
      },
      venues: {
        'POST /api/venues': 'Create venue (admin)',
        'GET /api/venues': 'List venues',
        'GET /api/venues/:id': 'Get venue with seats',
        'PUT /api/venues/:id': 'Update venue (admin)',
        'POST /api/venues/:id/categories': 'Add seat category (admin)',
        'POST /api/venues/:id/seats': 'Add seats bulk (admin)',
        'POST /api/venues/:id/generate-seats': 'Auto-generate seat grid (admin)',
      },
      events: {
        'POST /api/events': 'Create event (organiser)',
        'GET /api/events': 'List/filter events',
        'GET /api/events/:id': 'Get event details',
        'PUT /api/events/:id': 'Update event (organiser)',
        'GET /api/events/:id/seats': 'Get seat map with status',
      },
      bookings: {
        'POST /api/bookings/hold': 'Hold seats (customer)',
        'POST /api/bookings/confirm': 'Confirm booking (customer)',
        'POST /api/bookings/release': 'Release held seats (customer)',
        'GET /api/bookings/my': 'Booking history (customer)',
        'POST /api/bookings/:id/cancel': 'Cancel booking (customer)',
        'GET /api/bookings/event/:eventId/summary': 'Booking summary (organiser)',
      },
      waitlist: {
        'POST /api/waitlist/join': 'Join waitlist (customer)',
        'GET /api/waitlist/my': 'My waitlist entries (customer)',
        'POST /api/waitlist/accept/:token': 'Accept waitlist offer',
        'DELETE /api/waitlist/:id': 'Leave waitlist (customer)',
      },
    },
  });
});

// ─── 404 Handler ─────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint not found.' });
});

// ─── Global Error Handler ────────────────────────────────
app.use(errorHandler);

// ─── Start Server ────────────────────────────────────────
server.listen(env.PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║          🎫 Ticket Booking Platform API                   ║
║                                                           ║
║   Server:    http://localhost:${env.PORT}                      ║
║   API Docs:  http://localhost:${env.PORT}/api                  ║
║   Health:    http://localhost:${env.PORT}/api/health            ║
║   Env:       ${env.NODE_ENV}                              ║
╚═══════════════════════════════════════════════════════════╝
  `);

  // Start scheduler for seat hold expiry and waitlist offer expiry
  startScheduler();
});

module.exports = { app, server };
