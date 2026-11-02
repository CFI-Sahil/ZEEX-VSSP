const Camera = require('../models/Camera');
const Alert = require('../models/Alert');
const { sendSuccess } = require('../utils/response');

/**
 * @route   GET /api/v1/dashboard/summary
 * @desc    Get dynamic dashboard operational KPI metrics, camera monitoring points and recent alerts
 * @access  Protected (ADMIN, SAFETY_OPERATOR)
 */
const getDashboardSummary = async (req, res, next) => {
  try {
    // 1. Efficient parallel aggregation for cameras and alerts
    const [cameraStats, alertStats, recentCameras, recentAlerts] = await Promise.all([
      Camera.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            online: { $sum: { $cond: [{ $eq: ['$status', 'ONLINE'] }, 1, 0] } },
            offline: { $sum: { $cond: [{ $eq: ['$status', 'OFFLINE'] }, 1, 0] } },
            unknown: { $sum: { $cond: [{ $eq: ['$status', 'UNKNOWN'] }, 1, 0] } },
          },
        },
      ]),
      Alert.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            pending: { $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, 1, 0] } },
            acknowledged: { $sum: { $cond: [{ $eq: ['$status', 'ACKNOWLEDGED'] }, 1, 0] } },
            resolved: { $sum: { $cond: [{ $eq: ['$status', 'CLOSED'] }, 1, 0] } },
          },
        },
      ]),
      Camera.find({ isActive: true })
        .sort({ createdAt: -1 })
        .limit(6)
        .select('cameraCode name site location status streamStatus lastSeenAt'),
      Alert.find({ isActive: true })
        .sort({ detectedAt: -1 })
        .limit(5)
        .populate('camera', 'cameraCode name site location')
        .populate('evidence', 'evidenceCode fileName fileType fileSize')
        .select('alertCode eventId violationType violationName severity confidence status detectedAt camera location'),
    ]);

    const cameraMetrics = cameraStats[0] || {
      total: 0,
      online: 0,
      offline: 0,
      unknown: 0,
    };

    const alertMetrics = alertStats[0] || {
      total: 0,
      pending: 0,
      acknowledged: 0,
      resolved: 0,
    };

    const summaryData = {
      kpis: {
        totalCameras: cameraMetrics.total,
        onlineCameras: cameraMetrics.online,
        offlineCameras: cameraMetrics.offline,
        unknownCameras: cameraMetrics.unknown,
        totalViolations: alertMetrics.total,
        pendingAlerts: alertMetrics.pending,
        acknowledgedAlerts: alertMetrics.acknowledged,
        resolvedAlerts: alertMetrics.resolved,
      },
      recentCameras,
      recentAlerts,
      timestamp: new Date().toISOString(),
    };

    return sendSuccess(res, 'Dashboard metrics retrieved successfully', summaryData);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardSummary,
};
