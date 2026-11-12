const express = require('express');
const shiftHandoverController = require('../controllers/shiftHandoverController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { csrfProtection } = require('../middleware/csrf');

const router = express.Router();

// Static routes declared first
router.get(
  '/operational-summary',
  requireAuth,
  requireRole('ADMIN', 'SAFETY_OPERATOR'),
  shiftHandoverController.getOperationalSummary
);

router.get(
  '/dashboard',
  requireAuth,
  requireRole('ADMIN', 'SAFETY_OPERATOR'),
  shiftHandoverController.getHandoverDashboard
);

router.get(
  '/inbox',
  requireAuth,
  requireRole('ADMIN', 'SAFETY_OPERATOR'),
  shiftHandoverController.getHandoverInbox
);

// Collection routes
router.get(
  '/',
  requireAuth,
  requireRole('ADMIN', 'SAFETY_OPERATOR'),
  shiftHandoverController.listHandovers
);

router.post(
  '/',
  requireAuth,
  requireRole('ADMIN', 'SAFETY_OPERATOR'),
  csrfProtection,
  shiftHandoverController.createHandover
);

// Parameterized item routes
router.get(
  '/:id',
  requireAuth,
  requireRole('ADMIN', 'SAFETY_OPERATOR'),
  shiftHandoverController.getHandoverById
);

router.patch(
  '/:id',
  requireAuth,
  requireRole('ADMIN', 'SAFETY_OPERATOR'),
  csrfProtection,
  shiftHandoverController.updateDraftHandover
);

router.post(
  '/:id/refresh-summary',
  requireAuth,
  requireRole('ADMIN', 'SAFETY_OPERATOR'),
  csrfProtection,
  shiftHandoverController.refreshHandoverSummary
);

router.post(
  '/:id/submit',
  requireAuth,
  requireRole('ADMIN', 'SAFETY_OPERATOR'),
  csrfProtection,
  shiftHandoverController.submitHandover
);

router.post(
  '/:id/claim',
  requireAuth,
  requireRole('ADMIN', 'SAFETY_OPERATOR'),
  csrfProtection,
  shiftHandoverController.claimHandover
);

router.post(
  '/:id/acknowledge',
  requireAuth,
  requireRole('ADMIN', 'SAFETY_OPERATOR'),
  csrfProtection,
  shiftHandoverController.acknowledgeHandover
);

router.post(
  '/:id/follow-ups',
  requireAuth,
  requireRole('ADMIN', 'SAFETY_OPERATOR'),
  csrfProtection,
  shiftHandoverController.createFollowUp
);

router.patch(
  '/:id/follow-ups/:followUpId',
  requireAuth,
  requireRole('ADMIN', 'SAFETY_OPERATOR'),
  csrfProtection,
  shiftHandoverController.updateFollowUp
);

router.post(
  '/:id/complete',
  requireAuth,
  requireRole('ADMIN', 'SAFETY_OPERATOR'),
  csrfProtection,
  shiftHandoverController.completeHandover
);

router.post(
  '/:id/cancel',
  requireAuth,
  requireRole('ADMIN', 'SAFETY_OPERATOR'),
  csrfProtection,
  shiftHandoverController.cancelHandover
);

module.exports = router;

