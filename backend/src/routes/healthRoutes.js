const express = require('express');
const { checkDatabaseHealth } = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');
const env = require('../config/env');

const router = express.Router();

/**
 * @route   GET /api/v1/health
 * @desc    Comprehensive system and database health check
 * @access  Public
 */
router.get('/', async (req, res) => {
  const dbHealth = await checkDatabaseHealth();
  const uptimeSeconds = Math.floor(process.uptime());

  const isHealthy = dbHealth.status === 'healthy';

  const isProduction = env.NODE_ENV === 'production';

  // Minimal public health envelope for production; detailed diagnostics reserved for development/test
  const healthData = isProduction
    ? {
        status: isHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
      }
    : {
        service: 'Visual Safety Surveillance Platform API',
        version: '1.0.0-mvp',
        status: isHealthy ? 'healthy' : 'degraded',
        environment: env.NODE_ENV,
        uptimeSeconds,
        timestamp: new Date().toISOString(),
        database: dbHealth,
      };

  const statusCode = isHealthy ? 200 : 503;
  return res.status(statusCode).json({
    success: isHealthy,
    message: isHealthy
      ? 'All services operational'
      : (isProduction ? 'Service degraded' : 'Database service degraded or disconnected'),
    data: healthData,
  });
});

module.exports = router;

