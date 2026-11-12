const express = require('express');
const {
  ingestEvent,
  getIntakeEvents,
  getIntakeStats,
  getIntakeEventById,
} = require('../controllers/eventIntakeController');
const {
  processEventById,
  processBatchQueue,
  getProcessingQueueStatus,
} = require('../controllers/eventProcessingController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { csrfProtection } = require('../middleware/csrf');
const { eventIntakeRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// All event routes require active authentication & RBAC
router.use(requireAuth);
router.use(requireRole('ADMIN', 'SAFETY_OPERATOR'));

// Ingest incoming detection event (rate-limited and CSRF-protected)
router.post('/intake', eventIntakeRateLimiter, csrfProtection, ingestEvent);

// List intake records & filters
router.get('/intake', getIntakeEvents);

// Retrieve intake performance & outcome metrics
router.get('/intake/stats', getIntakeStats);

// Inspect single intake record details
router.get('/intake/:id', getIntakeEventById);

// Batch 2: Event Processing & Rule Engine Endpoints
// Real-time queue metrics and processing counts
router.get('/processing-queue/status', getProcessingQueueStatus);

// Batch process pending accepted events
router.post('/process-queue', csrfProtection, processBatchQueue);

// Process single accepted event by ID
router.post('/:id/process', csrfProtection, processEventById);

module.exports = router;

