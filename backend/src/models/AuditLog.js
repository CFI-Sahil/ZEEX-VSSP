const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: [true, 'Audit action is required'],
      enum: [
        'ALERT_CREATED',
        'ALERT_ACKNOWLEDGED',
        'ALERT_CLOSED',
        'EVIDENCE_VIEWED',
        'DEMO_EVENT_INGESTED',
        'CAMERA_CREATED',
        'CAMERA_UPDATED',
        'WORKFRONT_CREATED',
        'WORKFRONT_UPDATED',
        'WORKFRONT_STATUS_CHANGED',
        'CAMERA_ASSIGNED_TO_WORKFRONT',
        'CAMERA_REMOVED_FROM_WORKFRONT',
        'CAMERA_RELOCATED',
        'USER_LOGIN',
        'USER_LOGOUT',
      ],
      index: true,
    },
    entityType: {
      type: String,
      required: [true, 'Entity type is required'],
      enum: ['ALERT', 'EVIDENCE', 'CAMERA', 'USER', 'SYSTEM', 'WORKFRONT'],
      index: true,
    },
    entityId: {
      type: String,
      required: [true, 'Entity ID is required'],
      index: true,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    performedByEmail: {
      type: String,
      default: 'system',
      trim: true,
    },
    performedByRole: {
      type: String,
      default: 'SYSTEM',
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ipAddress: {
      type: String,
      default: '',
    },
    userAgent: {
      type: String,
      default: '',
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
  }
);

auditLogSchema.index({ entityType: 1, entityId: 1, timestamp: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);

