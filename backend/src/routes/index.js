const express = require('express');
const healthRoutes = require('./healthRoutes');
const authRoutes = require('./authRoutes');
const cameraRoutes = require('./cameraRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const alertRoutes = require('./alertRoutes');
const evidenceRoutes = require('./evidenceRoutes');
const workFrontRoutes = require('./workFrontRoutes');
const demoRoutes = require('./demoRoutes');
const env = require('../config/env');

const router = express.Router();

// Mount public health check
router.use('/health', healthRoutes);

// Mount authentication & session routes
router.use('/auth', authRoutes);

// Mount operational camera, work-front & dashboard routes
router.use('/cameras', cameraRoutes);
router.use('/work-fronts', workFrontRoutes);
router.use('/dashboard', dashboardRoutes);

// Mount safety alert & evidence routes
router.use('/alerts', alertRoutes);
router.use('/evidence', evidenceRoutes);

// Mount detection event simulation & ingestion routes (protected by auth, RBAC & CSRF)
router.use('/demo', demoRoutes);

module.exports = router;
