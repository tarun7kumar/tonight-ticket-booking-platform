const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const env = require('../config/env');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * Generate JWT token for a user
 */
const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );
};

/**
 * POST /api/auth/register
 * Register a new customer or organiser
 */
const register = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;

  // Validate input
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }

  // Only allow customer and organiser registration
  const allowedRoles = ['customer', 'organiser'];
  const userRole = role && allowedRoles.includes(role) ? role : 'customer';

  // Check if email already exists
  const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (existing.rows.length > 0) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  // Insert user
  const result = await query(
    'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, created_at',
    [name.trim(), email.toLowerCase().trim(), passwordHash, userRole]
  );

  const user = result.rows[0];
  const token = generateToken(user);

  res.status(201).json({
    message: 'Registration successful.',
    user: { id: user.id, name: user.name, email: user.email, role: user.role, created_at: user.created_at },
    token,
  });
});

/**
 * POST /api/auth/login
 * Login with email and password
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  // Find user
  const result = await query(
    'SELECT id, name, email, password_hash, role, created_at FROM users WHERE email = $1',
    [email.toLowerCase().trim()]
  );

  if (result.rows.length === 0) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const user = result.rows[0];

  // Verify password
  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const token = generateToken(user);

  res.json({
    message: 'Login successful.',
    user: { id: user.id, name: user.name, email: user.email, role: user.role, created_at: user.created_at },
    token,
  });
});

/**
 * GET /api/auth/me
 * Get current authenticated user profile
 */
const getMe = asyncHandler(async (req, res) => {
  const result = await query(
    'SELECT id, name, email, role, created_at FROM users WHERE id = $1',
    [req.user.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'User not found.' });
  }

  res.json({ user: result.rows[0] });
});

module.exports = { register, login, getMe };
