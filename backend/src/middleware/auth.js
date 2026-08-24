const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { query } = require('../config/db');

/**
 * JWT authentication middleware
 * Extracts token from Authorization header, verifies it, and checks DB existence.
 * Attaches decoded user to req.user
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required. Please log in.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, env.JWT_SECRET);

    const userResult = await query('SELECT id, email, role, name FROM users WHERE id = $1', [decoded.id]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'User session invalid or user no longer exists. Please log in again.' });
    }

    req.user = userResult.rows[0];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid session token. Please log in again.' });
    }
    return res.status(401).json({ error: 'Authentication failed. Please log in again.' });
  }
};

/**
 * Optional authentication — attaches user if token is present and valid in DB
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, env.JWT_SECRET);
      const userResult = await query('SELECT id, email, role, name FROM users WHERE id = $1', [decoded.id]);
      if (userResult.rows.length > 0) {
        req.user = userResult.rows[0];
      }
    }
  } catch {
    // Ignore token errors for optional auth
  }
  next();
};

module.exports = { authenticate, optionalAuth };
