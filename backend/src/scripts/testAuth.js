/**
 * Backend Automated Security & Authentication Test Suite
 * Validates:
 * 1. Invalid credential rejection & generic error messages
 * 2. Successful login, HttpOnly JWT issuance & signed CSRF cookie
 * 3. Session persistence via /api/v1/auth/me
 * 4. CSRF protection: missing token rejection & forged token rejection
 * 5. Clean logout & session cookie clearance
 * 6. RBAC enforcement: Admin vs Safety Operator route authorization
 */
const http = require('http');
const app = require('../app');
const { connectDB, disconnectDB } = require('../config/db');

// Helper to make HTTP requests against ephemeral server
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

        // Parse Set-Cookie headers
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
          rawSetCookies: setCookies,
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

const runAuthTests = async () => {
  console.log('\n========================================================');
  console.log('  BACKEND AUTHENTICATION & RBAC SECURITY TEST SUITE');
  console.log('========================================================\n');

  await connectDB();

  const testServer = http.createServer(app);
  await new Promise((resolve) => testServer.listen(0, '127.0.0.1', resolve));
  const port = testServer.address().port;

  let passedChecks = 0;
  let totalChecks = 0;

  const assert = (condition, description) => {
    totalChecks++;
    if (condition) {
      passedChecks++;
      console.log(`  [PASS] ${description}`);
    } else {
      console.error(`  [FAIL] ${description}`);
    }
  };

  try {
    const adminEmail = process.env.INITIAL_ADMIN_EMAIL || 'admin@vssp.local';
    const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'AdminSecurePass@2026!';
    const operatorEmail = process.env.INITIAL_OPERATOR_EMAIL || 'operator@vssp.local';
    const operatorPassword = process.env.INITIAL_OPERATOR_PASSWORD || 'OperatorSecurePass@2026!';

    // TEST 1: Invalid Login Credentials
    console.log('[Test 1] Testing Invalid Credentials Handling...');
    const invalidRes = await makeRequest(port, { path: '/api/v1/auth/login', method: 'POST' }, {
      email: adminEmail,
      password: 'WrongPassword999!',
    });
    assert(invalidRes.statusCode === 401, 'Rejects invalid password with 401 Unauthorized');
    assert(invalidRes.body.message === 'Invalid email or password', 'Returns generic error without leaking account existence');
    assert(!invalidRes.cookies.vssp_jwt, 'Does not issue session cookie on failure');

    // TEST 2: Valid Administrator Login
    console.log('\n[Test 2] Testing Valid Admin Login & Cookie Issuance...');
    const adminLoginRes = await makeRequest(port, { path: '/api/v1/auth/login', method: 'POST' }, {
      email: adminEmail,
      password: adminPassword,
    });
    assert(adminLoginRes.statusCode === 200, 'Admin login succeeds with 200 OK');
    assert(adminLoginRes.body.data?.user?.role === 'ADMIN', 'Returns user profile with ADMIN role');
    assert(!adminLoginRes.body.data?.user?.passwordHash, 'Strictly omits passwordHash from response');
    assert(Boolean(adminLoginRes.cookies.vssp_jwt), 'Issues vssp_jwt session cookie');
    assert(Boolean(adminLoginRes.cookies.vssp_csrf), 'Issues vssp_csrf double-submit cookie');

    // Verify Cookie Flags
    const jwtCookieHeader = adminLoginRes.rawSetCookies.find((c) => c.startsWith('vssp_jwt='));
    assert(jwtCookieHeader && jwtCookieHeader.includes('HttpOnly'), 'vssp_jwt has HttpOnly attribute set');
    assert(jwtCookieHeader && jwtCookieHeader.includes('SameSite=Lax'), 'vssp_jwt has SameSite=Lax attribute set');

    const adminJwt = adminLoginRes.cookies.vssp_jwt;
    const adminCsrf = adminLoginRes.cookies.vssp_csrf;

    // TEST 3: Authenticated Session (/api/v1/auth/me)
    console.log('\n[Test 3] Testing Current Session Verification (/api/v1/auth/me)...');
    const meRes = await makeRequest(port, {
      path: '/api/v1/auth/me',
      method: 'GET',
      headers: { Cookie: `vssp_jwt=${adminJwt}` },
    });
    assert(meRes.statusCode === 200, 'Returns active session profile with 200 OK');
    assert(meRes.body.data?.user?.email === adminEmail, 'Session profile matches authenticated user');

    // TEST 4: Unauthenticated Access Rejection
    console.log('\n[Test 4] Testing Unauthenticated Access Rejection...');
    const unauthRes = await makeRequest(port, { path: '/api/v1/auth/me', method: 'GET' });
    assert(unauthRes.statusCode === 401, 'Rejects unauthenticated request with 401');

    // TEST 5: CSRF Protection on Mutating Requests
    console.log('\n[Test 5] Testing CSRF Validation & Forgery Rejection...');
    
    // 5a. Missing CSRF Token
    const noCsrfRes = await makeRequest(port, {
      path: '/api/v1/auth/logout',
      method: 'POST',
      headers: { Cookie: `vssp_jwt=${adminJwt}` },
    });
    assert(noCsrfRes.statusCode === 403, 'Rejects mutating request without CSRF token with 403 Forbidden');

    // 5b. Forged / Tampered CSRF Token
    const forgedCsrfRes = await makeRequest(port, {
      path: '/api/v1/auth/logout',
      method: 'POST',
      headers: {
        Cookie: `vssp_jwt=${adminJwt}; vssp_csrf=forged_token.1234567890abcdef`,
        'X-CSRF-Token': 'forged_token.1234567890abcdef',
      },
    });
    assert(forgedCsrfRes.statusCode === 403, 'Rejects forged CSRF token with invalid cryptographic signature');

    // 5c. Valid CSRF Token
    const validLogoutRes = await makeRequest(port, {
      path: '/api/v1/auth/logout',
      method: 'POST',
      headers: {
        Cookie: `vssp_jwt=${adminJwt}; vssp_csrf=${adminCsrf}`,
        'X-CSRF-Token': adminCsrf,
      },
    });
    assert(validLogoutRes.statusCode === 200, 'Accepts valid cryptographically signed CSRF token');

    // TEST 6: RBAC Authorization Checks (ADMIN vs SAFETY_OPERATOR)
    console.log('\n[Test 6] Testing Role-Based Access Control (RBAC)...');
    
    // Login as Safety Operator
    const opLoginRes = await makeRequest(port, { path: '/api/v1/auth/login', method: 'POST' }, {
      email: operatorEmail,
      password: operatorPassword,
    });
    const opJwt = opLoginRes.cookies.vssp_jwt;

    // Operator accesses operator route -> Permitted
    const opAccessRes = await makeRequest(port, {
      path: '/api/v1/auth/rbac/operator-access',
      method: 'GET',
      headers: { Cookie: `vssp_jwt=${opJwt}` },
    });
    assert(opAccessRes.statusCode === 200, 'SAFETY_OPERATOR granted access to operator route');

    // Operator accesses admin-only route -> Blocked with 403
    const opAdminBlockRes = await makeRequest(port, {
      path: '/api/v1/auth/rbac/admin-only',
      method: 'GET',
      headers: { Cookie: `vssp_jwt=${opJwt}` },
    });
    assert(opAdminBlockRes.statusCode === 403, 'SAFETY_OPERATOR blocked from ADMIN-only route with 403 Forbidden');

    // Login as Admin
    const adminReLoginRes = await makeRequest(port, { path: '/api/v1/auth/login', method: 'POST' }, {
      email: adminEmail,
      password: adminPassword,
    });
    const freshAdminJwt = adminReLoginRes.cookies.vssp_jwt;

    // Admin accesses admin-only route -> Permitted
    const adminAccessRes = await makeRequest(port, {
      path: '/api/v1/auth/rbac/admin-only',
      method: 'GET',
      headers: { Cookie: `vssp_jwt=${freshAdminJwt}` },
    });
    assert(adminAccessRes.statusCode === 200, 'ADMIN granted access to admin-only route');

    console.log('\n========================================================');
    console.log(`  BACKEND AUTH SUITE: ${passedChecks}/${totalChecks} CHECKS PASSED`);
    console.log('========================================================\n');
  } finally {
    testServer.close(async () => {
      await disconnectDB();
    });
  }
};

runAuthTests();

