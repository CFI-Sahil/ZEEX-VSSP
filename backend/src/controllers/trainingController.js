const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const trainingService = require('../services/trainingService');
const { sendSuccess, sendError } = require('../utils/response');
const {
  scenarioQuerySchema,
  scenarioCreateSchema,
  scenarioUpdateSchema,
  startSessionSchema,
  acknowledgeSessionSchema,
  assessSessionSchema,
  correctiveActionSchema,
  completeSessionSchema,
  sessionHistoryQuerySchema,
} = require('../validators/trainingValidator');

/**
 * Serves static demonstration evidence images safely without external network calls
 */
const getEvidenceSample = async (req, res, next) => {
  try {
    const filename = path.basename(req.params.filename);
    const allowedFiles = {
      'sample-helmet-violation.jpg': 'image/jpeg',
      'sample-zone-breach.png': 'image/png',
    };

    const mime = allowedFiles[filename] || 'image/jpeg';
    const filePath = path.join(__dirname, '../assets/evidence', filename);

    if (fs.existsSync(filePath)) {
      res.setHeader('Content-Type', mime);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return fs.createReadStream(filePath).pipe(res);
    }

    // Fallback: if specific file not found, fall back to helmet sample
    const fallbackPath = path.join(__dirname, '../assets/evidence/sample-helmet-violation.jpg');
    if (fs.existsSync(fallbackPath)) {
      res.setHeader('Content-Type', 'image/jpeg');
      return fs.createReadStream(fallbackPath).pipe(res);
    }

    return sendError(res, 'Sample evidence file not found', null, 404);
  } catch (err) {
    next(err);
  }
};

/**
 * List scenarios with filtering, search, and pagination
 */
const listScenarios = async (req, res, next) => {
  try {
    const parseResult = scenarioQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      return sendError(res, 'Invalid query parameters', parseResult.error.issues, 400);
    }

    const result = await trainingService.listScenarios(parseResult.data, req.user);
    return sendSuccess(res, 'Training scenarios retrieved successfully', result.scenarios, result.pagination);
  } catch (err) {
    next(err);
  }
};

/**
 * Get scenario by ID
 */
const getScenarioById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid scenario ID format', null, 400);
    }

    const scenario = await trainingService.getScenarioById(id, req.user);
    return sendSuccess(res, 'Scenario retrieved successfully', scenario);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, null, err.statusCode);
    }
    next(err);
  }
};

/**
 * Create a new scenario (ADMIN only)
 */
const createScenario = async (req, res, next) => {
  try {
    const parseResult = scenarioCreateSchema.safeParse(req.body);
    if (!parseResult.success) {
      return sendError(res, 'Validation error', parseResult.error.issues, 400);
    }

    const scenario = await trainingService.createScenario(parseResult.data, req.user, req);
    return sendSuccess(res, 'Training scenario created successfully', scenario, null, 201);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, null, err.statusCode);
    }
    next(err);
  }
};

/**
 * Update an existing scenario (ADMIN only)
 */
const updateScenario = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid scenario ID format', null, 400);
    }

    const parseResult = scenarioUpdateSchema.safeParse(req.body);
    if (!parseResult.success) {
      return sendError(res, 'Validation error', parseResult.error.issues, 400);
    }

    const scenario = await trainingService.updateScenario(id, parseResult.data, req.user, req);
    return sendSuccess(res, 'Training scenario updated successfully', scenario);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, null, err.statusCode);
    }
    next(err);
  }
};

/**
 * Publish a scenario (ADMIN only)
 */
const publishScenario = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid scenario ID format', null, 400);
    }

    const scenario = await trainingService.publishScenario(id, req.user, req);
    return sendSuccess(res, 'Training scenario published successfully', scenario);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, null, err.statusCode);
    }
    next(err);
  }
};

/**
 * Archive a scenario (ADMIN only)
 */
const archiveScenario = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid scenario ID format', null, 400);
    }

    const scenario = await trainingService.archiveScenario(id, req.user, req);
    return sendSuccess(res, 'Training scenario archived successfully', scenario);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, null, err.statusCode);
    }
    next(err);
  }
};

/**
 * Start a training session
 */
const startSession = async (req, res, next) => {
  try {
    const parseResult = startSessionSchema.safeParse(req.body);
    if (!parseResult.success) {
      return sendError(res, 'Validation error', parseResult.error.issues, 400);
    }

    const session = await trainingService.startSession(parseResult.data.scenarioId, req.user, req);
    return sendSuccess(res, 'Training session started successfully', session, null, 201);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, null, err.statusCode);
    }
    next(err);
  }
};

/**
 * Get session by ID
 */
const getSessionById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid session ID format', null, 400);
    }

    const session = await trainingService.getSessionById(id, req.user);
    return sendSuccess(res, 'Training session retrieved successfully', session);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, null, err.statusCode);
    }
    next(err);
  }
};

/**
 * Acknowledge simulated alert in training session
 */
const acknowledgeSession = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid session ID format', null, 400);
    }

    const parseResult = acknowledgeSessionSchema.safeParse(req.body);
    if (!parseResult.success) {
      return sendError(res, 'Validation error', parseResult.error.issues, 400);
    }

    const session = await trainingService.acknowledgeSession(id, parseResult.data.remarks, req.user, req);
    return sendSuccess(res, 'Simulated alert acknowledged', session);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, null, err.statusCode);
    }
    next(err);
  }
};

/**
 * Submit operator assessment
 */
const assessSession = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid session ID format', null, 400);
    }

    const parseResult = assessSessionSchema.safeParse(req.body);
    if (!parseResult.success) {
      return sendError(res, 'Validation error', parseResult.error.issues, 400);
    }

    const session = await trainingService.assessSession(id, parseResult.data, req.user, req);
    return sendSuccess(res, 'Operator assessment recorded', session);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, null, err.statusCode);
    }
    next(err);
  }
};

/**
 * Record corrective action
 */
const recordCorrectiveAction = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid session ID format', null, 400);
    }

    const parseResult = correctiveActionSchema.safeParse(req.body);
    if (!parseResult.success) {
      return sendError(res, 'Validation error', parseResult.error.issues, 400);
    }

    const session = await trainingService.recordCorrectiveAction(id, parseResult.data, req.user, req);
    return sendSuccess(res, 'Corrective action recorded', session);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, null, err.statusCode);
    }
    next(err);
  }
};

/**
 * Complete training session and evaluate
 */
const completeSession = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid session ID format', null, 400);
    }

    const parseResult = completeSessionSchema.safeParse(req.body);
    if (!parseResult.success) {
      return sendError(res, 'Validation error', parseResult.error.issues, 400);
    }

    const session = await trainingService.completeSession(id, parseResult.data, req.user, req);
    return sendSuccess(res, 'Training session completed and evaluated', session);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, null, err.statusCode);
    }
    next(err);
  }
};

/**
 * Abandon training session
 */
const abandonSession = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid session ID format', null, 400);
    }

    const session = await trainingService.abandonSession(id, req.user, req);
    return sendSuccess(res, 'Training session abandoned', session);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, null, err.statusCode);
    }
    next(err);
  }
};

/**
 * Training statistics
 */
const getTrainingStats = async (req, res, next) => {
  try {
    const stats = await trainingService.getTrainingStats(req.user);
    return sendSuccess(res, 'Training statistics retrieved successfully', stats);
  } catch (err) {
    next(err);
  }
};

/**
 * Training history
 */
const getTrainingHistory = async (req, res, next) => {
  try {
    const parseResult = sessionHistoryQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      return sendError(res, 'Invalid query parameters', parseResult.error.issues, 400);
    }

    const result = await trainingService.getTrainingHistory(parseResult.data, req.user);
    return sendSuccess(res, 'Training history retrieved successfully', result.sessions, result.pagination);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getEvidenceSample,
  listScenarios,
  getScenarioById,
  createScenario,
  updateScenario,
  publishScenario,
  archiveScenario,
  startSession,
  getSessionById,
  acknowledgeSession,
  assessSession,
  recordCorrectiveAction,
  completeSession,
  abandonSession,
  getTrainingStats,
  getTrainingHistory,
};

