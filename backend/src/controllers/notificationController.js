const mongoose = require('mongoose');
const NotificationLog = require('../models/NotificationLog');
const escalationEngine = require('../services/escalationEngine');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * @route   GET /api/v1/notifications
 * @desc    Get user's in-app notifications with pagination and filtering
 * @access  Protected (ADMIN, SAFETY_OPERATOR)
 */
const getNotifications = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const { channel, isRead, escalationLevel } = req.query;

    const filter = {
      isActive: true,
    };

    // By default, users see their own in-app notifications
    if (req.user.role === 'ADMIN' && req.query.allUsers === 'true') {
      // Admin audit view
    } else {
      filter.recipientUser = req.user._id;
      filter.channel = 'IN_APP';
    }

    if (channel && channel !== 'ALL') {
      filter.channel = channel;
    }

    if (isRead !== undefined && isRead !== 'ALL') {
      filter.isRead = isRead === 'true';
    }

    if (escalationLevel && escalationLevel !== 'ALL') {
      filter.escalationLevel = parseInt(escalationLevel, 10);
    }

    const [notifications, total, unreadCount] = await Promise.all([
      NotificationLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('alert', 'alertCode violationName severity status location detectedAt escalationLevel')
        .lean(),
      NotificationLog.countDocuments(filter),
      NotificationLog.countDocuments({
        recipientUser: req.user._id,
        channel: 'IN_APP',
        isRead: false,
        isActive: true,
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return sendSuccess(
      res,
      'Notifications retrieved successfully',
      {
        notifications,
        unreadCount,
      },
      {
        page,
        limit,
        total,
        totalPages,
      }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/notifications/unread-count
 * @desc    Get unread count of in-app notifications for current user
 * @access  Protected (ADMIN, SAFETY_OPERATOR)
 */
const getUnreadCount = async (req, res, next) => {
  try {
    const count = await NotificationLog.countDocuments({
      recipientUser: req.user._id,
      channel: 'IN_APP',
      isRead: false,
      isActive: true,
    });

    return sendSuccess(res, 'Unread notification count retrieved', { unreadCount: count });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/v1/notifications/:id/read
 * @desc    Mark a single in-app notification as read
 * @access  Protected (ADMIN, SAFETY_OPERATOR)
 */
const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid notification identifier format', null, 400);
    }

    const filter = { _id: id, isActive: true };
    // Non-admins can only mark their own notifications as read
    if (req.user.role !== 'ADMIN') {
      filter.recipientUser = req.user._id;
    }

    const notif = await NotificationLog.findOne(filter);
    if (!notif) {
      return sendError(res, 'Notification record not found', null, 404);
    }

    if (!notif.isRead) {
      notif.isRead = true;
      notif.readAt = new Date();
      await notif.save();
    }

    const unreadCount = await NotificationLog.countDocuments({
      recipientUser: req.user._id,
      channel: 'IN_APP',
      isRead: false,
      isActive: true,
    });

    return sendSuccess(res, 'Notification marked as read', { notification: notif, unreadCount });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/v1/notifications/mark-all-read
 * @desc    Mark all in-app notifications as read for current user
 * @access  Protected (ADMIN, SAFETY_OPERATOR)
 */
const markAllAsRead = async (req, res, next) => {
  try {
    const result = await NotificationLog.updateMany(
      {
        recipientUser: req.user._id,
        channel: 'IN_APP',
        isRead: false,
        isActive: true,
      },
      {
        $set: {
          isRead: true,
          readAt: new Date(),
        },
      }
    );

    return sendSuccess(res, 'All notifications marked as read', {
      markedCount: result.modifiedCount || 0,
      unreadCount: 0,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/notifications/alert/:alertId
 * @desc    Get notification delivery history for a specific alert
 * @access  Protected (ADMIN, SAFETY_OPERATOR)
 */
const getAlertNotifications = async (req, res, next) => {
  try {
    const { alertId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(alertId)) {
      return sendError(res, 'Invalid alert identifier format', null, 400);
    }

    const notifications = await NotificationLog.find({
      alert: alertId,
      isActive: true,
    })
      .sort({ createdAt: -1 })
      .lean();

    return sendSuccess(res, 'Alert notification history retrieved', { notifications });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/escalations/evaluate
 * @desc    Manually trigger SLA escalation evaluation cycle
 * @access  Protected (ADMIN, SAFETY_OPERATOR)
 */
const triggerSLAEvaluation = async (req, res, next) => {
  try {
    const result = await escalationEngine.evaluatePendingAlerts();
    return sendSuccess(res, 'SLA escalation evaluation completed', result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  getAlertNotifications,
  triggerSLAEvaluation,
};

