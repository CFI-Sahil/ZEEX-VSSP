const mongoose = require('mongoose');

const handoverActivitySchema = new mongoose.Schema(
  {
    handover: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ShiftHandover',
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    userEmail: {
      type: String,
      default: '',
    },
    action: {
      type: String,
      required: true,
      enum: [
        'HANDOVER_CREATED',
        'HANDOVER_UPDATED',
        'SUMMARY_REFRESHED',
        'HANDOVER_SUBMITTED',
        'HANDOVER_ACKNOWLEDGED',
        'FOLLOWUP_CREATED',
        'FOLLOWUP_UPDATED',
        'HANDOVER_COMPLETED',
        'HANDOVER_CANCELLED',
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

handoverActivitySchema.index({ handover: 1, timestamp: 1 });

module.exports = mongoose.model('HandoverActivity', handoverActivitySchema);

