const Alert = require('../models/Alert');
const NotificationLog = require('../models/NotificationLog');
const User = require('../models/User');
const escalationEngine = require('./escalationEngine');
const notificationService = require('./notificationService');
const notificationDispatcher = require('./notificationDispatcher');
const evidenceRecoveryService = require('./evidenceRecoveryService');

let coreIntervalHandle = null;
let evidenceIntervalHandle = null;
let isCoreRunning = false;
let isEvidenceRunning = false;

/**
 * Reconciles missing initial Level 1 notifications for any pending alerts
 */
const reconcileMissingNotifications = async () => {
  const pendingAlerts = await Alert.find({ status: 'PENDING', isActive: true }).select(
    '_id alertCode severity violationType violationName location detectedAt workFront'
  );

  let reconciledCount = 0;

  for (const alert of pendingAlerts) {
    const existingCount = await NotificationLog.countDocuments({
      alert: alert._id,
      escalationLevel: 1,
    });

    if (existingCount === 0) {
      const result = await notificationService.generateInitialAlertNotifications(alert);
      if (result.stagedNotifications && result.stagedNotifications.length > 0) {
        notificationDispatcher.dispatchBatch(result.stagedNotifications).catch((err) => {
          console.error('[Scheduler] Reconciliation dispatch error:', err.message);
        });
        reconciledCount++;
      }
    }
  }

  return reconciledCount;
};

/**
 * One-time startup recovery routine executed on application boot
 */
const runStartupRecovery = async () => {
  console.log('[Scheduler] Executing on-boot startup recovery sequence...');
  try {
    // 1. Evidence recovery check
    const evResult = await evidenceRecoveryService.sweepEvidenceRecovery();
    console.log('[Scheduler] Startup evidence recovery:', evResult);

    // 2. Missing Level 1 notifications reconciliation
    const notifReconciled = await reconcileMissingNotifications();
    console.log('[Scheduler] Startup notifications reconciled:', notifReconciled);

    // 3. Offline missed milestones catch-up
    const slaResult = await escalationEngine.evaluatePendingAlerts();
    console.log('[Scheduler] Startup SLA offline catch-up:', slaResult);

    // 4. Expired retry lease reclamation
    const retryResult = await notificationDispatcher.processRetryQueue();
    console.log('[Scheduler] Startup retry queue reclamation:', retryResult);

    console.log('[Scheduler] On-boot startup recovery sequence completed successfully.');
  } catch (err) {
    console.error('[Scheduler] Error in startup recovery sequence:', err.message);
  }
};

/**
 * 30-Second recurring core cycle
 */
const runCoreCycle = async () => {
  if (isCoreRunning) return;
  isCoreRunning = true;

  try {
    // 1. Evaluate SLA milestones
    await escalationEngine.evaluatePendingAlerts();

    // 2. Process notification retry queue and expired leases
    await notificationDispatcher.processRetryQueue();

    // 3. Reconcile missing notifications
    await reconcileMissingNotifications();
  } catch (err) {
    console.error('[Scheduler] Error in 30s core cycle:', err.message);
  } finally {
    isCoreRunning = false;
  }
};

/**
 * 5-Minute recurring evidence recovery sweep (throttled to avoid cloud rate limits)
 */
const runEvidenceCycle = async () => {
  if (isEvidenceRunning) return;
  isEvidenceRunning = true;

  try {
    await evidenceRecoveryService.sweepEvidenceRecovery();
  } catch (err) {
    console.error('[Scheduler] Error in 5m evidence recovery sweep:', err.message);
  } finally {
    isEvidenceRunning = false;
  }
};

/**
 * Starts the background escalation and notification scheduler
 */
const start = async () => {
  if (coreIntervalHandle) return;

  // Run initial startup recovery
  await runStartupRecovery();

  // 30-second core recurring cycle
  coreIntervalHandle = setInterval(runCoreCycle, 30 * 1000);

  // 5-minute evidence recovery sweep
  evidenceIntervalHandle = setInterval(runEvidenceCycle, 5 * 60 * 1000);

  console.log('[Scheduler] Escalation & Notification scheduler started (30s core, 5m evidence sweep).');
};

/**
 * Stops the background scheduler cleanly (e.g. for testing or graceful shutdown)
 */
const stop = () => {
  if (coreIntervalHandle) {
    clearInterval(coreIntervalHandle);
    coreIntervalHandle = null;
  }
  if (evidenceIntervalHandle) {
    clearInterval(evidenceIntervalHandle);
    evidenceIntervalHandle = null;
  }
  console.log('[Scheduler] Escalation & Notification scheduler stopped.');
};

module.exports = {
  start,
  stop,
  runStartupRecovery,
  runCoreCycle,
  runEvidenceCycle,
  reconcileMissingNotifications,
};

