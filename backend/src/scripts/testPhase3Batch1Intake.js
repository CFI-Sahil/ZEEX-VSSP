/**
 * VSSP Phase 3 – Batch 1: Detection Event Intake Test Suite
 * Validates payload schema, canonical detection registry, camera eligibility,
 * eventId uniqueness, safe rejection persistence, and strict no-alert-creation boundary.
 */

const http = require('http');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const { connectDB, disconnectDB } = require('../config/db');
const app = require('../app');
const Camera = require('../models/Camera');
const Alert = require('../models/Alert');
const DetectionEvent = require('../models/DetectionEvent');
const AuditLog = require('../models/AuditLog');

const PORT = 5088;
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

const runBatch1Suite = async () => {
  console.log('\n========================================================================');
  console.log('  VSSP PHASE 3 – BATCH 1: DETECTION EVENT INTAKE TEST SUITE');
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

    // Prepare probe test cameras
    const runTag = `P3B1_${Date.now().toString(36).toUpperCase()}`;
    const activeCameraCode = `CAM-ACT-${runTag}`;
    const inactiveCameraCode = `CAM-INA-${runTag}`;

    const testActiveCamera = await Camera.create({
      cameraCode: activeCameraCode,
      name: `Intake Test Active Camera ${runTag}`,
      site: 'Plant 1',
      location: 'Testing Bay A',
      status: 'UNKNOWN', // Stream status and status must NOT disqualify the camera
      streamStatus: 'UNAVAILABLE',
      isActive: true,
    });

    const testInactiveCamera = await Camera.create({
      cameraCode: inactiveCameraCode,
      name: `Intake Test Inactive Camera ${runTag}`,
      site: 'Plant 1',
      location: 'Decommissioned Area',
      status: 'OFFLINE',
      streamStatus: 'UNAVAILABLE',
      isActive: false, // Disqualified due to deactivation
    });

    const initialAlertCount = await Alert.countDocuments();

    // Test 1: Valid Demo Event Intake (Stream-Agnostic Camera Acceptance)
    console.log('\n[Test 1] Valid Demo Detection Event Reception...');
    const validEventRes = await request(
      'POST',
      '/api/v1/events/intake',
      {
        cameraCode: activeCameraCode,
        violationType: 'NO_HELMET',
        severity: 'HIGH',
        confidence: 0.95,
        description: 'Operator without safety helmet at assembly bay',
      },
      authHeaders
    );

    assert(validEventRes.statusCode === 201, `Valid intake returns 201 Created (got ${validEventRes.statusCode})`);
    assert(validEventRes.data.success === true, 'Response envelope has success: true');
    assert(validEventRes.data.data.intakeStatus === 'ACCEPTED', 'intakeStatus is strictly ACCEPTED');
    assert(typeof validEventRes.data.data.eventId === 'string', 'Generated eventId returned');

    const createdEvent = await DetectionEvent.findOne({ eventId: validEventRes.data.data.eventId });
    assert(Boolean(createdEvent), 'DetectionEvent document persisted in database');
    assert(createdEvent.status === 'ACCEPTED', 'Persisted status is ACCEPTED');
    assert(createdEvent.processedByRuleEngine === false, 'processedByRuleEngine strictly defaults to false');
    assert(createdEvent.camera.toString() === testActiveCamera._id.toString(), 'Camera correctly associated by ID');

    // Test 2: Invariant Check — No Premature Alert Creation in Batch 1
    console.log('\n[Test 2] Scope Boundary Invariant: No Premature Alert or Evidence Creation...');
    const currentAlertCount = await Alert.countDocuments();
    assert(
      currentAlertCount === initialAlertCount,
      `Alert collection count unchanged (${currentAlertCount} === ${initialAlertCount}). Batch 1 does not create alerts!`
    );

    // Test 3: Reject Missing Required Fields
    console.log('\n[Test 3] Reject Incomplete Event Payload...');
    const missingFieldsRes = await request(
      'POST',
      '/api/v1/events/intake',
      {
        severity: 'HIGH',
        // cameraCode and violationType missing
      },
      authHeaders
    );

    assert(missingFieldsRes.statusCode === 400, `Missing required fields rejected with 400 (got ${missingFieldsRes.statusCode})`);
    assert(missingFieldsRes.data.success === false, 'success is false');
    assert(Array.isArray(missingFieldsRes.data.errors), 'Validation errors array returned');

    // Confirm rejection record was safely persisted
    const rejectedMissing = await DetectionEvent.findOne({
      rejectionReason: /Event payload validation failed/,
    }).sort({ receivedAt: -1 });
    assert(Boolean(rejectedMissing), 'Rejected intake attempt safely persisted in database');
    assert(rejectedMissing.status === 'REJECTED', 'Status is persisted as REJECTED');

    // Test 4: Reject Unsupported Violation Type (Canonical Detection Registry Enforcement)
    console.log('\n[Test 4] Canonical Detection Registry Enforcement...');
    const invalidTypeRes = await request(
      'POST',
      '/api/v1/events/intake',
      {
        cameraCode: activeCameraCode,
        violationType: 'UNSUPPORTED_MAGIC_VIOLATION_TYPE',
        severity: 'HIGH',
      },
      authHeaders
    );

    assert(invalidTypeRes.statusCode === 400, `Unsupported violationType rejected with 400 (got ${invalidTypeRes.statusCode})`);
    assert(
      JSON.stringify(invalidTypeRes.data.errors).includes('Unsupported detection/violation type'),
      'Error message cites canonical detection registry requirement'
    );

    // Test 5: Camera Verification — Reject Non-Existent Camera
    console.log('\n[Test 5] Camera Verification: Non-Existent Camera...');
    const missingCameraRes = await request(
      'POST',
      '/api/v1/events/intake',
      {
        cameraCode: 'CAM-NON-EXISTENT-XYZ',
        violationType: 'NO_VEST',
        severity: 'HIGH',
      },
      authHeaders
    );

    assert(missingCameraRes.statusCode === 422, `Non-existent camera rejected with 422 (got ${missingCameraRes.statusCode})`);
    const rejectedCameraDoc = await DetectionEvent.findOne({
      cameraCode: 'CAM-NON-EXISTENT-XYZ',
      status: 'REJECTED',
    });
    assert(Boolean(rejectedCameraDoc), 'Rejection record for invalid camera persisted');
    assert(rejectedCameraDoc.rejectionReason.includes('not a registered camera'), 'Rejection reason states camera not registered');

    // Test 6: Camera Verification — Reject Inactive/Decommissioned Camera
    console.log('\n[Test 6] Camera Verification: Deactivated Camera...');
    const inactiveCameraRes = await request(
      'POST',
      '/api/v1/events/intake',
      {
        cameraCode: inactiveCameraCode,
        violationType: 'NO_VEST',
        severity: 'HIGH',
      },
      authHeaders
    );

    assert(inactiveCameraRes.statusCode === 422, `Inactive camera rejected with 422 (got ${inactiveCameraRes.statusCode})`);
    const rejectedInactiveDoc = await DetectionEvent.findOne({
      cameraCode: inactiveCameraCode,
      status: 'REJECTED',
    });
    assert(Boolean(rejectedInactiveDoc), 'Rejection record for inactive camera persisted');
    assert(rejectedInactiveDoc.rejectionReason.includes('deactivated'), 'Rejection reason notes camera is deactivated');

    // Test 7: Database-Enforced eventId Uniqueness & Duplicate Replay Defense
    console.log('\n[Test 7] Event Identifier Uniqueness & Repeated Identifier Handling...');
    const customEventId = `EVT-UNIQUE-${runTag}`;
    const firstUniqueRes = await request(
      'POST',
      '/api/v1/events/intake',
      {
        eventId: customEventId,
        cameraCode: activeCameraCode,
        violationType: 'UNAUTHORIZED_ZONE',
        severity: 'MEDIUM',
      },
      authHeaders
    );

    assert(firstUniqueRes.statusCode === 201, `First submission with custom eventId accepted (got ${firstUniqueRes.statusCode})`);

    // Repeated submission with same eventId
    const secondUniqueRes = await request(
      'POST',
      '/api/v1/events/intake',
      {
        eventId: customEventId,
        cameraCode: activeCameraCode,
        violationType: 'UNAUTHORIZED_ZONE',
        severity: 'MEDIUM',
      },
      authHeaders
    );

    assert(secondUniqueRes.statusCode === 409, `Duplicate eventId rejected with 409 Conflict (got ${secondUniqueRes.statusCode})`);
    assert(secondUniqueRes.data.message.includes('already been accepted'), 'Conflict response clearly notes duplicate eventId');

    // Test 8: Reject Excessive Future-Dated Timestamps (>5 min drift)
    console.log('\n[Test 8] Future-Dated Timestamp Rejection...');
    const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour in future
    const futureRes = await request(
      'POST',
      '/api/v1/events/intake',
      {
        cameraCode: activeCameraCode,
        violationType: 'NO_SAFETY_BOOTS',
        severity: 'HIGH',
        occurredAt: futureDate,
      },
      authHeaders
    );

    assert(futureRes.statusCode === 400, `Future-dated occurredAt rejected with 400 (got ${futureRes.statusCode})`);
    assert(JSON.stringify(futureRes.data.errors).includes('future-dated'), 'Validation error flags future-dated timestamp');

    // Test 9: Context Spoofing Defense (Operational Context is Ignored)
    console.log('\n[Test 9] Operational Context Spoofing Defense...');
    const spoofedRes = await request(
      'POST',
      '/api/v1/events/intake',
      {
        cameraCode: activeCameraCode,
        violationType: 'RESTRICTED_ACCESS',
        severity: 'CRITICAL',
        workFront: 'SPOOFED_WF_FAKE_ID',
        contractor: 'HACKED_CONTRACTOR_CORP',
        riskLevel: 'LOW',
      },
      authHeaders
    );

    assert(spoofedRes.statusCode === 400, `Client payload with unauthorized context fields rejected with 400 strict schema (got ${spoofedRes.statusCode})`);

    // Test 10: Intake Querying, Filtering and Performance Metrics
    console.log('\n[Test 10] Intake Event Querying, Filtering and Metrics Aggregation...');
    const listRes = await request('GET', '/api/v1/events/intake?limit=20', null, authHeaders);
    assert(listRes.statusCode === 200, `GET /api/v1/events/intake returns 200 (got ${listRes.statusCode})`);
    assert(Array.isArray(listRes.data.data.events), 'Returns events array');
    assert(listRes.data.meta.total >= 2, 'Pagination meta reflects ingested records');

    const filteredAcceptedRes = await request('GET', '/api/v1/events/intake?status=ACCEPTED', null, authHeaders);
    assert(filteredAcceptedRes.statusCode === 200, 'Filter status=ACCEPTED returns 200');
    assert(filteredAcceptedRes.data.data.events.every((e) => e.status === 'ACCEPTED'), 'All returned records have status ACCEPTED');

    const statsRes = await request('GET', '/api/v1/events/intake/stats', null, authHeaders);
    assert(statsRes.statusCode === 200, `GET /api/v1/events/intake/stats returns 200 (got ${statsRes.statusCode})`);
    assert(statsRes.data.data.stats.total >= 2, 'Stats total count accurate');
    assert(statsRes.data.data.stats.accepted >= 2, 'Stats accepted count accurate');
    assert(statsRes.data.data.stats.rejected >= 1, 'Stats rejected count accurate');
    assert(typeof statsRes.data.data.stats.acceptanceRate === 'number', 'acceptanceRate percentage computed');

    // Test 11: Inspect Single Event Intake Record
    console.log('\n[Test 11] Single Record Detail Inspection...');
    const singleEventRes = await request('GET', `/api/v1/events/intake/${createdEvent._id}`, null, authHeaders);
    assert(singleEventRes.statusCode === 200, 'GET /api/v1/events/intake/:id returns 200');
    assert(singleEventRes.data.data.event.eventId === createdEvent.eventId, 'Detail matches target eventId');

    // Test 12: Authentication & RBAC Enforcement
    console.log('\n[Test 12] Authentication & Security Enforcement...');
    const unauthRes = await request('POST', '/api/v1/events/intake', { cameraCode: activeCameraCode });
    assert(unauthRes.statusCode === 401, `Unauthenticated intake rejected with 401 (got ${unauthRes.statusCode})`);

    // Test 13: Audit Trail Verification
    console.log('\n[Test 13] Operational Audit Trail Verification...');
    const acceptAudit = await AuditLog.findOne({
      action: 'EVENT_INTAKE_ACCEPTED',
      entityId: validEventRes.data.data.eventId,
    });
    assert(Boolean(acceptAudit), 'EVENT_INTAKE_ACCEPTED logged in AuditLog');

    const rejectAudit = await AuditLog.findOne({
      action: 'EVENT_INTAKE_REJECTED',
    }).sort({ timestamp: -1 });
    assert(Boolean(rejectAudit), 'EVENT_INTAKE_REJECTED logged in AuditLog');

    console.log('\n========================================================================');
    console.log(`  BATCH 1 SUITE RESULTS: ${passedTests}/${totalTests} CHECKS PASSED`);
    console.log('========================================================================\n');

    // Teardown probe cameras and detection events created during this test
    console.log('Teardown: Cleaning test probe records...');
    await Camera.deleteMany({ cameraCode: { $in: [activeCameraCode, inactiveCameraCode] } });
    await DetectionEvent.deleteMany({
      $or: [
        { cameraCode: { $in: [activeCameraCode, inactiveCameraCode, 'CAM-NON-EXISTENT-XYZ'] } },
        { eventId: customEventId },
        { eventId: validEventRes?.data?.data?.eventId },
        { eventId: { $regex: '^REJ-MALFORMED-' } },
      ],
    });
    console.log('Teardown complete.');

    server.close();
    await disconnectDB();
  } catch (error) {
    console.error('Test suite failed with unexpected error:', error);
    if (server) server.close();
    await disconnectDB().catch(() => {});
    process.exit(1);
  }
};

runBatch1Suite();

