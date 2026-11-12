const NotificationLog = require('../models/NotificationLog');
const User = require('../models/User');
const WorkFront = require('../models/WorkFront');

/**
 * Masks an email address for privacy preserving displays and logs
 * Example: 'john.doe@contractor.com' -> 'j***e@contractor.com'
 */
const maskEmail = (email) => {
  if (!email || typeof email !== 'string') return '***@unknown.internal';
  const parts = email.trim().split('@');
  if (parts.length !== 2) return '***@unknown.internal';
  const [local, domain] = parts;
  if (local.length <= 2) {
    return `${local[0] || '*'}***@${domain}`;
  }
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
};

/**
 * Masks a phone number for privacy preserving displays and logs
 * Example: '+919876543210' -> '+91 ******3210'
 */
const maskPhone = (phone) => {
  if (!phone || typeof phone !== 'string') return '+** ******0000';
  const cleaned = phone.trim();
  if (cleaned.length <= 4) return '******' + cleaned;
  const lastFour = cleaned.slice(-4);
  const prefix = cleaned.startsWith('+') ? cleaned.slice(0, 3) : '';
  return `${prefix ? prefix + ' ' : ''}******${lastFour}`;
};

/**
 * Resolves recipients for a given alert and escalation level
 */
const resolveRecipients = async (alert, escalationLevel) => {
  const recipients = [];

  // Active console operators and admins receive IN_APP notifications at all levels
  const activeUsers = await User.find({
    role: { $in: ['SAFETY_OPERATOR', 'ADMIN'] },
    isActive: true,
  }).select('_id name email role');

  for (const user of activeUsers) {
    let title = `Safety Alert: ${alert.violationName || 'Violation'} [L1]`;
    let message = `Safety alert ${alert.alertCode} (${alert.severity}) at ${alert.location || 'Site'}. Requires operator acknowledgement.`;

    if (escalationLevel === 2) {
      title = `ESCALATION [L2]: ${alert.violationName || 'Violation'} Overdue`;
      message = `Alert ${alert.alertCode} has exceeded Level 2 SLA threshold. Work-front supervisor notified.`;
    } else if (escalationLevel === 3) {
      title = `CRITICAL ESCALATION [L3]: ${alert.violationName || 'Violation'}`;
      message = `Urgent: Alert ${alert.alertCode} has exceeded Level 3 SLA threshold. Site management notified.`;
    }

    recipients.push({
      channel: 'IN_APP',
      recipientKey: `USER:${user._id}`,
      recipientUser: user._id,
      recipientRole: user.role,
      recipientContact: maskEmail(user.email),
      recipientName: user.name,
      title,
      message,
      isSimulated: false,
    });
  }

  // Levels 2 and 3: External simulated dispatch to supervisor & management
  if (escalationLevel >= 2) {
    let supervisor = null;

    if (alert.workFront) {
      const wf = await WorkFront.findById(alert.workFront).select('supervisor name workFrontCode');
      if (wf && wf.supervisor) {
        supervisor = wf.supervisor;
      }
    }

    // 1. Supervisor Simulated SMS
    if (supervisor && supervisor.phone) {
      recipients.push({
        channel: 'SIMULATED_SMS',
        recipientKey: `SMS:${supervisor.phone.trim()}`,
        recipientUser: null,
        recipientRole: 'SUPERVISOR',
        recipientContact: maskPhone(supervisor.phone),
        recipientName: supervisor.name || 'Site Supervisor',
        title: `VSSP L${escalationLevel} ESCALATION: ${alert.alertCode}`,
        message: `[SIMULATED SMS] Alert ${alert.alertCode}: ${alert.violationName || 'Violation'} at ${alert.location || 'Site'} unattended past L${escalationLevel} SLA.`,
        isSimulated: true,
      });
    }

    // 2. Supervisor Simulated Email
    if (supervisor && supervisor.email) {
      recipients.push({
        channel: 'SIMULATED_EMAIL',
        recipientKey: `EMAIL:${supervisor.email.trim().toLowerCase()}`,
        recipientUser: null,
        recipientRole: 'SUPERVISOR',
        recipientContact: maskEmail(supervisor.email),
        recipientName: supervisor.name || 'Site Supervisor',
        title: `VSSP Level ${escalationLevel} Escalation Notice: ${alert.alertCode}`,
        message: `[SIMULATED EMAIL] Attention Supervisor ${supervisor.name}: Safety alert ${alert.alertCode} at ${alert.location || 'Site'} has exceeded SLA threshold.`,
        isSimulated: true,
      });
    } else if (!supervisor || (!supervisor.phone && !supervisor.email)) {
      // Fallback if supervisor not assigned
      recipients.push({
        channel: 'SIMULATED_EMAIL',
        recipientKey: 'EMAIL:site.safety.desk@vssp.internal',
        recipientUser: null,
        recipientRole: 'SITE_SAFETY_OFFICER',
        recipientContact: maskEmail('site.safety.desk@vssp.internal'),
        recipientName: 'Duty Safety Officer',
        title: `VSSP Level ${escalationLevel} Escalation Fallback: ${alert.alertCode}`,
        message: `[SIMULATED EMAIL] Alert ${alert.alertCode} at ${alert.location || 'Site'} has escalated to L${escalationLevel}. Supervisor unassigned.`,
        isSimulated: true,
      });
    }
  }

  // Level 3: Additional simulated email to Plant Safety Management
  if (escalationLevel === 3) {
    recipients.push({
      channel: 'SIMULATED_EMAIL',
      recipientKey: 'EMAIL:plant.management@vssp.internal',
      recipientUser: null,
      recipientRole: 'PLANT_MANAGEMENT',
      recipientContact: maskEmail('plant.management@vssp.internal'),
      recipientName: 'Plant Operations Management',
      title: `CRITICAL L3 BREACH: Alert ${alert.alertCode}`,
      message: `[SIMULATED EMAIL] Critical safety SLA breached for alert ${alert.alertCode} (${alert.violationName || 'Violation'}) at ${alert.location || 'Site'}. Immediate management intervention required.`,
      isSimulated: true,
    });
  }

  return recipients;
};

/**
 * Generates initial Level 1 notifications for a freshly created alert
 * Persists records within the optional session transaction
 */
const generateInitialAlertNotifications = async (alert, { session = null } = {}) => {
  const recipients = await resolveRecipients(alert, 1);
  const stagedNotifications = [];

  for (const r of recipients) {
    try {
      const notifData = {
        alert: alert._id,
        alertCode: alert.alertCode,
        escalationLevel: 1,
        channel: r.channel,
        recipientKey: r.recipientKey,
        recipientUser: r.recipientUser,
        recipientRole: r.recipientRole,
        recipientContact: r.recipientContact,
        recipientName: r.recipientName,
        title: r.title,
        message: r.message,
        severity: alert.severity,
        violationType: alert.violationType,
        deliveryStatus: r.channel === 'IN_APP' ? 'DELIVERED_IN_APP' : 'PENDING',
        isSimulated: r.isSimulated,
        isRead: false,
        retryCount: 0,
      };

      const doc = new NotificationLog(notifData);
      if (session) {
        await doc.save({ session });
      } else {
        await doc.save();
      }
      stagedNotifications.push(doc);
    } catch (err) {
      // Ignore unique duplicate key errors (already staged)
      if (err.code !== 11000 && !err.message?.includes('E11000')) {
        throw err;
      }
    }
  }

  return {
    stagedNotifications,
    count: stagedNotifications.length,
  };
};

/**
 * Generates Level 2 or Level 3 escalation notifications
 */
const generateEscalationNotifications = async (alert, escalationLevel, { session = null } = {}) => {
  const recipients = await resolveRecipients(alert, escalationLevel);
  const stagedNotifications = [];

  for (const r of recipients) {
    try {
      const notifData = {
        alert: alert._id,
        alertCode: alert.alertCode,
        escalationLevel,
        channel: r.channel,
        recipientKey: r.recipientKey,
        recipientUser: r.recipientUser,
        recipientRole: r.recipientRole,
        recipientContact: r.recipientContact,
        recipientName: r.recipientName,
        title: r.title,
        message: r.message,
        severity: alert.severity,
        violationType: alert.violationType,
        deliveryStatus: r.channel === 'IN_APP' ? 'DELIVERED_IN_APP' : 'PENDING',
        isSimulated: r.isSimulated,
        isRead: false,
        retryCount: 0,
      };

      const doc = new NotificationLog(notifData);
      if (session) {
        await doc.save({ session });
      } else {
        await doc.save();
      }
      stagedNotifications.push(doc);
    } catch (err) {
      if (err.code !== 11000 && !err.message?.includes('E11000')) {
        throw err;
      }
    }
  }

  return {
    stagedNotifications,
    count: stagedNotifications.length,
  };
};

module.exports = {
  maskEmail,
  maskPhone,
  resolveRecipients,
  generateInitialAlertNotifications,
  generateEscalationNotifications,
};

