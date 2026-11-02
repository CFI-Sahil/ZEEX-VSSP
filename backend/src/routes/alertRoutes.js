const express = require('express');
const {
  getAlerts,
  getAlertById,
  acknowledgeAlert,
  closeAlert,
} = require('../controllers/alertController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { csrfProtection } = require('../middleware/csrf');

const router = express.Router();

// Read alerts: Authenticated (ADMIN, SAFETY_OPERATOR)
router.get('/', requireAuth, requireRole('ADMIN', 'SAFETY_OPERATOR'), getAlerts);
router.get('/:id', requireAuth, requireRole('ADMIN', 'SAFETY_OPERATOR'), getAlertById);

// Lifecycle transitions: Authenticated + CSRF protection (ADMIN, SAFETY_OPERATOR)
router.patch('/:id/acknowledge', requireAuth, requireRole('ADMIN', 'SAFETY_OPERATOR'), csrfProtection, acknowledgeAlert);
router.patch('/:id/close', requireAuth, requireRole('ADMIN', 'SAFETY_OPERATOR'), csrfProtection, closeAlert);

module.exports = router;
