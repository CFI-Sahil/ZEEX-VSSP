const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');
const { sendError } = require('../utils/response');

/**
 * Authentication Middleware
 * Validates JWT token from HttpOnly cookie or Authorization Bearer header
 */
const requireAuth = async (req, res, next) => {
  try {
    let token = req.cookies?.vssp_jwt;

    // Optional Bearer header fallback
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return sendError(res, 'Authentication required: No active session', null, 401);
    }

    let decoded;
    try {
      decoded = jwt.verify(token, env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return sendError(res, 'Session expired: Please log in again', null, 401);
      }
      return sendError(res, 'Invalid authentication token', null, 401);
    }

    const user = await User.findById(decoded.id);

    if (!user) {
      return sendError(res, 'User session invalid: Account not found', null, 401);
    }

    if (!user.isActive) {
      return sendError(res, 'Account access suspended: Please contact an administrator', null, 403);
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('[AuthMiddleware Error]:', error.message);
    return sendError(res, 'Authentication service error', null, 500);
  }
};

/**
 * Role-Based Access Control Middleware
 * @param  {...string} allowedRoles Roles authorized to access the route
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 'Authentication required prior to permission check', null, 401);
    }

    if (!allowedRoles.includes(req.user.role)) {
      return sendError(
        res,
        `Access denied: '${req.user.role}' role is not authorized for this resource`,
        null,
        403
      );
    }

    next();
  };
};

module.exports = {
  requireAuth,
  requireRole,
};

