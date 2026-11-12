const mongoose = require('mongoose');

const trainingActivitySchema = new mongoose.Schema(
  {
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TrainingSession',
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    userEmail: {
      type: String,
      default: '',
    },
    action: {
      type: String,
      required: true,
      enum: [
        'SESSION_STARTED',
        'SESSION_ACKNOWLEDGED',
        'ASSESSMENT_SUBMITTED',
        'CORRECTIVE_ACTION_SAVED',
        'SESSION_COMPLETED',
        'SESSION_ABANDONED',
      ],
      index: true,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
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

trainingActivitySchema.index({ session: 1, timestamp: 1 });

module.exports = mongoose.model('TrainingActivity', trainingActivitySchema);

