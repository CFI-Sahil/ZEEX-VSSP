const mongoose = require('mongoose');
const Alert = require('../models/Alert');
const AuditLog = require('../models/AuditLog');
const NotificationLog = require('../models/NotificationLog');
const notificationDispatcher = require('../services/notificationDispatcher');
const { sendSuccess, sendError } = require('../utils/response');
const { alertQuerySchema, closeAlertSchema } = require('../validators/alertValidator');
const { logAudit } = require('../utils/auditLogger');

// Helper to escape regex special characters
const escapeRegex = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * @route   GET /api/v1/alerts
 * @desc    List safety alerts with pagination, search and filtering
 * @access  Protected (ADMIN, SAFETY_OPERATOR)
 */
const getAlerts = async (req, res, next) => {
  try {
    const parseResult = alertQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      return sendError(res, 'Invalid query parameters', parseResult.error.issues, 400);
    }

    const { page, limit, search, status, severity, escalationLevel, cameraCode } = parseResult.data;
    const filter = { isActive: true };

    if (status && status !== 'ALL') {
      filter.status = status;
    }

    if (severity && severity !== 'ALL') {
      filter.severity = severity;
    }

    if (escalationLevel) {
      filter.escalationLevel = escalationLevel;
    }

    if (cameraCode && cameraCode.trim()) {
      filter.cameraCode = cameraCode.trim().toUpperCase();
    }

    if (search && search.trim() !== '') {
      const sanitized = escapeRegex(search.trim());
      const regex = new RegExp(sanitized, 'i');
      filter.$or = [
        { alertCode: regex },
        { eventId: regex },
        { violationName: regex },
        { cameraCode: regex },
        { location: regex },
        { workFrontCode: regex },
        { workFrontName: regex },
        { contractor: regex },
      ];
    }

    const skip = (page - 1) * limit;

    const [alerts, total] = await Promise.all([
      Alert.find(filter)
        .sort({ detectedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('camera', 'cameraCode name site location status')
        .populate('workFront', 'workFrontCode name site zone contractor status')
        .populate('evidence', 'evidenceCode fileName fileType fileSize capturedAt')
        .populate('acknowledgedBy', 'name email role')
        .populate('closedBy', 'name email role'),
      Alert.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return sendSuccess(
      res,
      'Alerts retrieved successfully',
      { alerts },
      {
        page,
        limit,
        total,
        totalPages,
      }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/alerts/:id
 * @desc    Get detailed alert record by ID with evidence and audit history
 * @access  Protected (ADMIN, SAFETY_OPERATOR)
 */
const getAlertById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid alert identifier format', null, 400);
    }

    const alert = await Alert.findOne({ _id: id, isActive: true })
      .populate('camera', 'cameraCode name site location status streamStatus lastSeenAt')
      .populate('workFront', 'workFrontCode name site zone contractor status supervisor activityType riskLevel shift')
      .populate('evidence')
      .populate('acknowledgedBy', 'name email role')
      .populate('closedBy', 'name email role');

    if (!alert) {
      return sendError(res, 'Alert record not found', null, 404);
    }

    // Retrieve associated audit trail
    const auditLogs = await AuditLog.find({
      entityType: 'ALERT',
      entityId: String(alert._id),
    }).sort({ timestamp: -1 });

    // Retrieve associated notification logs (Batch 3)
    const notifications = await NotificationLog.find({
      alert: alert._id,
      isActive: true,
    }).sort({ createdAt: -1 });

    return sendSuccess(res, 'Alert details retrieved successfully', { alert, auditLogs, notifications });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/v1/alerts/:id/acknowledge
 * @desc    Acknowledge a pending alert
 * @access  Protected (ADMIN, SAFETY_OPERATOR)
 */
const acknowledgeAlert = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid alert identifier format', null, 400);
    }

    const alert = await Alert.findOne({ _id: id, isActive: true });
    if (!alert) {
      return sendError(res, 'Alert record not found', null, 404);
    }

    // Strict state transition validation: only PENDING -> ACKNOWLEDGED
    if (alert.status !== 'PENDING') {
      return sendError(
        res,
        `Cannot acknowledge alert in '${alert.status}' status. Only PENDING alerts can be acknowledged.`,
        [{ field: 'status', message: `Current status is ${alert.status}` }],
        400
      );
    }

    alert.status = 'ACKNOWLEDGED';
    alert.acknowledgedBy = req.user._id;
    alert.acknowledgedAt = new Date();

    await alert.save();

    // Cancel pending/retrying external notifications for acknowledged alert
    await notificationDispatcher.cancelPendingAlertNotifications(alert._id);

    // Record audit event
    await logAudit({
      action: 'ALERT_ACKNOWLEDGED',
      entityType: 'ALERT',
      entityId: alert._id,
      req,
      details: {
        alertCode: alert.alertCode,
        previousStatus: 'PENDING',
        newStatus: 'ACKNOWLEDGED',
      },
    });

    const populatedAlert = await Alert.findById(alert._id)
      .populate('camera', 'cameraCode name site location status')
      .populate('workFront', 'workFrontCode name site zone contractor status')
      .populate('evidence')
      .populate('acknowledgedBy', 'name email role');

    return sendSuccess(res, 'Alert acknowledged successfully', { alert: populatedAlert });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/v1/alerts/:id/close
 * @desc    Close an alert with required remarks
 * @access  Protected (ADMIN, SAFETY_OPERATOR)
 */
const closeAlert = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid alert identifier format', null, 400);
    }

    const parseResult = closeAlertSchema.safeParse(req.body);
    if (!parseResult.success) {
      return sendError(
        res,
        'Validation failed: Closure remarks are required',
        parseResult.error.issues.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        })),
        400
      );
    }

    const alert = await Alert.findOne({ _id: id, isActive: true });
    if (!alert) {
      return sendError(res, 'Alert record not found', null, 404);
    }

    // Strict state transition: alerts MUST transition PENDING -> ACKNOWLEDGED -> CLOSED
    if (alert.status !== 'ACKNOWLEDGED') {
      return sendError(
        res,
        `Cannot close alert in '${alert.status}' status. Alerts must transition strictly from PENDING -> ACKNOWLEDGED -> CLOSED. Direct closure from PENDING is prohibited.`,
        [{ field: 'status', message: `Current status is ${alert.status}. Must be ACKNOWLEDGED before closing.` }],
        400
      );
    }

    const previousStatus = alert.status;
    const { remarks } = parseResult.data;

    alert.status = 'CLOSED';
    alert.closedBy = req.user._id;
    alert.closedAt = new Date();
    alert.closureRemarks = remarks;

    await alert.save();

    // Cancel pending/retrying external notifications for closed alert
    await notificationDispatcher.cancelPendingAlertNotifications(alert._id);

    // Record audit event
    await logAudit({
      action: 'ALERT_CLOSED',
      entityType: 'ALERT',
      entityId: alert._id,
      req,
      details: {
        alertCode: alert.alertCode,
        previousStatus,
        newStatus: 'CLOSED',
        remarks,
      },
    });

    const populatedAlert = await Alert.findById(alert._id)
      .populate('camera', 'cameraCode name site location status')
      .populate('workFront', 'workFrontCode name site zone contractor status')
      .populate('evidence')
      .populate('acknowledgedBy', 'name email role')
      .populate('closedBy', 'name email role');

    return sendSuccess(res, 'Alert closed successfully with remarks', { alert: populatedAlert });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAlerts,
  getAlertById,
  acknowledgeAlert,
  closeAlert,
};

