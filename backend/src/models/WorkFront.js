const mongoose = require('mongoose');

const workFrontSchema = new mongoose.Schema(
  {
    workFrontCode: {
      type: String,
      required: [true, 'Work-front identifier code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Work-front name is required'],
      trim: true,
      maxlength: [120, 'Work-front name cannot exceed 120 characters'],
    },
    site: {
      type: String,
      required: [true, 'Site location name is required'],
      trim: true,
      index: true,
    },
    zone: {
      type: String,
      required: [true, 'Zone or area location is required'],
      trim: true,
    },
    contractor: {
      type: String,
      required: [true, 'Responsible contractor is required'],
      trim: true,
      index: true,
    },
    supervisor: {
      name: {
        type: String,
        required: [true, 'Supervisor name is required'],
        trim: true,
      },
      phone: {
        type: String,
        default: '',
        trim: true,
      },
      email: {
        type: String,
        default: '',
        trim: true,
        lowercase: true,
      },
    },
    activityType: {
      type: String,
      required: [true, 'Activity type classification is required'],
      enum: {
        values: [
          'WORKING_AT_HEIGHT',
          'HOT_WORK',
          'EXCAVATION',
          'CONFINED_SPACE',
          'HEAVY_LIFTING',
          'ELECTRICAL',
          'GENERAL_CONSTRUCTION',
          'OTHER',
        ],
        message: 'Invalid activity type classification',
      },
      default: 'GENERAL_CONSTRUCTION',
      index: true,
    },
    riskLevel: {
      type: String,
      required: [true, 'Risk level classification is required'],
      enum: {
        values: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        message: 'Risk level must be LOW, MEDIUM, HIGH, or CRITICAL',
      },
      default: 'MEDIUM',
      index: true,
    },
    shift: {
      type: String,
      required: [true, 'Operational shift is required'],
      enum: {
        values: ['MORNING', 'AFTERNOON', 'NIGHT', 'GENERAL_24X7'],
        message: 'Shift must be MORNING, AFTERNOON, NIGHT, or GENERAL_24X7',
      },
      default: 'GENERAL_24X7',
    },
    status: {
      type: String,
      required: [true, 'Work-front lifecycle status is required'],
      enum: {
        values: ['PLANNING', 'ACTIVE', 'SUSPENDED', 'COMPLETED'],
        message: 'Status must be PLANNING, ACTIVE, SUSPENDED, or COMPLETED',
      },
      default: 'ACTIVE',
      index: true,
    },
    // Cameras associated with this work-front (Forward-compatible placeholder for Batch 2)
    cameras: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Camera',
      },
    ],
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
      default: null,
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
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

// Compound indexes for performant querying and filtering
workFrontSchema.index({ site: 1, status: 1 });
workFrontSchema.index({ status: 1, riskLevel: 1 });
workFrontSchema.index({ status: 1, isActive: 1 });

module.exports = mongoose.model('WorkFront', workFrontSchema);

