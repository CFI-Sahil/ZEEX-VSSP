const express = require('express');
const { ingestDemoEvent } = require('../controllers/demoController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { csrfProtection } = require('../middleware/csrf');

const router = express.Router();

/**
 * Detection event ingestion and demonstration simulator
 * Protected by authentication (requireAuth), RBAC (ADMIN, SAFETY_OPERATOR), and CSRF validation
 */
router.post(
  '/ingest-event',
  requireAuth,
  requireRole('ADMIN', 'SAFETY_OPERATOR'),
  csrfProtection,
  ingestDemoEvent
);

module.exports = router;
