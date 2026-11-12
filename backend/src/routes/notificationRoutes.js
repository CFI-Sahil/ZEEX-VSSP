const express = require('express');
const {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  getAlertNotifications,
  triggerSLAEvaluation,
} = require('../controllers/notificationController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { csrfProtection } = require('../middleware/csrf');

const router = express.Router();

// Read notifications and unread count: Authenticated (ADMIN, SAFETY_OPERATOR)
router.get('/', requireAuth, requireRole('ADMIN', 'SAFETY_OPERATOR'), getNotifications);
router.get('/unread-count', requireAuth, requireRole('ADMIN', 'SAFETY_OPERATOR'), getUnreadCount);
router.get('/alert/:alertId', requireAuth, requireRole('ADMIN', 'SAFETY_OPERATOR'), getAlertNotifications);

// State transitions: Authenticated + CSRF protection (ADMIN, SAFETY_OPERATOR)
router.patch('/mark-all-read', requireAuth, requireRole('ADMIN', 'SAFETY_OPERATOR'), csrfProtection, markAllAsRead);
router.patch('/:id/read', requireAuth, requireRole('ADMIN', 'SAFETY_OPERATOR'), csrfProtection, markAsRead);

// Manual SLA evaluation diagnostic endpoint
router.post('/evaluate', requireAuth, requireRole('ADMIN', 'SAFETY_OPERATOR'), csrfProtection, triggerSLAEvaluation);

module.exports = router;

