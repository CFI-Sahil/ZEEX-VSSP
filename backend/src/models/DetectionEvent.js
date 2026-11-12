const mongoose = require('mongoose');

const detectionEventSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: [true, 'Event identifier is required'],
      uppercase: true,
      trim: true,
      index: true,
    },
    source: {
      type: String,
      enum: {
        values: ['DEMO', 'EXTERNAL_CV'],
        message: 'Source must be DEMO or EXTERNAL_CV',
      },
      default: 'DEMO',
      index: true,
    },
    camera: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Camera',
      default: null,
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
      default: null,
      index: true,
    },
    violationName: {
      type: String,
      default: null,
      trim: true,
    },
    severity: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', null],
      default: null,
      index: true,
    },
    confidence: {
      type: Number,
      default: null,
      min: 0,
      max: 1,
    },
    status: {
      type: String,
      required: [true, 'Intake status is required'],
      enum: {
        values: ['RECEIVED', 'ACCEPTED', 'REJECTED', 'FAILED'],
        message: 'Status must be RECEIVED, ACCEPTED, REJECTED, or FAILED',
      },
      default: 'RECEIVED',
      index: true,
    },
    rejectionReason: {
      type: String,
      default: null,
      trim: true,
    },
    validationErrors: [
      {
        field: { type: String, required: true },
        message: { type: String, required: true },
      },
    ],
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    evidenceMetadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    occurredAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    receivedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    processedByRuleEngine: {
      type: Boolean,
      default: false,
      index: true,
    },
    processingStatus: {
      type: String,
      enum: {
        values: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'],
        message: 'Processing status must be PENDING, PROCESSING, COMPLETED, or FAILED',
      },
      default: 'PENDING',
      index: true,
    },
    processedAt: {
      type: Date,
      default: null,
    },
    processingStartedAt: {
      type: Date,
      default: null,
    },
    processingError: {
      type: String,
      default: null,
      trim: true,
    },
    ruleEvaluation: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    associatedAlert: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Alert',
      default: null,
      index: true,
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    ipAddress: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Database-enforced uniqueness: No two ACCEPTED events may share the same eventId
detectionEventSchema.index(
  { eventId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'ACCEPTED' },
    name: 'unique_accepted_eventId',
  }
);

// Compound indexes for optimal performance in intake tables, dashboards, and audit queries
detectionEventSchema.index({ status: 1, receivedAt: -1 });
detectionEventSchema.index({ cameraCode: 1, receivedAt: -1 });
detectionEventSchema.index({ source: 1, receivedAt: -1 });
detectionEventSchema.index({ processedByRuleEngine: 1, status: 1 });
detectionEventSchema.index({ status: 1, processingStatus: 1, processedByRuleEngine: 1 });

module.exports = mongoose.model('DetectionEvent', detectionEventSchema);

