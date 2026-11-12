const express = require('express');
const healthRoutes = require('./healthRoutes');
const authRoutes = require('./authRoutes');
const cameraRoutes = require('./cameraRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const alertRoutes = require('./alertRoutes');
const evidenceRoutes = require('./evidenceRoutes');
const workFrontRoutes = require('./workFrontRoutes');
const demoRoutes = require('./demoRoutes');
const eventRoutes = require('./eventRoutes');
const notificationRoutes = require('./notificationRoutes');
const escalationRoutes = require('./escalationRoutes');
const trainingRoutes = require('./trainingRoutes');
const shiftHandoverRoutes = require('./shiftHandoverRoutes');
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

// Mount Phase 3 event processing & intake routes
router.use('/events', eventRoutes);

// Mount Phase 3 Batch 3 notifications & escalations
router.use('/notifications', notificationRoutes);
router.use('/escalations', escalationRoutes);

// Mount Phase 3 Batch 5 training sandbox routes
router.use('/training', trainingRoutes);

// Mount Phase 3 Batch 6 shift handover routes
router.use('/handovers', shiftHandoverRoutes);

// Mount detection event simulation & ingestion routes (protected by auth, RBAC & CSRF)
router.use('/demo', demoRoutes);

module.exports = router;
