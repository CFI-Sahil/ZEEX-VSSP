/**
 * VSSP Phase 3: Cross-Batch End-to-End Integration Test Suite
 * Programmatically verifies end-to-end multi-batch workflows connecting all six batches:
 *   - Scenario 1: Event Intake -> Rule Engine -> Alert Creation -> Enrichment -> Audit Trail
 *   - Scenario 2: Synthetic Alert -> Controlled Timestamp SLA Evaluation -> L2 & L3 Escalation -> Notifications
 *   - Scenario 3: Alert to Evidence Vault -> SHA-256 Forensic Integrity -> Secure Authenticated Stream
 *   - Scenario 4: Training Sandbox Isolation -> Session Completion -> Zero Mutation to Live Platform State
 *   - Scenario 5: Full Lifecycle Handover: Incident -> Processing -> Handover Inclusion -> Submit -> Claim -> Ack -> Follow-up -> Complete
 *   - Scenario 6: Historical Snapshot Integrity -> Live Alert Mutation vs Frozen Handover Snapshot Immutability
 */

const http = require('http');
const path = require('path');
const crypto = require('crypto');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const { connectDB, disconnectDB } = require('../config/db');
const app = require('../app');

// Models
const Alert = require('../models/Alert');
const Evidence = require('../models/Evidence');
const Camera = require('../models/Camera');
const WorkFront = require('../models/WorkFront');
const DetectionEvent = require('../models/DetectionEvent');
const NotificationLog = require('../models/NotificationLog');
const ShiftHandover = require('../models/ShiftHandover');
const HandoverActivity = require('../models/HandoverActivity');
const TrainingScenario = require('../models/TrainingScenario');
const TrainingSession = require('../models/TrainingSession');
const TrainingActivity = require('../models/TrainingActivity');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');

// Services
const escalationEngine = require('../services/escalationEngine');

const PORT = 5092;
let server;

const SYNTH_PREFIX = 'SYNTH-INTG-P3-';

const request = (method, endpoint, body = null, headers = {}) => {
  return new Promise((resolve, reject) => {
    const url = new URL(`http://localhost:${PORT}${endpoint}`);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    if (body) {
      const dataStr = typeof body === 'string' ? body : JSON.stringify(body);
      options.headers['Content-Length'] = Buffer.byteLength(dataStr);
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch (_) {
          parsed = data;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: parsed,
        });
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
};

const runIntegrationSuite = async () => {
  console.log('\n========================================================================');
  console.log('  VSSP PHASE 3: CROSS-BATCH INTEGRATION AUTOMATED TEST SUITE');
  console.log('========================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  const assert = (condition, message) => {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  [PASS] ${message}`);
    } else {
      console.error(`  [FAIL] ${message}`);
    }
  };

  const createdFixtures = {
    workFrontIds: [],
    cameraIds: [],
    eventIds: [],
    alertIds: [],
    evidenceIds: [],
    handoverIds: [],
    sessionIds: [],
    scenarioIds: [],
  };

  try {
    await connectDB();
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(PORT, resolve));

    // Baseline counts
    const baselineAlerts = await Alert.countDocuments();
    const baselineEvidence = await Evidence.countDocuments();
    const baselineCameras = await Camera.countDocuments();
    const baselineWorkFronts = await WorkFront.countDocuments();

    console.log(`[Baseline] Alerts: ${baselineAlerts}, Evidence: ${baselineEvidence}, Cameras: ${baselineCameras}, WorkFronts: ${baselineWorkFronts}`);

    // Authenticate Admin and Operator
    const adminLogin = await request('POST', '/api/v1/auth/login', {
      email: 'admin@vssp.local',
      password: process.env.INITIAL_ADMIN_PASSWORD || 'AdminSecurePass@2026!',
    });
    assert(adminLogin.statusCode === 200, 'Admin successfully authenticated');

    const adminCookies = adminLogin.headers['set-cookie'] || [];
    const adminCookieHeader = adminCookies.map((c) => c.split(';')[0]).join('; ');
    const adminCsrfMatch = adminCookieHeader.match(/vssp_csrf=([^;]+)/);
    const adminCsrf = adminCsrfMatch ? decodeURIComponent(adminCsrfMatch[1]) : '';
    const adminToken = adminLogin.data?.data?.token;

    const adminHeaders = {
      Cookie: adminCookieHeader,
      Authorization: `Bearer ${adminToken}`,
      'X-CSRF-Token': adminCsrf,
    };

    const opLogin = await request('POST', '/api/v1/auth/login', {
      email: 'operator@vssp.local',
      password: process.env.INITIAL_OPERATOR_PASSWORD || 'OperatorSecurePass@2026!',
    });
    assert(opLogin.statusCode === 200, 'Safety Operator successfully authenticated');

    const opCookies = opLogin.headers['set-cookie'] || [];
    const opCookieHeader = opCookies.map((c) => c.split(';')[0]).join('; ');
    const opCsrfMatch = opCookieHeader.match(/vssp_csrf=([^;]+)/);
    const opCsrf = opCsrfMatch ? decodeURIComponent(opCsrfMatch[1]) : '';
    const opToken = opLogin.data?.data?.token;

    const opHeaders = {
      Cookie: opCookieHeader,
      Authorization: `Bearer ${opToken}`,
      'X-CSRF-Token': opCsrf,
    };

    // Provision Shared Integration Fixtures
    const runTag = Date.now().toString(36).toUpperCase();
    const wfCode = `${SYNTH_PREFIX}WF-${runTag}`;
    const camCode = `${SYNTH_PREFIX}CAM-${runTag}`;

    const testWf = await WorkFront.create({
      workFrontCode: wfCode,
      name: `Cross Batch Sector ${runTag}`,
      site: 'Refinery Integration Complex',
      zone: 'Sector 9',
      contractor: 'Larsen Construction Engineering',
      supervisor: {
        name: 'Devin Cole',
        phone: '+91 98765 11223',
        email: 'devin.cole@larsen-eng.com',
      },
      activityType: 'WORKING_AT_HEIGHT',
      riskLevel: 'CRITICAL',
      shift: 'MORNING',
      status: 'ACTIVE',
    });
    createdFixtures.workFrontIds.push(testWf._id);

    const testCam = await Camera.create({
      cameraCode: camCode,
      name: `Integration Scaffolding Camera ${runTag}`,
      site: 'Refinery Integration Complex',
      location: 'Column 14 Overhead',
      status: 'ONLINE',
      streamStatus: 'LIVE',
      isActive: true,
      workFront: testWf._id,
    });
    createdFixtures.cameraIds.push(testCam._id);

    // =========================================================================
    // SCENARIO 1: Event to Alert (Batch 1 -> Batch 2 Integration)
    // =========================================================================
    console.log('\n--- SCENARIO 1: Event to Alert Integration (Batch 1 -> Batch 2) ---');
    const eventId1 = `${SYNTH_PREFIX}EVT-1-${runTag}`;

    // 1. Submit event intake
    const intakeRes = await request('POST', '/api/v1/events/intake', {
      eventId: eventId1,
      cameraCode: camCode,
      violationType: 'NO_HELMET',
      severity: 'CRITICAL',
      confidence: 0.96,
      source: 'DEMO',
      description: 'Worker on high scaffolding platform without protective headgear',
    }, adminHeaders);

    assert(intakeRes.statusCode === 201, 'Step 1: Event Intake accepted (201 Created)');
    assert(intakeRes.data?.data?.intakeStatus === 'ACCEPTED', 'Step 1: Intake status is ACCEPTED');

    const createdEvent = await DetectionEvent.findOne({ eventId: eventId1 });
    assert(createdEvent !== null, 'Step 2: DetectionEvent persisted in MongoDB');
    assert(createdEvent.processedByRuleEngine === false, 'Step 2: Event not yet processed by rule engine');
    createdFixtures.eventIds.push(createdEvent._id);

    // Verify invariant: No alert created prematurely
    const alertCountBeforeProcess = await Alert.countDocuments();
    assert(alertCountBeforeProcess === baselineAlerts, 'Step 2: No alert created prior to rule engine evaluation');

    // 3. Process event through rule engine
    const processRes = await request('POST', `/api/v1/events/${createdEvent._id}/process`, {}, adminHeaders);
    assert(processRes.statusCode === 201, 'Step 3: Event successfully processed by Rule Engine (201 Created)');
    assert(processRes.data?.data?.alert !== undefined, 'Step 3: Alert payload returned in processing envelope');

    const alert1Id = processRes.data?.data?.alert?._id;
    createdFixtures.alertIds.push(alert1Id);

    const alert1Doc = await Alert.findById(alert1Id).populate('workFront camera');
    assert(alert1Doc !== null, 'Step 4: Alert persisted in MongoDB');
    assert(alert1Doc.eventId === eventId1, 'Step 4: Alert correctly references originating eventId');
    assert(alert1Doc.detectionEvent.toString() === createdEvent._id.toString(), 'Step 5: Event-to-Alert relationship verified');
    assert(alert1Doc.severity === 'CRITICAL', 'Step 5: Alert severity is CRITICAL');
    assert(alert1Doc.workFront?.workFrontCode === wfCode, 'Step 6: Alert enriched with WorkFront context');
    assert(alert1Doc.workFront?.contractor === 'Larsen Construction Engineering', 'Step 6: Alert enriched with contractor info');
    assert(alert1Doc.camera?.cameraCode === camCode, 'Step 6: Alert enriched with Camera context');

    // 7. Verify Audit record
    const auditAlertCreated = await AuditLog.findOne({
      action: 'ALERT_CREATED',
      'details.eventId': eventId1,
    });
    assert(auditAlertCreated !== null, 'Step 7: Audit record ALERT_CREATED persisted with event reference');

    // =========================================================================
    // SCENARIO 2: Alert to Escalation (Batch 2 -> Batch 3 Integration)
    // =========================================================================
    console.log('\n--- SCENARIO 2: Alert to Escalation Integration (Batch 2 -> Batch 3) ---');
    // Using controlled timestamps: backdate alert1 to 6 minutes ago (CRITICAL L2 SLA is 5m)
    const fiveMinutesThirtySecsAgo = new Date(Date.now() - 5.5 * 60 * 1000);
    await Alert.updateOne({ _id: alert1Id }, { detectedAt: fiveMinutesThirtySecsAgo });

    // Trigger SLA evaluation
    const evalRes = await escalationEngine.evaluatePendingAlerts();
    assert(evalRes.evaluatedCount >= 1, 'Step 1: SLA evaluation executed against overdue alerts');

    const escalatedAlertL2 = await Alert.findById(alert1Id);
    assert(escalatedAlertL2.escalationLevel === 2, 'Step 2: Alert escalated to Level 2 (5m SLA breached)');
    assert(escalatedAlertL2.escalatedAtL2 !== null, 'Step 2: escalatedAtL2 timestamp recorded');
    assert(escalatedAlertL2.escalationHistory.length >= 1, 'Step 2: escalationHistory entry added');

    // Verify notifications generated for L2
    const notifsL2 = await NotificationLog.find({ alert: alert1Id, escalationLevel: 2 });
    assert(notifsL2.length >= 1, 'Step 3: Level 2 NotificationLog records dispatched');

    // Backdate alert1 to 16 minutes ago (CRITICAL L3 SLA is 15m)
    const sixteenMinsAgo = new Date(Date.now() - 16 * 60 * 1000);
    await Alert.updateOne({ _id: alert1Id }, { detectedAt: sixteenMinsAgo });

    const evalRes2 = await escalationEngine.evaluatePendingAlerts();
    const escalatedAlertL3 = await Alert.findById(alert1Id);
    assert(escalatedAlertL3.escalationLevel === 3, 'Step 4: Alert escalated to Level 3 (15m SLA breached)');
    assert(escalatedAlertL3.escalatedAtL3 !== null, 'Step 4: escalatedAtL3 timestamp recorded');

    const notifsL3 = await NotificationLog.find({ alert: alert1Id, escalationLevel: 3 });
    assert(notifsL3.length >= 1, 'Step 5: Level 3 NotificationLog records dispatched');

    // Verify audit record for escalation
    const auditEscL2 = await AuditLog.findOne({
      action: 'ALERT_ESCALATED_L2',
      entityId: alert1Id,
    });
    assert(auditEscL2 !== null, 'Step 6: Audit log ALERT_ESCALATED_L2 recorded');

    // =========================================================================
    // SCENARIO 3: Alert to Evidence Vault (Batch 3 -> Batch 4 Integration)
    // =========================================================================
    console.log('\n--- SCENARIO 3: Alert to Evidence Vault Integration (Batch 3 -> Batch 4) ---');
    // Create authentic synthetic evidence record linked to alert1
    const fs = require('fs');
    const uploadsEvidenceDir = path.resolve(__dirname, '../../uploads/evidence');
    if (!fs.existsSync(uploadsEvidenceDir)) {
      fs.mkdirSync(uploadsEvidenceDir, { recursive: true });
    }
    const physicalFileName = `${SYNTH_PREFIX}physical_snapshot.jpg`;
    const physicalFilePath = path.join(uploadsEvidenceDir, physicalFileName);
    const testImageBuffer = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00,
      0x60, 0x00, 0x60, 0x00, 0x00, 0xff, 0xd9,
    ]);
    fs.writeFileSync(physicalFilePath, testImageBuffer);
    const genuineChecksum = crypto.createHash('sha256').update(testImageBuffer).digest('hex');

    const evCode = `${SYNTH_PREFIX}EVD-${runTag}`;
    const synthEvidence = await Evidence.create({
      evidenceCode: evCode,
      alert: alert1Id,
      alertCode: escalatedAlertL3.alertCode,
      camera: testCam._id,
      cameraCode: camCode,
      fileName: physicalFileName,
      filePath: `uploads/evidence/${physicalFileName}`,
      fileType: 'image/jpeg',
      fileSize: testImageBuffer.length,
      storageDriver: 'local',
      checksumSha256: genuineChecksum,
      integrityStatus: 'NOT_YET_VERIFIED',
      capturedAt: new Date(),
    });
    createdFixtures.evidenceIds.push(synthEvidence._id);

    // Link evidence to alert
    await Alert.updateOne({ _id: alert1Id }, { evidence: synthEvidence._id, evidenceStatus: 'AVAILABLE' });

    // Verify evidence retrieved through API
    const evDetailRes = await request('GET', `/api/v1/evidence/${synthEvidence._id}`, null, adminHeaders);
    assert(evDetailRes.statusCode === 200, 'Step 1: Evidence retrieved via Vault API (200 OK)');
    assert(evDetailRes.data?.data?.evidence?.alert?.alertCode === escalatedAlertL3.alertCode, 'Step 1: Linked alert populated');

    // Run SHA-256 verification endpoint
    const verifyRes = await request('POST', `/api/v1/evidence/${synthEvidence._id}/verify`, {}, adminHeaders);
    assert(verifyRes.statusCode === 200, 'Step 2: Forensic SHA-256 integrity check returns 200 OK');
    assert(verifyRes.data?.data?.integrityStatus !== undefined, 'Step 2: Integrity status returned');

    // Test authenticated download stream
    const fileRes = await request('GET', `/api/v1/evidence/${synthEvidence._id}/file?download=true`, null, opHeaders);
    assert(fileRes.statusCode === 200, 'Step 3: Authenticated evidence file download stream succeeds (200 OK)');
    assert(fileRes.headers['content-disposition']?.includes('attachment'), 'Step 4: Content-Disposition is attachment');

    // Check evidence download audit
    const downloadAudit = await AuditLog.findOne({
      action: 'EVIDENCE_DOWNLOADED',
      entityId: synthEvidence._id,
    });
    assert(downloadAudit !== null, 'Step 5: Audit log EVIDENCE_DOWNLOADED recorded');

    // Clean up temporary physical file
    if (fs.existsSync(physicalFilePath)) {
      fs.unlinkSync(physicalFilePath);
    }

    // =========================================================================
    // SCENARIO 4: Training Isolation (Batch 5 Integration)
    // =========================================================================
    console.log('\n--- SCENARIO 4: Training Isolation Integration (Batch 5) ---');
    // Start session on first active scenario
    const scenariosRes = await request('GET', '/api/v1/training/scenarios', null, opHeaders);
    assert(scenariosRes.statusCode === 200, 'Step 1: Scenarios listed (200 OK)');
    const scenarios = Array.isArray(scenariosRes.data?.data)
      ? scenariosRes.data.data
      : (scenariosRes.data?.data?.scenarios || []);
    const scenario = scenarios[0];
    assert(scenario !== undefined, 'Step 1: Active training scenario found');

    const startSessionRes = await request('POST', '/api/v1/training/sessions', {
      scenarioId: scenario._id,
    }, opHeaders);
    assert(startSessionRes.statusCode === 201, 'Step 2: Training session started (201 Created)');
    const sessionId = startSessionRes.data?.data?._id;
    createdFixtures.sessionIds.push(sessionId);

    // Complete session with answers
    await request('POST', `/api/v1/training/sessions/${sessionId}/acknowledge`, {}, opHeaders);
    await request('POST', `/api/v1/training/sessions/${sessionId}/assess`, {
      identifiedViolationType: scenario.violationType,
      assessedSeverity: scenario.severity,
      immediateActionRequired: true,
      hazardAssessmentNotes: 'Immediate safety perimeter established. Unsafe work suspended.',
    }, opHeaders);
    await request('POST', `/api/v1/training/sessions/${sessionId}/corrective-action`, {
      correctiveActionCategory: 'PPE_COMPLIANCE_ISSUANCE',
      correctiveActionRemarks: 'Daily pre-shift toolbox safety meeting.',
    }, opHeaders);

    const completeSessionRes = await request('POST', `/api/v1/training/sessions/${sessionId}/complete`, {
      resolutionRemarks: 'Worker is now in full PPE compliance. Incident cleared and reported.',
    }, opHeaders);
    assert(completeSessionRes.statusCode === 200, 'Step 3: Training session completed (200 OK)');
    assert(typeof completeSessionRes.data?.data?.evaluationResult?.totalScore === 'number', 'Step 3: Deterministic server-side score calculated');

    // Verify Isolation: Operational collections untouched by training
    const alertCountAfterTraining = await Alert.countDocuments();
    const evidenceCountAfterTraining = await Evidence.countDocuments();
    assert(alertCountAfterTraining === baselineAlerts + 1, 'Step 4: Training did not create live alerts');
    assert(evidenceCountAfterTraining === baselineEvidence + 1, 'Step 4: Training did not create live evidence');

    // =========================================================================
    // SCENARIO 5: Shift Handover Lifecycle (Batch 6 Integration)
    // =========================================================================
    console.log('\n--- SCENARIO 5: Shift Handover Lifecycle (Batch 6 Integration) ---');
    // Check that alert1 appears in live operational summary
    const opSummaryRes = await request('GET', '/api/v1/handovers/operational-summary', null, opHeaders);
    assert(opSummaryRes.statusCode === 200, 'Step 1: Live operational summary retrieved (200 OK)');
    assert(typeof opSummaryRes.data?.data?.operationalSummary?.pendingAlertsCount === 'number', 'Step 1: Operational summary includes pendingAlertsCount');

    // Create Draft Handover by Operator
    const createHandoverRes = await request('POST', '/api/v1/handovers', {
      shiftDate: new Date().toISOString(),
      shiftType: 'DAY',
      shiftLabel: `${SYNTH_PREFIX}Morning Cross-Batch Handover`,
      outgoingRemarks: 'Elevated tower work suspended due to PPE violation.',
      manualNotes: [
        {
          category: 'SAFETY_OBSERVATION',
          priority: 'HIGH',
          note: 'Sector 9 scaffolding requires safety harness anchor check.',
        },
      ],
    }, opHeaders);

    assert(createHandoverRes.statusCode === 201, 'Step 2: Handover draft created (201 Created)');
    const handoverId = createHandoverRes.data?.data?._id;
    createdFixtures.handoverIds.push(handoverId);

    // Submit Handover (Freezes snapshot)
    const submitRes = await request('POST', `/api/v1/handovers/${handoverId}/submit`, {}, opHeaders);
    assert(submitRes.statusCode === 200, 'Step 3: Handover submitted (200 OK)');
    assert(submitRes.data?.data?.status === 'SUBMITTED', 'Step 3: Status transitions to SUBMITTED');
    assert(submitRes.data?.data?.submittedSnapshot !== null, 'Step 3: submittedSnapshot frozen');

    // Claim Handover by Admin (acting as incoming supervisor)
    const claimRes = await request('POST', `/api/v1/handovers/${handoverId}/claim`, {}, adminHeaders);
    assert(claimRes.statusCode === 200, 'Step 4: Handover claimed by oncoming operator (200 OK)');
    assert(claimRes.data?.data?.incomingOperator !== null, 'Step 4: incomingOperator assigned to claimant');

    // Acknowledge Handover
    const ackRes = await request('POST', `/api/v1/handovers/${handoverId}/acknowledge`, {
      remarks: 'Shift briefing received. Sector 9 scaffolding inspection team notified.',
    }, adminHeaders);
    assert(ackRes.statusCode === 200, 'Step 5: Handover acknowledged (200 OK)');
    assert(ackRes.data?.data?.status === 'ACKNOWLEDGED', 'Step 5: Status transitions to ACKNOWLEDGED');

    // Create follow-up action item
    const fupRes = await request('POST', `/api/v1/handovers/${handoverId}/follow-ups`, {
      description: 'Audit safety harness permits on Scaffolding Column 14',
      priority: 'HIGH',
    }, adminHeaders);
    assert(fupRes.statusCode === 201, 'Step 6: Follow-up action item created (201 Created)');
    const followUpId = fupRes.data?.data?.followUps?.[0]?._id;

    // Complete follow-up
    const updateFupRes = await request('PATCH', `/api/v1/handovers/${handoverId}/follow-ups/${followUpId}`, {
      status: 'COMPLETED',
      notes: 'Permits audited and verified compliant.',
    }, adminHeaders);
    assert(updateFupRes.statusCode === 200, 'Step 7: Follow-up transitioned to COMPLETED (200 OK)');

    // Complete Handover
    const completeHandoverRes = await request('POST', `/api/v1/handovers/${handoverId}/complete`, {}, adminHeaders);
    assert(completeHandoverRes.statusCode === 200, 'Step 8: Handover completed (200 OK)');
    assert(completeHandoverRes.data?.data?.status === 'COMPLETED', 'Step 8: Final status is COMPLETED');

    // Verify audit trail for handover
    const hoAudits = await AuditLog.find({ entityId: handoverId });
    assert(hoAudits.length >= 4, 'Step 9: Complete audit trail recorded for handover lifecycle');

    // =========================================================================
    // SCENARIO 6: Historical Snapshot Integrity
    // =========================================================================
    console.log('\n--- SCENARIO 6: Historical Snapshot Integrity (Immutability Check) ---');
    // Fetch snapshot stored on handover
    const completedHandoverDoc = await ShiftHandover.findById(handoverId);
    const snapshotCriticalCountBefore = completedHandoverDoc.submittedSnapshot.operationalSummary.criticalCount;

    // Mutate live alert1 (acknowledge and close it)
    await Alert.updateOne({ _id: alert1Id }, { status: 'CLOSED', severity: 'LOW' });
    const liveAlertAfter = await Alert.findById(alert1Id);
    assert(liveAlertAfter.status === 'CLOSED', 'Step 1: Live alert status mutated to CLOSED');
    assert(liveAlertAfter.severity === 'LOW', 'Step 1: Live alert severity mutated to LOW');

    // Re-fetch handover and verify snapshot is unchanged
    const reFetchedHandover = await ShiftHandover.findById(handoverId);
    assert(
      reFetchedHandover.submittedSnapshot.operationalSummary.criticalCount === snapshotCriticalCountBefore,
      'Step 2: Frozen snapshot operational summary criticalCount remains UNCHANGED despite live alert mutation'
    );
    assert(
      reFetchedHandover.status === 'COMPLETED',
      'Step 3: Historical completed handover status is immutable'
    );

    // =========================================================================
    // CLEANUP & PURGE SYNTHETIC TEST FIXTURES
    // =========================================================================
    console.log('\n--- TEARDOWN: Purging Cross-Batch Synthetic Test Records ---');
    await Alert.deleteMany({ _id: { $in: createdFixtures.alertIds } });
    await Evidence.deleteMany({ _id: { $in: createdFixtures.evidenceIds } });
    await DetectionEvent.deleteMany({ _id: { $in: createdFixtures.eventIds } });
    await Camera.deleteMany({ _id: { $in: createdFixtures.cameraIds } });
    await WorkFront.deleteMany({ _id: { $in: createdFixtures.workFrontIds } });
    await ShiftHandover.deleteMany({ _id: { $in: createdFixtures.handoverIds } });
    await HandoverActivity.deleteMany({ handover: { $in: createdFixtures.handoverIds } });
    await TrainingSession.deleteMany({ _id: { $in: createdFixtures.sessionIds } });
    await NotificationLog.deleteMany({ alert: { $in: createdFixtures.alertIds } });
    await AuditLog.deleteMany({
      $or: [
        { entityId: { $in: createdFixtures.alertIds } },
        { entityId: { $in: createdFixtures.handoverIds } },
        { 'details.eventId': eventId1 },
      ],
    });

    // Verify baseline preserved
    const finalAlerts = await Alert.countDocuments();
    const finalEvidence = await Evidence.countDocuments();
    const finalCameras = await Camera.countDocuments();
    const finalWorkFronts = await WorkFront.countDocuments();
    const finalHandovers = await ShiftHandover.countDocuments();
    const finalActivities = await HandoverActivity.countDocuments();

    assert(finalAlerts === baselineAlerts, `Alert collection preserved (${finalAlerts} === ${baselineAlerts})`);
    assert(finalEvidence === baselineEvidence, `Evidence collection preserved (${finalEvidence} === ${baselineEvidence})`);
    assert(finalCameras === baselineCameras, `Camera collection preserved (${finalCameras} === ${baselineCameras})`);
    assert(finalWorkFronts === baselineWorkFronts, `WorkFront collection preserved (${finalWorkFronts} === ${baselineWorkFronts})`);
    assert(finalHandovers === 0, `ShiftHandovers clean (0)`);
    assert(finalActivities === 0, `HandoverActivities clean (0)`);

    console.log('\n========================================================================');
    console.log(`  CROSS-BATCH INTEGRATION TEST COMPLETE: ${passedTests}/${totalTests} PASSED`);
    console.log('========================================================================\n');

    if (passedTests === totalTests) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal Integration Test Error:', err);
    process.exit(1);
  } finally {
    if (server) server.close();
    await disconnectDB();
  }
};

runIntegrationSuite();
