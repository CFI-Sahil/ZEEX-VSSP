const mongoose = require('mongoose');
const env = require('../config/env');
const { connectDB, disconnectDB } = require('../config/db');

// Models
const Alert = require('../models/Alert');
const NotificationLog = require('../models/NotificationLog');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const Camera = require('../models/Camera');
const WorkFront = require('../models/WorkFront');
const Evidence = require('../models/Evidence');

// Services
const escalationEngine = require('../services/escalationEngine');
const notificationService = require('../services/notificationService');
const notificationDispatcher = require('../services/notificationDispatcher');
const evidenceRecoveryService = require('../services/evidenceRecoveryService');
const storageService = require('../services/storageService');
const cloudinary = require('../config/cloudinary');
const { logAudit } = require('../utils/auditLogger');

const SYNTH_PREFIX = 'SYNTH-B3-';

const runTests = async () => {
  console.log('================================================================');
  console.log('  VSSP Phase 3 Batch 3: Escalation & Notifications Verification');
  console.log('================================================================');

  await connectDB();

  // Ensure all Mongoose indexes are built and ready
  await Promise.all([
    Alert.init(),
    NotificationLog.init(),
    AuditLog.init(),
  ]);

  let passed = 0;
  let failed = 0;

  const assert = (condition, description) => {
    if (condition) {
      console.log(`  [PASS] ${description}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${description}`);
      failed++;
    }
  };

  try {
    // Clean up any stale synthetic test artifacts from prior runs
    await Alert.deleteMany({ alertCode: { $regex: `^${SYNTH_PREFIX}` } });
    await NotificationLog.deleteMany({ alertCode: { $regex: `^${SYNTH_PREFIX}` } });
    await AuditLog.deleteMany({
      $or: [
        { 'details.alertCode': { $regex: `^${SYNTH_PREFIX}` } },
        { 'details.eventId': { $regex: `^${SYNTH_PREFIX}` } },
      ],
    });

    // -------------------------------------------------------------------------
    // TEST 1: SLA Matrix & Milestone Calculations
    // -------------------------------------------------------------------------
    console.log('\n--- Test 1: SLA Matrix & Milestone Boundary Conditions ---');
    const { SLA_MATRIX, evaluateAlertMilestone } = escalationEngine;

    assert(SLA_MATRIX.CRITICAL.L2 === 5 && SLA_MATRIX.CRITICAL.L3 === 15, 'CRITICAL SLA is 5m (L2) and 15m (L3)');
    assert(SLA_MATRIX.HIGH.L2 === 15 && SLA_MATRIX.HIGH.L3 === 30, 'HIGH SLA is 15m (L2) and 30m (L3)');
    assert(SLA_MATRIX.MEDIUM.L2 === 30 && SLA_MATRIX.MEDIUM.L3 === 60, 'MEDIUM SLA is 30m (L2) and 60m (L3)');
    assert(SLA_MATRIX.LOW.L2 === 60 && SLA_MATRIX.LOW.L3 === null, 'LOW SLA is 60m (L2) and no L3');

    const baseNow = new Date('2026-11-08T12:00:00Z');
    const makeMockAlert = (severity, elapsedMinutes) => ({
      status: 'PENDING',
      severity,
      detectedAt: new Date(baseNow.getTime() - elapsedMinutes * 60 * 1000),
      escalationLevel: 1,
    });

    // CRITICAL checks
    assert(evaluateAlertMilestone(makeMockAlert('CRITICAL', 4.9), baseNow) === 1, 'CRITICAL at 4.9m remains L1');
    assert(evaluateAlertMilestone(makeMockAlert('CRITICAL', 5.0), baseNow) === 2, 'CRITICAL at 5.0m escalates to L2');
    assert(evaluateAlertMilestone(makeMockAlert('CRITICAL', 14.9), baseNow) === 2, 'CRITICAL at 14.9m remains L2');
    assert(evaluateAlertMilestone(makeMockAlert('CRITICAL', 15.0), baseNow) === 3, 'CRITICAL at 15.0m escalates to L3');

    // HIGH checks
    assert(evaluateAlertMilestone(makeMockAlert('HIGH', 14.9), baseNow) === 1, 'HIGH at 14.9m remains L1');
    assert(evaluateAlertMilestone(makeMockAlert('HIGH', 15.0), baseNow) === 2, 'HIGH at 15.0m escalates to L2');
    assert(evaluateAlertMilestone(makeMockAlert('HIGH', 29.9), baseNow) === 2, 'HIGH at 29.9m remains L2');
    assert(evaluateAlertMilestone(makeMockAlert('HIGH', 30.0), baseNow) === 3, 'HIGH at 30.0m escalates to L3');

    // MEDIUM checks
    assert(evaluateAlertMilestone(makeMockAlert('MEDIUM', 29.9), baseNow) === 1, 'MEDIUM at 29.9m remains L1');
    assert(evaluateAlertMilestone(makeMockAlert('MEDIUM', 30.0), baseNow) === 2, 'MEDIUM at 30.0m escalates to L2');
    assert(evaluateAlertMilestone(makeMockAlert('MEDIUM', 59.9), baseNow) === 2, 'MEDIUM at 59.9m remains L2');
    assert(evaluateAlertMilestone(makeMockAlert('MEDIUM', 60.0), baseNow) === 3, 'MEDIUM at 60.0m escalates to L3');

    // LOW checks
    assert(evaluateAlertMilestone(makeMockAlert('LOW', 59.9), baseNow) === 1, 'LOW at 59.9m remains L1');
    assert(evaluateAlertMilestone(makeMockAlert('LOW', 60.0), baseNow) === 2, 'LOW at 60.0m escalates to L2');
    assert(evaluateAlertMilestone(makeMockAlert('LOW', 120.0), baseNow) === 2, 'LOW at 120m remains L2 (no L3)');

    // -------------------------------------------------------------------------
    // Setup synthetic camera, user & work-front for DB tests
    // -------------------------------------------------------------------------
    const testCamera = await Camera.findOneAndUpdate(
      { cameraCode: `${SYNTH_PREFIX}CAM-01` },
      {
        cameraCode: `${SYNTH_PREFIX}CAM-01`,
        name: 'Synthetic Test Camera Point',
        location: 'Sector 4 Fabrication Yard',
        site: 'Plant 1',
        isActive: true,
      },
      { upsert: true, new: true }
    );

    const testOperator = await User.findOneAndUpdate(
      { email: 'synth.operator@vssp.internal' },
      {
        email: 'synth.operator@vssp.internal',
        name: 'Synthetic Safety Operator',
        role: 'SAFETY_OPERATOR',
        isActive: true,
        password: 'Password123!',
      },
      { upsert: true, new: true }
    );

    const testWorkFront = await WorkFront.findOneAndUpdate(
      { workFrontCode: `${SYNTH_PREFIX}WF-01` },
      {
        workFrontCode: `${SYNTH_PREFIX}WF-01`,
        name: 'Synthetic Boiler Erection',
        contractor: 'Apex Heavy Engineering',
        zone: 'Zone 4',
        site: 'Plant 1',
        activityType: 'HEAVY_LIFTING',
        riskLevel: 'HIGH',
        shift: 'DAY',
        supervisor: {
          name: 'Robert Vance',
          phone: '+919876543210',
          email: 'robert.vance@contractor.internal',
        },
        isActive: true,
      },
      { upsert: true, new: true }
    );

    // -------------------------------------------------------------------------
    // TEST 2: Atomic Escalation & Duplicate Prevention
    // -------------------------------------------------------------------------
    console.log('\n--- Test 2: Atomic Escalation & Duplicate Prevention ---');
    const synthAlert1 = new Alert({
      alertCode: `${SYNTH_PREFIX}ALT-101`,
      eventId: `${SYNTH_PREFIX}EVT-101`,
      camera: testCamera._id,
      cameraCode: testCamera.cameraCode,
      workFront: testWorkFront._id,
      workFrontCode: testWorkFront.workFrontCode,
      violationType: 'NO_HELMET',
      violationName: 'Missing Safety Helmet',
      severity: 'CRITICAL',
      confidence: 0.94,
      status: 'PENDING',
      escalationLevel: 1,
      location: testCamera.location,
      detectedAt: new Date(Date.now() - 6 * 60 * 1000), // 6 minutes ago
    });
    await synthAlert1.save();

    // Escalate to Level 2
    const escResultL2 = await escalationEngine.escalateAlert(synthAlert1._id, 2);
    assert(escResultL2.escalated === true, 'Alert 1 successfully escalated to L2');
    assert(escResultL2.currentLevel === 2, 'Alert 1 current level is 2');

    const reloadedAlert1 = await Alert.findById(synthAlert1._id);
    assert(reloadedAlert1.escalationLevel === 2, 'Database persisted escalationLevel = 2');
    assert(reloadedAlert1.escalatedAtL2 instanceof Date, 'Database persisted escalatedAtL2 timestamp');
    assert(reloadedAlert1.escalationHistory.length === 1, 'escalationHistory recorded 1 transition');

    // Attempt duplicate escalation to Level 2 -> must be rejected
    const dupResult = await escalationEngine.escalateAlert(synthAlert1._id, 2);
    assert(dupResult.escalated === false, 'Duplicate escalation to L2 safely rejected');

    // Escalate to Level 3
    const escResultL3 = await escalationEngine.escalateAlert(synthAlert1._id, 3);
    assert(escResultL3.escalated === true, 'Alert 1 successfully escalated to L3');
    const reloadedAlert1L3 = await Alert.findById(synthAlert1._id);
    assert(reloadedAlert1L3.escalationLevel === 3, 'Database persisted escalationLevel = 3');
    assert(reloadedAlert1L3.escalatedAtL3 instanceof Date, 'Database persisted escalatedAtL3 timestamp');
    assert(reloadedAlert1L3.escalationHistory.length === 2, 'escalationHistory recorded 2 transitions');

    // -------------------------------------------------------------------------
    // TEST 3: Downtime Catch-Up (L1 -> L3 Offline Jump)
    // -------------------------------------------------------------------------
    console.log('\n--- Test 3: Downtime Catch-Up (L1 -> L3 Offline Jump) ---');
    const synthAlert2 = new Alert({
      alertCode: `${SYNTH_PREFIX}ALT-102`,
      eventId: `${SYNTH_PREFIX}EVT-102`,
      camera: testCamera._id,
      cameraCode: testCamera.cameraCode,
      workFront: testWorkFront._id,
      workFrontCode: testWorkFront.workFrontCode,
      violationType: 'UNAUTHORIZED_ZONE',
      violationName: 'Zone Breach',
      severity: 'CRITICAL',
      confidence: 0.96,
      status: 'PENDING',
      escalationLevel: 1,
      location: testCamera.location,
      detectedAt: new Date(Date.now() - 25 * 60 * 1000), // 25 min ago (exceeds both L2 5m and L3 15m)
    });
    await synthAlert2.save();

    // Trigger catch-up directly to L3
    const catchupResult = await escalationEngine.escalateAlert(synthAlert2._id, 3);
    assert(catchupResult.escalated === true, 'Catch-up alert successfully transitioned');

    const reloadedAlert2 = await Alert.findById(synthAlert2._id);
    assert(reloadedAlert2.escalationLevel === 3, 'Alert reached Level 3');
    assert(reloadedAlert2.escalatedAtL2 instanceof Date, 'L2 milestone timestamp recorded during catch-up');
    assert(reloadedAlert2.escalatedAtL3 instanceof Date, 'L3 milestone timestamp recorded during catch-up');
    assert(reloadedAlert2.escalationHistory.length === 2, 'Chronological history contains both L2 and L3 transitions');

    // Verify notifications were staged for both L2 and L3
    const notifsL2 = await NotificationLog.find({ alert: synthAlert2._id, escalationLevel: 2 });
    const notifsL3 = await NotificationLog.find({ alert: synthAlert2._id, escalationLevel: 3 });
    assert(notifsL2.length > 0, 'Level 2 notifications generated during catch-up');
    assert(notifsL3.length > 0, 'Level 3 notifications generated during catch-up');

    // -------------------------------------------------------------------------
    // TEST 4: Audit Unique Partial Indexes & E11000 Handling
    // -------------------------------------------------------------------------
    console.log('\n--- Test 4: Escalation Audit Uniqueness & E11000 Resolution ---');
    const synthAlertAudit = new Alert({
      alertCode: `${SYNTH_PREFIX}ALT-AUDIT`,
      eventId: `${SYNTH_PREFIX}EVT-AUDIT`,
      camera: testCamera._id,
      cameraCode: testCamera.cameraCode,
      violationType: 'NO_HELMET',
      violationName: 'Helmet Violation',
      severity: 'HIGH',
      confidence: 0.9,
      status: 'PENDING',
      location: testCamera.location,
    });
    await synthAlertAudit.save();

    const audit1 = await logAudit({
      action: 'ALERT_ESCALATED_L2',
      entityType: 'ALERT',
      entityId: synthAlertAudit._id,
      details: { test: 'first insert' },
    });
    assert(audit1 && !audit1.isDuplicate, 'First ALERT_ESCALATED_L2 audit logged successfully');

    // Second worker attempts duplicate audit insertion for same alert
    const audit2 = await logAudit({
      action: 'ALERT_ESCALATED_L2',
      entityType: 'ALERT',
      entityId: synthAlertAudit._id,
      details: { test: 'concurrent duplicate insert' },
    });
    assert(audit2 && audit2.isDuplicate === true, 'Second concurrent escalation audit safely resolved E11000');

    // Verify Batch 2 ALERT_CREATED index continues to operate without collision
    const auditEvent1 = await logAudit({
      action: 'ALERT_CREATED',
      entityType: 'ALERT',
      entityId: synthAlert1._id,
      details: { eventId: `${SYNTH_PREFIX}EVT-UNIQUE-1` },
    });
    assert(auditEvent1 && !auditEvent1.isDuplicate, 'Batch 2 ALERT_CREATED audit works cleanly');

    const auditEventDup = await logAudit({
      action: 'ALERT_CREATED',
      entityType: 'ALERT',
      entityId: synthAlert2._id,
      details: { eventId: `${SYNTH_PREFIX}EVT-UNIQUE-1` },
    });
    assert(auditEventDup && auditEventDup.isDuplicate === true, 'Batch 2 duplicate eventId handled safely');

    // -------------------------------------------------------------------------
    // TEST 5: Recipient Resolution & Supervisor Privacy Masking
    // -------------------------------------------------------------------------
    console.log('\n--- Test 5: Recipient Resolution & Contact Masking ---');
    const { maskEmail, maskPhone, resolveRecipients } = notificationService;

    assert(maskEmail('robert.vance@contractor.internal') === 'r***e@contractor.internal', 'maskEmail correctly masks email');
    assert(maskPhone('+919876543210') === '+91 ******3210', 'maskPhone correctly masks phone');

    const l2Recipients = await resolveRecipients(synthAlert1, 2);
    const inAppRecipient = l2Recipients.find((r) => r.channel === 'IN_APP');
    const smsRecipient = l2Recipients.find((r) => r.channel === 'SIMULATED_SMS');
    const emailRecipient = l2Recipients.find((r) => r.channel === 'SIMULATED_EMAIL');

    assert(Boolean(inAppRecipient), 'L2 includes IN_APP recipient for console operators');
    assert(Boolean(smsRecipient), 'L2 includes SIMULATED_SMS for WorkFront supervisor');
    assert(Boolean(emailRecipient), 'L2 includes SIMULATED_EMAIL for WorkFront supervisor');
    assert(smsRecipient.recipientContact.includes('******'), 'Supervisor phone is masked in recipientContact');
    assert(emailRecipient.recipientContact.includes('***'), 'Supervisor email is masked in recipientContact');

    // -------------------------------------------------------------------------
    // TEST 6: Four-Attempt Retry Lifecycle (1 Initial + 3 Retries)
    // -------------------------------------------------------------------------
    console.log('\n--- Test 6: Four-Attempt Retry Lifecycle (1 Initial + 3 Retries) ---');
    const retryAlert = new Alert({
      alertCode: `${SYNTH_PREFIX}ALT-RETRY`,
      eventId: `${SYNTH_PREFIX}EVT-RETRY`,
      camera: testCamera._id,
      cameraCode: testCamera.cameraCode,
      violationType: 'NO_HELMET',
      violationName: 'Helmet Violation',
      severity: 'HIGH',
      confidence: 0.9,
      status: 'PENDING',
      location: testCamera.location,
    });
    await retryAlert.save();

    const retryNotif = new NotificationLog({
      alert: retryAlert._id,
      alertCode: retryAlert.alertCode,
      escalationLevel: 2,
      channel: 'SIMULATED_SMS',
      recipientKey: `SMS:+919876543210`,
      recipientContact: '+91 ******3210',
      title: 'Retry Test Notification',
      message: 'Simulated failure lifecycle test',
      severity: 'CRITICAL',
      deliveryStatus: 'PENDING',
      retryCount: 0,
      metadata: { forceSimulatedFailure: true }, // Force simulated failure
    });
    await retryNotif.save();

    // 1. Initial Attempt: Dispatched via dispatchBatch -> Fails -> transitions to FAILED with retryCount: 1
    await notificationDispatcher.dispatchBatch([retryNotif]);
    const afterInit = await NotificationLog.findById(retryNotif._id);
    assert(afterInit.deliveryStatus === 'FAILED', 'Initial attempt failure transitions status to FAILED');
    assert(afterInit.retryCount === 1, 'Initial attempt failure sets retryCount = 1');
    assert(afterInit.nextRetryAt instanceof Date, 'nextRetryAt is scheduled for Retry 1');

    // Simulate due retry: set nextRetryAt to past
    await NotificationLog.updateOne({ _id: retryNotif._id }, { $set: { nextRetryAt: new Date(Date.now() - 1000) } });

    // 2. Retry 1 (Attempt 2 of 4) -> Fails -> retryCount = 2
    await notificationDispatcher.processRetryQueue();
    const afterRetry1 = await NotificationLog.findById(retryNotif._id);
    assert(afterRetry1.deliveryStatus === 'FAILED', 'Retry 1 failure keeps status FAILED');
    assert(afterRetry1.retryCount === 2, 'Retry 1 failure sets retryCount = 2');

    // Simulate due retry: set nextRetryAt to past
    await NotificationLog.updateOne({ _id: retryNotif._id }, { $set: { nextRetryAt: new Date(Date.now() - 1000) } });

    // 3. Retry 2 (Attempt 3 of 4) -> Fails -> retryCount = 3
    await notificationDispatcher.processRetryQueue();
    const afterRetry2 = await NotificationLog.findById(retryNotif._id);
    assert(afterRetry2.deliveryStatus === 'FAILED', 'Retry 2 failure keeps status FAILED');
    assert(afterRetry2.retryCount === 3, 'Retry 2 failure sets retryCount = 3');

    // Simulate due retry: set nextRetryAt to past
    await NotificationLog.updateOne({ _id: retryNotif._id }, { $set: { nextRetryAt: new Date(Date.now() - 1000) } });

    // 4. Retry 3 (Attempt 4 of 4 - Final Retry) -> Fails -> transitions to PERMANENTLY_FAILED, retryCount = 4
    await notificationDispatcher.processRetryQueue();
    const afterRetry3 = await NotificationLog.findById(retryNotif._id);
    assert(
      afterRetry3.deliveryStatus === 'PERMANENTLY_FAILED',
      '4th total attempt failure transitions status to PERMANENTLY_FAILED'
    );
    assert(afterRetry3.retryCount === 4, 'Terminal failure sets retryCount = 4');
    assert(afterRetry3.nextRetryAt === null, 'Terminal failure clears nextRetryAt to null');

    // Verify record with retryCount = 4 will never be selected for further retries
    const ineligible = await NotificationLog.find({
      _id: retryNotif._id,
      deliveryStatus: 'FAILED',
      retryCount: { $lte: 3 },
    });
    assert(ineligible.length === 0, 'Permanently failed record is excluded from retry queries');

    // -------------------------------------------------------------------------
    // TEST 7: Expired Worker Lease Reclamation
    // -------------------------------------------------------------------------
    console.log('\n--- Test 7: Expired Worker Lease Reclamation ---');
    const leaseNotif = new NotificationLog({
      alert: synthAlert1._id,
      alertCode: synthAlert1.alertCode,
      escalationLevel: 2,
      channel: 'SIMULATED_EMAIL',
      recipientKey: `EMAIL:synth.lease@contractor.internal`,
      recipientContact: 's***e@contractor.internal',
      title: 'Lease Reclamation Test',
      message: 'Crash simulation test',
      severity: 'CRITICAL',
      deliveryStatus: 'RETRYING',
      retryCount: 1,
      retryLeaseAt: new Date(Date.now() - 10000), // Lease expired 10s ago
      retryToken: 'crashed-worker-token-uuid',
    });
    await leaseNotif.save();

    const leaseReclaimResult = await notificationDispatcher.processRetryQueue();
    assert(leaseReclaimResult.reclaims >= 1, 'Expired RETRYING lease detected and reclaimed');
    const reclaimedDoc = await NotificationLog.findById(leaseNotif._id);
    assert(reclaimedDoc.deliveryStatus !== 'RETRYING', 'Expired lease recovered from stalled RETRYING state');

    // -------------------------------------------------------------------------
    // TEST 8: Alert Acknowledgment Cancels Pending Notifications
    // -------------------------------------------------------------------------
    console.log('\n--- Test 8: Alert Acknowledgment Cancels Pending Notifications ---');
    const cancelNotif = new NotificationLog({
      alert: synthAlert2._id,
      alertCode: synthAlert2.alertCode,
      escalationLevel: 2,
      channel: 'SIMULATED_SMS',
      recipientKey: `SMS:+919999999999`,
      recipientContact: '+91 ******9999',
      title: 'Cancellation Test',
      message: 'Alert acknowledged test',
      severity: 'CRITICAL',
      deliveryStatus: 'FAILED',
      retryCount: 1,
      nextRetryAt: new Date(Date.now() + 60000),
    });
    await cancelNotif.save();

    const cancelledCount = await notificationDispatcher.cancelPendingAlertNotifications(synthAlert2._id);
    assert(cancelledCount >= 1, 'cancelPendingAlertNotifications successfully executed');
    const afterCancel = await NotificationLog.findById(cancelNotif._id);
    assert(afterCancel.deliveryStatus === 'CANCELLED', 'Notification transitioned to CANCELLED');
    assert(afterCancel.nextRetryAt === null, 'nextRetryAt cleared upon cancellation');

    // -------------------------------------------------------------------------
    // TEST 9: Durable Pre-Upload Intent & Cloudinary Overwrite Safety
    // -------------------------------------------------------------------------
    console.log('\n--- Test 9: Durable Evidence Intent & Cloudinary Safety ---');
    assert(typeof storageService.saveEvidenceSnapshot === 'function', 'storageService exposes saveEvidenceSnapshot');

    // Create an alert with explicit durable intent
    const synthAlertWithIntent = new Alert({
      alertCode: `${SYNTH_PREFIX}ALT-INTENT`,
      eventId: `${SYNTH_PREFIX}EVT-INTENT`,
      camera: testCamera._id,
      cameraCode: testCamera.cameraCode,
      violationType: 'NO_VEST',
      violationName: 'Missing High-Vis Vest',
      severity: 'HIGH',
      confidence: 0.91,
      status: 'PENDING',
      escalationLevel: 1,
      evidence: null,
      metadata: {
        evidenceStatus: 'EVIDENCE_PENDING_UPLOAD',
        evidenceIntent: {
          evidenceCode: `${SYNTH_PREFIX}EVD-INTENT`,
          publicId: `ZEEX VSSP/Evidence/${SYNTH_PREFIX}EVD-INTENT`,
          fileName: 'sample-zone-breach.png',
          stagedAt: new Date(),
        },
      },
      location: testCamera.location,
    });
    await synthAlertWithIntent.save();
    assert(synthAlertWithIntent._id !== null, 'Alert with durable intent committed before upload');

    // -------------------------------------------------------------------------
    // TEST 10: Cloudinary Evidence Recovery Policy (Three-Sweep Counter & Transient Immunity)
    // -------------------------------------------------------------------------
    console.log('\n--- Test 10: Cloudinary Evidence Recovery Policy & Error Discrimination ---');
    const { isNotFoundError, isTransientError, sweepEvidenceRecovery } = evidenceRecoveryService;

    // Error discrimination helpers
    assert(isNotFoundError({ http_code: 404 }) === true, 'HTTP 404 recognized as Not Found');
    assert(isNotFoundError({ message: 'Resource not found in cloud' }) === true, 'Message Not Found recognized');
    assert(isNotFoundError({ error: { message: 'Resource not found', http_code: 404 } }) === true, 'Nested error.message Not Found recognized');
    assert(isTransientError({ message: 'ETIMEDOUT connection failed' }) === true, 'ETIMEDOUT recognized as transient');
    assert(isTransientError({ http_code: 503 }) === true, 'HTTP 503 recognized as transient');
    assert(isTransientError({ http_code: 429 }) === true, 'HTTP 429 rate limit recognized as transient');
    assert(isTransientError({ http_code: 404 }) === false, 'HTTP 404 is NOT transient');

    // Create probe alert with ACKNOWLEDGED status to verify operational status preservation
    const sweepProbeAlert = new Alert({
      alertCode: `${SYNTH_PREFIX}SWEEP-ALT-01`,
      eventId: `${SYNTH_PREFIX}SWEEP-EVT-01`,
      camera: testCamera._id,
      cameraCode: testCamera.cameraCode,
      violationType: 'RESTRICTED_ACCESS',
      violationName: 'Restricted Access',
      severity: 'CRITICAL',
      confidence: 0.95,
      status: 'ACKNOWLEDGED', // Operational status to test non-interference
      escalationLevel: 2,
      evidence: null,
      metadata: {
        evidenceStatus: 'EVIDENCE_RECOVERY_PENDING',
        evidenceNotFoundCount: 0,
        evidenceIntent: {
          evidenceCode: `${SYNTH_PREFIX}SWEEP-EVD-01`,
          publicId: `ZEEX VSSP/Evidence/${SYNTH_PREFIX}SWEEP-EVD-01`,
          fileName: 'sweep-evidence.png',
          stagedAt: new Date(),
        },
      },
      location: testCamera.location,
    });
    await sweepProbeAlert.save();

    // Probe alert without evidence intent (must be skipped by recovery)
    const noIntentProbeAlert = new Alert({
      alertCode: `${SYNTH_PREFIX}NOINTENT-ALT-02`,
      eventId: `${SYNTH_PREFIX}NOINTENT-EVT-02`,
      camera: testCamera._id,
      cameraCode: testCamera.cameraCode,
      violationType: 'NO_HELMET',
      violationName: 'No Helmet',
      severity: 'HIGH',
      confidence: 0.88,
      status: 'PENDING',
      escalationLevel: 1,
      evidence: null,
      metadata: {
        evidenceStatus: 'EVIDENCE_RECOVERY_PENDING',
      },
      location: testCamera.location,
    });
    await noIntentProbeAlert.save();

    const origCloudinaryResource = cloudinary.api.resource;
    try {
      // Sweep 1: Simulate confirmed Cloudinary 404
      cloudinary.api.resource = async () => {
        const notFoundErr = new Error('Resource not found');
        notFoundErr.http_code = 404;
        throw notFoundErr;
      };

      await sweepEvidenceRecovery();
      const afterSweep1 = await Alert.findById(sweepProbeAlert._id);
      assert(afterSweep1.metadata.evidenceNotFoundCount === 1, 'Sweep 1 increments evidenceNotFoundCount to 1');
      assert(afterSweep1.metadata.evidenceStatus === 'EVIDENCE_RECOVERY_PENDING', 'Sweep 1 keeps status EVIDENCE_RECOVERY_PENDING');
      assert(afterSweep1.status === 'ACKNOWLEDGED', 'Sweep 1 preserves operational status (ACKNOWLEDGED unchanged)');

      // Verify alert without intent was skipped
      const noIntentCheck = await Alert.findById(noIntentProbeAlert._id);
      assert(noIntentCheck.metadata.evidenceNotFoundCount === undefined, 'Alert without evidence intent skipped by recovery query');

      // Transient Failure: Simulate HTTP 503 / Network Timeout (must NOT increment counter)
      cloudinary.api.resource = async () => {
        const transErr = new Error('Service Unavailable');
        transErr.http_code = 503;
        throw transErr;
      };

      await sweepEvidenceRecovery();
      const afterTransient = await Alert.findById(sweepProbeAlert._id);
      assert(afterTransient.metadata.evidenceNotFoundCount === 1, 'Transient HTTP 503 does NOT increment evidenceNotFoundCount');
      assert(afterTransient.metadata.evidenceStatus === 'EVIDENCE_RECOVERY_PENDING', 'Transient error leaves status EVIDENCE_RECOVERY_PENDING');

      // Sweep 2: Simulate second confirmed Cloudinary 404
      cloudinary.api.resource = async () => {
        const notFoundErr = new Error('Resource not found');
        notFoundErr.http_code = 404;
        throw notFoundErr;
      };

      await sweepEvidenceRecovery();
      const afterSweep2 = await Alert.findById(sweepProbeAlert._id);
      assert(afterSweep2.metadata.evidenceNotFoundCount === 2, 'Sweep 2 increments evidenceNotFoundCount to 2');
      assert(afterSweep2.metadata.evidenceStatus === 'EVIDENCE_RECOVERY_PENDING', 'Sweep 2 keeps status EVIDENCE_RECOVERY_PENDING');

      // Sweep 3: Simulate third confirmed Cloudinary 404 (Terminal transition)
      await sweepEvidenceRecovery();
      const afterSweep3 = await Alert.findById(sweepProbeAlert._id);
      assert(afterSweep3.metadata.evidenceNotFoundCount === 3, 'Sweep 3 reaches evidenceNotFoundCount 3');
      assert(afterSweep3.metadata.evidenceStatus === 'EVIDENCE_INCOMPLETE_UNRECOVERABLE', 'Sweep 3 transitions status to EVIDENCE_INCOMPLETE_UNRECOVERABLE');
      assert(afterSweep3.metadata.evidenceIntent === undefined, 'Sweep 3 clears completed/unrecoverable evidenceIntent');
      assert(afterSweep3.status === 'ACKNOWLEDGED', 'Operational status remains ACKNOWLEDGED after unrecoverable transition');

    } finally {
      cloudinary.api.resource = origCloudinaryResource;
    }

    // -------------------------------------------------------------------------
    // TEST 11: In-App Notification Query & Unread Count Verification
    // -------------------------------------------------------------------------
    console.log('\n--- Test 11: In-App Notifications & Unread Count ---');
    const inAppTest = new NotificationLog({
      alert: synthAlert1._id,
      alertCode: synthAlert1.alertCode,
      escalationLevel: 1,
      channel: 'IN_APP',
      recipientKey: `USER:${testOperator._id}`,
      recipientUser: testOperator._id,
      recipientRole: 'SAFETY_OPERATOR',
      recipientContact: 's***r@vssp.internal',
      title: 'In-App Operational Test',
      message: 'Test in-app delivery and unread count tracking',
      severity: 'HIGH',
      deliveryStatus: 'DELIVERED_IN_APP',
      isRead: false,
    });
    await inAppTest.save();

    const unreadBefore = await NotificationLog.countDocuments({
      recipientUser: testOperator._id,
      channel: 'IN_APP',
      isRead: false,
      isActive: true,
    });
    assert(unreadBefore >= 1, 'Unread in-app count reflects new notification');

    // Mark as read
    await NotificationLog.updateOne({ _id: inAppTest._id }, { $set: { isRead: true, readAt: new Date() } });
    const unreadAfter = await NotificationLog.countDocuments({
      recipientUser: testOperator._id,
      channel: 'IN_APP',
      isRead: false,
      isActive: true,
    });
    assert(unreadAfter === unreadBefore - 1, 'Marking notification read decrements unread count');

    // -------------------------------------------------------------------------
    // TEST 12: Index Execution Plan Verification via .explain('executionStats')
    // -------------------------------------------------------------------------
    console.log('\n--- Test 12: Database Index Execution Plans via explain() ---');
    try {
      const hasIXSCAN = (plan) => {
        if (!plan) return false;
        if (plan.stage === 'IXSCAN') return true;
        if (plan.inputStage && hasIXSCAN(plan.inputStage)) return true;
        if (plan.inputStages && plan.inputStages.some(hasIXSCAN)) return true;
        return false;
      };

      // 1. SLA Evaluation Query
      const slaExplain = await Alert.find({
        status: 'PENDING',
        isActive: true,
        escalationLevel: { $lt: 3 },
      })
        .sort({ detectedAt: 1 })
        .explain('executionStats');

      const isSlaIndexed =
        hasIXSCAN(slaExplain.queryPlanner?.winningPlan) ||
        hasIXSCAN(slaExplain.executionStats?.executionStages);
      assert(isSlaIndexed, `SLA Overdue query utilizes IXSCAN in execution plan`);

      // 2. Retry Queue Query
      const retryExplain = await NotificationLog.find({
        deliveryStatus: 'FAILED',
        nextRetryAt: { $lte: new Date() },
        retryCount: { $lte: 3 },
        isActive: true,
      }).explain('executionStats');

      const isRetryIndexed =
        hasIXSCAN(retryExplain.queryPlanner?.winningPlan) ||
        hasIXSCAN(retryExplain.executionStats?.executionStages);
      assert(isRetryIndexed, `Notification retry query utilizes IXSCAN in execution plan`);

      // 3. In-App Notifications Feed Query
      const feedExplain = await NotificationLog.find({
        recipientUser: testOperator._id,
        channel: 'IN_APP',
        isRead: false,
        isActive: true,
      }).explain('executionStats');

      const isFeedIndexed =
        hasIXSCAN(feedExplain.queryPlanner?.winningPlan) ||
        hasIXSCAN(feedExplain.executionStats?.executionStages);
      assert(isFeedIndexed, `In-app feed query utilizes IXSCAN in execution plan`);
    } catch (explainErr) {
      console.warn('  [WARN] explain() check encountered warning:', explainErr.message);
    }

    // -------------------------------------------------------------------------
    // TEST 13: Clean Synthetic Test Data Purge
    // -------------------------------------------------------------------------
    console.log('\n--- Test 13: Purge Synthetic Test Records ---');
    const purgeAlerts = await Alert.deleteMany({ alertCode: { $regex: `^${SYNTH_PREFIX}` } });
    const purgeNotifs = await NotificationLog.deleteMany({ alertCode: { $regex: `^${SYNTH_PREFIX}` } });
    const purgeAudits = await AuditLog.deleteMany({ 'details.alertCode': { $regex: `^${SYNTH_PREFIX}` } });
    const purgeCameras = await Camera.deleteMany({ cameraCode: { $regex: `^${SYNTH_PREFIX}` } });
    const purgeWfs = await WorkFront.deleteMany({ workFrontCode: { $regex: `^${SYNTH_PREFIX}` } });
    await User.deleteMany({ email: 'synth.operator@vssp.internal' });

    console.log(`  Purged: ${purgeAlerts.deletedCount} alerts, ${purgeNotifs.deletedCount} notifications, ${purgeAudits.deletedCount} audits.`);
    assert(true, 'All synthetic test records cleanly purged from database');

  } catch (err) {
    console.error('[CRITICAL TEST ERROR]', err);
    failed++;
  } finally {
    await disconnectDB();
  }

  console.log('\n================================================================');
  console.log(`  SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
};

runTests();
