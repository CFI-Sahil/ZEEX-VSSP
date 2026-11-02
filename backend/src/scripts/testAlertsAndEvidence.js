/**
 * Backend Test Suite: Alerts, Evidence, Lifecycle & Demo Ingestion
 */
const http = require('http');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = require('../app');
const { connectDB, disconnectDB } = require('../config/db');
const Alert = require('../models/Alert');
const Evidence = require('../models/Evidence');
const AuditLog = require('../models/AuditLog');
const Camera = require('../models/Camera');

const PORT = 5002;
let server;

// Helper to perform HTTP requests
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
          status: res.statusCode,
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

const runAlertsSuite = async () => {
  console.log('========================================================');
  console.log('  BACKEND ALERTS, EVIDENCE & LIFECYCLE TEST SUITE');
  console.log('========================================================\n');

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
    const adminLoginRes = await request('POST', '/api/v1/auth/login', {
      email: 'admin@vssp.local',
      password: process.env.INITIAL_ADMIN_PASSWORD || 'AdminSecurePass@2026!',
    });
    const adminCookies = adminLoginRes.headers['set-cookie'] || [];
    const adminCookieHeader = adminCookies.map((c) => c.split(';')[0]).join('; ');
    const adminCsrfMatch = adminCookieHeader.match(/vssp_csrf=([^;]+)/);
    const adminCsrfToken = adminCsrfMatch ? decodeURIComponent(adminCsrfMatch[1]) : '';

    // Authenticate as Safety Operator
    const opLoginRes = await request('POST', '/api/v1/auth/login', {
      email: 'operator@vssp.local',
      password: process.env.INITIAL_OPERATOR_PASSWORD || 'OperatorSecurePass@2026!',
    });
    const opCookies = opLoginRes.headers['set-cookie'] || [];
    const opCookieHeader = opCookies.map((c) => c.split(';')[0]).join('; ');
    const opCsrfMatch = opCookieHeader.match(/vssp_csrf=([^;]+)/);
    const opCsrfToken = opCsrfMatch ? decodeURIComponent(opCsrfMatch[1]) : '';

    const adminHeaders = {
      Cookie: adminCookieHeader,
      'X-CSRF-Token': adminCsrfToken,
    };

    const opHeaders = {
      Cookie: opCookieHeader,
      'X-CSRF-Token': opCsrfToken,
    };

    // Ensure a test camera exists
    let testCam = await Camera.findOne({ cameraCode: 'CAM-SUITE-01' });
    if (!testCam) {
      testCam = await Camera.create({
        cameraCode: 'CAM-SUITE-01',
        name: 'Assembly Unit Alpha',
        site: 'Plant 1',
        location: 'Zone A North',
        status: 'ONLINE',
        streamStatus: 'UNAVAILABLE',
      });
    }

    // ------------------------------------------------------------------
    // TEST 1: Demo Event Ingestion
    // ------------------------------------------------------------------
    console.log('[Test 1] Testing Demo Detection Event Ingestion...');
    const ingestRes = await request(
      'POST',
      '/api/v1/demo/ingest-event',
      {
        cameraCode: 'CAM-SUITE-01',
        violationType: 'NO_HELMET',
        severity: 'HIGH',
        confidence: 0.95,
        description: 'Worker in high-risk zone without safety hardhat',
      },
      adminHeaders
    );

    assert(ingestRes.status === 201, `Ingestion returned 201 Created (got ${ingestRes.status})`);
    const createdAlert = ingestRes.data?.data?.alert;
    const createdEvidence = ingestRes.data?.data?.evidence;

    assert(Boolean(createdAlert?._id), 'Alert record created with valid ID');
    assert(createdAlert?.status === 'PENDING', 'New alert strictly starts in PENDING status');
    assert(createdAlert?.violationType === 'NO_HELMET', 'Violation type matches NO_HELMET');
    assert(createdAlert?.severity === 'HIGH', 'Severity matches HIGH');
    assert(Boolean(createdEvidence?._id), 'Associated Evidence record created');
    assert(
      ['image/jpeg', 'image/png'].includes(createdEvidence?.fileType),
      `Evidence fileType is valid image MIME (${createdEvidence?.fileType})`
    );

    // ------------------------------------------------------------------
    // TEST 2: Alert Query & Search Endpoints
    // ------------------------------------------------------------------
    console.log('\n[Test 2] Testing Alert Listing, Search and Filters...');
    const listRes = await request('GET', '/api/v1/alerts', null, adminHeaders);
    assert(listRes.status === 200, 'GET /api/v1/alerts returns 200 OK');
    assert(Array.isArray(listRes.data?.data?.alerts), 'Returns array of alerts');
    assert(listRes.data?.meta?.total >= 1, 'Pagination meta reflects alerts count');

    // Filter by Status PENDING
    const filterPendingRes = await request('GET', '/api/v1/alerts?status=PENDING', null, adminHeaders);
    const pendingList = filterPendingRes.data?.data?.alerts || [];
    assert(
      pendingList.every((a) => a.status === 'PENDING'),
      'Status filter PENDING returns only PENDING alerts'
    );

    // Search by alertCode
    const searchRes = await request(
      'GET',
      `/api/v1/alerts?search=${encodeURIComponent(createdAlert.alertCode)}`,
      null,
      adminHeaders
    );
    assert(
      searchRes.data?.data?.alerts?.some((a) => a.alertCode === createdAlert.alertCode),
      `Search query found alert by alertCode '${createdAlert.alertCode}'`
    );

    // ------------------------------------------------------------------
    // TEST 3: Alert Lifecycle (PENDING -> ACKNOWLEDGED -> CLOSED)
    // ------------------------------------------------------------------
    console.log('\n[Test 3] Testing Alert Lifecycle State Transitions...');

    // Acknowledge by Operator (Safety Operator can acknowledge)
    const ackRes = await request(
      'PATCH',
      `/api/v1/alerts/${createdAlert._id}/acknowledge`,
      {},
      opHeaders
    );
    assert(ackRes.status === 200, `Operator acknowledged alert successfully (200 OK)`);
    assert(ackRes.data?.data?.alert?.status === 'ACKNOWLEDGED', 'Alert status transitioned to ACKNOWLEDGED');
    assert(Boolean(ackRes.data?.data?.alert?.acknowledgedBy), 'acknowledgedBy recorded');

    // Re-acknowledging already acknowledged alert should be rejected (400)
    const duplicateAckRes = await request(
      'PATCH',
      `/api/v1/alerts/${createdAlert._id}/acknowledge`,
      {},
      opHeaders
    );
    assert(duplicateAckRes.status === 400, 'Re-acknowledging already ACKNOWLEDGED alert returns 400 Bad Request');

    // Attempt to close without remarks should fail (400)
    const closeNoRemarksRes = await request(
      'PATCH',
      `/api/v1/alerts/${createdAlert._id}/close`,
      { remarks: '' },
      adminHeaders
    );
    assert(closeNoRemarksRes.status === 400, 'Closing alert without remarks returns 400 Bad Request');

    // Close with valid remarks by Admin
    const closeRes = await request(
      'PATCH',
      `/api/v1/alerts/${createdAlert._id}/close`,
      { remarks: 'Worker briefed and safety helmet provided. Clearance granted.' },
      adminHeaders
    );
    assert(closeRes.status === 200, 'Alert closed successfully with mandatory remarks (200 OK)');
    assert(closeRes.data?.data?.alert?.status === 'CLOSED', 'Alert status transitioned to CLOSED');
    assert(
      closeRes.data?.data?.alert?.closureRemarks === 'Worker briefed and safety helmet provided. Clearance granted.',
      'Closure remarks saved accurately'
    );

    // Attempting to acknowledge or close a CLOSED alert should fail (400)
    const ackClosedRes = await request(
      'PATCH',
      `/api/v1/alerts/${createdAlert._id}/acknowledge`,
      {},
      adminHeaders
    );
    assert(ackClosedRes.status === 400, 'Acknowledging CLOSED alert is rejected with 400 Bad Request');

    const reCloseRes = await request(
      'PATCH',
      `/api/v1/alerts/${createdAlert._id}/close`,
      { remarks: 'Attempt second close' },
      adminHeaders
    );
    assert(reCloseRes.status === 400, 'Re-closing already CLOSED alert is rejected with 400 Bad Request');

    // ------------------------------------------------------------------
    // TEST 4: Evidence Inspection & Secure Streaming
    // ------------------------------------------------------------------
    console.log('\n[Test 4] Testing Evidence Metadata and File Delivery...');
    const evidenceListRes = await request('GET', '/api/v1/evidence', null, opHeaders);
    assert(evidenceListRes.status === 200, 'GET /api/v1/evidence returns 200 OK');
    assert(evidenceListRes.data?.data?.evidence?.length > 0, 'Evidence list contains records');

    const evItem = evidenceListRes.data.data.evidence[0];
    const evDetailRes = await request('GET', `/api/v1/evidence/${evItem._id}`, null, opHeaders);
    assert(evDetailRes.status === 200, 'GET /api/v1/evidence/:id returns 200 OK');
    assert(evDetailRes.data?.data?.evidence?.evidenceCode === evItem.evidenceCode, 'Evidence detail matches code');

    // File streaming
    const fileRes = await request('GET', `/api/v1/evidence/${evItem._id}/file`, null, opHeaders);
    assert(fileRes.status === 200, `Evidence snapshot streamed with 200 OK`);
    assert(
      ['image/jpeg', 'image/png', 'image/webp'].includes(fileRes.headers['content-type']),
      `Evidence stream Content-Type is valid image (${fileRes.headers['content-type']})`
    );
    assert(fileRes.headers['x-content-type-options'] === 'nosniff', 'Security header nosniff present');

    // ------------------------------------------------------------------
    // TEST 5: Audit Log Trail
    // ------------------------------------------------------------------
    console.log('\n[Test 5] Testing Audit Trail Verification...');
    const alertAuditLogs = await AuditLog.find({
      entityType: 'ALERT',
      entityId: String(createdAlert._id),
    });

    const hasCreateAudit = alertAuditLogs.some((l) => l.action === 'ALERT_CREATED' || l.action === 'DEMO_EVENT_INGESTED');
    const hasAckAudit = alertAuditLogs.some((l) => l.action === 'ALERT_ACKNOWLEDGED');
    const hasCloseAudit = alertAuditLogs.some((l) => l.action === 'ALERT_CLOSED');

    assert(hasCreateAudit, 'Audit trail contains ALERT_CREATED');
    assert(hasAckAudit, 'Audit trail contains ALERT_ACKNOWLEDGED');
    assert(hasCloseAudit, 'Audit trail contains ALERT_CLOSED');

    // ------------------------------------------------------------------
    // TEST 6: Dashboard Dynamic Aggregation
    // ------------------------------------------------------------------
    console.log('\n[Test 6] Testing Dashboard Dynamic Summary Aggregation...');
    const dashRes = await request('GET', '/api/v1/dashboard/summary', null, adminHeaders);
    assert(dashRes.status === 200, 'GET /api/v1/dashboard/summary returns 200 OK');
    const kpis = dashRes.data?.data?.kpis;
    assert(kpis?.totalViolations >= 1, `totalViolations reflected in KPIs (${kpis?.totalViolations})`);
    assert(kpis?.resolvedAlerts >= 1, `resolvedAlerts reflected in KPIs (${kpis?.resolvedAlerts})`);
    assert(Array.isArray(dashRes.data?.data?.recentAlerts), 'recentAlerts array returned in summary');

    console.log('\n========================================================');
    console.log(`  BACKEND SUITE: ${passedTests}/${totalTests} CHECKS PASSED`);
    console.log('========================================================\n');
  } catch (err) {
    console.error('[Suite Error]:', err);
  } finally {
    // Teardown test records
    console.log('[Teardown] Purging test probe records...');
    try {
      await Alert.deleteMany({ cameraCode: 'CAM-SUITE-01' });
      await Evidence.deleteMany({ cameraCode: 'CAM-SUITE-01' });
      await Camera.deleteOne({ cameraCode: 'CAM-SUITE-01' });
      await AuditLog.deleteMany({ details: { cameraCode: 'CAM-SUITE-01' } });
    } catch (_) {}

    if (server) server.close();
    await disconnectDB();
  }
};

runAlertsSuite();

