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

    await AuditLog.create({
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
  } catch (error) {
    // Non-blocking error handling to ensure main transaction is not disrupted
    console.error('[AuditLog] Failed to record audit log:', error.message);
  }
};

module.exports = {
  logAudit,
};

