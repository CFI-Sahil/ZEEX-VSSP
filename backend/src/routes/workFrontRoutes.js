const express = require('express');
const {
  getWorkFronts,
  getWorkFrontById,
  createWorkFront,
  updateWorkFront,
  updateWorkFrontStatus,
  assignCameraToWorkFront,
  removeCameraFromWorkFront,
  relocateCamera,
} = require('../controllers/workFrontController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { csrfProtection } = require('../middleware/csrf');

const router = express.Router();

// Read Work-Fronts: Authenticated (ADMIN, SAFETY_OPERATOR)
router.get('/', requireAuth, requireRole('ADMIN', 'SAFETY_OPERATOR'), getWorkFronts);
router.get('/:id', requireAuth, requireRole('ADMIN', 'SAFETY_OPERATOR'), getWorkFrontById);

// Work-Front Management Operations: Strictly ADMIN + CSRF Protection
router.post('/', requireAuth, requireRole('ADMIN'), csrfProtection, createWorkFront);
router.patch('/:id', requireAuth, requireRole('ADMIN'), csrfProtection, updateWorkFront);
router.patch('/:id/status', requireAuth, requireRole('ADMIN'), csrfProtection, updateWorkFrontStatus);

// Batch 2: Camera Mapping & Relocation Operations: Strictly ADMIN + CSRF Protection
router.post('/:id/cameras/assign', requireAuth, requireRole('ADMIN'), csrfProtection, assignCameraToWorkFront);
router.delete('/:id/cameras/:cameraId', requireAuth, requireRole('ADMIN'), csrfProtection, removeCameraFromWorkFront);
router.post('/:id/cameras/relocate', requireAuth, requireRole('ADMIN'), csrfProtection, relocateCamera);

module.exports = router;

