/**
 * Batch 3 Verification Test Suite: Automated Alert Context Enrichment
 * Validates:
 * 1. Admin login, CSRF capture
 * 2. Ingest demo event without cameraCode is rejected (HTTP 400)
 * 3. Ingest demo event with unregistered camera is rejected (HTTP 404)
 * 4. Ingest demo event on UNASSIGNED camera creates valid alert with workFront: null
 * 5. Ingest demo event on ASSIGNED camera automatically enriches alert with workFront snapshot
 * 6. Enrichment fields match WorkFront details (workFrontCode, contractor, activityType, riskLevel, shift, zone)
 * 7. Ingestion ignores client-supplied work-front and contractor override attempts (Security / Integrity)
 * 8. Ingest demo event on camera mapped to COMPLETED WorkFront does not attach active context
 * 9. Duplicate eventId ingestion is rejected (HTTP 409)
 * 10. AuditLog captures ALERT_CREATED with operational context details
 * 11. Relocating camera does not mutate historical snapshot of previously created alert (Historical Integrity)
 * 12. GET /api/v1/alerts returns enriched workFront and snapshot fields
 * 13. Search by workFrontCode matches enriched alert
 * 14. Search by contractor matches enriched alert
 * 15. GET /api/v1/alerts/:id returns populated workFront object
 * 16. Alert lifecycle (PENDING -> ACKNOWLEDGED -> CLOSED) preserves enrichment intact
 * 17. Legacy / unassigned alerts continue to render and function without error
 * 18. Clean teardown of all test fixtures
 */

const http = require('http');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = require('../app');
const { connectDB, disconnectDB } = require('../config/db');
const WorkFront = require('../models/WorkFront');
const Camera = require('../models/Camera');
const Alert = require('../models/Alert');
const AuditLog = require('../models/AuditLog');

const PORT = 5006;
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

const runBatch3Tests = async () => {
  console.log('\n========================================================');
  console.log('  BATCH 3: AUTOMATED ALERT CONTEXT ENRICHMENT SUITE');
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

  // Fixture IDs to clean up
  const createdAlertIds = [];
  const createdCameraIds = [];
  const createdWorkFrontIds = [];

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

    const adminAuthHeaders = {
      Cookie: adminCookieHeader,
      'x-csrf-token': adminCsrfToken,
    };

    // 2. Setup Test Fixtures:
    // Create an unassigned test camera
    const unassignedCamCode = `CAM-UNASS-${Date.now().toString(36).toUpperCase()}`;
    const unassignedCam = await Camera.create({
      cameraCode: unassignedCamCode,
      name: 'Unassigned Test Camera',
      site: 'Refinery South',
      location: 'Perimeter Gate 3',
      status: 'ONLINE',
      streamStatus: 'DEMO_FEED',
      workFront: null,
      isActive: true,
    });
    createdCameraIds.push(unassignedCam._id);

    // Create an active WorkFront
    const activeWfCode = `WF-B3ACT-${Date.now().toString(36).toUpperCase()}`;
    const activeWf = await WorkFront.create({
      workFrontCode: activeWfCode,
      name: 'Deep Trench Excavation Sector 7',
      site: 'Refinery South',
      zone: 'Sector 7 Trench',
      contractor: 'Titan Heavy Earthworks Ltd',
      supervisor: { name: 'Deepak Verma', phone: '+91 98765 43210', email: 'deepak@titan.example.com' },
      activityType: 'EXCAVATION',
      riskLevel: 'CRITICAL',
      shift: 'NIGHT',
      status: 'ACTIVE',
      cameras: [],
    });
    createdWorkFrontIds.push(activeWf._id);

    // Create a camera assigned to active WorkFront
    const assignedCamCode = `CAM-ASGN-${Date.now().toString(36).toUpperCase()}`;
    const assignedCam = await Camera.create({
      cameraCode: assignedCamCode,
      name: 'Sector 7 Overhead Monitoring Cam',
      site: 'Refinery South',
      location: 'Trench Mast North',
      status: 'ONLINE',
      streamStatus: 'DEMO_FEED',
      workFront: activeWf._id,
      isActive: true,
    });
    createdCameraIds.push(assignedCam._id);

    // Link camera to active WorkFront
    activeWf.cameras.push(assignedCam._id);
    await activeWf.save();

    // Create a completed WorkFront with its camera
    const completedWfCode = `WF-B3CMP-${Date.now().toString(36).toUpperCase()}`;
    const completedCamCode = `CAM-CMP-${Date.now().toString(36).toUpperCase()}`;
    const completedWf = await WorkFront.create({
      workFrontCode: completedWfCode,
      name: 'Completed Piling Project',
      site: 'Refinery South',
      zone: 'Sector 9',
      contractor: 'Old Piling Corp',
      supervisor: { name: 'Pravin Joshi', phone: '+91 99112 23344', email: 'pravin@piling.example.com' },
      activityType: 'CONFINED_SPACE',
      riskLevel: 'MEDIUM',
      shift: 'MORNING',
      status: 'COMPLETED',
      cameras: [],
    });
    createdWorkFrontIds.push(completedWf._id);

    const completedCam = await Camera.create({
      cameraCode: completedCamCode,
      name: 'Completed Work-Front Camera',
      site: 'Refinery South',
      location: 'Sector 9 Deck',
      status: 'ONLINE',
      streamStatus: 'DEMO_FEED',
      workFront: completedWf._id,
      isActive: true,
    });
    createdCameraIds.push(completedCam._id);

    completedWf.cameras.push(completedCam._id);
    await completedWf.save();

    // -------------------------------------------------------------------------
    // TEST 1: Ingest demo event without cameraCode rejected (HTTP 400)
    // -------------------------------------------------------------------------
    const missingCamRes = await makeRequest(
      { path: '/api/v1/demo/ingest-event', method: 'POST', headers: adminAuthHeaders },
      { violationType: 'NO_HELMET', confidence: 0.95 }
    );
    assert(missingCamRes.statusCode === 400, 'Ingest event without cameraCode returns HTTP 400');

    // -------------------------------------------------------------------------
    // TEST 2: Ingest demo event with non-existent camera rejected (HTTP 404)
    // -------------------------------------------------------------------------
    const fakeCamRes = await makeRequest(
      { path: '/api/v1/demo/ingest-event', method: 'POST', headers: adminAuthHeaders },
      { cameraCode: 'CAM-DOES-NOT-EXIST-999', violationType: 'NO_HELMET', severity: 'HIGH', confidence: 0.9 }
    );
    assert(fakeCamRes.statusCode === 404, 'Ingest event with unregistered camera returns HTTP 404');

    // -------------------------------------------------------------------------
    // TEST 3: Ingest demo event on UNASSIGNED camera succeeds with workFront: null
    // -------------------------------------------------------------------------
    const unassignedEventId = `EVT-UNASS-${Date.now()}`;
    const unassignedIngestRes = await makeRequest(
      { path: '/api/v1/demo/ingest-event', method: 'POST', headers: adminAuthHeaders },
      {
        eventId: unassignedEventId,
        cameraCode: unassignedCamCode,
        violationType: 'NO_VEST',
        severity: 'MEDIUM',
        confidence: 0.88,
        description: 'Worker spotted without hi-vis jacket near perimeter gate',
      }
    );
    assert(
      unassignedIngestRes.statusCode === 201,
      'Ingest event on unassigned camera returns HTTP 201 Created'
    );
    const unassignedAlert = unassignedIngestRes.body?.data?.alert;
    assert(
      unassignedAlert && unassignedAlert.workFront === null,
      'Unassigned camera alert has workFront === null'
    );
    assert(
      !unassignedAlert.workFrontCode && !unassignedAlert.contractor,
      'Unassigned camera alert has no workFrontCode or contractor snapshot'
    );
    if (unassignedAlert?._id) createdAlertIds.push(unassignedAlert._id);

    // -------------------------------------------------------------------------
    // TEST 4: Ingest demo event on ASSIGNED camera automatically enriches alert
    // -------------------------------------------------------------------------
    const assignedEventId = `EVT-ASGN-${Date.now()}`;
    const assignedIngestRes = await makeRequest(
      { path: '/api/v1/demo/ingest-event', method: 'POST', headers: adminAuthHeaders },
      {
        eventId: assignedEventId,
        cameraCode: assignedCamCode,
        violationType: 'NO_HELMET',
        severity: 'HIGH',
        confidence: 0.94,
        description: 'Excavation worker operating without required hard hat',
      }
    );
    assert(
      assignedIngestRes.statusCode === 201,
      'Ingest event on assigned camera returns HTTP 201 Created'
    );
    const enrichedAlert = assignedIngestRes.body?.data?.alert;
    assert(
      enrichedAlert &&
        (enrichedAlert.workFront?._id === activeWf._id.toString() ||
          enrichedAlert.workFront === activeWf._id.toString()),
      'Alert correctly linked to active WorkFront ObjectId'
    );
    assert(
      enrichedAlert.workFrontCode === activeWfCode,
      `Alert workFrontCode snapshotted as ${activeWfCode}`
    );
    assert(
      enrichedAlert.contractor === 'Titan Heavy Earthworks Ltd',
      'Alert contractor snapshotted as Titan Heavy Earthworks Ltd'
    );
    assert(
      enrichedAlert.activityType === 'EXCAVATION',
      'Alert activityType snapshotted as EXCAVATION'
    );
    assert(
      enrichedAlert.riskLevel === 'CRITICAL',
      'Alert riskLevel snapshotted as CRITICAL'
    );
    assert(
      enrichedAlert.shift === 'NIGHT',
      'Alert shift snapshotted as NIGHT'
    );
    assert(
      enrichedAlert.zone === 'Sector 7 Trench',
      'Alert zone snapshotted as Sector 7 Trench'
    );
    if (enrichedAlert?._id) createdAlertIds.push(enrichedAlert._id);

    // -------------------------------------------------------------------------
    // TEST 5: Security / Tampering Protection - Ignore client-supplied overrides
    // -------------------------------------------------------------------------
    const spoofEventId = `EVT-SPOOF-${Date.now()}`;
    const spoofIngestRes = await makeRequest(
      { path: '/api/v1/demo/ingest-event', method: 'POST', headers: adminAuthHeaders },
      {
        eventId: spoofEventId,
        cameraCode: assignedCamCode,
        violationType: 'UNAUTHORIZED_ZONE',
        severity: 'CRITICAL',
        confidence: 0.97,
        // Attacker attempts to spoof contractor and workfront to framed entity:
        workFront: '600000000000000000000001',
        workFrontCode: 'WF-MALICIOUS-HACK',
        contractor: 'Innocent Third Party Framing Corp',
        activityType: 'HOT_WORK',
      }
    );
    assert(spoofIngestRes.statusCode === 201, 'Tampered event payload accepted');
    const spoofAlert = spoofIngestRes.body?.data?.alert;
    assert(
      spoofAlert.contractor === 'Titan Heavy Earthworks Ltd' &&
        spoofAlert.workFrontCode === activeWfCode &&
        spoofAlert.activityType === 'EXCAVATION',
      'Backend strictly derives context from DB and rejects client-supplied contractor/workfront overrides'
    );
    if (spoofAlert?._id) createdAlertIds.push(spoofAlert._id);

    // -------------------------------------------------------------------------
    // TEST 6: Ingest demo event on COMPLETED WorkFront does not attach active context
    // -------------------------------------------------------------------------
    const completedEventId = `EVT-CMP-${Date.now()}`;
    const completedIngestRes = await makeRequest(
      { path: '/api/v1/demo/ingest-event', method: 'POST', headers: adminAuthHeaders },
      {
        eventId: completedEventId,
        cameraCode: completedCamCode,
        violationType: 'NO_HELMET',
        severity: 'LOW',
        confidence: 0.82,
      }
    );
    assert(completedIngestRes.statusCode === 201, 'Event on completed workfront camera creates alert');
    const completedAlert = completedIngestRes.body?.data?.alert;
    assert(
      completedAlert.workFront === null && !completedAlert.workFrontCode,
      'Alert on COMPLETED work-front camera is not enriched with active context'
    );
    if (completedAlert?._id) createdAlertIds.push(completedAlert._id);

    // -------------------------------------------------------------------------
    // TEST 7: Duplicate eventId ingestion is rejected (HTTP 400/409)
    // -------------------------------------------------------------------------
    const dupRes = await makeRequest(
      { path: '/api/v1/demo/ingest-event', method: 'POST', headers: adminAuthHeaders },
      {
        eventId: assignedEventId, // same event ID as TEST 4
        cameraCode: assignedCamCode,
        violationType: 'NO_HELMET',
        severity: 'HIGH',
        confidence: 0.9,
      }
    );
    assert(
      dupRes.statusCode === 400 || dupRes.statusCode === 409,
      'Duplicate eventId ingestion rejected with error'
    );

    // -------------------------------------------------------------------------
    // TEST 8: AuditLog captures ALERT_CREATED with enriched work-front details
    // -------------------------------------------------------------------------
    const auditRecord = await AuditLog.findOne({
      action: 'ALERT_CREATED',
      'details.alertCode': enrichedAlert.alertCode,
    });
    assert(
      auditRecord !== null,
      'AuditLog entry found for ALERT_CREATED action'
    );
    assert(
      auditRecord &&
        auditRecord.details?.workFrontCode === activeWfCode &&
        auditRecord.details?.contractor === 'Titan Heavy Earthworks Ltd' &&
        auditRecord.details?.isEnriched === true,
      'AuditLog records workFrontCode, contractor, and isEnriched: true'
    );

    // -------------------------------------------------------------------------
    // TEST 9: Historical Snapshot Integrity - Relocating camera does not mutate past alert
    // -------------------------------------------------------------------------
    // Create Destination WorkFront and relocate assignedCam
    const destWfCode = `WF-B3DST-${Date.now().toString(36).toUpperCase()}`;
    const destWf = await WorkFront.create({
      workFrontCode: destWfCode,
      name: 'Destination High Voltage Yard',
      site: 'Refinery South',
      zone: 'Substation Yard B',
      contractor: 'Volt Electricals Infrastructure',
      supervisor: { name: 'Kunal Deshmukh', phone: '+91 99882 23344', email: 'kunal@volt.example.com' },
      activityType: 'ELECTRICAL',
      riskLevel: 'HIGH',
      shift: 'MORNING',
      status: 'ACTIVE',
      cameras: [],
    });
    createdWorkFrontIds.push(destWf._id);

    // Perform camera relocation
    const relocateRes = await makeRequest(
      {
        path: `/api/v1/work-fronts/${activeWf._id}/cameras/relocate`,
        method: 'POST',
        headers: adminAuthHeaders,
      },
      {
        cameraId: assignedCam._id.toString(),
        destinationWorkFrontId: destWf._id.toString(),
        reason: 'Emergency electrical safety reassignment',
      }
    );
    assert(relocateRes.statusCode === 200, 'Camera successfully relocated to destination WorkFront');

    // Verify historical alert record in DB
    const historicalAlert = await Alert.findById(enrichedAlert._id);
    assert(
      historicalAlert.workFrontCode === activeWfCode &&
        historicalAlert.contractor === 'Titan Heavy Earthworks Ltd' &&
        historicalAlert.activityType === 'EXCAVATION',
      'Historical alert retains original Work-Front and Contractor snapshot post-relocation'
    );

    // -------------------------------------------------------------------------
    // TEST 10: Ingest new event on relocated camera receives NEW destination context
    // -------------------------------------------------------------------------
    const postRelocateEventId = `EVT-POST-RELOC-${Date.now()}`;
    const postRelocateRes = await makeRequest(
      { path: '/api/v1/demo/ingest-event', method: 'POST', headers: adminAuthHeaders },
      {
        eventId: postRelocateEventId,
        cameraCode: assignedCamCode,
        violationType: 'RESTRICTED_ACCESS',
        severity: 'HIGH',
        confidence: 0.96,
        description: 'High voltage electrical yard perimeter breach',
      }
    );
    assert(postRelocateRes.statusCode === 201, 'New event on relocated camera ingested');
    const postRelocateAlert = postRelocateRes.body?.data?.alert;
    assert(
      postRelocateAlert.workFrontCode === destWfCode &&
        postRelocateAlert.contractor === 'Volt Electricals Infrastructure' &&
        postRelocateAlert.activityType === 'ELECTRICAL',
      'New alert receives new destination WorkFront context after relocation'
    );
    if (postRelocateAlert?._id) createdAlertIds.push(postRelocateAlert._id);

    // -------------------------------------------------------------------------
    // TEST 11: GET /api/v1/alerts returns enriched workFront and snapshot fields
    // -------------------------------------------------------------------------
    const listAlertsRes = await makeRequest(
      { path: '/api/v1/alerts?limit=20', method: 'GET', headers: adminAuthHeaders }
    );
    assert(listAlertsRes.statusCode === 200, 'GET /api/v1/alerts returns HTTP 200 OK');
    const alertsList = listAlertsRes.body?.data?.alerts || [];
    const foundAlert = alertsList.find((a) => a._id === enrichedAlert._id);
    assert(
      foundAlert && foundAlert.workFrontCode === activeWfCode,
      'GET /api/v1/alerts list includes enriched workFrontCode'
    );

    // -------------------------------------------------------------------------
    // TEST 12: Search by workFrontCode matches enriched alert
    // -------------------------------------------------------------------------
    const searchCodeRes = await makeRequest(
      { path: `/api/v1/alerts?search=${activeWfCode}`, method: 'GET', headers: adminAuthHeaders }
    );
    assert(searchCodeRes.statusCode === 200, 'Search alerts by workFrontCode returns HTTP 200 OK');
    const searchCodeAlerts = searchCodeRes.body?.data?.alerts || [];
    assert(
      searchCodeAlerts.some((a) => a.workFrontCode === activeWfCode),
      `Search query '${activeWfCode}' finds the enriched alert`
    );

    // -------------------------------------------------------------------------
    // TEST 13: Search by contractor matches enriched alert
    // -------------------------------------------------------------------------
    const searchContractorRes = await makeRequest(
      { path: `/api/v1/alerts?search=Titan%20Heavy`, method: 'GET', headers: adminAuthHeaders }
    );
    assert(searchContractorRes.statusCode === 200, 'Search alerts by contractor returns HTTP 200 OK');
    const searchContractorAlerts = searchContractorRes.body?.data?.alerts || [];
    assert(
      searchContractorAlerts.some((a) => a.contractor === 'Titan Heavy Earthworks Ltd'),
      "Search query 'Titan Heavy' finds the enriched alert"
    );

    // -------------------------------------------------------------------------
    // TEST 14: GET /api/v1/alerts/:id returns populated workFront object
    // -------------------------------------------------------------------------
    const detailRes = await makeRequest(
      { path: `/api/v1/alerts/${enrichedAlert._id}`, method: 'GET', headers: adminAuthHeaders }
    );
    assert(detailRes.statusCode === 200, 'GET /api/v1/alerts/:id returns HTTP 200 OK');
    const alertDetail = detailRes.body?.data?.alert;
    assert(
      alertDetail && alertDetail.workFront && typeof alertDetail.workFront === 'object',
      'GET /api/v1/alerts/:id populates workFront object'
    );
    assert(
      alertDetail.workFront.workFrontCode === activeWfCode,
      'Populated workFront contains correct workFrontCode'
    );

    // -------------------------------------------------------------------------
    // TEST 15: Alert lifecycle (PENDING -> ACKNOWLEDGED -> CLOSED) preserves enrichment
    // -------------------------------------------------------------------------
    const ackRes = await makeRequest(
      {
        path: `/api/v1/alerts/${enrichedAlert._id}/acknowledge`,
        method: 'PATCH',
        headers: adminAuthHeaders,
      }
    );
    assert(ackRes.statusCode === 200, 'PATCH /api/v1/alerts/:id/acknowledge returns HTTP 200 OK');
    const ackAlert = ackRes.body?.data?.alert;
    assert(
      ackAlert && ackAlert.status === 'ACKNOWLEDGED' && ackAlert.workFrontCode === activeWfCode,
      'Acknowledged alert preserves workFrontCode enrichment'
    );

    const closeRes = await makeRequest(
      {
        path: `/api/v1/alerts/${enrichedAlert._id}/close`,
        method: 'PATCH',
        headers: adminAuthHeaders,
      },
      { remarks: 'Safety operator intervened; worker equipped with hard hat before trench entry' }
    );
    assert(closeRes.statusCode === 200, 'PATCH /api/v1/alerts/:id/close returns HTTP 200 OK');
    const closedAlert = closeRes.body?.data?.alert;
    assert(
      closedAlert &&
        closedAlert.status === 'CLOSED' &&
        closedAlert.workFrontCode === activeWfCode &&
        closedAlert.contractor === 'Titan Heavy Earthworks Ltd',
      'Closed alert preserves workFrontCode and contractor enrichment'
    );

    // -------------------------------------------------------------------------
    // TEST 16: Legacy / unassigned alert queries render cleanly without crashing
    // -------------------------------------------------------------------------
    const unassignedDetailRes = await makeRequest(
      { path: `/api/v1/alerts/${unassignedAlert._id}`, method: 'GET', headers: adminAuthHeaders }
    );
    assert(
      unassignedDetailRes.statusCode === 200,
      'GET /api/v1/alerts/:id for unassigned alert returns HTTP 200 OK'
    );
    assert(
      unassignedDetailRes.body?.data?.alert?.workFront === null,
      'Unassigned alert detail honestly returns workFront === null'
    );

  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    // -------------------------------------------------------------------------
    // TEST 17: Clean teardown of test fixtures
    // -------------------------------------------------------------------------
    console.log('\n  Cleaning up test fixtures...');
    try {
      if (createdAlertIds.length > 0) {
        await Alert.deleteMany({ _id: { $in: createdAlertIds } });
      }
      if (createdCameraIds.length > 0) {
        await Camera.deleteMany({ _id: { $in: createdCameraIds } });
      }
      if (createdWorkFrontIds.length > 0) {
        await WorkFront.deleteMany({ _id: { $in: createdWorkFrontIds } });
      }
      console.log('  Cleaned up probe alerts, cameras, and work-fronts.');
    } catch (cleanupErr) {
      console.error('  Failed to clean up test fixtures:', cleanupErr.message);
    }

    if (server) {
      await new Promise((r) => server.close(r));
    }
    await disconnectDB();

    console.log('\n========================================================');
    console.log(`  BATCH 3 TEST RESULTS: ${passed}/${total} PASSED`);
    console.log('========================================================\n');

    process.exit(passed === total ? 0 : 1);
  }
};

runBatch3Tests();

