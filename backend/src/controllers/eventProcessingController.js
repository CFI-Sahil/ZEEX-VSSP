const { sendSuccess, sendError } = require('../utils/response');
const eventProcessingService = require('../services/eventProcessingService');

/**
 * @route   POST /api/v1/events/:id/process
 * @desc    Evaluate and process a single accepted detection event by ID
 * @access  Protected (ADMIN, SAFETY_OPERATOR)
 */
const processEventById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string') {
      return sendError(res, 'Invalid event identifier', null, 400);
    }

    const context = {
      user: req.user,
      req,
    };

    const result = await eventProcessingService.processEvent(id, context);

    if (!result.success) {
      return sendError(res, result.message, null, result.statusCode || 400);
    }

    return sendSuccess(
      res,
      result.message,
      {
        alert: result.alert,
        event: result.event,
        ruleEvaluation: result.ruleEvaluation,
        isExisting: result.isExisting || false,
      },
      null,
      result.statusCode || 200
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/events/process-queue
 * @desc    Trigger batch execution of pending accepted events
 * @access  Protected (ADMIN, SAFETY_OPERATOR)
 */
const processBatchQueue = async (req, res, next) => {
  try {
    const limit = req.body?.limit || req.query?.limit || 10;
    const context = {
      user: req.user,
      req,
    };

    const metrics = await eventProcessingService.processQueue({ limit, context });

    return sendSuccess(
      res,
      `Batch processing complete: ${metrics.processedCount} processed, ${metrics.alertsCreated} alerts created, ${metrics.failedCount} failed`,
      metrics
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/events/processing-queue/status
 * @desc    Retrieve real-time processing pipeline status and queue counts
 * @access  Protected (ADMIN, SAFETY_OPERATOR)
 */
const getProcessingQueueStatus = async (req, res, next) => {
  try {
    const stats = await eventProcessingService.getProcessingQueueStats();
    return sendSuccess(res, 'Processing queue status retrieved successfully', { stats });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  processEventById,
  processBatchQueue,
  getProcessingQueueStatus,
};

