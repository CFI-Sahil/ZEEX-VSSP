const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema(
  {
    alertCode: {
      type: String,
      required: [true, 'Alert code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    eventId: {
      type: String,
      required: [true, 'Detection event identifier is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    camera: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Camera',
      required: [true, 'Associated camera reference is required'],
      index: true,
    },
    cameraCode: {
      type: String,
      required: [true, 'Camera code is required'],
      uppercase: true,
      trim: true,
      index: true,
    },
    violationType: {
      type: String,
      required: [true, 'Violation type is required'],
      enum: {
        values: [
          'NO_HELMET',
          'NO_VEST',
          'UNAUTHORIZED_ZONE',
          'NO_SAFETY_BOOTS',
          'RESTRICTED_ACCESS',
          'OTHER',
        ],
        message: 'Invalid violation type',
      },
      index: true,
    },
    violationName: {
      type: String,
      required: [true, 'Violation name is required'],
      trim: true,
    },
    severity: {
      type: String,
      required: [true, 'Severity level is required'],
      enum: {
        values: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        message: 'Severity must be LOW, MEDIUM, HIGH, or CRITICAL',
      },
      index: true,
    },
    confidence: {
      type: Number,
      required: [true, 'AI confidence score is required'],
      min: [0, 'Confidence cannot be less than 0'],
      max: [1, 'Confidence cannot exceed 1'],
    },
    status: {
      type: String,
      required: true,
      enum: {
        values: ['PENDING', 'ACKNOWLEDGED', 'CLOSED'],
        message: 'Status must be PENDING, ACKNOWLEDGED, or CLOSED',
      },
      default: 'PENDING',
      index: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    location: {
      type: String,
      required: [true, 'Incident location is required'],
      trim: true,
    },
    detectedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    acknowledgedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    acknowledgedAt: {
      type: Date,
      default: null,
    },
    closedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    closedAt: {
      type: Date,
      default: null,
    },
    closureRemarks: {
      type: String,
      default: null,
      trim: true,
      maxlength: [1000, 'Closure remarks cannot exceed 1000 characters'],
    },
    evidence: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Evidence',
      default: null,
    },
    detectionEvent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DetectionEvent',
      default: null,
      index: true,
    },
    // SLA Escalation Tracking (Batch 3)
    escalationLevel: {
      type: Number,
      enum: [1, 2, 3],
      default: 1,
      index: true,
    },
    escalatedAtL2: {
      type: Date,
      default: null,
    },
    escalatedAtL3: {
      type: Date,
      default: null,
    },
    escalationHistory: [
      {
        level: { type: Number, required: true },
        escalatedAt: { type: Date, default: Date.now },
        reason: { type: String, default: 'SLA threshold exceeded' },
        previousLevel: { type: Number, default: 1 },
        details: { type: mongoose.Schema.Types.Mixed, default: {} },
      },
    ],
    // Operational Work-Front & Contractor Enrichment (Batch 3)
    workFront: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WorkFront',
      default: null,
      index: true,
    },
    workFrontCode: {
      type: String,
      default: null,
      uppercase: true,
      trim: true,
      index: true,
    },
    workFrontName: {
      type: String,
      default: null,
      trim: true,
    },
    contractor: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
    activityType: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
    riskLevel: {
      type: String,
      default: null,
      trim: true,
    },
    shift: {
      type: String,
      default: null,
      trim: true,
    },
    zone: {
      type: String,
      default: null,
      trim: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for performant querying
alertSchema.index({ status: 1, severity: 1, detectedAt: -1 });
alertSchema.index({ cameraCode: 1, detectedAt: -1 });
alertSchema.index({ workFront: 1, detectedAt: -1 });
alertSchema.index({ contractor: 1, detectedAt: -1 });

// Batch 3: SLA Overdue Escalation evaluation & Evidence Recovery
alertSchema.index({ status: 1, isActive: 1, escalationLevel: 1, detectedAt: 1 });
alertSchema.index({ evidence: 1, 'metadata.evidenceStatus': 1, isActive: 1 });

module.exports = mongoose.model('Alert', alertSchema);

