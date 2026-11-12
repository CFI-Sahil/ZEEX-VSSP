const rateLimit = require('express-rate-limit');
const env = require('../config/env');

/**
 * Strict Rate Limiter for Authentication Endpoints
 * Mitigates brute-force attacks against credentials.
 * Enforces strict 10 attempts in production, 200 in development/testing to support automated test suites.
 */
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  max: env.NODE_ENV === 'production' ? 10 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again after 15 minutes.',
  },
});

/**
 * Event Intake Rate Limiter
 * Mitigates event flooding and DoS against ingestion endpoints.
 */
const eventIntakeRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: env.NODE_ENV === 'production' ? 60 : 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Event intake rate limit exceeded. Please throttle ingestion requests.',
  },
});

module.exports = {
  authRateLimiter,
  eventIntakeRateLimiter,
};

