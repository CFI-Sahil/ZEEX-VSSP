/**
 * Batch 2 Verification Test Suite: Camera-to-Work-Front Mapping & Camera Relocation
 * Validates:
 * 1. Admin login, CSRF capture
 * 2. Available cameras listing (GET /api/v1/cameras/available)
 * 3. Assigning an unassigned camera as ADMIN (POST /api/v1/work-fronts/:id/cameras/assign)
 * 4. Safety Operator blocked from assigning camera (HTTP 403 Forbidden)
 * 5. Rejection of assigning a camera already assigned elsewhere (Exclusive assignment)
 * 6. Assigned camera no longer appears in available cameras list
 * 7. Removing an assigned camera as ADMIN (DELETE /api/v1/work-fronts/:id/cameras/:cameraId)
 * 8. Verification that removing an assignment leaves the Camera record intact
 * 9. Rejection of assigning camera to a COMPLETED Work-Front
 * 10. Relocating a camera from Source Work-Front to Destination Work-Front
 * 11. Verification that Relocation atomically removes camera from Source and adds to Destination
 * 12. Rejection of relocation when stating incorrect source Work-Front
 * 13. Rejection of relocation to a COMPLETED Work-Front
 * 14. Rejection of relocation when source and destination are identical
 * 15. AuditLog verification for CAMERA_ASSIGNED_TO_WORKFRONT, CAMERA_REMOVED_FROM_WORKFRONT, CAMERA_RELOCATED
 * 16. Clean teardown of test probe records
 */

const http = require('http');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = require('../app');
const { connectDB, disconnectDB } = require('../config/db');
const WorkFront = require('../models/WorkFront');
const Camera = require('../models/Camera');
const AuditLog = require('../models/AuditLog');

const PORT = 5005;
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

const runBatch2Tests = async () => {
  console.log('\n========================================================');
  console.log('  BATCH 2: CAMERA MAPPING & RELOCATION VERIFICATION');
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

  // Test fixtures
  let testCameraId = null;
  let sourceWfId = null;
  let destWfId = null;
  let completedWfId = null;

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

    // Provision Test Camera
    const testCameraCode = `CAM-TEST-${Date.now().toString(36).toUpperCase()}`;
    const camera = await Camera.create({
      cameraCode: testCameraCode,
      name: 'Batch 2 Test Camera Probe',
      site: 'Plant 1',
      location: 'Turbine Generator Hall',
      status: 'ONLINE',
      streamStatus: 'DEMO_FEED',
      workFront: null,
      isActive: true,
    });
    testCameraId = camera._id.toString();

    // Provision Source WorkFront
    const sourceWf = await WorkFront.create({
      workFrontCode: `WF-SRC-${Date.now().toString(36).toUpperCase()}`,
      name: 'Source Turbine Installation Front',
      site: 'Plant 1',
      zone: 'Turbine Bay East',
      contractor: 'L&T Power Division',
      supervisor: { name: 'Kiran Rao', phone: '+91 99887 76655', email: 'kiran@lt.example.com' },
      activityType: 'HEAVY_LIFTING',
      riskLevel: 'HIGH',
      status: 'ACTIVE',
      cameras: [],
      isActive: true,
    });
    sourceWfId = sourceWf._id.toString();

    // Provision Destination WorkFront
    const destWf = await WorkFront.create({
      workFrontCode: `WF-DST-${Date.now().toString(36).toUpperCase()}`,
      name: 'Destination Boiler Deck Front',
      site: 'Plant 1',
      zone: 'Boiler Structure Deck',
      contractor: 'Tata Projects Infrastructure',
      supervisor: { name: 'Amit Patel', phone: '+91 98765 12345', email: 'amit@tata.example.com' },
      activityType: 'WORKING_AT_HEIGHT',
      riskLevel: 'CRITICAL',
      status: 'ACTIVE',
      cameras: [],
      isActive: true,
    });
    destWfId = destWf._id.toString();

    // Provision Completed WorkFront
    const compWf = await WorkFront.create({
      workFrontCode: `WF-CMP-${Date.now().toString(36).toUpperCase()}`,
      name: 'Completed Excavation Pit Front',
      site: 'Plant 1',
      zone: 'Foundation Perimeter',
      contractor: 'Apex Geotech',
      supervisor: { name: 'Sanjay Dutt', phone: '+91 91234 56789' },
      activityType: 'EXCAVATION',
      riskLevel: 'MEDIUM',
      status: 'COMPLETED',
      cameras: [],
      isActive: true,
    });
    completedWfId = compWf._id.toString();

    // Check 1: Available Cameras Endpoint
    const availRes = await makeRequest({
      path: '/api/v1/cameras/available',
      method: 'GET',
      headers: { Cookie: adminCookieHeader },
    });
    assert(availRes.statusCode === 200, 'GET /api/v1/cameras/available succeeds (HTTP 200)');
    const availableCodes = availRes.body?.data?.cameras?.map((c) => c.cameraCode) || [];
    assert(availableCodes.includes(testCameraCode), 'Unassigned test camera appears in available list');

    // Check 2: Safety Operator Blocked from Assigning Camera (403 Forbidden)
    const opAssignRes = await makeRequest(
      {
        path: `/api/v1/work-fronts/${sourceWfId}/cameras/assign`,
        method: 'POST',
        headers: {
          Cookie: operatorCookieHeader,
          'X-CSRF-Token': operatorCsrfToken,
        },
      },
      { cameraId: testCameraId }
    );
    assert(opAssignRes.statusCode === 403, 'Safety Operator blocked from assigning camera (HTTP 403 Forbidden)');

    // Check 3: Admin Assigns Camera to Source Work-Front
    const assignRes = await makeRequest(
      {
        path: `/api/v1/work-fronts/${sourceWfId}/cameras/assign`,
        method: 'POST',
        headers: {
          Cookie: adminCookieHeader,
          'X-CSRF-Token': adminCsrfToken,
        },
      },
      { cameraId: testCameraId }
    );
    assert(assignRes.statusCode === 200, 'Admin can assign unassigned camera to Work-Front (HTTP 200)');

    // Verify both records updated consistently
    const updatedCam1 = await Camera.findById(testCameraId);
    const updatedSrc1 = await WorkFront.findById(sourceWfId);
    assert(updatedCam1.workFront.toString() === sourceWfId, 'Camera.workFront set to source WorkFront ID');
    assert(updatedSrc1.cameras.map((c) => c.toString()).includes(testCameraId), 'WorkFront.cameras contains Camera ID');

    // Check 4: Assigned Camera No Longer Appears in Available Cameras List
    const availRes2 = await makeRequest({
      path: '/api/v1/cameras/available',
      method: 'GET',
      headers: { Cookie: adminCookieHeader },
    });
    const availableCodes2 = availRes2.body?.data?.cameras?.map((c) => c.cameraCode) || [];
    assert(!availableCodes2.includes(testCameraCode), 'Assigned camera does not appear in available list');

    // Check 5: Exclusive Assignment - Reject Assigning Already Assigned Camera
    const duplicateAssignRes = await makeRequest(
      {
        path: `/api/v1/work-fronts/${destWfId}/cameras/assign`,
        method: 'POST',
        headers: {
          Cookie: adminCookieHeader,
          'X-CSRF-Token': adminCsrfToken,
        },
      },
      { cameraId: testCameraId }
    );
    assert(
      duplicateAssignRes.statusCode === 400,
      'Rejects assigning already-assigned camera to another front (HTTP 400 Bad Request)'
    );

    // Check 6: Reject Assigning Camera to COMPLETED Work-Front
    // Unassign first for this probe
    await Camera.updateOne({ _id: testCameraId }, { $set: { workFront: null } });
    await WorkFront.updateOne({ _id: sourceWfId }, { $pull: { cameras: testCameraId } });

    const compAssignRes = await makeRequest(
      {
        path: `/api/v1/work-fronts/${completedWfId}/cameras/assign`,
        method: 'POST',
        headers: {
          Cookie: adminCookieHeader,
          'X-CSRF-Token': adminCsrfToken,
        },
      },
      { cameraId: testCameraId }
    );
    assert(
      compAssignRes.statusCode === 400,
      'Rejects assigning camera to a COMPLETED work-front (HTTP 400 Bad Request)'
    );

    // Re-assign to source for relocation test
    await Camera.updateOne({ _id: testCameraId }, { $set: { workFront: sourceWfId } });
    await WorkFront.updateOne({ _id: sourceWfId }, { $addToSet: { cameras: testCameraId } });

    // Check 7: Relocate Camera from Source to Destination
    const relocateRes = await makeRequest(
      {
        path: `/api/v1/work-fronts/${sourceWfId}/cameras/relocate`,
        method: 'POST',
        headers: {
          Cookie: adminCookieHeader,
          'X-CSRF-Token': adminCsrfToken,
        },
      },
      {
        cameraId: testCameraId,
        destinationWorkFrontId: destWfId,
        reason: 'Turbine assembly completed; camera relocated to monitor boiler erection',
      }
    );
    assert(relocateRes.statusCode === 200, 'Admin can relocate camera to destination Work-Front (HTTP 200)');

    // Verify two-way relationship consistency after relocation
    const updatedCamRel = await Camera.findById(testCameraId);
    const updatedSrcRel = await WorkFront.findById(sourceWfId);
    const updatedDstRel = await WorkFront.findById(destWfId);

    assert(
      updatedCamRel.workFront.toString() === destWfId,
      'Camera.workFront updated to destination WorkFront ID'
    );
    assert(
      !updatedSrcRel.cameras.map((c) => c.toString()).includes(testCameraId),
      'Camera successfully removed from Source WorkFront.cameras'
    );
    assert(
      updatedDstRel.cameras.map((c) => c.toString()).includes(testCameraId),
      'Camera successfully added to Destination WorkFront.cameras'
    );

    // Check 8: Reject Relocation When Stating Incorrect Source Work-Front
    const badSourceRelRes = await makeRequest(
      {
        path: `/api/v1/work-fronts/${sourceWfId}/cameras/relocate`, // Camera is currently on destWfId!
        method: 'POST',
        headers: {
          Cookie: adminCookieHeader,
          'X-CSRF-Token': adminCsrfToken,
        },
      },
      {
        cameraId: testCameraId,
        destinationWorkFrontId: sourceWfId,
      }
    );
    assert(
      badSourceRelRes.statusCode === 400,
      'Rejects relocation when camera is not assigned to the stated source Work-Front (HTTP 400)'
    );

    // Check 9: Reject Relocation to a COMPLETED Work-Front
    const compRelRes = await makeRequest(
      {
        path: `/api/v1/work-fronts/${destWfId}/cameras/relocate`,
        method: 'POST',
        headers: {
          Cookie: adminCookieHeader,
          'X-CSRF-Token': adminCsrfToken,
        },
      },
      {
        cameraId: testCameraId,
        destinationWorkFrontId: completedWfId,
      }
    );
    assert(
      compRelRes.statusCode === 400,
      'Rejects relocation to a COMPLETED destination Work-Front (HTTP 400)'
    );

    // Check 10: Reject Relocation When Source and Destination are Identical
    const sameRelRes = await makeRequest(
      {
        path: `/api/v1/work-fronts/${destWfId}/cameras/relocate`,
        method: 'POST',
        headers: {
          Cookie: adminCookieHeader,
          'X-CSRF-Token': adminCsrfToken,
        },
      },
      {
        cameraId: testCameraId,
        destinationWorkFrontId: destWfId,
      }
    );
    assert(
      sameRelRes.statusCode === 400,
      'Rejects relocation when source and destination are identical (HTTP 400)'
    );

    // Check 11: Remove Camera from Destination Work-Front
    const removeRes = await makeRequest({
      path: `/api/v1/work-fronts/${destWfId}/cameras/${testCameraId}`,
      method: 'DELETE',
      headers: {
        Cookie: adminCookieHeader,
        'X-CSRF-Token': adminCsrfToken,
      },
    });
    assert(removeRes.statusCode === 200, 'Admin can remove camera from Work-Front (HTTP 200)');

    // Verify Camera Record is Preserved and Disassociated
    const removedCam = await Camera.findById(testCameraId);
    const updatedDstAfterRemove = await WorkFront.findById(destWfId);

    assert(removedCam !== null, 'Camera record remains completely INTACT after removal');
    assert(removedCam.workFront === null, 'Camera.workFront is reset to null');
    assert(
      !updatedDstAfterRemove.cameras.map((c) => c.toString()).includes(testCameraId),
      'Camera removed from WorkFront.cameras array'
    );

    // Check 12: AuditLog Entries Verification
    const auditLogs = await AuditLog.find({
      $or: [
        { entityId: String(testCameraId) },
        { 'details.cameraId': String(testCameraId) },
        { 'details.cameraId': camera._id },
      ],
    });

    const actions = auditLogs.map((l) => l.action);
    assert(
      actions.includes('CAMERA_ASSIGNED_TO_WORKFRONT'),
      'AuditLog captured CAMERA_ASSIGNED_TO_WORKFRONT event'
    );
    assert(
      actions.includes('CAMERA_RELOCATED'),
      'AuditLog captured CAMERA_RELOCATED event'
    );
    assert(
      actions.includes('CAMERA_REMOVED_FROM_WORKFRONT'),
      'AuditLog captured CAMERA_REMOVED_FROM_WORKFRONT event'
    );

    console.log('\n========================================================');
    console.log(`  BATCH 2 RESULTS: ${passed}/${total} TESTS PASSED`);
    console.log('========================================================\n');
  } catch (err) {
    console.error('Batch 2 test execution failed:', err);
  } finally {
    // Teardown
    if (testCameraId) await Camera.deleteOne({ _id: testCameraId });
    if (sourceWfId) await WorkFront.deleteOne({ _id: sourceWfId });
    if (destWfId) await WorkFront.deleteOne({ _id: destWfId });
    if (completedWfId) await WorkFront.deleteOne({ _id: completedWfId });
    if (testCameraId) {
      await AuditLog.deleteMany({
        $or: [
          { entityId: String(testCameraId) },
          { 'details.cameraId': String(testCameraId) },
          { 'details.cameraId': testCameraId },
        ],
      });
    }
    console.log('  [CLEANUP] Batch 2 probe fixtures and audit logs cleaned up cleanly');

    if (server) server.close();
    await disconnectDB();
  }
};

runBatch2Tests();

