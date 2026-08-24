/**
 * Role-based access control middleware factory
 * @param  {...string} allowedRoles - Roles that are allowed access
 * @returns {Function} Express middleware
 * 
 * Usage: router.post('/venues', authenticate, authorize('admin'), createVenue)
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Required role: ${allowedRoles.join(' or ')}. Your role: ${req.user.role}`,
      });
    }

    next();
  };
};

module.exports = { authorize };
