const express = require('express');
const { getDashboardSummary } = require('../controllers/dashboardController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Dashboard summary accessible to both authorized roles
router.get('/summary', requireAuth, requireRole('ADMIN', 'SAFETY_OPERATOR'), getDashboardSummary);

module.exports = router;

