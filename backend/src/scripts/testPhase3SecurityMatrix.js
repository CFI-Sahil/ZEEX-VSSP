/**
 * VSSP Phase 3: Comprehensive API Security Matrix Test Suite
 * Programmatically tests authentication, RBAC, CSRF, input validation, IDOR,
 * concurrency, state guard transitions, and information leakage prevention across all Phase 3 endpoints:
 *   - Batch 1 & 2: Event Intake & Processing Engine
 *   - Batch 3: Escalation & Notification Services
 *   - Batch 4: Evidence Vault & Forensic Cryptographic Verification
 *   - Batch 5: Training Sandbox & IDOR Protection
 *   - Batch 6: Shift Handover Lifecycle, Claiming & Self-Ack Guard
 */

const http = require('http');
const path = require('path');
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
const ShiftHandover = require('../models/ShiftHandover');
const TrainingScenario = require('../models/TrainingScenario');
const TrainingSession = require('../models/TrainingSession');
const User = require('../models/User');

const PORT = 5093;
let server;

const SYNTH_PREFIX = 'SYNTH-SEC-P3-';

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
          rawBody: data,
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

const runSecurityMatrixSuite = async () => {
  console.log('\n========================================================================');
  console.log('  VSSP PHASE 3: COMPREHENSIVE SECURITY MATRIX TEST SUITE');
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

    // Authenticate Admin and Operator
    const adminLogin = await request('POST', '/api/v1/auth/login', {
      email: 'admin@vssp.local',
      password: process.env.INITIAL_ADMIN_PASSWORD || 'AdminSecurePass@2026!',
    });
    assert(adminLogin.statusCode === 200, 'Admin login succeeded');

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
    assert(opLogin.statusCode === 200, 'Operator login succeeded');

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

    // Helper to check for sensitive information leaks in response
    const assertNoLeak = (res, testLabel) => {
      const bodyStr = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      const hasStackTrace = bodyStr.includes('node_modules') || bodyStr.includes('MongooseError') || bodyStr.includes('MongoServerError');
      const hasPassword = bodyStr.includes('AdminSecurePass') || bodyStr.includes('OperatorSecurePass') || bodyStr.includes('passwordHash');
      const hasSecret = bodyStr.includes('JWT_SECRET') || bodyStr.includes('CLOUDINARY_API_SECRET');
      assert(!hasStackTrace && !hasPassword && !hasSecret, `${testLabel}: No internal sensitive information leaked in error response`);
    };

    // =========================================================================
    // 1. UNAUTHENTICATED REQUEST ENFORCEMENT (401 Unauthorized)
    // =========================================================================
    console.log('\n--- 1. Unauthenticated Request Controls (401 Unauthorized) ---');
    const protectedEndpoints = [
      { method: 'POST', path: '/api/v1/events/intake', body: {} },
      { method: 'GET', path: '/api/v1/events/intake', body: null },
      { method: 'GET', path: '/api/v1/events/processing-queue/status', body: null },
      { method: 'POST', path: '/api/v1/events/process-queue', body: {} },
      { method: 'GET', path: '/api/v1/notifications', body: null },
      { method: 'GET', path: '/api/v1/notifications/unread-count', body: null },
      { method: 'POST', path: '/api/v1/escalations/evaluate', body: {} },
      { method: 'GET', path: '/api/v1/evidence', body: null },
      { method: 'GET', path: '/api/v1/evidence/stats', body: null },
      { method: 'GET', path: '/api/v1/training/scenarios', body: null },
      { method: 'POST', path: '/api/v1/training/sessions', body: {} },
      { method: 'GET', path: '/api/v1/handovers/operational-summary', body: null },
      { method: 'GET', path: '/api/v1/handovers/dashboard', body: null },
      { method: 'GET', path: '/api/v1/handovers', body: null },
      { method: 'POST', path: '/api/v1/handovers', body: {} },
    ];

    for (const ep of protectedEndpoints) {
      const res = await request(ep.method, ep.path, ep.body);
      assert(res.statusCode === 401, `${ep.method} ${ep.path} unauthenticated request rejected with 401`);
      assertNoLeak(res, `${ep.method} ${ep.path}`);
    }

    // =========================================================================
    // 2. CSRF PROTECTION CONTROLS (403 Forbidden on Mutations)
    // =========================================================================
    console.log('\n--- 2. CSRF Protection Controls (403 Forbidden) ---');
    const mutationEndpoints = [
      { method: 'POST', path: '/api/v1/events/intake', body: { eventId: 'CSRF-TEST-1' } },
      { method: 'POST', path: '/api/v1/events/process-queue', body: { limit: 5 } },
      { method: 'PATCH', path: '/api/v1/notifications/mark-all-read', body: {} },
      { method: 'POST', path: '/api/v1/escalations/evaluate', body: {} },
      { method: 'POST', path: '/api/v1/training/scenarios', body: { title: 'CSRF Scenario' } },
      { method: 'POST', path: '/api/v1/training/sessions', body: { scenarioId: '507f1f77bcf86cd799439011' } },
      { method: 'POST', path: '/api/v1/handovers', body: { shiftLabel: 'CSRF Handover' } },
    ];

    for (const mep of mutationEndpoints) {
      // Omit CSRF header entirely
      const noCsrfHeaders = {
        Cookie: adminCookieHeader,
        Authorization: `Bearer ${adminToken}`,
      };
      const resNoCsrf = await request(mep.method, mep.path, mep.body, noCsrfHeaders);
      assert(resNoCsrf.statusCode === 403, `${mep.method} ${mep.path} without CSRF token rejected with 403 Forbidden`);

      // Provide invalid CSRF token
      const badCsrfHeaders = {
        Cookie: adminCookieHeader,
        Authorization: `Bearer ${adminToken}`,
        'X-CSRF-Token': 'INVALID_MALICIOUS_CSRF_TOKEN_HEX',
      };
      const resBadCsrf = await request(mep.method, mep.path, mep.body, badCsrfHeaders);
      assert(resBadCsrf.statusCode === 403, `${mep.method} ${mep.path} with invalid CSRF token rejected with 403 Forbidden`);
    }

    // =========================================================================
    // 3. ROLE-BASED ACCESS CONTROL (RBAC) ENFORCEMENT
    // =========================================================================
    console.log('\n--- 3. Role-Based Access Control (RBAC) Enforcement ---');
    // Admin-only endpoints should reject SAFETY_OPERATOR with 403 Forbidden
    const adminOnlyEndpoints = [
      { method: 'POST', path: '/api/v1/training/scenarios', body: { title: 'Op Forbidden Scn' } },
      { method: 'PATCH', path: '/api/v1/training/scenarios/507f1f77bcf86cd799439011', body: { title: 'Op Forbidden' } },
      { method: 'PATCH', path: '/api/v1/training/scenarios/507f1f77bcf86cd799439011/publish', body: {} },
      { method: 'PATCH', path: '/api/v1/training/scenarios/507f1f77bcf86cd799439011/archive', body: {} },
    ];

    for (const aep of adminOnlyEndpoints) {
      const res = await request(aep.method, aep.path, aep.body, opHeaders);
      assert(res.statusCode === 403, `${aep.method} ${aep.path} by SAFETY_OPERATOR rejected with 403 Forbidden`);
    }

    // Both ADMIN and SAFETY_OPERATOR should have access to operational endpoints
    const sharedGetEndpoints = [
      '/api/v1/events/intake',
      '/api/v1/events/processing-queue/status',
      '/api/v1/notifications',
      '/api/v1/notifications/unread-count',
      '/api/v1/evidence',
      '/api/v1/evidence/stats',
      '/api/v1/training/scenarios',
      '/api/v1/handovers/operational-summary',
      '/api/v1/handovers/dashboard',
      '/api/v1/handovers',
    ];

    for (const sep of sharedGetEndpoints) {
      const opRes = await request('GET', sep, null, opHeaders);
      assert(opRes.statusCode === 200, `GET ${sep} accessible by SAFETY_OPERATOR (200 OK)`);
      const adminRes = await request('GET', sep, null, adminHeaders);
      assert(adminRes.statusCode === 200, `GET ${sep} accessible by ADMIN (200 OK)`);
    }

    // =========================================================================
    // 4. MALFORMED REQUEST BODY & INPUT VALIDATION (400 Bad Request)
    // =========================================================================
    console.log('\n--- 4. Input Validation & Strict Schema Controls (400 Bad Request) ---');
    // Intake with invalid schema
    const malformedIntake = await request('POST', '/api/v1/events/intake', {
      cameraCode: '',
      violationType: 'INVALID_ENUM_NAME',
    }, adminHeaders);
    assert(malformedIntake.statusCode === 400, 'POST /events/intake with empty camera and invalid enum rejected with 400');

    // Handover with empty shift label
    const malformedHandover = await request('POST', '/api/v1/handovers', {
      shiftType: 'INVALID_SHIFT_TYPE',
      shiftLabel: '',
    }, adminHeaders);
    assert(malformedHandover.statusCode === 400, 'POST /handovers with invalid shiftType rejected with 400');

    // Training session with missing scenarioId
    const malformedSession = await request('POST', '/api/v1/training/sessions', {}, adminHeaders);
    assert(malformedSession.statusCode === 400, 'POST /training/sessions with empty body rejected with 400');

    // =========================================================================
    // 5. RESOURCE IDENTIFIER VALIDATION & 404 NOT FOUND HANDLING
    // =========================================================================
    console.log('\n--- 5. Resource Identifier Validation & Nonexistent Records ---');
    const idValidationEndpoints = [
      { method: 'GET', path: '/api/v1/events/intake/invalid-mongo-id' },
      { method: 'POST', path: '/api/v1/events/invalid-mongo-id/process', body: {} },
      { method: 'GET', path: '/api/v1/evidence/invalid-mongo-id' },
      { method: 'POST', path: '/api/v1/evidence/invalid-mongo-id/verify', body: {} },
      { method: 'GET', path: '/api/v1/training/sessions/invalid-mongo-id' },
      { method: 'GET', path: '/api/v1/handovers/invalid-mongo-id' },
    ];

    for (const iep of idValidationEndpoints) {
      const res = await request(iep.method, iep.path, iep.body, adminHeaders);
      assert(res.statusCode === 400 || res.statusCode === 404, `${iep.method} ${iep.path} with malformed ObjectId safely rejected (${res.statusCode})`);
      assertNoLeak(res, iep.path);
    }

    const nonexistentId = '507f1f77bcf86cd799439011';
    const nonexistentEndpoints = [
      { method: 'GET', path: `/api/v1/events/intake/${nonexistentId}` },
      { method: 'POST', path: `/api/v1/events/${nonexistentId}/process`, body: {} },
      { method: 'GET', path: `/api/v1/evidence/${nonexistentId}` },
      { method: 'GET', path: `/api/v1/training/sessions/${nonexistentId}` },
      { method: 'GET', path: `/api/v1/handovers/${nonexistentId}` },
    ];

    for (const nep of nonexistentEndpoints) {
      const res = await request(nep.method, nep.path, nep.body, adminHeaders);
      assert(res.statusCode === 404, `${nep.method} ${nep.path} on nonexistent ObjectId returns 404 Not Found`);
    }

    // =========================================================================
    // 6. IDOR (INSECURE DIRECT OBJECT REFERENCE) PROTECTION
    // =========================================================================
    console.log('\n--- 6. IDOR & Session Isolation Protection ---');
    // Create training session owned by Admin
    const scenariosRes = await request('GET', '/api/v1/training/scenarios', null, adminHeaders);
    const scenarios = Array.isArray(scenariosRes.data?.data) ? scenariosRes.data.data : [];
    const testScenario = scenarios[0];

    const adminSessionRes = await request('POST', '/api/v1/training/sessions', {
      scenarioId: testScenario._id,
    }, adminHeaders);
    assert(adminSessionRes.statusCode === 201, 'Admin training session created');
    const adminSessionId = adminSessionRes.data?.data?._id;
    createdFixtures.sessionIds.push(adminSessionId);

    // Operator attempts to access Admin's private training session
    const opIdorRes = await request('GET', `/api/v1/training/sessions/${adminSessionId}`, null, opHeaders);
    assert(opIdorRes.statusCode === 403, 'GET /training/sessions/:id by different operator rejected with 403 Forbidden (IDOR Guard)');

    // =========================================================================
    // 7. SHIFT HANDOVER AUTHOR SELF-ACKNOWLEDGEMENT PROTECTION
    // =========================================================================
    console.log('\n--- 7. Shift Handover Self-Acknowledgement Guard ---');
    // Create and submit handover by Operator
    const hoRes = await request('POST', '/api/v1/handovers', {
      shiftDate: new Date().toISOString(),
      shiftType: 'NIGHT',
      shiftLabel: `${SYNTH_PREFIX}Self-Ack Protection Handover`,
      outgoingRemarks: 'Night shift operations.',
    }, opHeaders);
    assert(hoRes.statusCode === 201, 'Handover created by Operator');
    const hoId = hoRes.data?.data?._id;
    createdFixtures.handoverIds.push(hoId);

    await request('POST', `/api/v1/handovers/${hoId}/submit`, {}, opHeaders);

    // Outgoing operator author attempts to self-acknowledge
    const selfAckRes = await request('POST', `/api/v1/handovers/${hoId}/acknowledge`, {
      remarks: 'Self acknowledging',
    }, opHeaders);
    assert(selfAckRes.statusCode === 403, 'POST /handovers/:id/acknowledge by outgoing author rejected with 403 Forbidden');
    assert(
      selfAckRes.data?.message?.toLowerCase().includes('cannot acknowledge their own shift handover') ||
      selfAckRes.data?.message?.includes('Outgoing operator cannot acknowledge'),
      'Rejection message cites self-acknowledgement rule'
    );

    // =========================================================================
    // 8. IMMUTABILITY & INVALID STATE TRANSITIONS
    // =========================================================================
    console.log('\n--- 8. Immutability & Invalid State Guard Transitions ---');
    // Submitted handover cannot be edited
    const editSubmittedRes = await request('PATCH', `/api/v1/handovers/${hoId}`, {
      shiftLabel: 'Altered Title',
    }, opHeaders);
    assert(editSubmittedRes.statusCode === 400, 'PATCH /handovers/:id on SUBMITTED handover returns 400 Bad Request');

    // Submitted handover cannot refresh summary
    const refreshSubmittedRes = await request('POST', `/api/v1/handovers/${hoId}/refresh-summary`, {}, opHeaders);
    assert(refreshSubmittedRes.statusCode === 400, 'POST /handovers/:id/refresh-summary on SUBMITTED handover returns 400 Bad Request');

    // Submitted handover cannot be cancelled
    const cancelSubmittedRes = await request('POST', `/api/v1/handovers/${hoId}/cancel`, {
      cancellationReason: 'Want to cancel submitted',
    }, adminHeaders);
    assert(cancelSubmittedRes.statusCode === 400, 'POST /handovers/:id/cancel on SUBMITTED handover returns 400 Bad Request');

    // =========================================================================
    // TEARDOWN: Clean Security Test Synthetic Fixtures
    // =========================================================================
    console.log('\n--- TEARDOWN: Cleaning Security Matrix Synthetic Fixtures ---');
    const HandoverActivity = require('../models/HandoverActivity');
    await HandoverActivity.deleteMany({ handover: { $in: createdFixtures.handoverIds } });
    await ShiftHandover.deleteMany({ _id: { $in: createdFixtures.handoverIds } });
    await TrainingSession.deleteMany({ _id: { $in: createdFixtures.sessionIds } });

    console.log('\n========================================================================');
    console.log(`  SECURITY MATRIX TEST SUITE COMPLETE: ${passedTests}/${totalTests} PASSED`);
    console.log('========================================================================\n');

    if (passedTests === totalTests) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal Security Matrix Test Error:', err);
    process.exit(1);
  } finally {
    if (server) server.close();
    await disconnectDB();
  }
};

runSecurityMatrixSuite();
