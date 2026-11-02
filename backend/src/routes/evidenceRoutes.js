const express = require('express');
const {
  getEvidenceList,
  getEvidenceById,
  getEvidenceFile,
} = require('../controllers/evidenceController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Read evidence metadata & file: Authenticated (ADMIN, SAFETY_OPERATOR)
router.get('/', requireAuth, requireRole('ADMIN', 'SAFETY_OPERATOR'), getEvidenceList);
router.get('/:id', requireAuth, requireRole('ADMIN', 'SAFETY_OPERATOR'), getEvidenceById);
router.get('/:id/file', requireAuth, requireRole('ADMIN', 'SAFETY_OPERATOR'), getEvidenceFile);

module.exports = router;
