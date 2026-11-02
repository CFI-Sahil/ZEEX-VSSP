const express = require('express');
const { ingestDemoEvent } = require('../controllers/demoController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { csrfProtection } = require('../middleware/csrf');

const router = express.Router();

/**
 * Development-only detection event ingestion
 * Strictly unmounted in production at route registration level
 */
router.post(
  '/ingest-event',
  requireAuth,
  requireRole('ADMIN', 'SAFETY_OPERATOR'),
  csrfProtection,
  ingestDemoEvent
);

module.exports = router;
