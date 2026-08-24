const express = require('express');
const router = express.Router();
const { holdSeats, confirmBooking, releaseSeats, getMyBookings, cancelBooking, getEventBookingSummary } = require('../controllers/booking.controller');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');

// POST /api/bookings/hold — Holds selected seats
router.post('/hold', authenticate, authorize('customer', 'organiser', 'admin'), holdSeats);

// POST /api/bookings/confirm — Confirms booking
router.post('/confirm', authenticate, authorize('customer', 'organiser', 'admin'), confirmBooking);

// POST /api/bookings/release — Releases held seats
router.post('/release', authenticate, authorize('customer', 'organiser', 'admin'), releaseSeats);

// GET /api/bookings/my — Booking history
router.get('/my', authenticate, authorize('customer', 'organiser', 'admin'), getMyBookings);

// POST /api/bookings/:id/cancel — Cancels booking
router.post('/:id/cancel', authenticate, authorize('customer', 'organiser', 'admin'), cancelBooking);

// GET /api/bookings/event/:eventId/summary — Organiser views booking summary
router.get('/event/:eventId/summary', authenticate, authorize('organiser', 'admin'), getEventBookingSummary);

module.exports = router;
