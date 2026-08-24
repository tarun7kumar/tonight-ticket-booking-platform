const express = require('express');
const router = express.Router();
const { register, login, getMe } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');

// POST /api/auth/register — Register a new customer or organiser
router.post('/register', register);

// POST /api/auth/login — Login with email and password
router.post('/login', login);

// GET /api/auth/me — Get current user profile (requires auth)
router.get('/me', authenticate, getMe);

module.exports = router;
