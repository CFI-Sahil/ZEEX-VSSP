/**
 * Batch 1 Verification Test Suite: Complete Work-Front Registry
 * Validates:
 * 1. Admin login, CSRF token capture
 * 2. Work-front registration as ADMIN
 * 3. Duplicate workFrontCode rejection (400)
 * 4. Invalid payload rejection (missing fields / invalid enum)
 * 5. Operator read access (GET /work-fronts, GET /work-fronts/:id)
 * 6. Operator mutation rejection with 403 Forbidden (POST, PATCH)
 * 7. Metadata update as ADMIN (PATCH /work-fronts/:id)
 * 8. Status update as ADMIN (PATCH /work-fronts/:id/status)
 * 9. Invalid status transition rejection (e.g., COMPLETED -> PLANNING)
 * 10. Multi-filter & search querying (status, site, contractor, risk, activity)
 * 11. AuditLog entry verification (WORKFRONT_CREATED, WORKFRONT_UPDATED, WORKFRONT_STATUS_CHANGED)
 * 12. Safe cleanup of test probe records
 */

const http = require('http');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = require('../app');
const { connectDB, disconnectDB } = require('../config/db');
const WorkFront = require('../models/WorkFront');
const AuditLog = require('../models/AuditLog');

const PORT = 5004;
let server;

const makeRequest = (options, body = null) => {
  return new Promise((resolve, reject) => {
    const reqOptions = {
      hostname: '127.0.0.1',
      port: PORT,
      path: options.path,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch (_) {
          parsed = data;
        }

        const setCookies = res.headers['set-cookie'] || [];
        const cookies = {};
        setCookies.forEach((sc) => {
          const parts = sc.split(';')[0].split('=');
          cookies[parts[0].trim()] = parts[1] ? parts[1].trim() : '';
        });

        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          cookies,
          body: parsed,
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

const runWorkFrontTests = async () => {
  console.log('\n========================================================');
  console.log('  BATCH 1: WORK-FRONT REGISTRY VERIFICATION SUITE');
  console.log('========================================================\n');

  let passed = 0;
  let total = 0;

  const assert = (condition, message) => {
    total++;
    if (condition) {
      passed++;
      console.log(`  [PASS] ${message}`);
    } else {
      console.error(`  [FAIL] ${message}`);
    }
  };

  try {
    await connectDB();
    server = app.listen(PORT);

    // 1. Authenticate as ADMIN
    const adminLoginRes = await makeRequest(
      { path: '/api/v1/auth/login', method: 'POST' },
      { email: process.env.INITIAL_ADMIN_EMAIL, password: process.env.INITIAL_ADMIN_PASSWORD }
    );
    assert(adminLoginRes.statusCode === 200, 'Admin authenticated successfully');

    const adminCookies = adminLoginRes.cookies;
    const adminCsrfToken = adminLoginRes.headers['x-csrf-token'] || adminCookies['vssp_csrf'];
    const adminCookieHeader = `vssp_jwt=${adminCookies['vssp_jwt']}; vssp_csrf=${adminCookies['vssp_csrf']}`;

    // 2. Authenticate as SAFETY_OPERATOR
    const operatorLoginRes = await makeRequest(
      { path: '/api/v1/auth/login', method: 'POST' },
      { email: process.env.INITIAL_OPERATOR_EMAIL, password: process.env.INITIAL_OPERATOR_PASSWORD }
    );
    assert(operatorLoginRes.statusCode === 200, 'Safety Operator authenticated successfully');

    const operatorCookies = operatorLoginRes.cookies;
    const operatorCsrfToken = operatorLoginRes.headers['x-csrf-token'] || operatorCookies['vssp_csrf'];
    const operatorCookieHeader = `vssp_jwt=${operatorCookies['vssp_jwt']}; vssp_csrf=${operatorCookies['vssp_csrf']}`;

    // 3. Register Work-Front as ADMIN
    const testCode = `WF-TEST-${Date.now().toString(36).toUpperCase()}`;
    const createPayload = {
      workFrontCode: testCode,
      name: 'Boiler Structure Erection Front',
      site: 'Plant 1',
      zone: 'Zone B - Main Assembly',
      contractor: 'Larsen & Toubro Heavy Civil',
      supervisor: {
        name: 'Rajesh Sharma',
        phone: '+91 98765 43210',
        email: 'rajesh.sharma@lt.example.com',
      },
      activityType: 'WORKING_AT_HEIGHT',
      riskLevel: 'HIGH',
      shift: 'MORNING',
      status: 'ACTIVE',
      description: 'Erection of structural steel framework for the main boiler tower.',
    };

    const createRes = await makeRequest(
      {
        path: '/api/v1/work-fronts',
        method: 'POST',
        headers: {
          Cookie: adminCookieHeader,
          'X-CSRF-Token': adminCsrfToken,
        },
      },
      createPayload
    );

    assert(createRes.statusCode === 201, 'Admin can create a new work-front (HTTP 201)');
    assert(createRes.body?.data?.workFront?.workFrontCode === testCode, 'Returned workFrontCode matches input');
    const createdId = createRes.body?.data?.workFront?._id;

    // 4. Duplicate workFrontCode Rejection
    const dupRes = await makeRequest(
      {
        path: '/api/v1/work-fronts',
        method: 'POST',
        headers: {
          Cookie: adminCookieHeader,
          'X-CSRF-Token': adminCsrfToken,
        },
      },
      createPayload
    );
    assert(dupRes.statusCode === 400, 'Duplicate workFrontCode rejected with HTTP 400 Bad Request');

    // 5. Invalid payload validation rejection
    const invalidRes = await makeRequest(
      {
        path: '/api/v1/work-fronts',
        method: 'POST',
        headers: {
          Cookie: adminCookieHeader,
          'X-CSRF-Token': adminCsrfToken,
        },
      },
      { workFrontCode: 'W', name: '' } // Missing site, zone, contractor, etc.
    );
    assert(invalidRes.statusCode === 400, 'Invalid payload rejected with HTTP 400 Validation Error');

    // 6. Operator Read Access (GET /work-fronts & GET /work-fronts/:id)
    const opListRes = await makeRequest({
      path: '/api/v1/work-fronts',
      method: 'GET',
      headers: { Cookie: operatorCookieHeader },
    });
    assert(opListRes.statusCode === 200, 'Safety Operator can list work-fronts (HTTP 200)');
    assert(Array.isArray(opListRes.body?.data?.workFronts), 'Operator response includes workFronts array');
    assert(opListRes.body?.data?.kpis?.totalWorkFronts >= 1, 'Summary KPIs include totalWorkFronts count');

    const opDetailRes = await makeRequest({
      path: `/api/v1/work-fronts/${createdId}`,
      method: 'GET',
      headers: { Cookie: operatorCookieHeader },
    });
    assert(opDetailRes.statusCode === 200, 'Safety Operator can view work-front details (HTTP 200)');
    assert(opDetailRes.body?.data?.workFront?._id === createdId, 'Detail record ID matches');

    // 7. Operator Mutation Rejection (403 Forbidden)
    const opCreateRes = await makeRequest(
      {
        path: '/api/v1/work-fronts',
        method: 'POST',
        headers: {
          Cookie: operatorCookieHeader,
          'X-CSRF-Token': operatorCsrfToken,
        },
      },
      { ...createPayload, workFrontCode: `WF-OP-${Date.now()}` }
    );
    assert(opCreateRes.statusCode === 403, 'Safety Operator blocked from creating work-front (HTTP 403 Forbidden)');

    const opPatchRes = await makeRequest(
      {
        path: `/api/v1/work-fronts/${createdId}`,
        method: 'PATCH',
        headers: {
          Cookie: operatorCookieHeader,
          'X-CSRF-Token': operatorCsrfToken,
        },
      },
      { name: 'Illegal Operator Edit' }
    );
    assert(opPatchRes.statusCode === 403, 'Safety Operator blocked from editing work-front (HTTP 403 Forbidden)');

    // 8. Admin Update Work-Front Metadata
    const updateRes = await makeRequest(
      {
        path: `/api/v1/work-fronts/${createdId}`,
        method: 'PATCH',
        headers: {
          Cookie: adminCookieHeader,
          'X-CSRF-Token': adminCsrfToken,
        },
      },
      {
        name: 'Boiler Structure Erection Front - Phase B',
        riskLevel: 'CRITICAL',
      }
    );
    assert(updateRes.statusCode === 200, 'Admin can update work-front metadata (HTTP 200)');
    assert(
      updateRes.body?.data?.workFront?.name === 'Boiler Structure Erection Front - Phase B',
      'Updated name persisted correctly'
    );
    assert(updateRes.body?.data?.workFront?.riskLevel === 'CRITICAL', 'Updated risk level persisted correctly');

    // 9. Admin Update Status
    const statusRes = await makeRequest(
      {
        path: `/api/v1/work-fronts/${createdId}/status`,
        method: 'PATCH',
        headers: {
          Cookie: adminCookieHeader,
          'X-CSRF-Token': adminCsrfToken,
        },
      },
      { status: 'COMPLETED', remarks: 'Erection completed and inspected by safety auditor' }
    );
    assert(statusRes.statusCode === 200, 'Admin can update status to COMPLETED (HTTP 200)');
    assert(statusRes.body?.data?.workFront?.status === 'COMPLETED', 'Status transitioned to COMPLETED');

    // 10. Invalid Status Transition Rejection (COMPLETED -> PLANNING)
    const invalidStatusRes = await makeRequest(
      {
        path: `/api/v1/work-fronts/${createdId}/status`,
        method: 'PATCH',
        headers: {
          Cookie: adminCookieHeader,
          'X-CSRF-Token': adminCsrfToken,
        },
      },
      { status: 'PLANNING' }
    );
    assert(invalidStatusRes.statusCode === 400, 'Invalid transition from COMPLETED to PLANNING rejected (HTTP 400)');

    // 11. Multi-filter and Search Verification
    const searchRes = await makeRequest({
      path: `/api/v1/work-fronts?search=${testCode}&status=COMPLETED&riskLevel=CRITICAL`,
      method: 'GET',
      headers: { Cookie: adminCookieHeader },
    });
    assert(searchRes.statusCode === 200, 'Filter query executed successfully (HTTP 200)');
    assert(searchRes.body?.data?.workFronts?.length === 1, 'Filter query returned exactly matching work-front');

    // 12. AuditLog Verification
    const auditLogs = await AuditLog.find({
      entityType: 'WORKFRONT',
      entityId: String(createdId),
    }).sort({ timestamp: 1 });

    const actions = auditLogs.map((l) => l.action);
    assert(actions.includes('WORKFRONT_CREATED'), 'AuditLog contains WORKFRONT_CREATED event');
    assert(actions.includes('WORKFRONT_UPDATED'), 'AuditLog contains WORKFRONT_UPDATED event');
    assert(actions.includes('WORKFRONT_STATUS_CHANGED'), 'AuditLog contains WORKFRONT_STATUS_CHANGED event');

    // 13. Cleanup test probe records
    await WorkFront.deleteOne({ _id: createdId });
    await AuditLog.deleteMany({ entityType: 'WORKFRONT', entityId: String(createdId) });
    console.log('  [CLEANUP] Test work-front and audit probe records removed cleanly');

    console.log('\n========================================================');
    console.log(`  VERIFICATION RESULTS: ${passed}/${total} TESTS PASSED`);
    console.log('========================================================\n');
  } catch (err) {
    console.error('Test execution failed:', err);
  } finally {
    if (server) server.close();
    await disconnectDB();
  }
};

runWorkFrontTests();

