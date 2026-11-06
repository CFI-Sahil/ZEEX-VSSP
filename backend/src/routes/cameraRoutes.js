const express = require('express');
const {
  createCamera,
  updateCamera,
  getCameras,
  getAvailableCameras,
  getCameraById,
} = require('../controllers/cameraController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { csrfProtection } = require('../middleware/csrf');

const router = express.Router();

// Camera Query Endpoints (Accessible to both ADMIN and SAFETY_OPERATOR)
router.get('/', requireAuth, requireRole('ADMIN', 'SAFETY_OPERATOR'), getCameras);
router.get('/available', requireAuth, requireRole('ADMIN', 'SAFETY_OPERATOR'), getAvailableCameras);
router.get('/:id', requireAuth, requireRole('ADMIN', 'SAFETY_OPERATOR'), getCameraById);

// Camera Management Endpoints (Strictly restricted to ADMIN)
router.post('/', requireAuth, requireRole('ADMIN'), csrfProtection, createCamera);
router.patch('/:id', requireAuth, requireRole('ADMIN'), csrfProtection, updateCamera);

module.exports = router;

