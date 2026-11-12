const mongoose = require('mongoose');
const { sendSuccess, sendError } = require('../utils/response');
const eventIntakeService = require('../services/eventIntakeService');

/**
 * @route   POST /api/v1/events/intake
 * @desc    Ingest, validate, and record incoming detection events
 * @access  Protected (ADMIN, SAFETY_OPERATOR)
 */
const ingestEvent = async (req, res, next) => {
  try {
    const context = {
      user: req.user,
      ipAddress: req.ip || req.connection?.remoteAddress,
      req,
    };

    const result = await eventIntakeService.receiveEvent(req.body, context);

    if (!result.success) {
      return sendError(
        res,
        result.message,
        result.validationErrors || [{ field: 'general', message: result.message }],
        result.statusCode || 400
      );
    }

    return sendSuccess(
      res,
      result.message,
      {
        event: result.event,
        intakeStatus: result.intakeStatus,
        eventId: result.event?.eventId,
      },
      null,
      result.statusCode || 201
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/events/intake
 * @desc    Get paginated detection event intake records with filters
 * @access  Protected (ADMIN, SAFETY_OPERATOR)
 */
const getIntakeEvents = async (req, res, next) => {
  try {
    const { events, meta } = await eventIntakeService.getIntakeEvents(req.query);
    return sendSuccess(res, 'Intake events retrieved successfully', { events }, meta);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/events/intake/stats
 * @desc    Get intake performance and outcome metrics
 * @access  Protected (ADMIN, SAFETY_OPERATOR)
 */
const getIntakeStats = async (req, res, next) => {
  try {
    const stats = await eventIntakeService.getIntakeStats();
    return sendSuccess(res, 'Intake metrics retrieved successfully', { stats });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/events/intake/:id
 * @desc    Get detailed intake event record
 * @access  Protected (ADMIN, SAFETY_OPERATOR)
 */
const getIntakeEventById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid event record identifier format', null, 400);
    }

    const event = await eventIntakeService.getIntakeEventById(id);
    if (!event) {
      return sendError(res, 'Detection event intake record not found', null, 404);
    }

    return sendSuccess(res, 'Detection event record retrieved successfully', { event });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  ingestEvent,
  getIntakeEvents,
  getIntakeStats,
  getIntakeEventById,
};

