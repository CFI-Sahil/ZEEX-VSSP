const crypto = require('crypto');
const env = require('../config/env');
const { sendError } = require('../utils/response');

/**
 * Generates an HMAC-SHA256 signed CSRF token
 * Token format: <random_hex>.<signature>
 */
const generateCsrfToken = (identifier = 'anon') => {
  const token = crypto.randomBytes(24).toString('hex');
  const signature = crypto
    .createHmac('sha256', env.CSRF_SECRET)
    .update(`${identifier}:${token}`)
    .digest('hex');
  return `${token}.${signature}`;
};

/**
 * Validates the HMAC-SHA256 signature of a CSRF token
 */
const isValidCsrfSignature = (csrfToken, identifier = 'anon') => {
  if (!csrfToken || typeof csrfToken !== 'string') return false;

  const parts = csrfToken.split('.');
  if (parts.length !== 2) return false;

  const [token, receivedSignature] = parts;

  const expectedSignature = crypto
    .createHmac('sha256', env.CSRF_SECRET)
    .update(`${identifier}:${token}`)
    .digest('hex');

  const receivedBuf = Buffer.from(receivedSignature, 'hex');
  const expectedBuf = Buffer.from(expectedSignature, 'hex');

  if (receivedBuf.length !== expectedBuf.length) return false;

  return crypto.timingSafeEqual(receivedBuf, expectedBuf);
};

/**
 * Double-Submit CSRF Verification Middleware
 * Requires:
 * 1. Matching token in X-CSRF-Token header and vssp_csrf cookie
 * 2. Valid cryptographic signature
 */
const csrfProtection = (req, res, next) => {
  // Safe HTTP methods bypass CSRF check
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method.toUpperCase())) {
    return next();
  }

  // Allow login endpoint to execute without prior session CSRF
  if (req.originalUrl.includes('/api/v1/auth/login')) {
    return next();
  }

  const headerToken = req.headers['x-csrf-token'];
  const cookieToken = req.cookies?.vssp_csrf;

  if (!headerToken || !cookieToken) {
    return sendError(res, 'CSRF verification failed: Missing token in header or cookie', null, 403);
  }

  // Tokens must match exactly
  if (headerToken !== cookieToken) {
    return sendError(res, 'CSRF verification failed: Token mismatch', null, 403);
  }

  // Validate signature bound to authenticated user ID or anonymous session
  const identifier = req.user ? req.user._id.toString() : 'anon';
  const isSignatureValid =
    isValidCsrfSignature(headerToken, identifier) ||
    isValidCsrfSignature(headerToken, 'anon'); // Allow transition from pre-auth

  if (!isSignatureValid) {
    return sendError(res, 'CSRF verification failed: Cryptographic signature invalid', null, 403);
  }

  next();
};

module.exports = {
  generateCsrfToken,
  isValidCsrfSignature,
  csrfProtection,
};

