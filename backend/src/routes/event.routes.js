const express = require('express');
const router = express.Router();
const { 
  createEvent, 
  getEvents, 
  getEventById, 
  updateEvent, 
  getEventSeats,
  getOrCreateMovieSession 
} = require('../controllers/event.controller');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');

// POST /api/events/movie-session — Automatically provisions/fetches movie session for seat booking
router.post('/movie-session', getOrCreateMovieSession);

// POST /api/events — Organiser creates an event
router.post('/', authenticate, authorize('organiser'), createEvent);

// GET /api/events — List/filter events (public)
router.get('/', getEvents);

// GET /api/events/:id — Get event details (public)
router.get('/:id', getEventById);

// PUT /api/events/:id — Organiser updates their event
router.put('/:id', authenticate, authorize('organiser', 'admin'), updateEvent);

// GET /api/events/:id/seats — Get full seat map with status (public)
router.get('/:id/seats', getEventSeats);

module.exports = router;
