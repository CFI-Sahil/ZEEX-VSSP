const Alert = require('../models/Alert');
const { logAudit } = require('../utils/auditLogger');
const notificationService = require('./notificationService');
const notificationDispatcher = require('./notificationDispatcher');

// Formally approved SLA matrix (in minutes)
const SLA_MATRIX = {
  CRITICAL: { L2: 5, L3: 15 },
  HIGH: { L2: 15, L3: 30 },
  MEDIUM: { L2: 30, L3: 60 },
  LOW: { L2: 60, L3: null },
};

/**
 * Calculates whether an alert has crossed L2 or L3 SLA milestones
 * @param {Object} alert - Alert document or object
 * @param {Date} [now=new Date()] - Evaluation timestamp
 * @returns {number} Target escalation level (1, 2, or 3)
 */
const evaluateAlertMilestone = (alert, now = new Date()) => {
  if (!alert || alert.status !== 'PENDING') {
    return alert?.escalationLevel || 1;
  }

  const detectedAt = new Date(alert.detectedAt);
  const elapsedMs = now.getTime() - detectedAt.getTime();
  const elapsedMinutes = elapsedMs / (60 * 1000);

  const thresholds = SLA_MATRIX[alert.severity];
  if (!thresholds) return 1;

  // Level 3 check
  if (thresholds.L3 !== null && elapsedMinutes >= thresholds.L3) {
    return 3;
  }

  // Level 2 check
  if (thresholds.L2 !== null && elapsedMinutes >= thresholds.L2) {
    return 2;
  }

  return 1;
};

/**
 * Executes escalation transition for a single alert from current level to target level
 * Handles downtime catch-up: if targetLevel is 3 and current is 1, steps through 2 then 3
 */
const escalateAlert = async (alertId, targetLevel, now = new Date()) => {
  const alert = await Alert.findById(alertId);
  if (!alert || alert.status !== 'PENDING') {
    return { escalated: false, reason: 'Alert not found or not in PENDING status' };
  }

  const currentLevel = alert.escalationLevel || 1;
  if (targetLevel <= currentLevel) {
    return { escalated: false, reason: `Target level ${targetLevel} <= current level ${currentLevel}` };
  }

  const transitions = [];
  if (currentLevel === 1 && targetLevel === 3) {
    transitions.push(2);
    transitions.push(3);
  } else {
    transitions.push(targetLevel);
  }

  let finalAlertDoc = alert;

  for (const stepLevel of transitions) {
    const fromLevel = finalAlertDoc.escalationLevel || 1;
    const historyEntry = {
      level: stepLevel,
      escalatedAt: now,
      reason: `SLA threshold exceeded for ${alert.severity} severity (elapsed time breach)`,
      previousLevel: fromLevel,
      details: {
        detectedAt: alert.detectedAt,
        escalatedAt: now,
      },
    };

    const updateFields = {
      escalationLevel: stepLevel,
    };
    if (stepLevel === 2) updateFields.escalatedAtL2 = now;
    if (stepLevel === 3) updateFields.escalatedAtL3 = now;

    // Concurrency fencing: only succeed if alert is still at fromLevel and still PENDING
    const updated = await Alert.findOneAndUpdate(
      {
        _id: alert._id,
        escalationLevel: fromLevel,
        status: 'PENDING',
      },
      {
        $set: updateFields,
        $push: { escalationHistory: historyEntry },
      },
      { new: true }
    );

    if (!updated) {
      console.warn(`[EscalationEngine] Alert ${alert._id} escalation race lost at step ${stepLevel}`);
      break;
    }

    finalAlertDoc = updated;

    // 1. Audit log the escalation milestone
    const auditAction = stepLevel === 2 ? 'ALERT_ESCALATED_L2' : 'ALERT_ESCALATED_L3';
    await logAudit({
      action: auditAction,
      entityType: 'ALERT',
      entityId: String(alert._id),
      details: {
        alertCode: alert.alertCode,
        severity: alert.severity,
        fromLevel,
        toLevel: stepLevel,
        detectedAt: alert.detectedAt,
        escalatedAt: now,
      },
    });

    // 2. Generate and dispatch escalation notifications
    try {
      const notifResult = await notificationService.generateEscalationNotifications(
        finalAlertDoc,
        stepLevel
      );

      if (notifResult.stagedNotifications && notifResult.stagedNotifications.length > 0) {
        // Post-commit dispatch asynchronously
        notificationDispatcher.dispatchBatch(notifResult.stagedNotifications).catch((err) => {
          console.error(`[EscalationEngine] Dispatch error for L${stepLevel} notifications:`, err.message);
        });
      }
    } catch (notifErr) {
      console.error(`[EscalationEngine] Notification generation failed for alert ${alert._id}:`, notifErr.message);
    }
  }

  return {
    escalated: true,
    previousLevel: currentLevel,
    currentLevel: finalAlertDoc.escalationLevel,
    alert: finalAlertDoc,
  };
};

/**
 * Evaluates all pending alerts eligible for SLA escalation
 */
const evaluatePendingAlerts = async (now = new Date()) => {
  // Candidate query using compound index { status: 1, isActive: 1, escalationLevel: 1, detectedAt: 1 }
  const pendingAlerts = await Alert.find({
    status: 'PENDING',
    isActive: true,
    escalationLevel: { $lt: 3 },
  }).sort({ detectedAt: 1 });

  let evaluatedCount = 0;
  let escalatedCount = 0;

  for (const alert of pendingAlerts) {
    evaluatedCount++;
    const targetLevel = evaluateAlertMilestone(alert, now);

    if (targetLevel > (alert.escalationLevel || 1)) {
      const result = await escalateAlert(alert._id, targetLevel, now);
      if (result.escalated) {
        escalatedCount++;
      }
    }
  }

  return { evaluatedCount, escalatedCount };
};

module.exports = {
  SLA_MATRIX,
  evaluateAlertMilestone,
  escalateAlert,
  evaluatePendingAlerts,
};

