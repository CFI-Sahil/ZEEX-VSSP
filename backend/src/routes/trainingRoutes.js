const express = require('express');
const trainingController = require('../controllers/trainingController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { csrfProtection } = require('../middleware/csrf');

const router = express.Router();

// 1. Static Demonstration Evidence Assets (Read-only, Authenticated)
router.get('/evidence-sample/:filename', requireAuth, trainingController.getEvidenceSample);

// 2. Training Statistics & History (Static routes declared before dynamic :id routes)
router.get('/stats', requireAuth, requireRole('ADMIN', 'SAFETY_OPERATOR'), trainingController.getTrainingStats);
router.get('/history', requireAuth, requireRole('ADMIN', 'SAFETY_OPERATOR'), trainingController.getTrainingHistory);

// 3. Scenario Management & Library
router.get('/scenarios', requireAuth, requireRole('ADMIN', 'SAFETY_OPERATOR'), trainingController.listScenarios);
router.post('/scenarios', requireAuth, requireRole('ADMIN'), csrfProtection, trainingController.createScenario);
router.get('/scenarios/:id', requireAuth, requireRole('ADMIN', 'SAFETY_OPERATOR'), trainingController.getScenarioById);
router.patch('/scenarios/:id', requireAuth, requireRole('ADMIN'), csrfProtection, trainingController.updateScenario);
router.patch('/scenarios/:id/publish', requireAuth, requireRole('ADMIN'), csrfProtection, trainingController.publishScenario);
router.patch('/scenarios/:id/archive', requireAuth, requireRole('ADMIN'), csrfProtection, trainingController.archiveScenario);

// 4. Training Session Lifecycle
router.post('/sessions', requireAuth, requireRole('ADMIN', 'SAFETY_OPERATOR'), csrfProtection, trainingController.startSession);
router.get('/sessions/:id', requireAuth, requireRole('ADMIN', 'SAFETY_OPERATOR'), trainingController.getSessionById);
router.post('/sessions/:id/acknowledge', requireAuth, requireRole('ADMIN', 'SAFETY_OPERATOR'), csrfProtection, trainingController.acknowledgeSession);
router.post('/sessions/:id/assess', requireAuth, requireRole('ADMIN', 'SAFETY_OPERATOR'), csrfProtection, trainingController.assessSession);
router.post('/sessions/:id/corrective-action', requireAuth, requireRole('ADMIN', 'SAFETY_OPERATOR'), csrfProtection, trainingController.recordCorrectiveAction);
router.post('/sessions/:id/complete', requireAuth, requireRole('ADMIN', 'SAFETY_OPERATOR'), csrfProtection, trainingController.completeSession);
router.post('/sessions/:id/abandon', requireAuth, requireRole('ADMIN', 'SAFETY_OPERATOR'), csrfProtection, trainingController.abandonSession);

module.exports = router;

