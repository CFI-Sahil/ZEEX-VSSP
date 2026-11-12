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
        'ALERT_ESCALATED_L2',
        'ALERT_ESCALATED_L3',
        'NOTIFICATION_DISPATCHED',
        'EVIDENCE_VIEWED',
        'EVIDENCE_DOWNLOADED',
        'DEMO_EVENT_INGESTED',
        'CAMERA_CREATED',
        'CAMERA_UPDATED',
        'WORKFRONT_CREATED',
        'WORKFRONT_UPDATED',
        'WORKFRONT_STATUS_CHANGED',
        'CAMERA_ASSIGNED_TO_WORKFRONT',
        'CAMERA_REMOVED_FROM_WORKFRONT',
        'CAMERA_RELOCATED',
        'EVENT_INTAKE_ACCEPTED',
        'EVENT_INTAKE_REJECTED',
        'EVENT_PROCESSED',
        'EVENT_PROCESSING_FAILED',
        'USER_LOGIN',
        'USER_LOGOUT',
        'TRAINING_SCENARIO_CREATED',
        'TRAINING_SCENARIO_UPDATED',
        'TRAINING_SCENARIO_PUBLISHED',
        'TRAINING_SCENARIO_ARCHIVED',
        'TRAINING_SESSION_STARTED',
        'TRAINING_SESSION_ACKNOWLEDGED',
        'TRAINING_ASSESSMENT_SUBMITTED',
        'TRAINING_CORRECTIVE_ACTION_RECORDED',
        'TRAINING_SESSION_COMPLETED',
        'TRAINING_SESSION_ABANDONED',
        'HANDOVER_CREATED',
        'HANDOVER_UPDATED',
        'HANDOVER_SUMMARY_REFRESHED',
        'HANDOVER_SUBMITTED',
        'HANDOVER_ACKNOWLEDGED',
        'HANDOVER_COMPLETED',
        'HANDOVER_CANCELLED',
        'HANDOVER_FOLLOWUP_CREATED',
        'HANDOVER_FOLLOWUP_UPDATED',
      ],
      index: true,
    },
    entityType: {
      type: String,
      required: [true, 'Entity type is required'],
      enum: [
        'ALERT',
        'EVIDENCE',
        'CAMERA',
        'USER',
        'SYSTEM',
        'WORKFRONT',
        'EVENT',
        'TRAINING_SCENARIO',
        'TRAINING_SESSION',
        'SHIFT_HANDOVER',
      ],
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

// Database-level uniqueness: guarantees exactly 1 ALERT_CREATED audit record per eventId
// Prevents duplicate audit entries under high concurrency or lease recovery races
auditLogSchema.index(
  { action: 1, 'details.eventId': 1 },
  {
    unique: true,
    partialFilterExpression: {
      action: 'ALERT_CREATED',
      'details.eventId': { $type: 'string' },
    },
  }
);

// Database-level uniqueness: guarantees exactly 1 ALERT_ESCALATED_L2 audit record per alert entityId
auditLogSchema.index(
  { action: 1, entityId: 1 },
  {
    name: 'audit_escalated_l2_unique',
    unique: true,
    partialFilterExpression: {
      action: 'ALERT_ESCALATED_L2',
    },
  }
);

// Database-level uniqueness: guarantees exactly 1 ALERT_ESCALATED_L3 audit record per alert entityId
auditLogSchema.index(
  { action: 1, entityId: 1 },
  {
    name: 'audit_escalated_l3_unique',
    unique: true,
    partialFilterExpression: {
      action: 'ALERT_ESCALATED_L3',
    },
  }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);

