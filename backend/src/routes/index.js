const express = require('express');
const healthRoutes = require('./healthRoutes');
const authRoutes = require('./authRoutes');
const cameraRoutes = require('./cameraRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const alertRoutes = require('./alertRoutes');
const evidenceRoutes = require('./evidenceRoutes');
const demoRoutes = require('./demoRoutes');
const env = require('../config/env');

const router = express.Router();

// Mount public health check
router.use('/health', healthRoutes);

// Mount authentication & session routes
router.use('/auth', authRoutes);

// Mount operational camera & dashboard routes
router.use('/cameras', cameraRoutes);
router.use('/dashboard', dashboardRoutes);

// Mount safety alert & evidence routes
router.use('/alerts', alertRoutes);
router.use('/evidence', evidenceRoutes);

// Server-side enforcement: dev-only demo simulator is NEVER registered in production
if (env.NODE_ENV !== 'production') {
  router.use('/demo', demoRoutes);
}

module.exports = router;
