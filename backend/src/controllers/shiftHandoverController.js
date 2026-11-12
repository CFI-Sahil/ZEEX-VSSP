const mongoose = require('mongoose');
const shiftHandoverService = require('../services/shiftHandoverService');
const { sendSuccess, sendError } = require('../utils/response');
const {
  createHandoverSchema,
  updateDraftHandoverSchema,
  submitHandoverSchema,
  acknowledgeHandoverSchema,
  createFollowUpSchema,
  updateFollowUpSchema,
  cancelHandoverSchema,
  handoverQuerySchema,
} = require('../validators/shiftHandoverValidator');

/**
 * Get current live operational summary candidate items
 */
const getOperationalSummary = async (req, res, next) => {
  try {
    const summary = await shiftHandoverService.collectOperationalSummary();
    return sendSuccess(res, 'Operational summary retrieved successfully', summary);
  } catch (err) {
    next(err);
  }
};

/**
 * Handover dashboard overview metrics
 */
const getHandoverDashboard = async (req, res, next) => {
  try {
    const dashboard = await shiftHandoverService.getHandoverDashboard(req.user);
    return sendSuccess(res, 'Handover dashboard retrieved successfully', dashboard);
  } catch (err) {
    next(err);
  }
};

/**
 * Incoming handover inbox for the current operator
 */
const getHandoverInbox = async (req, res, next) => {
  try {
    const inbox = await shiftHandoverService.getHandoverInbox(req.user);
    return sendSuccess(res, 'Handover inbox retrieved successfully', inbox);
  } catch (err) {
    next(err);
  }
};

/**
 * List paginated and filtered handovers
 */
const listHandovers = async (req, res, next) => {
  try {
    const parseResult = handoverQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      return sendError(res, 'Invalid query parameters', parseResult.error.issues, 400);
    }

    const result = await shiftHandoverService.listHandovers(parseResult.data, req.user);
    return sendSuccess(res, 'Handovers retrieved successfully', {
      handovers: result.handovers,
      pagination: result.pagination,
    }, result.pagination);
  } catch (err) {
    next(err);
  }
};

/**
 * Retrieve single handover by ID
 */
const getHandoverById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid handover ID format', null, 400);
    }

    const handover = await shiftHandoverService.getHandoverById(id, req.user);
    return sendSuccess(res, 'Handover retrieved successfully', handover);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, null, err.statusCode);
    }
    next(err);
  }
};

/**
 * Create a new handover draft
 */
const createHandover = async (req, res, next) => {
  try {
    const parseResult = createHandoverSchema.safeParse(req.body);
    if (!parseResult.success) {
      return sendError(res, 'Validation error', parseResult.error.issues, 400);
    }

    const handover = await shiftHandoverService.createHandover(parseResult.data, req.user, req);
    return sendSuccess(res, 'Shift handover draft created successfully', handover, null, 201);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, null, err.statusCode);
    }
    next(err);
  }
};

/**
 * Update an existing draft handover
 */
const updateDraftHandover = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid handover ID format', null, 400);
    }

    const parseResult = updateDraftHandoverSchema.safeParse(req.body);
    if (!parseResult.success) {
      return sendError(res, 'Validation error', parseResult.error.issues, 400);
    }

    const handover = await shiftHandoverService.updateDraftHandover(id, parseResult.data, req.user, req);
    return sendSuccess(res, 'Draft handover updated successfully', handover);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, null, err.statusCode);
    }
    next(err);
  }
};

/**
 * Refresh operational data on a draft handover
 */
const refreshHandoverSummary = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid handover ID format', null, 400);
    }

    const result = await shiftHandoverService.refreshHandoverSummary(id, req.user, req);
    return sendSuccess(res, 'Handover operational summary refreshed', result);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, null, err.statusCode);
    }
    next(err);
  }
};

/**
 * Submit draft handover (freezes snapshot permanently)
 */
const submitHandover = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid handover ID format', null, 400);
    }

    const parseResult = submitHandoverSchema.safeParse(req.body);
    if (!parseResult.success) {
      return sendError(res, 'Validation error', parseResult.error.issues, 400);
    }

    const handover = await shiftHandoverService.submitHandover(id, parseResult.data, req.user, req);
    return sendSuccess(res, 'Shift handover submitted successfully', handover);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, null, err.statusCode);
    }
    next(err);
  }
};

/**
 * Claim an unassigned submitted handover
 */
const claimHandover = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid handover ID format', null, 400);
    }

    const handover = await shiftHandoverService.claimHandover(id, req.user, req);
    return sendSuccess(res, 'Shift handover claimed successfully', handover);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, null, err.statusCode);
    }
    next(err);
  }
};

/**
 * Incoming operator acknowledges handover
 */
const acknowledgeHandover = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid handover ID format', null, 400);
    }

    const parseResult = acknowledgeHandoverSchema.safeParse(req.body);
    if (!parseResult.success) {
      return sendError(res, 'Validation error', parseResult.error.issues, 400);
    }

    const handover = await shiftHandoverService.acknowledgeHandover(id, parseResult.data, req.user, req);
    return sendSuccess(res, 'Shift handover acknowledged successfully', handover);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, null, err.statusCode);
    }
    next(err);
  }
};

/**
 * Add a follow-up action item to a handover
 */
const createFollowUp = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid handover ID format', null, 400);
    }

    const parseResult = createFollowUpSchema.safeParse(req.body);
    if (!parseResult.success) {
      return sendError(res, 'Validation error', parseResult.error.issues, 400);
    }

    const handover = await shiftHandoverService.createFollowUp(id, parseResult.data, req.user, req);
    return sendSuccess(res, 'Follow-up item created successfully', handover, null, 201);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, null, err.statusCode);
    }
    next(err);
  }
};

/**
 * Update a follow-up action item status/remarks
 */
const updateFollowUp = async (req, res, next) => {
  try {
    const { id, followUpId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid handover ID format', null, 400);
    }

    const parseResult = updateFollowUpSchema.safeParse(req.body);
    if (!parseResult.success) {
      return sendError(res, 'Validation error', parseResult.error.issues, 400);
    }

    const handover = await shiftHandoverService.updateFollowUp(id, followUpId, parseResult.data, req.user, req);
    return sendSuccess(res, 'Follow-up item updated successfully', handover);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, null, err.statusCode);
    }
    next(err);
  }
};

/**
 * Conclude and mark handover as COMPLETED
 */
const completeHandover = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid handover ID format', null, 400);
    }

    const handover = await shiftHandoverService.completeHandover(id, req.user, req);
    return sendSuccess(res, 'Shift handover concluded and completed', handover);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, null, err.statusCode);
    }
    next(err);
  }
};

/**
 * Cancel a draft handover
 */
const cancelHandover = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid handover ID format', null, 400);
    }

    const parseResult = cancelHandoverSchema.safeParse(req.body);
    if (!parseResult.success) {
      return sendError(res, 'Validation error', parseResult.error.issues, 400);
    }

    const handover = await shiftHandoverService.cancelHandover(id, parseResult.data.cancellationReason, req.user, req);
    return sendSuccess(res, 'Shift handover cancelled', handover);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, null, err.statusCode);
    }
    next(err);
  }
};

module.exports = {
  getOperationalSummary,
  getHandoverDashboard,
  getHandoverInbox,
  listHandovers,
  getHandoverById,
  createHandover,
  updateDraftHandover,
  refreshHandoverSummary,
  submitHandover,
  claimHandover,
  acknowledgeHandover,
  createFollowUp,
  updateFollowUp,
  completeHandover,
  cancelHandover,
};
