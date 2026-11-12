const mongoose = require('mongoose');

const notificationLogSchema = new mongoose.Schema(
  {
    alert: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Alert',
      required: [true, 'Associated alert reference is required'],
      index: true,
    },
    alertCode: {
      type: String,
      required: [true, 'Alert code is required'],
      uppercase: true,
      trim: true,
      index: true,
    },
    escalationLevel: {
      type: Number,
      required: [true, 'Escalation level is required'],
      enum: [1, 2, 3],
      default: 1,
    },
    channel: {
      type: String,
      required: [true, 'Notification channel is required'],
      enum: {
        values: ['IN_APP', 'SIMULATED_EMAIL', 'SIMULATED_SMS'],
        message: 'Channel must be IN_APP, SIMULATED_EMAIL, or SIMULATED_SMS',
      },
      index: true,
    },
    recipientKey: {
      type: String,
      required: [true, 'Recipient identifier key is required'],
      trim: true,
    },
    recipientUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    recipientRole: {
      type: String,
      default: 'SAFETY_OPERATOR',
      trim: true,
    },
    recipientContact: {
      type: String,
      default: null,
      trim: true,
    },
    recipientName: {
      type: String,
      default: null,
      trim: true,
    },
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    message: {
      type: String,
      required: [true, 'Notification message is required'],
      trim: true,
      maxlength: [1000, 'Message cannot exceed 1000 characters'],
    },
    severity: {
      type: String,
      required: [true, 'Alert severity is required'],
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    },
    violationType: {
      type: String,
      default: null,
      trim: true,
    },
    deliveryStatus: {
      type: String,
      required: true,
      enum: {
        values: [
          'PENDING',
          'DELIVERED_IN_APP',
          'DISPATCHED_SIMULATED',
          'FAILED',
          'RETRYING',
          'PERMANENTLY_FAILED',
          'CANCELLED',
        ],
        message: 'Invalid notification delivery status',
      },
      default: 'PENDING',
      index: true,
    },
    isSimulated: {
      type: Boolean,
      default: false,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
    retryCount: {
      type: Number,
      default: 0,
      min: 0,
      max: 4,
    },
    nextRetryAt: {
      type: Date,
      default: null,
      index: true,
    },
    retryLeaseAt: {
      type: Date,
      default: null,
    },
    retryToken: {
      type: String,
      default: null,
    },
    lastError: {
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

// 1. Compound uniqueness: guarantees exactly 1 record per alert milestone per channel destination
notificationLogSchema.index(
  { alert: 1, escalationLevel: 1, channel: 1, recipientKey: 1 },
  { unique: true }
);

// 2. Retry queue selection and lease recovery
notificationLogSchema.index({
  deliveryStatus: 1,
  nextRetryAt: 1,
  retryCount: 1,
  retryLeaseAt: 1,
  isActive: 1,
});

// 3. In-App notification feed & unread count queries
notificationLogSchema.index({ recipientUser: 1, channel: 1, isRead: 1, createdAt: -1 });

// 4. Alert notification history query
notificationLogSchema.index({ alert: 1, createdAt: -1 });

module.exports = mongoose.model('NotificationLog', notificationLogSchema);

