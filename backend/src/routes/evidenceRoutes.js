const express = require('express');
const {
  getEvidenceList,
  getEvidenceStats,
  getEvidenceById,
  getEvidenceFile,
  verifyEvidenceIntegrity,
} = require('../controllers/evidenceController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Read evidence metadata, statistics, verification & file: Authenticated (ADMIN, SAFETY_OPERATOR)
router.get('/', requireAuth, requireRole('ADMIN', 'SAFETY_OPERATOR'), getEvidenceList);
router.get('/stats', requireAuth, requireRole('ADMIN', 'SAFETY_OPERATOR'), getEvidenceStats);
router.get('/:id', requireAuth, requireRole('ADMIN', 'SAFETY_OPERATOR'), getEvidenceById);
router.post('/:id/verify', requireAuth, requireRole('ADMIN', 'SAFETY_OPERATOR'), verifyEvidenceIntegrity);
router.get('/:id/file', requireAuth, requireRole('ADMIN', 'SAFETY_OPERATOR'), getEvidenceFile);

module.exports = router;
