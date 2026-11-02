const express = require('express');
const { login, logout, getCurrentUser } = require('../controllers/authController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { csrfProtection } = require('../middleware/csrf');
const { authRateLimiter } = require('../middleware/rateLimiter');
const { sendSuccess } = require('../utils/response');

const router = express.Router();

// Authentication Endpoints
router.post('/login', authRateLimiter, login);
router.post('/logout', requireAuth, csrfProtection, logout);
router.get('/me', requireAuth, getCurrentUser);

// RBAC Verification Endpoints (used for Milestone 2 testing & verification)
router.get('/rbac/admin-only', requireAuth, requireRole('ADMIN'), (req, res) => {
  return sendSuccess(res, 'Administrative privilege verified', { role: req.user.role });
});

router.get('/rbac/operator-access', requireAuth, requireRole('ADMIN', 'SAFETY_OPERATOR'), (req, res) => {
  return sendSuccess(res, 'Operational privilege verified', { role: req.user.role });
});

module.exports = router;

