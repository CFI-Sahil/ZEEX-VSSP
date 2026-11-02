const { sendError } = require('../utils/response');
const env = require('../config/env');

/**
 * 404 Not Found Middleware
 */
const notFoundHandler = (req, res, next) => {
  return sendError(res, `Endpoint not found: ${req.method} ${req.originalUrl}`, null, 404);
};

/**
 * Central Error Handling Middleware
 * - Normalizes Zod validation errors
 * - Normalizes Mongoose validation and cast errors
 * - Prevents sensitive error leakage in production
 */
const centralErrorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'An unexpected internal server error occurred';
  let errors = null;

  // Handle Zod Validation Errors
  if (err.name === 'ZodError') {
    statusCode = 400;
    message = 'Request validation failed';
    const issues = err.issues || err.errors || [];
    errors = issues.map((e) => ({
      field: e.path ? e.path.join('.') : 'field',
      message: e.message,
    }));
  }

  // Handle Mongoose Validation Errors
  else if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Database schema validation failed';
    errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
  }

  // Handle Mongoose Cast Errors (Invalid ObjectId)
  else if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid identifier format: ${err.value}`;
  }

  // Handle CORS Errors
  else if (err.message && err.message.includes('CORS blocked')) {
    statusCode = 403;
    message = 'Cross-Origin Request Blocked by Security Policy';
  }

  // Log error details safely on server
  if (statusCode >= 500) {
    console.error(`[SERVER ERROR] ${req.method} ${req.originalUrl}:`, err);
  }

  // Never leak internal stack trace in production
  const responsePayload = {
    field: null,
    message: env.NODE_ENV === 'production' && statusCode >= 500 ? 'Internal server error' : message,
  };

  return sendError(
    res,
    message,
    errors || (env.NODE_ENV === 'development' && err.stack ? [{ stack: err.stack }] : null),
    statusCode
  );
};

module.exports = {
  notFoundHandler,
  centralErrorHandler,
};

