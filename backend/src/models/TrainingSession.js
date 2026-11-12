const mongoose = require('mongoose');

const trainingSessionSchema = new mongoose.Schema(
  {
    sessionCode: {
      type: String,
      required: [true, 'Session code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    scenario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TrainingScenario',
      required: [true, 'Scenario reference is required'],
      index: true,
    },
    scenarioSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      required: [true, 'Scenario snapshot is required for historical fidelity'],
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true,
    },
    userEmail: {
      type: String,
      required: true,
      trim: true,
    },
    userRole: {
      type: String,
      default: 'SAFETY_OPERATOR',
    },
    status: {
      type: String,
      enum: ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'ABANDONED'],
      default: 'IN_PROGRESS',
      index: true,
    },
    startedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    durationSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
    simulatedAlert: {
      alertCode: { type: String, default: '' },
      status: {
        type: String,
        enum: ['PENDING', 'ACKNOWLEDGED', 'RESOLVED'],
        default: 'PENDING',
      },
      acknowledgedAt: { type: Date, default: null },
      acknowledgedRemarks: { type: String, default: '' },
      resolvedAt: { type: Date, default: null },
      resolutionRemarks: { type: String, default: '' },
    },
    operatorAssessment: {
      assessedViolationType: { type: String, default: '' },
      assessedSeverity: { type: String, default: '' },
      assessedRiskLevel: { type: String, default: '' },
      selectedImmediateResponse: { type: String, default: '' },
      correctiveActionCategory: { type: String, default: '' },
      correctiveActionRemarks: { type: String, default: '' },
      submittedAt: { type: Date, default: null },
    },
    evaluationResult: {
      totalScore: { type: Number, default: 0, min: 0, max: 100 },
      maxScore: { type: Number, default: 100 },
      passed: { type: Boolean, default: false },
      performanceBand: {
        type: String,
        enum: ['EXCELLENT', 'GOOD', 'NEEDS_IMPROVEMENT', 'INCOMPLETE'],
        default: 'INCOMPLETE',
      },
      scoreBreakdown: {
        violationScore: { type: Number, default: 0 },
        severityScore: { type: Number, default: 0 },
        ackScore: { type: Number, default: 0 },
        responseScore: { type: Number, default: 0 },
        correctiveScore: { type: Number, default: 0 },
        remarksScore: { type: Number, default: 0 },
      },
      feedback: { type: [String], default: [] },
      missedCriteria: { type: [String], default: [] },
      evaluatedAt: { type: Date, default: null },
    },
  },
  {
    timestamps: true,
  }
);

trainingSessionSchema.index({ user: 1, status: 1 });
trainingSessionSchema.index({ scenario: 1, status: 1 });
trainingSessionSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('TrainingSession', trainingSessionSchema);

