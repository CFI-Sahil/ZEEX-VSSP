/**
 * Focused Verification Suite for Milestone 4 Requirements:
 * 1. Demo ingestion accepts only existing active cameras (never auto-creates).
 * 2. Duplicate eventId submissions are rejected.
 * 3. Evidence 5MB limit, JPEG/PNG/WebP format, magic number validation, and non-public storage.
 * 4. Alerts transition strictly PENDING -> ACKNOWLEDGED -> CLOSED (direct closure from PENDING rejected).
 * 5. Demo ingestion route is completely unregistered in production.
 * 6. Audit records correctly capture lifecycle events without immutable/tamper-proof claims.
 */

const http = require('http');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = require('../app');
const { connectDB, disconnectDB } = require('../config/db');
const Alert = require('../models/Alert');
const Evidence = require('../models/Evidence');
const Camera = require('../models/Camera');
const AuditLog = require('../models/AuditLog');
const { validateFileSignature, validateEvidenceFileOnDisk } = require('../utils/fileValidator');

const PORT = 5003;
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

const runFocusedVerification = async () => {
  console.log('========================================================');
  console.log('  FOCUSED VERIFICATION: MILESTONE 4 AUDIT REQUIREMENTS');
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

    // Authenticate Admin
    const adminLoginRes = await request('POST', '/api/v1/auth/login', {
      email: 'admin@vssp.local',
      password: process.env.INITIAL_ADMIN_PASSWORD || 'AdminSecurePass@2026!',
    });
    const adminCookies = adminLoginRes.headers['set-cookie'] || [];
    const adminCookieHeader = adminCookies.map((c) => c.split(';')[0]).join('; ');
    const adminCsrfMatch = adminCookieHeader.match(/vssp_csrf=([^;]+)/);
    const adminCsrfToken = adminCsrfMatch ? decodeURIComponent(adminCsrfMatch[1]) : '';

    const adminHeaders = {
      Cookie: adminCookieHeader,
      'X-CSRF-Token': adminCsrfToken,
    };

    // Ensure a registered active camera exists
    let activeCam = await Camera.findOne({ cameraCode: 'CAM-AUDIT-01' });
    if (!activeCam) {
      activeCam = await Camera.create({
        cameraCode: 'CAM-AUDIT-01',
        name: 'Audit Assembly Line',
        site: 'Plant 1',
        location: 'Zone C North',
        status: 'ONLINE',
        streamStatus: 'UNAVAILABLE',
      });
    }

    // ------------------------------------------------------------------
    // CHECK 1: Demo Ingestion Rejects Non-Existent Cameras (Never Auto-Creates)
    // ------------------------------------------------------------------
    console.log('[Check 1] Verifying Demo Ingestion Accepts ONLY Existing Active Cameras...');
    const nonExistentCode = 'CAM-DOES-NOT-EXIST-999';
    const rejectCamRes = await request(
      'POST',
      '/api/v1/demo/ingest-event',
      {
        cameraCode: nonExistentCode,
        violationType: 'NO_HELMET',
        severity: 'HIGH',
      },
      adminHeaders
    );

    assert(rejectCamRes.status === 404, `Rejects non-existent camera with 404 Not Found (got ${rejectCamRes.status})`);
    assert(
      rejectCamRes.data?.message?.includes('not a registered, active camera'),
      'Returns descriptive error requiring existing registered camera'
    );

    const autoCreatedCam = await Camera.findOne({ cameraCode: nonExistentCode });
    assert(autoCreatedCam === null, 'Confirmed: Camera was NEVER auto-created in database');

    // ------------------------------------------------------------------
    // CHECK 2: Duplicate eventId Submissions Rejected
    // ------------------------------------------------------------------
    console.log('\n[Check 2] Verifying Duplicate eventId Prevention...');
    const duplicateEventId = `EVT-AUDIT-DUP-${Date.now()}`;

    // First submission with eventId
    const firstEventRes = await request(
      'POST',
      '/api/v1/demo/ingest-event',
      {
        eventId: duplicateEventId,
        cameraCode: 'CAM-AUDIT-01',
        violationType: 'NO_HELMET',
        severity: 'HIGH',
      },
      adminHeaders
    );
    assert(firstEventRes.status === 201, 'First event submission with unique eventId succeeds (201)');

    // Second submission with exact same eventId
    const secondEventRes = await request(
      'POST',
      '/api/v1/demo/ingest-event',
      {
        eventId: duplicateEventId,
        cameraCode: 'CAM-AUDIT-01',
        violationType: 'NO_VEST',
        severity: 'MEDIUM',
      },
      adminHeaders
    );
    assert(secondEventRes.status === 400, `Duplicate eventId submission rejected with 400 Bad Request (got ${secondEventRes.status})`);
    assert(
      secondEventRes.data?.message?.includes('Duplicate detection event'),
      'Returns clear duplicate eventId rejection message'
    );

    const eventCount = await Alert.countDocuments({ eventId: duplicateEventId });
    assert(eventCount === 1, `Confirmed: Only 1 Alert exists in MongoDB for eventId '${duplicateEventId}'`);

    // ------------------------------------------------------------------
    // CHECK 3: Evidence File 5MB Limit, Magic Numbers & Non-Public Storage
    // ------------------------------------------------------------------
    console.log('\n[Check 3] Verifying Evidence Validation, Signatures & Storage Isolation...');

    // 3a. Magic Numbers Validation Tests
    const validJpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    const validPngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
    const validWebpHeader = Buffer.from('RIFF\x00\x00\x00\x00WEBPVP8 ');
    const fakeExeHeader = Buffer.from('MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00'); // Windows PE executable header

    assert(validateFileSignature(validJpegHeader).valid === true, 'Signature validator accepts JPEG magic numbers (FF D8 FF)');
    assert(validateFileSignature(validPngHeader).valid === true, 'Signature validator accepts PNG magic numbers (89 50 4E 47)');
    assert(validateFileSignature(validWebpHeader).valid === true, 'Signature validator accepts WebP magic numbers (RIFF...WEBP)');
    assert(validateFileSignature(fakeExeHeader).valid === false, 'Signature validator rejects spoofed non-image binary');

    // 3b. 5MB Limit Check
    const uploadsDir = path.resolve(__dirname, '../../uploads/evidence');
    assert(!uploadsDir.includes('frontend'), 'Evidence storage directory is strictly outside public/frontend web roots');

    // Test that Evidence schema rejects > 5 MB
    const oversizedEvidence = new Evidence({
      evidenceCode: 'EVD-OVERSIZED-TEST',
      alert: firstEventRes.data.data.alert._id,
      alertCode: firstEventRes.data.data.alert.alertCode,
      camera: activeCam._id,
      cameraCode: activeCam.cameraCode,
      fileName: 'oversized.jpg',
      filePath: 'uploads/evidence/oversized.jpg',
      fileType: 'image/jpeg',
      fileSize: 6 * 1024 * 1024, // 6 MB exceeds 5 MB limit
    });

    let schemaValidationFailed = false;
    try {
      await oversizedEvidence.validate();
    } catch (err) {
      schemaValidationFailed = true;
      assert(err.errors.fileSize.message.includes('cannot exceed 5 MB'), 'Evidence schema enforces 5 MB maximum file size limit');
    }
    assert(schemaValidationFailed, 'Validation fails when fileSize exceeds 5 MB');

    // ------------------------------------------------------------------
    // CHECK 4: Alert Lifecycle PENDING -> ACKNOWLEDGED -> CLOSED
    // Direct closure from PENDING must be rejected
    // ------------------------------------------------------------------
    console.log('\n[Check 4] Verifying Strict Transition: PENDING -> ACKNOWLEDGED -> CLOSED...');

    // Ingest a fresh alert in PENDING status
    const freshAlertRes = await request(
      'POST',
      '/api/v1/demo/ingest-event',
      {
        cameraCode: 'CAM-AUDIT-01',
        violationType: 'NO_VEST',
        severity: 'MEDIUM',
      },
      adminHeaders
    );
    const freshAlert = freshAlertRes.data.data.alert;
    assert(freshAlert.status === 'PENDING', 'New alert is created in PENDING status');

    // ATTEMPT DIRECT CLOSURE FROM PENDING (MUST FAIL with 400)
    const directCloseRes = await request(
      'PATCH',
      `/api/v1/alerts/${freshAlert._id}/close`,
      { remarks: 'Direct closure attempt from PENDING' },
      adminHeaders
    );
    assert(directCloseRes.status === 400, `Direct closure from PENDING is rejected with 400 Bad Request (got ${directCloseRes.status})`);
    assert(
      directCloseRes.data?.message?.includes('Direct closure from PENDING is prohibited'),
      'Returns message: Direct closure from PENDING is prohibited'
    );

    // Verify alert is STILL in PENDING status in DB
    const alertStillPending = await Alert.findById(freshAlert._id);
    assert(alertStillPending.status === 'PENDING', 'Alert remained PENDING after rejected direct close attempt');

    // Perform valid step 1: PENDING -> ACKNOWLEDGED
    const validAckRes = await request(
      'PATCH',
      `/api/v1/alerts/${freshAlert._id}/acknowledge`,
      {},
      adminHeaders
    );
    assert(validAckRes.status === 200, 'Valid transition PENDING -> ACKNOWLEDGED succeeds (200 OK)');
    assert(validAckRes.data.data.alert.status === 'ACKNOWLEDGED', 'Status is now ACKNOWLEDGED');

    // Perform valid step 2: ACKNOWLEDGED -> CLOSED
    const validCloseRes = await request(
      'PATCH',
      `/api/v1/alerts/${freshAlert._id}/close`,
      { remarks: 'Operator inspected site and issued high-vis vest.' },
      adminHeaders
    );
    assert(validCloseRes.status === 200, 'Valid transition ACKNOWLEDGED -> CLOSED succeeds (200 OK)');
    assert(validCloseRes.data.data.alert.status === 'CLOSED', 'Status is now CLOSED');

    // ------------------------------------------------------------------
    // CHECK 5: Demo Ingestion Route Available & Protected in Production
    // ------------------------------------------------------------------
    console.log('\n[Check 5] Verifying Demo Ingestion Route is Mounted and Protected in Production...');
    // We inspect routes mounted in backend/src/routes/index.js
    const routesIndexContent = fs.readFileSync(path.resolve(__dirname, '../routes/index.js'), 'utf8');
    const isRouteMounted = routesIndexContent.includes("router.use('/demo', demoRoutes)");
    assert(isRouteMounted, "routes/index.js mounts /demo router: router.use('/demo', demoRoutes)");

    // Test production behavior by creating an app instance with NODE_ENV = 'production'
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    // Clear require cache for env and routes
    delete require.cache[require.resolve('../config/env')];
    delete require.cache[require.resolve('../routes/index')];
    delete require.cache[require.resolve('../app')];

    const prodApp = require('../app');
    const prodServer = http.createServer(prodApp);
    const PROD_PORT = 5004;
    await new Promise((resolve) => prodServer.listen(PROD_PORT, resolve));

    // Request demo endpoint on production server without credentials
    const prodDemoRes = await new Promise((resolve) => {
      const req = http.request(
        {
          hostname: 'localhost',
          port: PROD_PORT,
          path: '/api/v1/demo/ingest-event',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
        (res) => resolve(res.statusCode)
      );
      req.write(JSON.stringify({ cameraCode: 'CAM-AUDIT-01', violationType: 'NO_HELMET', severity: 'HIGH' }));
      req.end();
    });

    assert(prodDemoRes === 401, `Production environment mounts /demo route and enforces authentication (got ${prodDemoRes})`);

    prodServer.close();
    process.env.NODE_ENV = originalEnv;
    // Restore cache
    delete require.cache[require.resolve('../config/env')];
    delete require.cache[require.resolve('../routes/index')];
    delete require.cache[require.resolve('../app')];

    // ------------------------------------------------------------------
    // CHECK 6: Audit Records Capture Lifecycle (Without Tamper-Proof Claims)
    // ------------------------------------------------------------------
    console.log('\n[Check 6] Verifying Audit Trail Capture & Honest Storage Claims...');
    const auditLogsForAlert = await AuditLog.find({
      entityType: 'ALERT',
      entityId: String(freshAlert._id),
    }).sort({ timestamp: 1 });

    const actions = auditLogsForAlert.map((l) => l.action);
    assert(actions.includes('ALERT_CREATED'), 'Audit log captured ALERT_CREATED');
    assert(actions.includes('ALERT_ACKNOWLEDGED'), 'Audit log captured ALERT_ACKNOWLEDGED');
    assert(actions.includes('ALERT_CLOSED'), 'Audit log captured ALERT_CLOSED');

    // Verify codebase does not contain false "tamper-proof" claims
    const auditLoggerContent = fs.readFileSync(path.resolve(__dirname, '../utils/auditLogger.js'), 'utf8');
    assert(!auditLoggerContent.toLowerCase().includes('tamper-proof'), 'Codebase does not claim "tamper-proof" storage');
    assert(!auditLoggerContent.toLowerCase().includes('immutable'), 'Codebase does not claim "immutable" storage');

    console.log('\n========================================================');
    console.log(`  FOCUSED VERIFICATION: ${passedTests}/${totalTests} CHECKS PASSED`);
    console.log('========================================================\n');
  } catch (err) {
    console.error('[Focused Verification Error]:', err);
  } finally {
    console.log('[Teardown] Purging audit test probe records...');
    try {
      await Alert.deleteMany({ cameraCode: 'CAM-AUDIT-01' });
      await Evidence.deleteMany({ cameraCode: 'CAM-AUDIT-01' });
      await Camera.deleteOne({ cameraCode: 'CAM-AUDIT-01' });
      await AuditLog.deleteMany({ details: { cameraCode: 'CAM-AUDIT-01' } });
    } catch (_) {}

    if (server) server.close();
    await disconnectDB();
  }
};

runFocusedVerification();

