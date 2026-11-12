const AuditLog = require('../models/AuditLog');

/**
 * Records an audit log entry for operational accountability and event tracking
 * @param {Object} params
 * @param {string} params.action
 * @param {string} params.entityType
 * @param {string} params.entityId
 * @param {Object} [params.req] - Express request object for extracting user, ip, userAgent
 * @param {Object} [params.details] - Additional contextual data
 */
const logAudit = async ({ action, entityType, entityId, req = null, details = {} }) => {
  try {
    const performedBy = req?.user?._id || null;
    const performedByEmail = req?.user?.email || 'system';
    const performedByRole = req?.user?.role || 'SYSTEM';
    const ipAddress = req?.ip || req?.headers?.['x-forwarded-for'] || req?.socket?.remoteAddress || '';
    const userAgent = req?.headers?.['user-agent'] || '';

    const entry = await AuditLog.create({
      action,
      entityType,
      entityId: String(entityId),
      performedBy,
      performedByEmail,
      performedByRole,
      details,
      ipAddress: String(ipAddress),
      userAgent: String(userAgent),
      timestamp: new Date(),
    });
    return entry;
  } catch (error) {
    // Discriminate E11000 duplicate-key errors:
    // Only resolve benign concurrent duplicate inserts for known unique actions
    if (error.code === 11000 || error.message?.includes('E11000')) {
      const isEscalationAction = action === 'ALERT_ESCALATED_L2' || action === 'ALERT_ESCALATED_L3';
      const isAlertCreatedAction = action === 'ALERT_CREATED';

      const keyPattern = error.keyPattern || {};
      const isEscalationKey = keyPattern.action && keyPattern.entityId;
      const isEventKey = keyPattern.action && keyPattern['details.eventId'];

      if ((isEscalationAction && (isEscalationKey || error.message?.includes('audit_escalated') || error.message?.includes('action_1_entityId_1'))) ||
          (isAlertCreatedAction && (isEventKey || error.message?.includes('details.eventId')))) {
        return { isDuplicate: true, action, entityId };
      }

      // Unrelated duplicate key collision: log as warning and rethrow or return error status
      console.warn('[AuditLog] Unexpected duplicate key violation:', error.message, { action, entityId });
      throw error;
    }
    // Non-blocking error handling to ensure main transaction is not disrupted
    console.error('[AuditLog] Failed to record audit log:', error.message);
    return null;
  }
};

module.exports = {
  logAudit,
};

