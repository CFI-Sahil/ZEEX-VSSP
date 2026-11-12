/**
 * VSSP Phase 3 – Batch 2: Event Processing & Rule Engine Test Suite
 * Validates atomic reservation, canonical detection registry evaluation,
 * deterministic severity assignment, confidence retention, camera deactivation policy,
 * legacy record backward-compatibility, crash lease recovery, concurrent duplicate prevention,
 * and Phase 1/Phase 2 regressions.
 */

const http = require('http');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const { connectDB, disconnectDB } = require('../config/db');
const app = require('../app');
const Camera = require('../models/Camera');
const WorkFront = require('../models/WorkFront');
const Alert = require('../models/Alert');
const DetectionEvent = require('../models/DetectionEvent');
const AuditLog = require('../models/AuditLog');

const PORT = 5089;
let server;

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

const runBatch2Suite = async () => {
  console.log('\n========================================================================');
  console.log('  VSSP PHASE 3 – BATCH 2: EVENT PROCESSING & RULE ENGINE TEST SUITE');
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

  try {
    await connectDB();
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(PORT, resolve));

    // Authenticate as Admin
    const loginRes = await request('POST', '/api/v1/auth/login', {
      email: 'admin@vssp.local',
      password: process.env.INITIAL_ADMIN_PASSWORD || 'AdminSecurePass@2026!',
    });

    assert(loginRes.statusCode === 200, 'Admin authenticated successfully');
    const cookies = loginRes.headers['set-cookie'] || [];
    const cookieHeader = cookies.map((c) => c.split(';')[0]).join('; ');
    const csrfMatch = cookieHeader.match(/vssp_csrf=([^;]+)/);
    const csrfToken = csrfMatch ? decodeURIComponent(csrfMatch[1]) : '';
    const token = loginRes.data?.data?.token;

    const authHeaders = {
      Cookie: cookieHeader,
      Authorization: `Bearer ${token}`,
      'X-CSRF-Token': csrfToken,
    };

    // Prepare test fixture: WorkFront & Camera
    const runTag = `P3B2_${Date.now().toString(36).toUpperCase()}`;
    const workFrontCode = `WF-${runTag}`;
    const cameraCode = `CAM-${runTag}`;

    const testWorkFront = await WorkFront.create({
      workFrontCode,
      name: `Processing Test Front ${runTag}`,
      site: 'Refinery Yard Alpha',
      zone: 'Sector 4',
      contractor: 'Apex Heavy Industries',
      supervisor: {
        name: 'Marcus Vance',
        phone: '+91 98765 43210',
        email: 'marcus.vance@apex-safety.com',
      },
      activityType: 'WORKING_AT_HEIGHT',
      riskLevel: 'HIGH',
      shift: 'MORNING',
      status: 'ACTIVE',
    });

    const testCamera = await Camera.create({
      cameraCode,
      name: `Processing Test Camera ${runTag}`,
      site: 'Refinery Yard Alpha',
      location: 'Scaffolding Tower B',
      status: 'ONLINE',
      streamStatus: 'LIVE',
      isActive: true,
      workFront: testWorkFront._id,
    });

    console.log(`\n--- TEST GROUP 1: Standard Event Processing & Operational Enrichment ---`);
    const eventId1 = `EVT-STD-${runTag}`;
    const intakeRes1 = await request(
      'POST',
      '/api/v1/events/intake',
      {
        eventId: eventId1,
        cameraCode,
        violationType: 'NO_HELMET',
        severity: 'HIGH',
        confidence: 0.94,
        source: 'DEMO',
      },
      authHeaders
    );

    assert(intakeRes1.statusCode === 201, 'Batch 1 intake accepted event without alert creation');
    const createdEvent1Id = intakeRes1.data?.data?.event?.id;

    // Process event
    const processRes1 = await request(
      'POST',
      `/api/v1/events/${createdEvent1Id}/process`,
      {},
      authHeaders
    );

    assert(processRes1.statusCode === 201, 'POST /events/:id/process returned 201 Created');
    const alert1 = processRes1.data?.data?.alert;
    const event1 = processRes1.data?.data?.event;
    const ruleEval1 = processRes1.data?.data?.ruleEvaluation;

    assert(Boolean(alert1), 'Alert object returned in response');
    assert(alert1?.eventId === eventId1, 'Generated alert matches originating eventId');
    assert(alert1?.status === 'PENDING', 'Generated alert status is PENDING');
    assert(event1?.processedByRuleEngine === true, 'DetectionEvent processedByRuleEngine is true');
    assert(event1?.processingStatus === 'COMPLETED', 'DetectionEvent processingStatus is COMPLETED');
    assert(
      String(event1?.associatedAlert) === String(alert1?._id),
      'DetectionEvent associatedAlert equals Alert._id'
    );
    assert(alert1?.workFrontCode === workFrontCode, 'Alert enriched with trusted WorkFront code');
    assert(
      alert1?.contractor === 'Apex Heavy Industries',
      'Alert enriched with trusted contractor'
    );
    assert(alert1?.riskLevel === 'HIGH', 'Alert enriched with WorkFront risk level');
    assert(
      ruleEval1?.severitySource === 'ASSIGNED_FROM_PAYLOAD',
      'Rule evaluation recorded ASSIGNED_FROM_PAYLOAD'
    );

    console.log(`\n--- TEST GROUP 2: Confidence Retention (No Arbitrary Suppression) ---`);
    const eventIdLowConf = `EVT-LOWCONF-${runTag}`;
    const intakeLowConf = await request(
      'POST',
      '/api/v1/events/intake',
      {
        eventId: eventIdLowConf,
        cameraCode,
        violationType: 'NO_VEST',
        severity: 'MEDIUM',
        confidence: 0.38, // Low confidence
        source: 'DEMO',
      },
      authHeaders
    );
    assert(intakeLowConf.statusCode === 201, 'Low confidence event accepted at intake');

    const processLowConf = await request(
      'POST',
      `/api/v1/events/${intakeLowConf.data.data.event.id}/process`,
      {},
      authHeaders
    );
    assert(
      processLowConf.statusCode === 201,
      'Event with confidence < 0.50 processed successfully without suppression'
    );
    assert(
      processLowConf.data?.data?.alert?.confidence === 0.38,
      'Low confidence 0.38 retained on Alert document'
    );

    console.log(`\n--- TEST GROUP 3: Severity Assignment & Traceability ---`);
    const eventIdNoSev = `EVT-NOSEV-${runTag}`;
    const intakeNoSev = await request(
      'POST',
      '/api/v1/events/intake',
      {
        eventId: eventIdNoSev,
        cameraCode,
        violationType: 'RESTRICTED_ACCESS',
        // severity omitted
        confidence: 0.91,
      },
      authHeaders
    );
    assert(intakeNoSev.statusCode === 201, 'Event without severity accepted');

    const processNoSev = await request(
      'POST',
      `/api/v1/events/${intakeNoSev.data.data.event.id}/process`,
      {},
      authHeaders
    );
    assert(processNoSev.statusCode === 201, 'Event without severity processed');
    assert(
      processNoSev.data?.data?.alert?.severity === 'CRITICAL',
      'Severity defaulted to CRITICAL from detection registry for RESTRICTED_ACCESS'
    );
    assert(
      processNoSev.data?.data?.ruleEvaluation?.severitySource === 'ASSIGNED_FROM_REGISTRY_DEFAULT',
      'Severity source recorded as ASSIGNED_FROM_REGISTRY_DEFAULT'
    );

    console.log(`\n--- TEST GROUP 4: Camera Deactivation Post-Intake (Preserve Event) ---`);
    const eventIdDeact = `EVT-DEACT-${runTag}`;
    const intakeDeact = await request(
      'POST',
      '/api/v1/events/intake',
      {
        eventId: eventIdDeact,
        cameraCode,
        violationType: 'NO_SAFETY_BOOTS',
        severity: 'HIGH',
      },
      authHeaders
    );
    assert(intakeDeact.statusCode === 201, 'Event accepted while camera active');

    // Deactivate camera
    await Camera.updateOne({ _id: testCamera._id }, { $set: { isActive: false } });

    const processDeact = await request(
      'POST',
      `/api/v1/events/${intakeDeact.data.data.event.id}/process`,
      {},
      authHeaders
    );
    assert(
      processDeact.statusCode === 201,
      'Event processed and alert created even after camera was deactivated post-intake'
    );
    assert(
      processDeact.data?.data?.ruleEvaluation?.cameraStatusAtProcessing === 'DEACTIVATED',
      'Camera status recorded as DEACTIVATED in rule evaluation diagnostics'
    );

    // Reactivate camera for subsequent tests
    await Camera.updateOne({ _id: testCamera._id }, { $set: { isActive: true } });

    console.log(`\n--- TEST GROUP 5: Legacy Batch 1 Documents (Without processingStatus) ---`);
    const legacyEventId = `EVT-LEGACY-${runTag}`;
    const legacyEvent = await DetectionEvent.create({
      eventId: legacyEventId,
      source: 'DEMO',
      camera: testCamera._id,
      cameraCode: testCamera.cameraCode,
      violationType: 'UNAUTHORIZED_ZONE',
      violationName: 'Unauthorized Zone Entry',
      severity: 'MEDIUM',
      confidence: 0.88,
      status: 'ACCEPTED',
      processedByRuleEngine: false,
      // Intentionally omit processingStatus, processedAt, etc.
    });

    const processLegacy = await request(
      'POST',
      `/api/v1/events/${legacyEvent._id}/process`,
      {},
      authHeaders
    );
    assert(
      processLegacy.statusCode === 201,
      'Legacy Batch 1 event lacking processingStatus leased and processed successfully'
    );
    assert(
      processLegacy.data?.data?.event?.processingStatus === 'COMPLETED',
      'Legacy event successfully transitioned to processingStatus: COMPLETED'
    );

    console.log(`\n--- TEST GROUP 6: Worker Crash Lease Recovery (Expired Lease) ---`);
    const crashedEventId = `EVT-CRASH-${runTag}`;
    const crashedEvent = await DetectionEvent.create({
      eventId: crashedEventId,
      source: 'DEMO',
      camera: testCamera._id,
      cameraCode: testCamera.cameraCode,
      violationType: 'NO_HELMET',
      violationName: 'Missing Safety Helmet',
      severity: 'HIGH',
      confidence: 0.95,
      status: 'ACCEPTED',
      processedByRuleEngine: false,
      processingStatus: 'PROCESSING',
      processingStartedAt: new Date(Date.now() - 45000), // 45 seconds ago (lease expired > 30s)
    });

    const processCrashed = await request(
      'POST',
      `/api/v1/events/${crashedEvent._id}/process`,
      {},
      authHeaders
    );
    assert(
      processCrashed.statusCode === 201,
      'Expired worker lease (>30s) automatically re-acquired and completed'
    );

    console.log(`\n--- TEST GROUP 7: Concurrency & Duplicate Alert Prevention ---`);
    const concurEventId = `EVT-CONCUR-${runTag}`;
    const intakeConcur = await request(
      'POST',
      '/api/v1/events/intake',
      {
        eventId: concurEventId,
        cameraCode,
        violationType: 'NO_VEST',
        severity: 'HIGH',
        confidence: 0.93,
      },
      authHeaders
    );
    assert(intakeConcur.statusCode === 201, 'Concurrent test event accepted');
    const concurEventDbId = intakeConcur.data.data.event.id;

    // Fire 10 simultaneous requests for the exact same event
    const concurrentRequests = Array.from({ length: 10 }).map(() =>
      request('POST', `/api/v1/events/${concurEventDbId}/process`, {}, authHeaders)
    );
    const concurrentResponses = await Promise.all(concurrentRequests);

    const alertCountForConcur = await Alert.countDocuments({ eventId: concurEventId });
    assert(
      alertCountForConcur === 1,
      `Exactly 1 Alert created across 10 simultaneous requests (actual: ${alertCountForConcur})`
    );

    const non500Responses = concurrentResponses.filter((r) => r.statusCode < 500);
    assert(
      non500Responses.length === 10,
      'All 10 concurrent requests handled safely without unhandled 500 server crashes'
    );

    console.log(`\n--- TEST GROUP 8: Repeated Processing Idempotency ---`);
    const repeatRes = await request(
      'POST',
      `/api/v1/events/${concurEventDbId}/process`,
      {},
      authHeaders
    );
    assert(repeatRes.statusCode === 200, 'Repeated call returned 200 OK');
    assert(repeatRes.data?.data?.isExisting === true, 'Response indicates isExisting: true');
    const finalAlertCount = await Alert.countDocuments({ eventId: concurEventId });
    assert(finalAlertCount === 1, 'No duplicate alert created after repeated call');

    console.log(`\n--- TEST GROUP 9: Non-ACCEPTED Event Exclusion ---`);
    const rejectedEvent = await DetectionEvent.create({
      eventId: `EVT-REJ-${runTag}`,
      cameraCode,
      status: 'REJECTED',
      rejectionReason: 'Test rejection',
      processedByRuleEngine: false,
    });
    const processRejected = await request(
      'POST',
      `/api/v1/events/${rejectedEvent._id}/process`,
      {},
      authHeaders
    );
    assert(
      processRejected.statusCode === 400,
      'Processing a REJECTED event returned 400 Bad Request'
    );

    console.log(`\n--- TEST GROUP 10: Queue Metrics & Batch Queue Processing ---`);
    // Create 3 pending accepted events
    for (let i = 1; i <= 3; i++) {
      await request(
        'POST',
        '/api/v1/events/intake',
        {
          eventId: `EVT-BATCH-${runTag}-${i}`,
          cameraCode,
          violationType: 'NO_HELMET',
          severity: 'HIGH',
        },
        authHeaders
      );
    }

    const queueStatusRes = await request(
      'GET',
      '/api/v1/events/processing-queue/status',
      null,
      authHeaders
    );
    assert(queueStatusRes.statusCode === 200, 'GET /events/processing-queue/status returned 200');
    assert(
      queueStatusRes.data?.data?.stats?.pending >= 3,
      `Pending count correctly reflects intake queue (pending: ${queueStatusRes.data?.data?.stats?.pending})`
    );

    const batchProcessRes = await request(
      'POST',
      '/api/v1/events/process-queue',
      { limit: 5 },
      authHeaders
    );
    assert(batchProcessRes.statusCode === 200, 'POST /events/process-queue returned 200');
    assert(
      batchProcessRes.data?.data?.processedCount >= 3,
      `Batch processing processed ${batchProcessRes.data?.data?.processedCount} events successfully`
    );

    console.log(`\n--- TEST GROUP 11: Audit Trail Verification ---`);
    const auditLogs = await AuditLog.find({
      action: 'ALERT_CREATED',
      'details.eventId': eventId1,
    });
    assert(auditLogs.length > 0, 'Audit log entry created for ALERT_CREATED');
    assert(
      auditLogs[0]?.details?.workFrontCode === workFrontCode,
      'Audit log recorded operational WorkFront context'
    );

    console.log(`\n--- TEST GROUP 12: Security, RBAC & CSRF Controls ---`);
    const unauthRes = await request('POST', `/api/v1/events/${createdEvent1Id}/process`, {});
    assert(unauthRes.statusCode === 401, 'Unauthenticated request rejected with 401');

    const noCsrfRes = await request('POST', `/api/v1/events/${createdEvent1Id}/process`, {}, {
      Cookie: cookieHeader,
      Authorization: `Bearer ${token}`,
      // Omit X-CSRF-Token
    });
    assert(noCsrfRes.statusCode === 403, 'Request without CSRF token rejected with 403');

    console.log(`\n--- TEST GROUP 13: Phase 1 Alert Lifecycle Regression ---`);
    // Acknowledge the alert created in Test Group 1
    const ackRes = await request(
      'PATCH',
      `/api/v1/alerts/${alert1._id}/acknowledge`,
      {},
      authHeaders
    );
    assert(ackRes.statusCode === 200, 'Alert acknowledged successfully (PENDING -> ACKNOWLEDGED)');
    assert(ackRes.data?.data?.alert?.status === 'ACKNOWLEDGED', 'Alert status is ACKNOWLEDGED');

    // Close the alert with remarks
    const closeRes = await request(
      'PATCH',
      `/api/v1/alerts/${alert1._id}/close`,
      { remarks: 'Corrective PPE issued by safety supervisor on site.' },
      authHeaders
    );
    assert(closeRes.statusCode === 200, 'Alert closed successfully (ACKNOWLEDGED -> CLOSED)');
    assert(closeRes.data?.data?.alert?.status === 'CLOSED', 'Alert status is CLOSED');

    // Clean up synthetic test records created during this run
    console.log('Teardown: Cleaning Batch 2 test probe records...');
    await Alert.deleteMany({ workFront: testWorkFront._id });
    await DetectionEvent.deleteMany({
      $or: [
        { cameraCode },
        { eventId: { $regex: runTag } },
      ],
    });
    await Camera.deleteOne({ _id: testCamera._id });
    await WorkFront.deleteOne({ _id: testWorkFront._id });
    console.log('Teardown complete.');

    console.log('\n========================================================================');
    console.log(`  BATCH 2 SUITE COMPLETE: ${passedTests}/${totalTests} TESTS PASSED`);
    console.log('========================================================================\n');

    if (passedTests === totalTests) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  } finally {
    if (server) {
      server.close();
    }
    await disconnectDB();
  }
};

runBatch2Suite();

