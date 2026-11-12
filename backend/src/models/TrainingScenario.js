const mongoose = require('mongoose');

const trainingScenarioSchema = new mongoose.Schema(
  {
    scenarioCode: {
      type: String,
      required: [true, 'Scenario code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Scenario title is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Scenario description is required'],
      trim: true,
    },
    objective: {
      type: String,
      required: [true, 'Training objective is required'],
      trim: true,
    },
    violationType: {
      type: String,
      required: [true, 'Violation type is required'],
      enum: ['NO_HELMET', 'NO_VEST', 'UNAUTHORIZED_ZONE', 'NO_SAFETY_BOOTS', 'RESTRICTED_ACCESS', 'OTHER'],
      index: true,
    },
    severity: {
      type: String,
      required: [true, 'Severity is required'],
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      index: true,
    },
    difficulty: {
      type: String,
      required: [true, 'Difficulty level is required'],
      enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'],
      default: 'BEGINNER',
      index: true,
    },
    estimatedMinutes: {
      type: Number,
      required: true,
      default: 10,
      min: 1,
      max: 120,
    },
    instructions: {
      type: [String],
      default: [],
    },
    learningObjectives: {
      type: [String],
      default: [],
    },
    simulatedAlertContext: {
      alertCode: { type: String, default: '' },
      cameraCode: { type: String, default: 'CAM-01' },
      cameraName: { type: String, default: 'Fabrication Bay Camera 01' },
      location: { type: String, default: 'Work Bay A' },
      site: { type: String, default: 'North Plant' },
      contractor: { type: String, default: 'Apex Structural Contracting' },
      workFrontCode: { type: String, default: 'WF-BAY-A' },
      workFrontName: { type: String, default: 'Main Assembly Bay' },
      riskLevel: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'HIGH' },
      detectedAtOffsetMinutes: { type: Number, default: 5 },
    },
    simulatedEvidence: {
      fileName: { type: String, default: 'simulated-incident.jpg' },
      fixtureType: {
        type: String,
        enum: ['HELMET', 'ZONE', 'VEST', 'BOOTS', 'GENERIC'],
        default: 'GENERIC',
      },
      fileUrl: { type: String, default: '/api/v1/training/evidence-sample/sample-helmet-violation.jpg' },
      mimeType: { type: String, default: 'image/jpeg' },
      caption: { type: String, default: 'Simulated CCTV Snapshot' },
    },
    expectedEvaluation: {
      expectedViolationType: { type: String, required: true },
      expectedSeverity: { type: String, required: true },
      expectedImmediateResponse: { type: String, required: true },
      expectedCorrectiveActionCategory: { type: String, required: true },
      minimumRemarksLength: { type: Number, default: 15 },
      weights: {
        violationId: { type: Number, default: 20 },
        severity: { type: Number, default: 20 },
        acknowledgment: { type: Number, default: 15 },
        immediateResponse: { type: Number, default: 15 },
        correctiveAction: { type: Number, default: 20 },
        resolutionRemarks: { type: Number, default: 10 },
      },
    },
    status: {
      type: String,
      enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'],
      default: 'DRAFT',
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    createdByEmail: {
      type: String,
      default: 'system',
      trim: true,
    },
    completionCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    attemptCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    averageScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for performant scenario browsing and filtering
trainingScenarioSchema.index({ status: 1, difficulty: 1, violationType: 1 });
trainingScenarioSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('TrainingScenario', trainingScenarioSchema);

