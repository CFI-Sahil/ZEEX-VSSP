const express = require('express');
const { triggerSLAEvaluation } = require('../controllers/notificationController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { csrfProtection } = require('../middleware/csrf');

const router = express.Router();

// SLA evaluation trigger endpoint: Authenticated + CSRF (ADMIN, SAFETY_OPERATOR)
router.post('/evaluate', requireAuth, requireRole('ADMIN', 'SAFETY_OPERATOR'), csrfProtection, triggerSLAEvaluation);

module.exports = router;

