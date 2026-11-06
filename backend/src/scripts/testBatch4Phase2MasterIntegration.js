/**
 * Phase 2, Batch 4: Master End-to-End Integration & Production Readiness Verification Suite
 * Validates the complete integrated Phase 2 workflow:
 * 1. Admin & Operator authentication, JWT cookie & CSRF protection
 * 2. RBAC strict backend enforcement (Operator blocked from Admin endpoints)
 * 3. Work-Front Registry: Creation, duplicate prevention, updates, status transitions, search/filtering
 * 4. Camera Assignment: Exclusive assignment rule, availability listing, completed workfront block
 * 5. Camera Relocation: Atomic source/destination transfer, validation constraints
 * 6. Camera Removal: Unassignment without camera record deletion
 * 7. Automated Alert Context Enrichment: Assigned camera event enriches operational snapshot
 * 8. Unassigned Camera Event: Honest unassigned state without fabricated context
 * 9. Tampering Defense: Client-supplied work-front overrides strictly ignored
 * 10. Historical Snapshot Integrity: Past alerts preserve original snapshot after camera relocation
 * 11. Alert Lifecycle: PENDING -> ACKNOWLEDGED -> CLOSED with mandatory remarks & context preserved
 * 12. Audit Logging: Complete operational audit trail across all domain events
 * 13. Safe Teardown: Clean removal of all test probe records
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
const Evidence = require('../models/Evidence');
const AuditLog = require('../models/AuditLog');

const PORT = 5007;
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

const runMasterIntegrationSuite = async () => {
  console.log('\n========================================================================');
  console.log('  VSSP PHASE 2 (BATCH 4): MASTER INTEGRATION & READINESS TEST SUITE');
  console.log('========================================================================\n');

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

  // Fixture tracking arrays for safe teardown
  const probeWorkFrontIds = [];
  const probeCameraIds = [];
  const probeAlertIds = [];
  const probeEvidenceIds = [];
  const probeAuditActions = [];

  try {
    await connectDB();
    server = app.listen(PORT);

    // -------------------------------------------------------------------------
    // SECTION 1: AUTHENTICATION & RBAC CREDENTIALS
    // -------------------------------------------------------------------------
    console.log('[Section 1] Verifying Authentication & Role Profiles...');

    // 1.1 Admin Authentication
    const adminLoginRes = await makeRequest(
      { path: '/api/v1/auth/login', method: 'POST' },
      { email: process.env.INITIAL_ADMIN_EMAIL, password: process.env.INITIAL_ADMIN_PASSWORD }
    );
    assert(adminLoginRes.statusCode === 200, 'ADMIN authenticated successfully');
    const adminCookies = adminLoginRes.cookies;
    const adminCsrfToken = adminLoginRes.headers['x-csrf-token'] || adminCookies['vssp_csrf'];
    const adminHeaders = {
      Cookie: `vssp_jwt=${adminCookies['vssp_jwt']}; vssp_csrf=${adminCookies['vssp_csrf']}`,
      'x-csrf-token': adminCsrfToken,
    };

    // 1.2 Safety Operator Authentication
    const opLoginRes = await makeRequest(
      { path: '/api/v1/auth/login', method: 'POST' },
      { email: process.env.INITIAL_OPERATOR_EMAIL, password: process.env.INITIAL_OPERATOR_PASSWORD }
    );
    assert(opLoginRes.statusCode === 200, 'SAFETY_OPERATOR authenticated successfully');
    const opCookies = opLoginRes.cookies;
    const opCsrfToken = opLoginRes.headers['x-csrf-token'] || opCookies['vssp_csrf'];
    const opHeaders = {
      Cookie: `vssp_jwt=${opCookies['vssp_jwt']}; vssp_csrf=${opCookies['vssp_csrf']}`,
      'x-csrf-token': opCsrfToken,
    };

    // -------------------------------------------------------------------------
    // SECTION 2: WORK-FRONT REGISTRY LIFECYCLE & VALIDATION
    // -------------------------------------------------------------------------
    console.log('\n[Section 2] Verifying Work-Front Registry Workflow...');

    const wfCode1 = `WF-B4-PRI-${Date.now().toString(36).toUpperCase()}`;
    const wfPayload1 = {
      workFrontCode: wfCode1,
      name: 'Primary Furnace Demolition Front',
      site: 'West Complex',
      zone: 'Furnace Unit 3',
      contractor: 'Larsen & Alpha Industrial Ltd',
      supervisor: {
        name: 'Rajesh Sharma',
        phone: '+91 98111 22233',
        email: 'rajesh.sharma@larsen.example.com',
      },
      activityType: 'WORKING_AT_HEIGHT',
      riskLevel: 'HIGH',
      shift: 'MORNING',
      status: 'PLANNING',
    };

    // 2.1 Operator blocked from creating Work-Front (RBAC)
    const opCreateWfRes = await makeRequest(
      { path: '/api/v1/work-fronts', method: 'POST', headers: opHeaders },
      wfPayload1
    );
    assert(
      opCreateWfRes.statusCode === 403,
      'SAFETY_OPERATOR blocked from creating Work-Front with 403 Forbidden'
    );

    // 2.2 Admin creates Work-Front
    const adminCreateWfRes = await makeRequest(
      { path: '/api/v1/work-fronts', method: 'POST', headers: adminHeaders },
      wfPayload1
    );
    assert(adminCreateWfRes.statusCode === 201, 'ADMIN creates Work-Front with 201 Created');
    const wf1 = adminCreateWfRes.body?.data?.workFront;
    assert(wf1 && wf1.workFrontCode === wfCode1, 'Created Work-Front matches uppercase code');
    if (wf1?._id) probeWorkFrontIds.push(wf1._id);

    // 2.3 Duplicate Work-Front code rejection
    const duplicateWfRes = await makeRequest(
      { path: '/api/v1/work-fronts', method: 'POST', headers: adminHeaders },
      wfPayload1
    );
    assert(duplicateWfRes.statusCode === 400, 'Duplicate workFrontCode rejected with 400 Bad Request');

    // 2.4 Retrieve Work-Front detail (Accessible by Operator)
    const opGetDetailRes = await makeRequest(
      { path: `/api/v1/work-fronts/${wf1._id}`, method: 'GET', headers: opHeaders }
    );
    assert(opGetDetailRes.statusCode === 200, 'SAFETY_OPERATOR permitted to inspect Work-Front detail');
    assert(
      opGetDetailRes.body?.data?.workFront?.contractor === 'Larsen & Alpha Industrial Ltd',
      'Detail returns correct contractor metadata'
    );

    // 2.5 Admin updates metadata (name, risk level, supervisor)
    const updateRes = await makeRequest(
      { path: `/api/v1/work-fronts/${wf1._id}`, method: 'PATCH', headers: adminHeaders },
      {
        name: 'Primary Furnace Heavy Scaffolding',
        riskLevel: 'CRITICAL',
        supervisor: {
          name: 'Rajesh V. Sharma',
          phone: '+91 98111 22299',
          email: 'rajesh.v@larsen.example.com',
        },
      }
    );
    assert(updateRes.statusCode === 200, 'ADMIN updates Work-Front metadata with 200 OK');
    assert(
      updateRes.body?.data?.workFront?.riskLevel === 'CRITICAL',
      'Updated risk level persisted as CRITICAL'
    );

    // 2.6 Status transition: PLANNING -> ACTIVE
    const statusActiveRes = await makeRequest(
      { path: `/api/v1/work-fronts/${wf1._id}/status`, method: 'PATCH', headers: adminHeaders },
      { status: 'ACTIVE' }
    );
    assert(statusActiveRes.statusCode === 200, 'Work-Front status transitioned from PLANNING to ACTIVE');

    // 2.7 Search and filter queries
    const searchWfRes = await makeRequest(
      {
        path: `/api/v1/work-fronts?search=${wfCode1}&status=ACTIVE&riskLevel=CRITICAL`,
        method: 'GET',
        headers: opHeaders,
      }
    );
    assert(searchWfRes.statusCode === 200, 'Search & filter Work-Fronts returns 200 OK');
    assert(
      searchWfRes.body?.data?.workFronts?.some((w) => w.workFrontCode === wfCode1),
      'Filtered list accurately returns matching Work-Front'
    );

    // -------------------------------------------------------------------------
    // SECTION 3: CAMERA MAPPING & EXCLUSIVE ASSIGNMENT
    // -------------------------------------------------------------------------
    console.log('\n[Section 3] Verifying Camera Mapping & Exclusive Assignment...');

    // Provision 2 test cameras
    const camCodeA = `CAM-B4-A-${Date.now().toString(36).toUpperCase()}`;
    const camCodeB = `CAM-B4-B-${Date.now().toString(36).toUpperCase()}`;

    const camA = await Camera.create({
      cameraCode: camCodeA,
      name: 'Furnace Overhead Monitor Cam',
      site: 'West Complex',
      location: 'Furnace Tier 3 Mast',
      status: 'ONLINE',
      streamStatus: 'DEMO_FEED',
      workFront: null,
      isActive: true,
    });
    probeCameraIds.push(camA._id);

    const camB = await Camera.create({
      cameraCode: camCodeB,
      name: 'Perimeter West Gate Monitor',
      site: 'West Complex',
      location: 'Gate 4 Sentry Post',
      status: 'ONLINE',
      streamStatus: 'DEMO_FEED',
      workFront: null,
      isActive: true,
    });
    probeCameraIds.push(camB._id);

    // 3.1 Verify available cameras listing includes both unassigned cameras
    const availRes1 = await makeRequest(
      { path: '/api/v1/cameras/available', method: 'GET', headers: opHeaders }
    );
    assert(availRes1.statusCode === 200, 'GET /api/v1/cameras/available returns 200 OK');
    const availCams1 = availRes1.body?.data?.cameras || [];
    assert(
      availCams1.some((c) => c._id === camA._id.toString()) &&
        availCams1.some((c) => c._id === camB._id.toString()),
      'Both unassigned test cameras appear in available list'
    );

    // 3.2 Operator blocked from assigning camera (RBAC)
    const opAssignRes = await makeRequest(
      {
        path: `/api/v1/work-fronts/${wf1._id}/cameras/assign`,
        method: 'POST',
        headers: opHeaders,
      },
      { cameraId: camA._id.toString() }
    );
    assert(opAssignRes.statusCode === 403, 'SAFETY_OPERATOR blocked from assigning camera with 403 Forbidden');

    // 3.3 Admin assigns Camera A to Work-Front 1
    const adminAssignRes = await makeRequest(
      {
        path: `/api/v1/work-fronts/${wf1._id}/cameras/assign`,
        method: 'POST',
        headers: adminHeaders,
      },
      { cameraId: camA._id.toString() }
    );
    assert(adminAssignRes.statusCode === 200, 'ADMIN assigns Camera A to Work-Front 1 with 200 OK');

    // 3.4 Verify Camera A no longer in available list
    const availRes2 = await makeRequest(
      { path: '/api/v1/cameras/available', method: 'GET', headers: opHeaders }
    );
    const availCams2 = availRes2.body?.data?.cameras || [];
    assert(
      !availCams2.some((c) => c._id === camA._id.toString()),
      'Assigned Camera A is excluded from available cameras list'
    );

    // 3.5 Exclusive Assignment Rule: Cannot assign Camera A to another Work-Front
    const wfCode2 = `WF-B4-SEC-${Date.now().toString(36).toUpperCase()}`;
    const wf2 = await WorkFront.create({
      workFrontCode: wfCode2,
      name: 'Cooling Tower Maintenance Front',
      site: 'West Complex',
      zone: 'Cooling Tower B',
      contractor: 'Thermal Solutions Co',
      supervisor: { name: 'Amit Roy', phone: '+91 97222 33344', email: 'amit@thermal.example.com' },
      activityType: 'HOT_WORK',
      riskLevel: 'MEDIUM',
      shift: 'AFTERNOON',
      status: 'ACTIVE',
      cameras: [],
    });
    probeWorkFrontIds.push(wf2._id);

    const conflictingAssignRes = await makeRequest(
      {
        path: `/api/v1/work-fronts/${wf2._id}/cameras/assign`,
        method: 'POST',
        headers: adminHeaders,
      },
      { cameraId: camA._id.toString() }
    );
    assert(
      conflictingAssignRes.statusCode === 400,
      'Exclusive assignment enforced: Assigning already-assigned camera rejected with 400 Bad Request'
    );

    // 3.6 Cannot assign camera to a COMPLETED Work-Front
    const wfCodeCompleted = `WF-B4-CMP-${Date.now().toString(36).toUpperCase()}`;
    const completedWf = await WorkFront.create({
      workFrontCode: wfCodeCompleted,
      name: 'Completed Pipeline Trenching',
      site: 'West Complex',
      zone: 'Sector 5 Pipeway',
      contractor: 'Pipeworks Global',
      supervisor: { name: 'K. Patel', phone: '+91 96333 44455', email: 'patel@pipeworks.example.com' },
      activityType: 'CONFINED_SPACE',
      riskLevel: 'LOW',
      shift: 'MORNING',
      status: 'COMPLETED',
      cameras: [],
    });
    probeWorkFrontIds.push(completedWf._id);

    const completedAssignRes = await makeRequest(
      {
        path: `/api/v1/work-fronts/${completedWf._id}/cameras/assign`,
        method: 'POST',
        headers: adminHeaders,
      },
      { cameraId: camB._id.toString() }
    );
    assert(
      completedAssignRes.statusCode === 400,
      'Assigning camera to COMPLETED Work-Front rejected with 400 Bad Request'
    );

    // -------------------------------------------------------------------------
    // SECTION 4: AUTOMATED ALERT CONTEXT ENRICHMENT & TAMPERING DEFENSE
    // -------------------------------------------------------------------------
    console.log('\n[Section 4] Verifying Alert Context Enrichment & Security...');

    // 4.1 Ingestion on ASSIGNED Camera (Camera A -> Work-Front 1)
    const assignedEventId = `EVT-B4-ENRICH-${Date.now()}`;
    const enrichIngestRes = await makeRequest(
      { path: '/api/v1/demo/ingest-event', method: 'POST', headers: adminHeaders },
      {
        eventId: assignedEventId,
        cameraCode: camCodeA,
        violationType: 'NO_HELMET',
        severity: 'HIGH',
        confidence: 0.95,
        description: 'Scaffolding technician operating at height without helmet',
      }
    );
    assert(enrichIngestRes.statusCode === 201, 'Ingest event on assigned camera succeeds with 201 Created');
    const enrichedAlert = enrichIngestRes.body?.data?.alert;
    assert(
      enrichedAlert && enrichedAlert.workFrontCode === wfCode1,
      `Alert correctly enriched with workFrontCode: ${wfCode1}`
    );
    assert(
      enrichedAlert.contractor === 'Larsen & Alpha Industrial Ltd',
      'Alert correctly snapshotted contractor: Larsen & Alpha Industrial Ltd'
    );
    assert(
      enrichedAlert.activityType === 'WORKING_AT_HEIGHT',
      'Alert correctly snapshotted activityType: WORKING_AT_HEIGHT'
    );
    assert(
      enrichedAlert.riskLevel === 'CRITICAL',
      'Alert correctly snapshotted riskLevel: CRITICAL'
    );
    if (enrichedAlert?._id) probeAlertIds.push(enrichedAlert._id);
    if (enrichedAlert?.evidence?._id) probeEvidenceIds.push(enrichedAlert.evidence._id);

    // 4.2 Ingestion on UNASSIGNED Camera (Camera B -> unassigned)
    const unassignedEventId = `EVT-B4-UNASS-${Date.now()}`;
    const unassignedIngestRes = await makeRequest(
      { path: '/api/v1/demo/ingest-event', method: 'POST', headers: adminHeaders },
      {
        eventId: unassignedEventId,
        cameraCode: camCodeB,
        violationType: 'NO_VEST',
        severity: 'LOW',
        confidence: 0.89,
        description: 'Visitor near perimeter sentry without high-visibility vest',
      }
    );
    assert(unassignedIngestRes.statusCode === 201, 'Ingest event on unassigned camera succeeds with 201 Created');
    const unassignedAlert = unassignedIngestRes.body?.data?.alert;
    assert(
      unassignedAlert && unassignedAlert.workFront === null,
      'Unassigned camera alert has workFront === null'
    );
    assert(
      !unassignedAlert.workFrontCode && !unassignedAlert.contractor,
      'Unassigned camera alert does not fabricate work-front context'
    );
    if (unassignedAlert?._id) probeAlertIds.push(unassignedAlert._id);
    if (unassignedAlert?.evidence?._id) probeEvidenceIds.push(unassignedAlert.evidence._id);

    // 4.3 Tampering Defense: Spoofed client payload strictly ignored
    const spoofEventId = `EVT-B4-SPOOF-${Date.now()}`;
    const spoofIngestRes = await makeRequest(
      { path: '/api/v1/demo/ingest-event', method: 'POST', headers: adminHeaders },
      {
        eventId: spoofEventId,
        cameraCode: camCodeA, // Assigned to WF1
        violationType: 'UNAUTHORIZED_ZONE',
        severity: 'HIGH',
        confidence: 0.93,
        // Attacker attempts to frame another contractor & fake workfront:
        workFront: '507f1f77bcf86cd799439011',
        workFrontCode: 'WF-FAKE-ATTACK',
        contractor: 'Framed Subcontractor Inc',
        activityType: 'ELECTRICAL',
      }
    );
    assert(spoofIngestRes.statusCode === 201, 'Spoofed ingestion payload processed');
    const spoofAlert = spoofIngestRes.body?.data?.alert;
    assert(
      spoofAlert.workFrontCode === wfCode1 &&
        spoofAlert.contractor === 'Larsen & Alpha Industrial Ltd' &&
        spoofAlert.activityType === 'WORKING_AT_HEIGHT',
      'Tampering Defense: Backend strictly ignores client overrides and preserves database truth'
    );
    if (spoofAlert?._id) probeAlertIds.push(spoofAlert._id);
    if (spoofAlert?.evidence?._id) probeEvidenceIds.push(spoofAlert.evidence._id);

    // -------------------------------------------------------------------------
    // SECTION 5: CAMERA RELOCATION & HISTORICAL SNAPSHOT PRESERVATION
    // -------------------------------------------------------------------------
    console.log('\n[Section 5] Verifying Camera Relocation & Historical Integrity...');

    // 5.1 Relocate Camera A from Work-Front 1 to Work-Front 2
    const relocateRes = await makeRequest(
      {
        path: `/api/v1/work-fronts/${wf1._id}/cameras/relocate`,
        method: 'POST',
        headers: adminHeaders,
      },
      {
        cameraId: camA._id.toString(),
        destinationWorkFrontId: wf2._id.toString(),
        reason: 'Shift reassignment to Cooling Tower maintenance',
      }
    );
    assert(relocateRes.statusCode === 200, 'ADMIN relocates Camera A to Work-Front 2 with 200 OK');

    // Verify database relationship post-relocation
    const refreshedCamA = await Camera.findById(camA._id);
    const refreshedWf1 = await WorkFront.findById(wf1._id);
    const refreshedWf2 = await WorkFront.findById(wf2._id);

    assert(
      refreshedCamA.workFront.toString() === wf2._id.toString(),
      'Camera A workFront pointer updated to Work-Front 2'
    );
    assert(
      !refreshedWf1.cameras.some((id) => id.toString() === camA._id.toString()),
      'Camera A cleanly removed from source Work-Front 1 cameras array'
    );
    assert(
      refreshedWf2.cameras.some((id) => id.toString() === camA._id.toString()),
      'Camera A cleanly added to destination Work-Front 2 cameras array'
    );

    // 5.2 Historical Snapshot Integrity: Past alert created at WF1 must NOT be altered
    const historicalAlert = await Alert.findById(enrichedAlert._id);
    assert(
      historicalAlert.workFrontCode === wfCode1 &&
        historicalAlert.contractor === 'Larsen & Alpha Industrial Ltd' &&
        historicalAlert.activityType === 'WORKING_AT_HEIGHT',
      'Historical Integrity: Alert created prior to relocation retains original Work-Front 1 snapshot'
    );

    // 5.3 Ingest new event on relocated camera: Receives NEW Work-Front 2 context
    const postRelocEventId = `EVT-B4-POSTRELOC-${Date.now()}`;
    const postRelocIngestRes = await makeRequest(
      { path: '/api/v1/demo/ingest-event', method: 'POST', headers: adminHeaders },
      {
        eventId: postRelocEventId,
        cameraCode: camCodeA,
        violationType: 'RESTRICTED_ACCESS',
        severity: 'MEDIUM',
        confidence: 0.91,
      }
    );
    assert(postRelocIngestRes.statusCode === 201, 'New event on relocated camera ingested with 201 Created');
    const postRelocAlert = postRelocIngestRes.body?.data?.alert;
    assert(
      postRelocAlert.workFrontCode === wfCode2 &&
        postRelocAlert.contractor === 'Thermal Solutions Co' &&
        postRelocAlert.activityType === 'HOT_WORK',
      'New alert receives updated Work-Front 2 operational context snapshot'
    );
    if (postRelocAlert?._id) probeAlertIds.push(postRelocAlert._id);
    if (postRelocAlert?.evidence?._id) probeEvidenceIds.push(postRelocAlert.evidence._id);

    // 5.4 Camera Removal: Unassign without deleting camera record
    const removeCamRes = await makeRequest(
      {
        path: `/api/v1/work-fronts/${wf2._id}/cameras/${camA._id}`,
        method: 'DELETE',
        headers: adminHeaders,
      }
    );
    assert(removeCamRes.statusCode === 200, 'ADMIN removes Camera A assignment with 200 OK');
    const removedCamCheck = await Camera.findById(camA._id);
    assert(removedCamCheck !== null, 'Camera record remains completely INTACT in database');
    assert(removedCamCheck.workFront === null, 'Camera workFront reset to null');

    // -------------------------------------------------------------------------
    // SECTION 6: ALERT LIFECYCLE & AUDIT TRAIL
    // -------------------------------------------------------------------------
    console.log('\n[Section 6] Verifying Alert Lifecycle & Audit Trail...');

    // 6.1 Operator acknowledges enriched alert
    const ackRes = await makeRequest(
      {
        path: `/api/v1/alerts/${enrichedAlert._id}/acknowledge`,
        method: 'PATCH',
        headers: opHeaders,
      }
    );
    assert(ackRes.statusCode === 200, 'SAFETY_OPERATOR acknowledges alert with 200 OK');
    assert(
      ackRes.body?.data?.alert?.status === 'ACKNOWLEDGED',
      'Alert status transitioned to ACKNOWLEDGED'
    );
    assert(
      ackRes.body?.data?.alert?.workFrontCode === wfCode1,
      'Operational context preserved during acknowledgment'
    );

    // 6.2 Close without remarks rejected
    const closeNoRemarksRes = await makeRequest(
      {
        path: `/api/v1/alerts/${enrichedAlert._id}/close`,
        method: 'PATCH',
        headers: adminHeaders,
      },
      { remarks: '' }
    );
    assert(closeNoRemarksRes.statusCode === 400, 'Closing alert without remarks rejected with 400 Bad Request');

    // 6.3 Close with valid remarks
    const closeRes = await makeRequest(
      {
        path: `/api/v1/alerts/${enrichedAlert._id}/close`,
        method: 'PATCH',
        headers: adminHeaders,
      },
      { remarks: 'Supervisor notified; full harness and safety helmet verified on worker' }
    );
    assert(closeRes.statusCode === 200, 'ADMIN closes alert with mandatory remarks (200 OK)');
    assert(closeRes.body?.data?.alert?.status === 'CLOSED', 'Alert status transitioned to CLOSED');
    assert(
      closeRes.body?.data?.alert?.contractor === 'Larsen & Alpha Industrial Ltd',
      'Operational contractor snapshot preserved through closure'
    );

    // 6.4 Verify AuditLog captured key domain actions
    const auditActions = [
      'WORKFRONT_CREATED',
      'WORKFRONT_UPDATED',
      'WORKFRONT_STATUS_CHANGED',
      'CAMERA_ASSIGNED_TO_WORKFRONT',
      'CAMERA_RELOCATED',
      'CAMERA_REMOVED_FROM_WORKFRONT',
      'ALERT_CREATED',
      'ALERT_ACKNOWLEDGED',
      'ALERT_CLOSED',
    ];

    for (const action of auditActions) {
      const log = await AuditLog.findOne({ action });
      assert(log !== null, `AuditLog captured action: ${action}`);
    }

  } catch (err) {
    console.error('[Master Suite Execution Error]:', err);
  } finally {
    // -------------------------------------------------------------------------
    // SECTION 7: CLEAN TEARDOWN OF TEST FIXTURES
    // -------------------------------------------------------------------------
    console.log('\n[Section 7] Cleaning Up Test Probe Records...');
    try {
      if (probeAlertIds.length > 0) {
        await Alert.deleteMany({ _id: { $in: probeAlertIds } });
      }
      if (probeEvidenceIds.length > 0) {
        await Evidence.deleteMany({ _id: { $in: probeEvidenceIds } });
      }
      if (probeCameraIds.length > 0) {
        await Camera.deleteMany({ _id: { $in: probeCameraIds } });
      }
      if (probeWorkFrontIds.length > 0) {
        await WorkFront.deleteMany({ _id: { $in: probeWorkFrontIds } });
      }
      // Purge audit logs created by this probe run
      await AuditLog.deleteMany({
        $or: [
          { 'details.workFrontCode': { $regex: /^WF-B4-/ } },
          { 'details.cameraCode': { $regex: /^CAM-B4-/ } },
        ],
      });
      console.log('  All probe Work-Fronts, Cameras, Alerts, Evidence, and AuditLogs purged.');
    } catch (cleanupErr) {
      console.error('  Cleanup error:', cleanupErr.message);
    }

    if (server) {
      await new Promise((r) => server.close(r));
    }
    await disconnectDB();

    console.log('\n========================================================================');
    console.log(`  MASTER INTEGRATION RESULTS: ${passed}/${total} CHECKS PASSED`);
    console.log('========================================================================\n');

    process.exit(passed === total ? 0 : 1);
  }
};

runMasterIntegrationSuite();

