const mongoose = require('mongoose');

const shiftHandoverSchema = new mongoose.Schema(
  {
    handoverCode: {
      type: String,
      required: [true, 'Handover reference code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    shiftDate: {
      type: Date,
      required: [true, 'Shift date is required'],
      default: Date.now,
      index: true,
    },
    shiftType: {
      type: String,
      enum: {
        values: ['DAY', 'NIGHT', 'SWING', 'CUSTOM'],
        message: 'Shift type must be DAY, NIGHT, SWING, or CUSTOM',
      },
      default: 'DAY',
      index: true,
    },
    shiftLabel: {
      type: String,
      required: [true, 'Shift label is required'],
      trim: true,
      maxlength: [100, 'Shift label cannot exceed 100 characters'],
    },
    outgoingOperator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Outgoing operator reference is required'],
      index: true,
    },
    outgoingOperatorEmail: {
      type: String,
      required: true,
      trim: true,
    },
    outgoingOperatorName: {
      type: String,
      default: '',
      trim: true,
    },
    incomingOperator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    incomingOperatorEmail: {
      type: String,
      default: null,
      trim: true,
    },
    incomingOperatorName: {
      type: String,
      default: null,
      trim: true,
    },
    claimedAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: {
        values: ['DRAFT', 'SUBMITTED', 'ACKNOWLEDGED', 'COMPLETED', 'CANCELLED'],
        message: 'Status must be DRAFT, SUBMITTED, ACKNOWLEDGED, COMPLETED, or CANCELLED',
      },
      default: 'DRAFT',
      index: true,
    },
    operationalSummary: {
      pendingAlertsCount: { type: Number, default: 0 },
      criticalCount: { type: Number, default: 0 },
      highPriorityCount: { type: Number, default: 0 },
      escalationsCount: { type: Number, default: 0 },
      unresolvedCorrectiveCount: { type: Number, default: 0 },
      offlineCamerasCount: { type: Number, default: 0 },
      activeWorkFrontsCount: { type: Number, default: 0 },
      collectedAt: { type: Date, default: Date.now },
    },
    selectedIncidents: [
      {
        alertId: { type: mongoose.Schema.Types.ObjectId, ref: 'Alert', required: true },
        alertCode: { type: String, required: true },
        violationType: { type: String, required: true },
        violationName: { type: String, default: '' },
        severity: { type: String, required: true },
        status: { type: String, required: true },
        detectedAt: { type: Date, default: null },
        cameraCode: { type: String, default: '' },
        workFrontCode: { type: String, default: '' },
        contractor: { type: String, default: '' },
        escalationLevel: { type: Number, default: 1 },
        flaggedForFollowUp: { type: Boolean, default: false },
        notes: { type: String, default: '' },
      },
    ],
    escalationSnapshots: [
      {
        alertId: { type: mongoose.Schema.Types.ObjectId, ref: 'Alert' },
        alertCode: { type: String, required: true },
        escalationLevel: { type: Number, required: true },
        escalatedAt: { type: Date, default: null },
        severity: { type: String, default: '' },
        contractor: { type: String, default: '' },
        status: { type: String, default: '' },
      },
    ],
    cameraIssues: [
      {
        cameraId: { type: mongoose.Schema.Types.ObjectId, ref: 'Camera' },
        cameraCode: { type: String, required: true },
        name: { type: String, default: '' },
        status: { type: String, required: true },
        location: { type: String, default: '' },
        lastSeenAt: { type: Date, default: null },
      },
    ],
    workFrontObservations: [
      {
        workFrontId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkFront' },
        workFrontCode: { type: String, required: true },
        name: { type: String, default: '' },
        contractor: { type: String, default: '' },
        supervisorName: { type: String, default: '' },
        riskLevel: { type: String, default: '' },
        status: { type: String, default: '' },
        activeAlertsCount: { type: Number, default: 0 },
      },
    ],
    manualNotes: [
      {
        category: {
          type: String,
          enum: ['SAFETY_OBSERVATION', 'SUPERVISOR_REQUEST', 'SITE_RESTRICTION', 'EQUIPMENT_HOLD', 'GENERAL'],
          default: 'GENERAL',
        },
        note: { type: String, required: true, trim: true },
        priority: {
          type: String,
          enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
          default: 'MEDIUM',
        },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    outgoingRemarks: {
      type: String,
      default: '',
      trim: true,
      maxlength: [2000, 'Outgoing remarks cannot exceed 2000 characters'],
    },
    submittedAt: {
      type: Date,
      default: null,
      index: true,
    },
    submittedSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    acknowledgement: {
      acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      acknowledgedByEmail: { type: String, default: null },
      acknowledgedByName: { type: String, default: null },
      acknowledgedAt: { type: Date, default: null, index: true },
      remarks: { type: String, default: '', trim: true },
    },
    followUps: [
      {
        followUpId: { type: String, required: true },
        description: { type: String, required: true, trim: true },
        relatedAlertCode: { type: String, default: null },
        assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        assignedToEmail: { type: String, default: null },
        priority: {
          type: String,
          enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
          default: 'MEDIUM',
        },
        status: {
          type: String,
          enum: ['OPEN', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED'],
          default: 'OPEN',
        },
        remarks: { type: String, default: '', trim: true },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
        completedAt: { type: Date, default: null },
      },
    ],
    completedAt: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancellationReason: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for performant inbox, search, and history filtering
shiftHandoverSchema.index({ status: 1, shiftDate: -1 });
shiftHandoverSchema.index({ outgoingOperator: 1, createdAt: -1 });
shiftHandoverSchema.index({ incomingOperator: 1, status: 1 });
shiftHandoverSchema.index({ 'acknowledgement.acknowledgedAt': -1 });

module.exports = mongoose.model('ShiftHandover', shiftHandoverSchema);

