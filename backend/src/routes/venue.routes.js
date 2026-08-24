const express = require('express');
const router = express.Router();
const { createVenue, getVenues, getVenueById, updateVenue, addCategory, addSeats, generateSeats } = require('../controllers/venue.controller');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');

// POST /api/venues — Admin creates a venue
router.post('/', authenticate, authorize('admin'), createVenue);

// GET /api/venues — List all venues
router.get('/', getVenues);

// GET /api/venues/:id — Get venue details with seats
router.get('/:id', getVenueById);

// PUT /api/venues/:id — Admin updates a venue
router.put('/:id', authenticate, authorize('admin'), updateVenue);

// POST /api/venues/:id/categories — Admin adds a seat category
router.post('/:id/categories', authenticate, authorize('admin'), addCategory);

// POST /api/venues/:id/seats — Admin adds seats in bulk
router.post('/:id/seats', authenticate, authorize('admin'), addSeats);

// POST /api/venues/:id/generate-seats — Admin auto-generates seat grid
router.post('/:id/generate-seats', authenticate, authorize('admin'), generateSeats);

module.exports = router;
