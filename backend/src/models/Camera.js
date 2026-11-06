const mongoose = require('mongoose');

const cameraSchema = new mongoose.Schema(
  {
    cameraCode: {
      type: String,
      required: [true, 'Camera identifier code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Camera name is required'],
      trim: true,
      maxlength: [100, 'Camera name cannot exceed 100 characters'],
    },
    site: {
      type: String,
      required: [true, 'Site location name is required'],
      trim: true,
      maxlength: [100, 'Site name cannot exceed 100 characters'],
    },
    location: {
      type: String,
      required: [true, 'Zone or area location is required'],
      trim: true,
      maxlength: [100, 'Location cannot exceed 100 characters'],
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: [300, 'Description cannot exceed 300 characters'],
    },
    status: {
      type: String,
      enum: {
        values: ['UNKNOWN', 'ONLINE', 'OFFLINE'],
        message: 'Status must be UNKNOWN, ONLINE, or OFFLINE',
      },
      default: 'UNKNOWN', // Strictly defaults to UNKNOWN for unverified cameras
      index: true,
    },
    streamStatus: {
      type: String,
      enum: ['UNAVAILABLE', 'DEMO_FEED', 'LIVE'],
      default: 'UNAVAILABLE',
    },
    lastSeenAt: {
      type: Date,
      default: null, // Strictly null until an actual telemetry event is received
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    workFront: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WorkFront',
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for optimal dashboard and filter queries
cameraSchema.index({ status: 1, isActive: 1 });
cameraSchema.index({ site: 1, location: 1 });
cameraSchema.index({ workFront: 1, isActive: 1 });

module.exports = mongoose.model('Camera', cameraSchema);

