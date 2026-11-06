/**
 * Verification Test Suite: Work-Front Search, Multi-Filter & Pagination
 * Validates:
 * 1. Search by Work-Front code
 * 2. Search by Work-Front name
 * 3. Search by Contractor
 * 4. Search by Zone
 * 5. Filter by Lifecycle Status (PLANNING, ACTIVE, SUSPENDED, COMPLETED)
 * 6. Filter by Risk Level (LOW, MEDIUM, HIGH, CRITICAL)
 * 7. Filter by Activity Category (EXCAVATION, HOT_WORK, CONFINED_SPACE, ELECTRICAL, etc.)
 * 8. Combining Multiple Filters simultaneously
 * 9. Clearing / resetting filters (full dataset restoration)
 * 10. Pagination with active filters (limit, page 1 vs page 2)
 * 11. Empty search results (honest zero-count array)
 * 12. Case tolerance for query parameters (e.g. status=active)
 * 13. Clean teardown of test probe fixtures
 */

const http = require('http');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = require('../app');
const { connectDB, disconnectDB } = require('../config/db');
const WorkFront = require('../models/WorkFront');

const PORT = 5008;
let server;

const makeRequest = (options) => {
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
    req.end();
  });
};

const runSearchFilterTests = async () => {
  console.log('\n========================================================================');
  console.log('  WORK-FRONT SEARCH, MULTI-FILTER & PAGINATION VERIFICATION');
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

  const createdFixtureIds = [];
  const runTag = Date.now().toString(36).toUpperCase();

  try {
    await connectDB();
    server = app.listen(PORT);

    // 1. Authenticate as Operator (Read-only role to prove search works for all authenticated users)
    const loginRes = await new Promise((resolve, reject) => {
      const postReq = http.request(
        {
          hostname: '127.0.0.1',
          port: PORT,
          path: '/api/v1/auth/login',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
        (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => {
            const setCookies = res.headers['set-cookie'] || [];
            const cookies = {};
            setCookies.forEach((sc) => {
              const parts = sc.split(';')[0].split('=');
              cookies[parts[0].trim()] = parts[1] ? parts[1].trim() : '';
            });
            resolve({ statusCode: res.statusCode, cookies });
          });
        }
      );
      postReq.on('error', reject);
      postReq.write(
        JSON.stringify({
          email: process.env.INITIAL_OPERATOR_EMAIL,
          password: process.env.INITIAL_OPERATOR_PASSWORD,
        })
      );
      postReq.end();
    });

    assert(loginRes.statusCode === 200, 'Operator authenticated successfully');
    const authHeaders = {
      Cookie: `vssp_jwt=${loginRes.cookies['vssp_jwt']}; vssp_csrf=${loginRes.cookies['vssp_csrf']}`,
    };

    // 2. Setup 4 Distinct Fixtures
    const wfCode1 = `WF-SF1-${runTag}`;
    const wfCode2 = `WF-SF2-${runTag}`;
    const wfCode3 = `WF-SF3-${runTag}`;
    const wfCode4 = `WF-SF4-${runTag}`;

    const fixture1 = await WorkFront.create({
      workFrontCode: wfCode1,
      name: `Deep Foundation Pit Digging ${runTag}`,
      site: `Alpha Plant ${runTag}`,
      zone: `Zone 101 North Trench ${runTag}`,
      contractor: `Shapoorji Earthmovers Ltd ${runTag}`,
      supervisor: { name: 'Vikram Seth', phone: '+91 91111 22222', email: 'vikram@example.com' },
      activityType: 'EXCAVATION',
      riskLevel: 'HIGH',
      shift: 'MORNING',
      status: 'ACTIVE',
      cameras: [],
    });
    createdFixtureIds.push(fixture1._id);

    const fixture2 = await WorkFront.create({
      workFrontCode: wfCode2,
      name: `Boiler Stack Heavy Welding ${runTag}`,
      site: `Alpha Plant ${runTag}`,
      zone: `Zone 202 High Bay ${runTag}`,
      contractor: `Thermax Engineering Corp ${runTag}`,
      supervisor: { name: 'Anil Deshmukh', phone: '+91 93333 44444', email: 'anil@example.com' },
      activityType: 'HOT_WORK',
      riskLevel: 'CRITICAL',
      shift: 'NIGHT',
      status: 'PLANNING',
      cameras: [],
    });
    createdFixtureIds.push(fixture2._id);

    const fixture3 = await WorkFront.create({
      workFrontCode: wfCode3,
      name: `Cooling Tower Confined Entry ${runTag}`,
      site: `Beta Yard ${runTag}`,
      zone: `Zone 303 Tower Base ${runTag}`,
      contractor: `Simplex Projects India ${runTag}`,
      supervisor: { name: 'Manoj Bajpayee', phone: '+91 95555 66666', email: 'manoj@example.com' },
      activityType: 'CONFINED_SPACE',
      riskLevel: 'MEDIUM',
      shift: 'AFTERNOON',
      status: 'SUSPENDED',
      cameras: [],
    });
    createdFixtureIds.push(fixture3._id);

    const fixture4 = await WorkFront.create({
      workFrontCode: wfCode4,
      name: `Substation Cabling Grid ${runTag}`,
      site: `Beta Yard ${runTag}`,
      zone: `Zone 404 Yard Grid ${runTag}`,
      contractor: `ABB Power Automation ${runTag}`,
      supervisor: { name: 'Sunil Gavaskar', phone: '+91 97777 88888', email: 'sunil@example.com' },
      activityType: 'ELECTRICAL',
      riskLevel: 'LOW',
      shift: 'GENERAL_24X7',
      status: 'COMPLETED',
      cameras: [],
    });
    createdFixtureIds.push(fixture4._id);

    console.log(`  Initialized 4 distinct test fixtures with runTag: ${runTag}\n`);

    // -------------------------------------------------------------------------
    // TEST 1: SEARCH BY WORK-FRONT CODE
    // -------------------------------------------------------------------------
    const searchCodeRes = await makeRequest({
      path: `/api/v1/work-fronts?search=${wfCode1}`,
      headers: authHeaders,
    });
    assert(searchCodeRes.statusCode === 200, 'Search by code returns HTTP 200');
    const codeList = searchCodeRes.body?.data?.workFronts || [];
    assert(
      codeList.length === 1 && codeList[0].workFrontCode === wfCode1,
      `Search by code '${wfCode1}' returns exactly matching Work-Front`
    );

    // -------------------------------------------------------------------------
    // TEST 2: SEARCH BY WORK-FRONT NAME
    // -------------------------------------------------------------------------
    const searchNameRes = await makeRequest({
      path: `/api/v1/work-fronts?search=Heavy%20Welding`,
      headers: authHeaders,
    });
    assert(searchNameRes.statusCode === 200, 'Search by name returns HTTP 200');
    const nameList = searchNameRes.body?.data?.workFronts || [];
    assert(
      nameList.some((w) => w.workFrontCode === wfCode2),
      "Search by name 'Heavy Welding' finds matching Work-Front"
    );

    // -------------------------------------------------------------------------
    // TEST 3: SEARCH BY CONTRACTOR
    // -------------------------------------------------------------------------
    const searchContractorRes = await makeRequest({
      path: `/api/v1/work-fronts?search=Simplex%20Projects`,
      headers: authHeaders,
    });
    assert(searchContractorRes.statusCode === 200, 'Search by contractor returns HTTP 200');
    const contractorList = searchContractorRes.body?.data?.workFronts || [];
    assert(
      contractorList.some((w) => w.workFrontCode === wfCode3),
      "Search by contractor 'Simplex Projects' finds matching Work-Front"
    );

    // -------------------------------------------------------------------------
    // TEST 4: SEARCH BY ZONE
    // -------------------------------------------------------------------------
    const searchZoneRes = await makeRequest({
      path: `/api/v1/work-fronts?search=Zone%20404`,
      headers: authHeaders,
    });
    assert(searchZoneRes.statusCode === 200, 'Search by zone returns HTTP 200');
    const zoneList = searchZoneRes.body?.data?.workFronts || [];
    assert(
      zoneList.some((w) => w.workFrontCode === wfCode4),
      "Search by zone 'Zone 404' finds matching Work-Front"
    );

    // -------------------------------------------------------------------------
    // TEST 5: FILTER BY LIFECYCLE STATUS (PLANNING, ACTIVE, SUSPENDED, COMPLETED)
    // -------------------------------------------------------------------------
    const statusTests = [
      { status: 'ACTIVE', expectedCode: wfCode1 },
      { status: 'PLANNING', expectedCode: wfCode2 },
      { status: 'SUSPENDED', expectedCode: wfCode3 },
      { status: 'COMPLETED', expectedCode: wfCode4 },
    ];

    for (const test of statusTests) {
      const res = await makeRequest({
        path: `/api/v1/work-fronts?status=${test.status}&search=${runTag}`,
        headers: authHeaders,
      });
      assert(res.statusCode === 200, `Filter by status=${test.status} returns HTTP 200`);
      const items = res.body?.data?.workFronts || [];
      assert(
        items.length === 1 && items[0].workFrontCode === test.expectedCode,
        `Status ${test.status} filter isolated Work-Front ${test.expectedCode}`
      );
    }

    // -------------------------------------------------------------------------
    // TEST 6: FILTER BY RISK LEVEL (LOW, MEDIUM, HIGH, CRITICAL)
    // -------------------------------------------------------------------------
    const riskTests = [
      { risk: 'HIGH', expectedCode: wfCode1 },
      { risk: 'CRITICAL', expectedCode: wfCode2 },
      { risk: 'MEDIUM', expectedCode: wfCode3 },
      { risk: 'LOW', expectedCode: wfCode4 },
    ];

    for (const test of riskTests) {
      const res = await makeRequest({
        path: `/api/v1/work-fronts?riskLevel=${test.risk}&search=${runTag}`,
        headers: authHeaders,
      });
      assert(res.statusCode === 200, `Filter by riskLevel=${test.risk} returns HTTP 200`);
      const items = res.body?.data?.workFronts || [];
      assert(
        items.length === 1 && items[0].workFrontCode === test.expectedCode,
        `Risk level ${test.risk} filter isolated Work-Front ${test.expectedCode}`
      );
    }

    // -------------------------------------------------------------------------
    // TEST 7: FILTER BY ACTIVITY CATEGORY
    // -------------------------------------------------------------------------
    const activityTests = [
      { activity: 'EXCAVATION', expectedCode: wfCode1 },
      { activity: 'HOT_WORK', expectedCode: wfCode2 },
      { activity: 'CONFINED_SPACE', expectedCode: wfCode3 },
      { activity: 'ELECTRICAL', expectedCode: wfCode4 },
    ];

    for (const test of activityTests) {
      const res = await makeRequest({
        path: `/api/v1/work-fronts?activityType=${test.activity}&search=${runTag}`,
        headers: authHeaders,
      });
      assert(res.statusCode === 200, `Filter by activityType=${test.activity} returns HTTP 200`);
      const items = res.body?.data?.workFronts || [];
      assert(
        items.length === 1 && items[0].workFrontCode === test.expectedCode,
        `Activity type ${test.activity} filter isolated Work-Front ${test.expectedCode}`
      );
    }

    // -------------------------------------------------------------------------
    // TEST 8: COMBINING MULTIPLE FILTERS (SEARCH + STATUS + RISK + ACTIVITY)
    // -------------------------------------------------------------------------
    const multiFilterMatchRes = await makeRequest({
      path: `/api/v1/work-fronts?search=${runTag}&status=ACTIVE&riskLevel=HIGH&activityType=EXCAVATION`,
      headers: authHeaders,
    });
    assert(multiFilterMatchRes.statusCode === 200, 'Combined multi-filter returns HTTP 200');
    const multiList = multiFilterMatchRes.body?.data?.workFronts || [];
    assert(
      multiList.length === 1 && multiList[0].workFrontCode === wfCode1,
      'Combined multi-filter correctly matched exactly the target Work-Front'
    );

    // Multi-filter with no match (e.g. ACTIVE with LOW risk)
    const multiFilterNoMatchRes = await makeRequest({
      path: `/api/v1/work-fronts?search=${runTag}&status=ACTIVE&riskLevel=LOW`,
      headers: authHeaders,
    });
    assert(multiFilterNoMatchRes.statusCode === 200, 'Contradicting multi-filter returns HTTP 200');
    assert(
      (multiFilterNoMatchRes.body?.data?.workFronts || []).length === 0,
      'Contradicting multi-filter returns honest empty list (0 matches)'
    );

    // -------------------------------------------------------------------------
    // TEST 9: CLEARING / RESETTING FILTERS (FULL DATASET RESTORATION)
    // -------------------------------------------------------------------------
    const resetRes = await makeRequest({
      path: `/api/v1/work-fronts?search=${runTag}&status=ALL&riskLevel=ALL&activityType=ALL`,
      headers: authHeaders,
    });
    assert(resetRes.statusCode === 200, 'Reset filters query returns HTTP 200');
    const resetList = resetRes.body?.data?.workFronts || [];
    assert(
      resetList.length === 4,
      `Reset filters query restored all 4 active test fixtures for runTag ${runTag}`
    );

    // -------------------------------------------------------------------------
    // TEST 10: PAGINATION WITH ACTIVE FILTERS
    // -------------------------------------------------------------------------
    // Alpha Plant has 2 fixtures (wfCode1, wfCode2)
    const page1Res = await makeRequest({
      path: `/api/v1/work-fronts?search=Alpha%20Plant%20${runTag}&limit=1&page=1`,
      headers: authHeaders,
    });
    assert(page1Res.statusCode === 200, 'Pagination page 1 returns HTTP 200');
    assert(
      page1Res.body?.data?.workFronts?.length === 1,
      'Page 1 returns exactly 1 item when limit=1'
    );
    assert(
      page1Res.body?.meta?.total === 2 && page1Res.body?.meta?.totalPages === 2,
      'Pagination meta accurately reflects 2 total records and 2 total pages'
    );

    const page2Res = await makeRequest({
      path: `/api/v1/work-fronts?search=Alpha%20Plant%20${runTag}&limit=1&page=2`,
      headers: authHeaders,
    });
    assert(page2Res.statusCode === 200, 'Pagination page 2 returns HTTP 200');
    assert(
      page2Res.body?.data?.workFronts?.length === 1,
      'Page 2 returns exactly 1 item when limit=1'
    );
    assert(
      page1Res.body?.data?.workFronts[0]._id !== page2Res.body?.data?.workFronts[0]._id,
      'Page 1 and Page 2 return distinct records'
    );

    // -------------------------------------------------------------------------
    // TEST 11: EMPTY SEARCH RESULTS
    // -------------------------------------------------------------------------
    const emptyRes = await makeRequest({
      path: `/api/v1/work-fronts?search=NON_EXISTENT_QUERY_XYZ_999999`,
      headers: authHeaders,
    });
    assert(emptyRes.statusCode === 200, 'Empty search returns HTTP 200 OK');
    assert(
      Array.isArray(emptyRes.body?.data?.workFronts) && emptyRes.body?.data?.workFronts?.length === 0,
      'Non-matching search returns an empty array'
    );
    assert(
      emptyRes.body?.meta?.total === 0,
      'Pagination meta reflects total=0 for non-matching search'
    );

    // -------------------------------------------------------------------------
    // TEST 12: CASE-INSENSITIVE PARAMETER TOLERANCE
    // -------------------------------------------------------------------------
    const lowercaseParamRes = await makeRequest({
      path: `/api/v1/work-fronts?status=active&riskLevel=high&activityType=excavation&search=${runTag}`,
      headers: authHeaders,
    });
    assert(lowercaseParamRes.statusCode === 200, 'Lowercase query parameters accepted (HTTP 200)');
    assert(
      lowercaseParamRes.body?.data?.workFronts?.length === 1 &&
        lowercaseParamRes.body?.data?.workFronts[0].workFrontCode === wfCode1,
      'Case-insensitive normalization correctly matches Work-Front'
    );

  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    // -------------------------------------------------------------------------
    // TEST 13: CLEAN TEARDOWN
    // -------------------------------------------------------------------------
    console.log('\n  Purging test fixtures...');
    try {
      if (createdFixtureIds.length > 0) {
        await WorkFront.deleteMany({ _id: { $in: createdFixtureIds } });
        console.log(`  Purged ${createdFixtureIds.length} test probe fixtures.`);
      }
    } catch (cleanupErr) {
      console.error('  Cleanup error:', cleanupErr.message);
    }

    if (server) await new Promise((r) => server.close(r));
    await disconnectDB();

    console.log('\n========================================================================');
    console.log(`  WORK-FRONT SEARCH & FILTERS TEST RESULTS: ${passed}/${total} PASSED`);
    console.log('========================================================================\n');

    process.exit(passed === total ? 0 : 1);
  }
};

runSearchFilterTests();

