const env = require('../config/env');

/**
 * Global error handling middleware
 * Catches unhandled errors and returns a consistent JSON response
 */
const errorHandler = (err, req, res, _next) => {
  console.error('❌ Unhandled error:', err.stack || err.message);

  // PostgreSQL unique violation
  if (err.code === '23505') {
    return res.status(409).json({
      error: 'A record with this data already exists.',
      detail: env.NODE_ENV === 'development' ? err.detail : undefined,
    });
  }

  // PostgreSQL foreign key violation
  if (err.code === '23503') {
    return res.status(400).json({
      error: 'Referenced record does not exist.',
      detail: env.NODE_ENV === 'development' ? err.detail : undefined,
    });
  }

  // PostgreSQL check constraint violation
  if (err.code === '23514') {
    return res.status(400).json({
      error: 'Data validation failed.',
      detail: env.NODE_ENV === 'development' ? err.detail : undefined,
    });
  }

  // Default server error
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: err.message || 'Internal server error',
    ...(env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

/**
 * Async handler wrapper — catches errors in async route handlers
 * and passes them to the error handler middleware
 * 
 * Usage: router.get('/path', asyncHandler(async (req, res) => { ... }))
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = { errorHandler, asyncHandler };
