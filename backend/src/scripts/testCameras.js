/**
 * Backend Camera Management & Dashboard Metrics Test Suite
 * Validates:
 * 1. Camera registration as ADMIN (defaults to UNKNOWN & lastSeenAt: null)
 * 2. Duplicate camera code rejection
 * 3. Invalid payload validation rejection
 * 4. Camera editing as ADMIN
 * 5. RBAC enforcement: Operator allowed to view, blocked with 403 from POST/PATCH
 * 6. Dynamic dashboard summary aggregation from MongoDB
 * 7. Safe cleanup of test probe records
 */
const http = require('http');
const app = require('../app');
const Camera = require('../models/Camera');
const { connectDB, disconnectDB } = require('../config/db');

const makeRequest = (port, options, body = null) => {
  return new Promise((resolve, reject) => {
    const reqOptions = {
      hostname: '127.0.0.1',
      port,
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
        } catch (e) {
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
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
};

const runCameraTests = async () => {
  console.log('\n========================================================');
  console.log('  BACKEND CAMERA MANAGEMENT & DASHBOARD TEST SUITE');
  console.log('========================================================\n');

  await connectDB();

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  let passed = 0;
  let total = 0;

  const assert = (condition, description) => {
    total++;
    if (condition) {
      passed++;
      console.log(`  [PASS] ${description}`);
    } else {
      console.error(`  [FAIL] ${description}`);
    }
  };

  const createdProbeIds = [];

  try {
    // Authenticate Admin to obtain session & CSRF cookies
    const adminLogin = await makeRequest(port, { path: '/api/v1/auth/login', method: 'POST' }, {
      email: process.env.INITIAL_ADMIN_EMAIL,
      password: process.env.INITIAL_ADMIN_PASSWORD,
    });
    const adminJwt = adminLogin.cookies.vssp_jwt;
    const adminCsrf = adminLogin.cookies.vssp_csrf;
    const adminHeaders = {
      Cookie: `vssp_jwt=${adminJwt}; vssp_csrf=${adminCsrf}`,
      'X-CSRF-Token': adminCsrf,
    };

    // Authenticate Operator
    const opLogin = await makeRequest(port, { path: '/api/v1/auth/login', method: 'POST' }, {
      email: process.env.INITIAL_OPERATOR_EMAIL,
      password: process.env.INITIAL_OPERATOR_PASSWORD,
    });
    const opJwt = opLogin.cookies.vssp_jwt;
    const opCsrf = opLogin.cookies.vssp_csrf;
    const opHeaders = {
      Cookie: `vssp_jwt=${opJwt}; vssp_csrf=${opCsrf}`,
      'X-CSRF-Token': opCsrf,
    };

    // ------------------------------------------------------------------
    // TEST 1: Camera Registration as ADMIN
    // ------------------------------------------------------------------
    console.log('[Test 1] Testing Camera Registration as ADMIN...');
    const uniqueSuffix = Date.now().toString().slice(-4);
    const probeCode = `CAM-TEST-${uniqueSuffix}`;

    const createRes = await makeRequest(port, { path: '/api/v1/cameras', method: 'POST', headers: adminHeaders }, {
      cameraCode: probeCode,
      name: 'Assembly Inspection Point',
      site: 'Manufacturing Plant 1',
      location: 'Main Assembly Hall - Bay 2',
      description: 'Overhead monitoring for PPE compliance verification',
    });

    assert(createRes.statusCode === 201, 'Admin registers new camera with 201 Created');
    const createdCamera = createRes.body.data?.camera;
    if (createdCamera?._id) createdProbeIds.push(createdCamera._id);

    assert(createdCamera?.cameraCode === probeCode, `Camera code matches: ${probeCode}`);
    assert(createdCamera?.status === 'UNKNOWN', 'Camera status strictly defaults to UNKNOWN');
    assert(createdCamera?.lastSeenAt === null, 'lastSeenAt strictly defaults to null');
    assert(createdCamera?.streamStatus === 'UNAVAILABLE', 'streamStatus defaults to UNAVAILABLE');

    // ------------------------------------------------------------------
    // TEST 2: Duplicate Camera Code Rejection
    // ------------------------------------------------------------------
    console.log('\n[Test 2] Testing Duplicate Camera Code Rejection...');
    const duplicateRes = await makeRequest(port, { path: '/api/v1/cameras', method: 'POST', headers: adminHeaders }, {
      cameraCode: probeCode, // Same code
      name: 'Duplicate Attempt',
      site: 'Plant 1',
      location: 'Zone B',
    });

    assert(duplicateRes.statusCode === 400, 'Rejects duplicate camera code with 400 Bad Request');
    assert(duplicateRes.body.message.includes('Duplicate'), 'Returns clear duplicate identifier error message');

    // ------------------------------------------------------------------
    // TEST 3: Invalid Input Validation
    // ------------------------------------------------------------------
    console.log('\n[Test 3] Testing Input Schema Validation...');
    const invalidRes = await makeRequest(port, { path: '/api/v1/cameras', method: 'POST', headers: adminHeaders }, {
      cameraCode: 'x', // Too short, invalid regex
      name: '',
      site: '',
    });

    assert(invalidRes.statusCode === 400, 'Rejects malformed camera input with 400 Bad Request');
    assert(Array.isArray(invalidRes.body.errors), 'Returns structured validation errors array');

    // ------------------------------------------------------------------
    // TEST 4: Camera Editing as ADMIN
    // ------------------------------------------------------------------
    console.log('\n[Test 4] Testing Camera Metadata Updates as ADMIN...');
    const updateRes = await makeRequest(
      port,
      { path: `/api/v1/cameras/${createdCamera._id}`, method: 'PATCH', headers: adminHeaders },
      {
        name: 'Assembly Inspection Point (Updated)',
        location: 'Hall B - Section 4',
        status: 'ONLINE',
      }
    );

    assert(updateRes.statusCode === 200, 'Admin updates camera successfully with 200 OK');
    assert(updateRes.body.data?.camera?.name === 'Assembly Inspection Point (Updated)', 'Updated name saved in DB');
    assert(updateRes.body.data?.camera?.status === 'ONLINE', 'Updated status saved in DB');

    // ------------------------------------------------------------------
    // TEST 5: RBAC Authorization Checks (SAFETY_OPERATOR)
    // ------------------------------------------------------------------
    console.log('\n[Test 5] Testing RBAC Permissions on Camera Endpoints...');
    // Operator listing cameras -> Permitted
    const opListRes = await makeRequest(port, { path: '/api/v1/cameras', method: 'GET', headers: opHeaders });
    assert(opListRes.statusCode === 200, 'SAFETY_OPERATOR permitted to view camera registry (200 OK)');
    assert(Array.isArray(opListRes.body.data?.cameras), 'Returns camera array to operator');

    // Operator viewing camera details -> Permitted
    const opDetailRes = await makeRequest(
      port,
      { path: `/api/v1/cameras/${createdCamera._id}`, method: 'GET', headers: opHeaders }
    );
    assert(opDetailRes.statusCode === 200, 'SAFETY_OPERATOR permitted to inspect camera details (200 OK)');

    // Operator attempting POST /cameras -> Blocked with 403
    const opCreateBlockRes = await makeRequest(
      port,
      { path: '/api/v1/cameras', method: 'POST', headers: opHeaders },
      { cameraCode: 'CAM-OP-UNAUTH', name: 'Unauthorized', site: 'Plant 1', location: 'Zone 1' }
    );
    assert(opCreateBlockRes.statusCode === 403, 'SAFETY_OPERATOR blocked from creating cameras (403 Forbidden)');

    // Operator attempting PATCH /cameras/:id -> Blocked with 403
    const opUpdateBlockRes = await makeRequest(
      port,
      { path: `/api/v1/cameras/${createdCamera._id}`, method: 'PATCH', headers: opHeaders },
      { name: 'Operator Hijack Attempt' }
    );
    assert(opUpdateBlockRes.statusCode === 403, 'SAFETY_OPERATOR blocked from editing cameras (403 Forbidden)');

    // ------------------------------------------------------------------
    // TEST 6: Dynamic Dashboard Aggregation Summary
    // ------------------------------------------------------------------
    console.log('\n[Test 6] Testing Dynamic Dashboard Aggregation (/api/v1/dashboard/summary)...');
    const dashboardRes = await makeRequest(port, { path: '/api/v1/dashboard/summary', method: 'GET', headers: adminHeaders });
    assert(dashboardRes.statusCode === 200, 'Dashboard summary returns 200 OK');

    const kpis = dashboardRes.body.data?.kpis;
    assert(typeof kpis?.totalCameras === 'number', 'totalCameras is numeric metric');
    assert(typeof kpis?.onlineCameras === 'number', 'onlineCameras is numeric metric');
    assert(typeof kpis?.unknownCameras === 'number', 'unknownCameras is numeric metric');
    assert(typeof kpis?.offlineCameras === 'number', 'offlineCameras is numeric metric');
    assert(kpis?.pendingAlerts === 0, 'pendingAlerts reflects honest empty state (0)');
    assert(Array.isArray(dashboardRes.body.data?.recentCameras), 'Returns recent cameras list from database');

    console.log('\n========================================================');
    console.log(`  BACKEND CAMERA SUITE: ${passed}/${total} CHECKS PASSED`);
    console.log('========================================================\n');
  } finally {
    // Purge test probe cameras from Atlas
    if (createdProbeIds.length > 0) {
      await Camera.deleteMany({ _id: { $in: createdProbeIds } });
      console.log('  - Test probe camera records purged from database');
    }
    server.close(async () => {
      await disconnectDB();
    });
  }
};

runCameraTests();

