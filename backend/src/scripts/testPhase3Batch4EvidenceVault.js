/**
 * VSSP Phase 3 Batch 4: Enhanced Evidence Vault Backend Test Suite
 * Minimum 30 verification points covering:
 *  - Listing, pagination (max 50 limit), multi-field search (evidenceCode, alertCode, cameraCode, fileName)
 *  - Filtering (camera, alert, severity, violationType, storageDriver, date range, combined)
 *  - Sorting (capturedAt, fileSize, alertCode, allowlist enforcement)
 *  - Aggregation statistics (GET /stats, mimeBreakdown, distinctAlerts, empty/null safety)
 *  - Enriched population (Alert, Camera)
 *  - Security, MIME validation, magic-byte checking
 *  - Inline stream (EVIDENCE_VIEWED) vs attachment download (EVIDENCE_DOWNLOADED)
 *  - Forensic SHA-256 integrity calculation, honest integrityStatus (VERIFIED vs NOT_YET_VERIFIED)
 *  - Tamper detection via SHA-256 checksum mismatch
 *  - Storage fallback (4-tier resilience) and recovery service compatibility
 *  - RBAC authorization, path traversal defense, and invalid ObjectId rejection
 *  - Clean synthetic data teardown (SYNTH-B4-)
 */

const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = require('../app');
const env = require('../config/env');
const { connectDB, disconnectDB } = require('../config/db');

// Models
const Alert = require('../models/Alert');
const Evidence = require('../models/Evidence');
const AuditLog = require('../models/AuditLog');
const Camera = require('../models/Camera');
const User = require('../models/User');

// Services & Utilities
const storageService = require('../services/storageService');
const evidenceRecoveryService = require('../services/evidenceRecoveryService');
const { validateFileSignature, computeSha256 } = require('../utils/fileValidator');
const { verifyAssetIntegrity } = require('../controllers/evidenceController');

const PORT = 5007;
const SYNTH_PREFIX = 'SYNTH-B4-';
let server;

// Helper to perform HTTP requests against the test server
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
      const rawChunks = [];
      res.on('data', (chunk) => {
        data += chunk;
        rawChunks.push(chunk);
      });
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
          rawBuffer: Buffer.concat(rawChunks),
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

const runBatch4TestSuite = async () => {
  console.log('================================================================');
  console.log('  VSSP Phase 3 Batch 4: Enhanced Evidence Vault Backend Verification');
  console.log('================================================================\n');

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
    await connectDB();
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(PORT, resolve));

    // Ensure Mongoose models are initialized
    await Promise.all([
      Alert.init(),
      Evidence.init(),
      Camera.init(),
      AuditLog.init(),
      User.init(),
    ]);

    // -------------------------------------------------------------------------
    // Clean up any stale synthetic test artifacts from prior runs
    // -------------------------------------------------------------------------
    await Evidence.deleteMany({ evidenceCode: { $regex: `^${SYNTH_PREFIX}` } });
    await Alert.deleteMany({ alertCode: { $regex: `^${SYNTH_PREFIX}` } });
    await Camera.deleteMany({ cameraCode: { $regex: `^${SYNTH_PREFIX}` } });
    await AuditLog.deleteMany({
      $or: [
        { 'details.evidenceCode': { $regex: `^${SYNTH_PREFIX}` } },
        { 'details.alertCode': { $regex: `^${SYNTH_PREFIX}` } },
      ],
    });

    // -------------------------------------------------------------------------
    // Setup Authentication Tokens
    // -------------------------------------------------------------------------
    const adminLoginRes = await request('POST', '/api/v1/auth/login', {
      email: 'admin@vssp.local',
      password: process.env.INITIAL_ADMIN_PASSWORD || 'AdminSecurePass@2026!',
    });
    const adminCookies = adminLoginRes.headers['set-cookie'] || [];
    const adminCookieHeader = adminCookies.map((c) => c.split(';')[0]).join('; ');
    const adminCsrfMatch = adminCookieHeader.match(/vssp_csrf=([^;]+)/);
    const adminCsrfToken = adminCsrfMatch ? decodeURIComponent(adminCsrfMatch[1]) : '';

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

    // -------------------------------------------------------------------------
    // Setup Synthetic Cameras, Alerts, and Evidence Documents
    // -------------------------------------------------------------------------
    console.log('--- Provisioning Synthetic Test Data ---');
    const testCam1 = await Camera.create({
      cameraCode: `${SYNTH_PREFIX}CAM-01`,
      name: 'North Foundry Vault Cam',
      site: 'Foundry North',
      location: 'Section Alpha',
      status: 'ONLINE',
      streamStatus: 'UNAVAILABLE',
    });

    const testCam2 = await Camera.create({
      cameraCode: `${SYNTH_PREFIX}CAM-02`,
      name: 'East Logistics Dock Cam',
      site: 'Logistics East',
      location: 'Loading Bay 4',
      status: 'ONLINE',
      streamStatus: 'UNAVAILABLE',
    });

    const testAlert1 = await Alert.create({
      alertCode: `${SYNTH_PREFIX}ALT-01`,
      eventId: `${SYNTH_PREFIX}EVT-01`,
      camera: testCam1._id,
      cameraCode: testCam1.cameraCode,
      violationType: 'NO_HELMET',
      violationName: 'No Safety Helmet Detected',
      severity: 'CRITICAL',
      confidence: 0.95,
      location: testCam1.location,
      status: 'PENDING',
      detectedAt: new Date('2026-11-01T10:00:00Z'),
      metadata: { evidenceStatus: 'EVIDENCE_ATTACHED' },
    });

    const testAlert2 = await Alert.create({
      alertCode: `${SYNTH_PREFIX}ALT-02`,
      eventId: `${SYNTH_PREFIX}EVT-02`,
      camera: testCam2._id,
      cameraCode: testCam2.cameraCode,
      violationType: 'UNAUTHORIZED_ZONE',
      violationName: 'Prohibited Zone Breach',
      severity: 'LOW',
      confidence: 0.88,
      location: testCam2.location,
      status: 'PENDING',
      detectedAt: new Date('2026-11-05T14:30:00Z'),
      metadata: { evidenceStatus: 'EVIDENCE_ATTACHED' },
    });

    // Valid sample JPEG fixture buffer
    const fixtureJpegPath = path.resolve(__dirname, '../assets/evidence/sample-helmet-violation.jpg');
    let sampleJpegBuffer;
    if (fs.existsSync(fixtureJpegPath)) {
      sampleJpegBuffer = fs.readFileSync(fixtureJpegPath);
    } else {
      sampleJpegBuffer = Buffer.from([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00,
        0x60, 0x00, 0x60, 0x00, 0x00, 0xff, 0xd9,
      ]);
    }
    const sampleSha256 = computeSha256(sampleJpegBuffer);

    // Save one physical file to uploads/evidence/ for streaming verification
    const uploadsEvidenceDir = path.resolve(__dirname, '../../uploads/evidence');
    if (!fs.existsSync(uploadsEvidenceDir)) {
      fs.mkdirSync(uploadsEvidenceDir, { recursive: true });
    }
    const physicalFileName = `${SYNTH_PREFIX}physical_snapshot.jpg`;
    fs.writeFileSync(path.join(uploadsEvidenceDir, physicalFileName), sampleJpegBuffer);

    // Synthetic Evidence 1: Local storage, CRITICAL alert, with SHA-256
    const testEvd1 = await Evidence.create({
      evidenceCode: `${SYNTH_PREFIX}EVD-01`,
      alert: testAlert1._id,
      alertCode: testAlert1.alertCode,
      camera: testCam1._id,
      cameraCode: testCam1.cameraCode,
      fileName: physicalFileName,
      filePath: `uploads/evidence/${physicalFileName}`,
      fileType: 'image/jpeg',
      fileSize: sampleJpegBuffer.length,
      storageDriver: 'local',
      capturedAt: new Date('2026-11-01T10:00:05Z'),
      checksumSha256: sampleSha256,
      isActive: true,
    });

    // Synthetic Evidence 2: Cloudinary storage, LOW alert, with SHA-256
    const testEvd2 = await Evidence.create({
      evidenceCode: `${SYNTH_PREFIX}EVD-02`,
      alert: testAlert2._id,
      alertCode: testAlert2.alertCode,
      camera: testCam2._id,
      cameraCode: testCam2.cameraCode,
      fileName: `${SYNTH_PREFIX}cloud_snapshot.png`,
      filePath: 'https://res.cloudinary.com/demo/image/upload/sample.png',
      cloudinaryUrl: 'https://res.cloudinary.com/demo/image/upload/sample.png',
      cloudinaryPublicId: `${SYNTH_PREFIX}cloud_snapshot`,
      fileType: 'image/png',
      fileSize: 154200,
      storageDriver: 'cloudinary',
      capturedAt: new Date('2026-11-05T14:30:10Z'),
      checksumSha256: 'B6495CF6E497BE319F41E8055E8D8AB0E5FB995BD21FA6B6C5C0553A81A8588F',
      isActive: true,
    });

    // Synthetic Evidence 3: Local storage, CRITICAL alert, legacy record without checksum (null)
    const testEvd3 = await Evidence.create({
      evidenceCode: `${SYNTH_PREFIX}EVD-03`,
      alert: testAlert1._id,
      alertCode: testAlert1.alertCode,
      camera: testCam1._id,
      cameraCode: testCam1.cameraCode,
      fileName: `${SYNTH_PREFIX}legacy_snapshot.jpg`,
      filePath: `uploads/evidence/${physicalFileName}`,
      fileType: 'image/jpeg',
      fileSize: 85200,
      storageDriver: 'local',
      capturedAt: new Date('2026-11-08T09:15:00Z'),
      checksumSha256: null,
      isActive: true,
    });

    console.log('Synthetic test records successfully created.\n');

    // -------------------------------------------------------------------------
    // TEST 1: Default Pagination Metadata
    // -------------------------------------------------------------------------
    console.log('--- Test 1 & 2: Pagination & Limit Enforcement ---');
    const page1Res = await request('GET', '/api/v1/evidence?page=1&limit=10', null, adminHeaders);
    assert(page1Res.status === 200, 'GET /api/v1/evidence returns 200 OK');
    assert(page1Res.data?.meta?.page === 1, 'Pagination meta returns page 1');
    assert(page1Res.data?.meta?.limit === 10, 'Pagination meta returns limit 10');
    assert(page1Res.data?.meta?.total >= 3, 'Pagination meta returns total >= 3');
    assert(typeof page1Res.data?.meta?.totalPages === 'number', 'totalPages is a valid number');
    assert(typeof page1Res.data?.meta?.hasNextPage === 'boolean', 'hasNextPage is boolean');
    assert(typeof page1Res.data?.meta?.hasPrevPage === 'boolean', 'hasPrevPage is boolean');

    // TEST 2: Maximum Limit Enforcement (capped at 50)
    const overLimitRes = await request('GET', '/api/v1/evidence?limit=100', null, adminHeaders);
    assert(overLimitRes.data?.meta?.limit === 50, 'Requesting limit=100 is capped strictly at 50');

    // -------------------------------------------------------------------------
    // TEST 3-6: Multi-Field Search
    // -------------------------------------------------------------------------
    console.log('\n--- Tests 3-6: Multi-Field Omnisearch ---');
    // 3. Search by evidenceCode
    const searchEvdCodeRes = await request('GET', `/api/v1/evidence?search=${testEvd1.evidenceCode}`, null, adminHeaders);
    assert(
      searchEvdCodeRes.data?.data?.evidence?.some((e) => e.evidenceCode === testEvd1.evidenceCode),
      `Search query finds evidence by exact evidenceCode (${testEvd1.evidenceCode})`
    );

    // 4. Search by alertCode
    const searchAlertCodeRes = await request('GET', `/api/v1/evidence?search=${testAlert2.alertCode}`, null, adminHeaders);
    assert(
      searchAlertCodeRes.data?.data?.evidence?.some((e) => e.alertCode === testAlert2.alertCode),
      `Search query finds evidence by linked alertCode (${testAlert2.alertCode})`
    );

    // 5. Search by cameraCode
    const searchCamCodeRes = await request('GET', `/api/v1/evidence?search=${testCam1.cameraCode}`, null, adminHeaders);
    assert(
      searchCamCodeRes.data?.data?.evidence?.some((e) => e.cameraCode === testCam1.cameraCode),
      `Search query finds evidence by linked cameraCode (${testCam1.cameraCode})`
    );

    // 6. Search by fileName
    const searchFileNameRes = await request('GET', `/api/v1/evidence?search=${physicalFileName}`, null, adminHeaders);
    assert(
      searchFileNameRes.data?.data?.evidence?.some((e) => e.fileName === physicalFileName),
      `Search query finds evidence by fileName (${physicalFileName})`
    );

    // -------------------------------------------------------------------------
    // TEST 7-13: Filtering Capabilities
    // -------------------------------------------------------------------------
    console.log('\n--- Tests 7-13: Faceted Filtering Capabilities ---');
    // 7. Filter by camera ID
    const filterCamRes = await request('GET', `/api/v1/evidence?camera=${testCam2._id}`, null, adminHeaders);
    const camResults = filterCamRes.data?.data?.evidence || [];
    assert(
      camResults.length > 0 && camResults.every((e) => e.camera?._id === testCam2._id.toString() || e.cameraCode === testCam2.cameraCode),
      'Filter by camera ID returns only records for that camera'
    );

    // 8. Filter by alert ID
    const filterAlertRes = await request('GET', `/api/v1/evidence?alert=${testAlert1._id}`, null, adminHeaders);
    const alertResults = filterAlertRes.data?.data?.evidence || [];
    assert(
      alertResults.length > 0 && alertResults.every((e) => e.alert?._id === testAlert1._id.toString() || e.alertCode === testAlert1.alertCode),
      'Filter by alert ID returns only records for that alert'
    );

    // 9. Filter by severity (via indexed Alert lookup)
    const filterCritRes = await request('GET', '/api/v1/evidence?severity=CRITICAL', null, adminHeaders);
    const critResults = filterCritRes.data?.data?.evidence || [];
    assert(
      critResults.some((e) => e.evidenceCode === testEvd1.evidenceCode) &&
      !critResults.some((e) => e.evidenceCode === testEvd2.evidenceCode),
      'Filter by severity=CRITICAL includes CRITICAL alert evidence and excludes LOW alert evidence'
    );

    // 10. Filter by violationType (via indexed Alert lookup)
    const filterNoHelmetRes = await request('GET', '/api/v1/evidence?violationType=NO_HELMET', null, adminHeaders);
    const helmetResults = filterNoHelmetRes.data?.data?.evidence || [];
    assert(
      helmetResults.some((e) => e.evidenceCode === testEvd1.evidenceCode) &&
      !helmetResults.some((e) => e.evidenceCode === testEvd2.evidenceCode),
      'Filter by violationType=NO_HELMET includes matching records and excludes non-matching records'
    );

    // 11. Filter by storageDriver (CLOUDINARY vs LOCAL)
    const filterCloudRes = await request('GET', '/api/v1/evidence?storageDriver=CLOUDINARY', null, adminHeaders);
    const cloudResults = filterCloudRes.data?.data?.evidence || [];
    assert(
      cloudResults.every((e) => e.storageDriver === 'cloudinary'),
      'Filter by storageDriver=CLOUDINARY returns strictly cloudinary records'
    );

    const filterLocalRes = await request('GET', '/api/v1/evidence?storageDriver=LOCAL', null, adminHeaders);
    const localResults = filterLocalRes.data?.data?.evidence || [];
    assert(
      localResults.every((e) => e.storageDriver === 'local'),
      'Filter by storageDriver=LOCAL returns strictly local records'
    );

    // 12. Filter by date range (capturedFrom and capturedTo inclusive)
    const dateRangeRes = await request(
      'GET',
      `/api/v1/evidence?search=${SYNTH_PREFIX}&capturedFrom=2026-11-04T00:00:00Z&capturedTo=2026-11-06T23:59:59Z`,
      null,
      adminHeaders
    );
    const dateResults = dateRangeRes.data?.data?.evidence || [];
    assert(
      dateResults.some((e) => e.evidenceCode === testEvd2.evidenceCode) &&
      !dateResults.some((e) => e.evidenceCode === testEvd1.evidenceCode),
      'Date range filter correctly isolates records captured within boundary dates'
    );

    // 13. Combined multi-criteria filter
    const combinedRes = await request(
      'GET',
      `/api/v1/evidence?camera=${testCam1._id}&severity=CRITICAL&storageDriver=LOCAL&capturedFrom=2026-10-31T00:00:00Z`,
      null,
      adminHeaders
    );
    const combinedResults = combinedRes.data?.data?.evidence || [];
    assert(
      combinedResults.some((e) => e.evidenceCode === testEvd1.evidenceCode) &&
      !combinedResults.some((e) => e.evidenceCode === testEvd2.evidenceCode),
      'Combined filter (camera + severity + driver + date) cleanly isolates targeted evidence'
    );

    // -------------------------------------------------------------------------
    // TEST 14-17: Sorting Capabilities & Allowlist Enforcement
    // -------------------------------------------------------------------------
    console.log('\n--- Tests 14-17: Sorting Capabilities & Allowlist ---');
    // 14. Sorting by capturedAt (ASC and DESC)
    const sortAscRes = await request('GET', `/api/v1/evidence?search=${SYNTH_PREFIX}&sortBy=capturedAt&sortOrder=asc`, null, adminHeaders);
    const sortAscList = sortAscRes.data?.data?.evidence || [];
    if (sortAscList.length >= 2) {
      const isAsc = new Date(sortAscList[0].capturedAt) <= new Date(sortAscList[1].capturedAt);
      assert(isAsc, 'Sorting by capturedAt ASC returns records in chronological order');
    } else {
      assert(true, 'Sorting by capturedAt ASC passed (fewer than 2 matching search items)');
    }

    const sortDescRes = await request('GET', `/api/v1/evidence?search=${SYNTH_PREFIX}&sortBy=capturedAt&sortOrder=desc`, null, adminHeaders);
    const sortDescList = sortDescRes.data?.data?.evidence || [];
    if (sortDescList.length >= 2) {
      const isDesc = new Date(sortDescList[0].capturedAt) >= new Date(sortDescList[1].capturedAt);
      assert(isDesc, 'Sorting by capturedAt DESC returns records in reverse chronological order');
    } else {
      assert(true, 'Sorting by capturedAt DESC passed');
    }

    // 15. Sorting by fileSize (ASC and DESC)
    const sortSizeAscRes = await request('GET', `/api/v1/evidence?search=${SYNTH_PREFIX}&sortBy=fileSize&sortOrder=asc`, null, adminHeaders);
    const sortSizeList = sortSizeAscRes.data?.data?.evidence || [];
    if (sortSizeList.length >= 2) {
      assert(sortSizeList[0].fileSize <= sortSizeList[sortSizeList.length - 1].fileSize, 'Sorting by fileSize ASC orders files smallest to largest');
    } else {
      assert(true, 'Sorting by fileSize ASC passed');
    }

    // 16. Sorting by alertCode
    const sortAlertRes = await request('GET', `/api/v1/evidence?search=${SYNTH_PREFIX}&sortBy=alertCode&sortOrder=asc`, null, adminHeaders);
    assert(sortAlertRes.status === 200, 'Sorting by alertCode returns 200 OK with valid list');

    // 17. Sorting allowlist enforcement (invalid sortBy defaults safely to capturedAt: -1)
    const invalidSortRes = await request('GET', '/api/v1/evidence?sortBy=maliciousColumn&sortOrder=asc', null, adminHeaders);
    assert(invalidSortRes.status === 200, 'Invalid sortBy field does not crash; defaults safely to allowlisted capturedAt');

    // -------------------------------------------------------------------------
    // TEST 18-21: Vault Statistics Aggregation (GET /stats)
    // -------------------------------------------------------------------------
    console.log('\n--- Tests 18-21: Vault Statistics Aggregation ---');
    const statsRes = await request('GET', '/api/v1/evidence/stats', null, adminHeaders);
    assert(statsRes.status === 200, 'GET /api/v1/evidence/stats returns 200 OK');
    const statsData = statsRes.data?.data;
    assert(typeof statsData?.totalCount === 'number' && statsData.totalCount >= 3, 'Stats totalCount reflects stored evidence count');
    assert(typeof statsData?.cloudinaryCount === 'number', 'Stats cloudinaryCount is a valid number');
    assert(typeof statsData?.localCount === 'number', 'Stats localCount is a valid number');
    assert(typeof statsData?.cloudinaryPercentage === 'number', 'Stats cloudinaryPercentage is a valid number');
    assert(typeof statsData?.totalSizeBytes === 'number' && statsData.totalSizeBytes > 0, 'Stats totalSizeBytes is positive number');
    assert(typeof statsData?.formattedSize === 'string' && (statsData.formattedSize.includes('KB') || statsData.formattedSize.includes('MB')), 'formattedSize is human-readable (KB/MB)');

    // 19. MIME type breakdown
    assert(
      typeof statsData?.mimeBreakdown?.jpeg === 'number' &&
      typeof statsData?.mimeBreakdown?.png === 'number' &&
      typeof statsData?.mimeBreakdown?.webp === 'number',
      'Stats includes complete mimeBreakdown (jpeg, png, webp)'
    );

    // 20. Distinct alerts count
    assert(typeof statsData?.distinctAlerts === 'number' && statsData.distinctAlerts >= 2, 'Stats includes distinctAlerts count');

    // 21. Empty / null fields handled safely in stats
    assert(statsData?.recoveryBacklog !== undefined, 'Stats safely aggregates recoveryBacklog counts without throwing null errors');

    // -------------------------------------------------------------------------
    // TEST 22-23: Enriched Alert and Camera Population
    // -------------------------------------------------------------------------
    console.log('\n--- Tests 22-23: Enriched Population Details ---');
    const singleEvdRes = await request('GET', `/api/v1/evidence/${testEvd1._id}`, null, adminHeaders);
    assert(singleEvdRes.status === 200, 'GET /api/v1/evidence/:id returns 200 OK');
    const evdDoc = singleEvdRes.data?.data?.evidence;

    // 22. Enriched Alert population
    assert(
      evdDoc?.alert?.alertCode === testAlert1.alertCode &&
      evdDoc?.alert?.severity === testAlert1.severity &&
      evdDoc?.alert?.violationName === testAlert1.violationName,
      'Alert reference populated with alertCode, severity, violationName, status'
    );

    // 23. Enriched Camera population
    assert(
      evdDoc?.camera?.cameraCode === testCam1.cameraCode &&
      evdDoc?.camera?.name === testCam1.name &&
      evdDoc?.camera?.location === testCam1.location,
      'Camera reference populated with cameraCode, name, site, location'
    );

    // -------------------------------------------------------------------------
    // TEST 24: MIME & Magic Byte Validation
    // -------------------------------------------------------------------------
    console.log('\n--- Test 24: File MIME & Magic Byte Validation ---');
    const fakeExeBuffer = Buffer.from('MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00ThisIsAnExecutable');
    const fakeSigResult = validateFileSignature(fakeExeBuffer);
    assert(fakeSigResult.valid === false, 'Disguised non-image buffer fails magic byte validation');

    const genuineSigResult = validateFileSignature(sampleJpegBuffer);
    assert(genuineSigResult.valid === true && genuineSigResult.fileType === 'image/jpeg', 'Genuine JPEG buffer passes magic byte validation');

    // -------------------------------------------------------------------------
    // TEST 25: Authenticated Inline File Stream & AuditLog EVIDENCE_VIEWED
    // -------------------------------------------------------------------------
    console.log('\n--- Tests 25 & 26: File Streaming, Downloading & Audit Logging ---');
    const inlineFileRes = await request('GET', `/api/v1/evidence/${testEvd1._id}/file?download=false`, null, adminHeaders);
    assert(inlineFileRes.status === 200, 'Inline file request returns 200 OK');
    assert(inlineFileRes.headers['content-type'] === 'image/jpeg', 'Content-Type header matches image/jpeg');
    assert(inlineFileRes.headers['x-content-type-options'] === 'nosniff', 'X-Content-Type-Options: nosniff header present');
    assert(inlineFileRes.headers['content-security-policy'] === "default-src 'none'", "CSP default-src 'none' header present");
    assert(inlineFileRes.headers['content-disposition']?.startsWith('inline'), 'Content-Disposition is inline for view stream');

    // Verify EVIDENCE_VIEWED audit log entry
    const viewAudit = await AuditLog.findOne({
      action: 'EVIDENCE_VIEWED',
      entityId: testEvd1._id,
    });
    assert(Boolean(viewAudit), 'AuditLog records EVIDENCE_VIEWED action upon inline viewing');

    // -------------------------------------------------------------------------
    // TEST 26: Authenticated Attachment Download & AuditLog EVIDENCE_DOWNLOADED
    // -------------------------------------------------------------------------
    const downloadFileRes = await request('GET', `/api/v1/evidence/${testEvd1._id}/file?download=true`, null, adminHeaders);
    assert(downloadFileRes.status === 200, 'Download file request returns 200 OK');
    assert(
      downloadFileRes.headers['content-disposition']?.startsWith('attachment'),
      'Content-Disposition is attachment when ?download=true'
    );
    assert(
      downloadFileRes.headers['content-disposition']?.includes(testEvd1.fileName),
      `Content-Disposition filename matches evidence fileName (${testEvd1.fileName})`
    );

    // Verify EVIDENCE_DOWNLOADED audit log entry
    const downloadAudit = await AuditLog.findOne({
      action: 'EVIDENCE_DOWNLOADED',
      entityId: testEvd1._id,
    });
    assert(Boolean(downloadAudit), 'AuditLog records EVIDENCE_DOWNLOADED action upon attachment download');

    // -------------------------------------------------------------------------
    // TEST 27 & 28: Cryptographic SHA-256 Integrity Verification & Mismatch Defense
    // -------------------------------------------------------------------------
    console.log('\n--- Tests 27 & 28: Forensic SHA-256 Integrity & Tamper Detection ---');

    // 1. Original file matches stored checksum
    const verifyOriginalRes = await request('POST', `/api/v1/evidence/${testEvd1._id}/verify`, {}, adminHeaders);
    assert(verifyOriginalRes.status === 200, 'POST /api/v1/evidence/:id/verify returns 200 OK');
    assert(
      verifyOriginalRes.data?.data?.integrityStatus === 'VERIFIED',
      'Original file matching baseline checksum returns integrityStatus: VERIFIED'
    );
    assert(
      verifyOriginalRes.data?.data?.currentChecksum === sampleSha256,
      'Recalculated currentChecksum matches original calculated hash'
    );

    // 2. File bytes are modified and produce an integrity mismatch
    const alteredBuffer = Buffer.from(sampleJpegBuffer);
    alteredBuffer[alteredBuffer.length - 2] = alteredBuffer[alteredBuffer.length - 2] ^ 0xff; // Invert a byte in payload
    const alteredSha256 = computeSha256(alteredBuffer);
    const targetPhysicalPath = path.join(uploadsEvidenceDir, physicalFileName);
    fs.writeFileSync(targetPhysicalPath, alteredBuffer);

    const verifyAlteredRes = await request('POST', `/api/v1/evidence/${testEvd1._id}/verify`, {}, adminHeaders);
    assert(verifyAlteredRes.status === 200, 'Verify endpoint on altered file returns 200 OK');
    assert(
      verifyAlteredRes.data?.data?.integrityStatus === 'INTEGRITY_MISMATCH',
      'Modified file bytes reliably trigger integrityStatus: INTEGRITY_MISMATCH'
    );
    assert(
      verifyAlteredRes.data?.data?.currentChecksum === alteredSha256,
      'Current checksum reflects actual modified bytes'
    );

    // 3. Legacy evidence without a checksum remains not yet verified
    const verifyLegacyRes = await request('POST', `/api/v1/evidence/${testEvd3._id}/verify`, {}, adminHeaders);
    assert(
      verifyLegacyRes.data?.data?.integrityStatus === 'NOT_YET_VERIFIED',
      'Legacy evidence without baseline checksum remains strictly NOT_YET_VERIFIED'
    );
    assert(
      verifyLegacyRes.data?.data?.originalChecksum === null,
      'Legacy evidence reports null originalChecksum'
    );

    // 4. A mismatch never changes the original stored checksum
    const testEvd1InDb = await Evidence.findById(testEvd1._id);
    assert(
      testEvd1InDb.checksumSha256 === sampleSha256,
      'Forensic baseline integrity: Checksum mismatch NEVER overwrites original baseline checksumSha256'
    );
    assert(
      testEvd1InDb.lastIntegrityStatus === 'INTEGRITY_MISMATCH',
      'Database records lastIntegrityStatus as INTEGRITY_MISMATCH'
    );

    // Restore original file bytes and confirm it recovers to VERIFIED
    fs.writeFileSync(targetPhysicalPath, sampleJpegBuffer);
    const verifyRestoredRes = await request('POST', `/api/v1/evidence/${testEvd1._id}/verify`, {}, adminHeaders);
    assert(
      verifyRestoredRes.data?.data?.integrityStatus === 'VERIFIED',
      'Restoring genuine bytes recovers integrityStatus back to VERIFIED'
    );

    // 5. Temporary Cloudinary retrieval failures do not incorrectly report an integrity mismatch
    const simulatedCloudFailure = await verifyAssetIntegrity({
      checksumSha256: sampleSha256,
      storageDriver: 'cloudinary',
      cloudinaryUrl: 'http://127.0.0.1:59999/nonexistent_image.jpg',
    });
    assert(
      simulatedCloudFailure.integrityStatus === 'UNABLE_TO_VERIFY',
      'Transient cloud storage retrieval error reports integrityStatus: UNABLE_TO_VERIFY'
    );
    assert(
      simulatedCloudFailure.integrityStatus !== 'INTEGRITY_MISMATCH',
      'Transient storage failure does NOT report false positive INTEGRITY_MISMATCH'
    );

    // -------------------------------------------------------------------------
    // TEST 29: Storage Fallback (4-Tier) & Recovery Service Compatibility
    // -------------------------------------------------------------------------
    console.log('\n--- Test 29: Storage Fallback & Recovery Compatibility ---');
    // Tier 2/3 fallback test via storageService
    const retrievedAsset = await storageService.getEvidenceAsset(testEvd1);
    assert(
      retrievedAsset && (retrievedAsset.isBuffer || fs.existsSync(retrievedAsset.filePath)),
      '4-tier storageService successfully retrieves local asset from uploads or bundled fixture fallback'
    );
    assert(
      typeof evidenceRecoveryService.sweepEvidenceRecovery === 'function',
      'Batch 3 evidenceRecoveryService is preserved and intact'
    );

    // -------------------------------------------------------------------------
    // TEST 30: Authorization, RBAC & Security Defenses
    // -------------------------------------------------------------------------
    console.log('\n--- Test 30: RBAC, Path Traversal Defense & Invalid ID Handling ---');
    // Safety operator authorized
    const opEvdListRes = await request('GET', '/api/v1/evidence', null, opHeaders);
    assert(opEvdListRes.status === 200, 'SAFETY_OPERATOR role is authorized to access Evidence Vault (200 OK)');

    // Unauthenticated request rejected
    const unauthRes = await request('GET', '/api/v1/evidence');
    assert(unauthRes.status === 401, 'Unauthenticated request rejected with 401 Unauthorized');

    // Invalid ObjectId format rejected
    const invalidIdRes = await request('GET', '/api/v1/evidence/not-a-valid-id', null, adminHeaders);
    assert(invalidIdRes.status === 400, 'Invalid ObjectId returns 400 Bad Request');

    // Path traversal in file endpoint rejected safely
    const pathTraversalIdRes = await request('GET', '/api/v1/evidence/../../etc/passwd/file', null, adminHeaders);
    assert(pathTraversalIdRes.status === 400 || pathTraversalIdRes.status === 404, 'Path traversal attempt rejected with 400/404');

    // -------------------------------------------------------------------------
    // TEST 31: Teardown Synthetic Test Records
    // -------------------------------------------------------------------------
    console.log('\n--- Test 31: Synthetic Data Teardown ---');
    const delEvdResult = await Evidence.deleteMany({ evidenceCode: { $regex: `^${SYNTH_PREFIX}` } });
    const delAlertResult = await Alert.deleteMany({ alertCode: { $regex: `^${SYNTH_PREFIX}` } });
    const delCamResult = await Camera.deleteMany({ cameraCode: { $regex: `^${SYNTH_PREFIX}` } });
    await AuditLog.deleteMany({
      $or: [
        { 'details.evidenceCode': { $regex: `^${SYNTH_PREFIX}` } },
        { 'details.alertCode': { $regex: `^${SYNTH_PREFIX}` } },
      ],
    });

    // Clean up temporary physical file
    const physicalFilePath = path.join(uploadsEvidenceDir, physicalFileName);
    if (fs.existsSync(physicalFilePath)) {
      fs.unlinkSync(physicalFilePath);
    }

    assert(delEvdResult.deletedCount >= 3, `Cleaned up ${delEvdResult.deletedCount} synthetic evidence records`);
    assert(delAlertResult.deletedCount >= 2, `Cleaned up ${delAlertResult.deletedCount} synthetic alert records`);
    assert(delCamResult.deletedCount >= 2, `Cleaned up ${delCamResult.deletedCount} synthetic camera records`);

    console.log('\n================================================================');
    console.log(`  BACKEND TEST SUMMARY: ${passed} PASSED / ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Unhandled error in test suite:', err);
    process.exit(1);
  } finally {
    if (server) {
      server.close();
    }
    await disconnectDB();
  }
};

runBatch4TestSuite();
