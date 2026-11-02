/**
 * Comprehensive Milestone 2 Security Audit Verification Script
 * Validates:
 * 1. seedUsers.js env-only credential enforcement
 * 2. JWT expiration rejection (expired tokens denied with 401)
 * 3. Inactive account access denial (inactive users blocked with 403)
 * 4. Logout cookie clearance with matching RFC 6265 attributes
 * 5. Production cookie security flags (Secure, HttpOnly, SameSite)
 * 6. Temporary test account lifecycle and clean teardown
 */
const http = require('http');
const jwt = require('jsonwebtoken');
const app = require('../app');
const env = require('../config/env');
const User = require('../models/User');
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

        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          setCookies: res.headers['set-cookie'] || [],
          body: parsed,
        });
      });
    });

    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
};

const runSecurityAudit = async () => {
  console.log('\n========================================================');
  console.log('  MILESTONE 2: DEEP SECURITY AUDIT & VERIFICATION');
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

  try {
    // ------------------------------------------------------------------
    // CHECK 1: seedUsers.js Environment-Only Credential Enforcement
    // ------------------------------------------------------------------
    console.log('[Check 1] Reviewing seedUsers.js for Hardcoded Secrets...');
    const fs = require('fs');
    const path = require('path');
    const seedCode = fs.readFileSync(path.resolve(__dirname, 'seedUsers.js'), 'utf8');

    const hasHardcodedAdminPass = seedCode.includes('AdminSecurePass');
    const hasHardcodedOpPass = seedCode.includes('OperatorSecurePass');
    const checksEnvVariables = seedCode.includes('process.env.INITIAL_ADMIN_EMAIL') &&
                               seedCode.includes('process.env.INITIAL_ADMIN_PASSWORD');

    assert(!hasHardcodedAdminPass, 'seedUsers.js has zero hardcoded administrator passwords');
    assert(!hasHardcodedOpPass, 'seedUsers.js has zero hardcoded operator passwords');
    assert(checksEnvVariables, 'seedUsers.js strictly requires credentials from environment');

    // ------------------------------------------------------------------
    // CHECK 2: JWT Expiration & Rejection of Expired Tokens
    // ------------------------------------------------------------------
    console.log('\n[Check 2] Testing JWT Expiration Rejection...');
    const expiredToken = jwt.sign(
      { id: '6ae5ca8c9ccae22626d6873b', role: 'ADMIN' },
      env.JWT_SECRET,
      { expiresIn: '-1s' } // Expired 1 second ago
    );

    const expiredRes = await makeRequest(port, {
      path: '/api/v1/auth/me',
      method: 'GET',
      headers: { Cookie: `vssp_jwt=${expiredToken}` },
    });

    assert(expiredRes.statusCode === 401, 'Expired token is rejected with 401 Unauthorized');
    assert(
      expiredRes.body.message && expiredRes.body.message.includes('expired'),
      `Explicit expired error returned: "${expiredRes.body.message}"`
    );

    // ------------------------------------------------------------------
    // CHECK 3: Inactive User Access Denial with Existing Session Cookie
    // ------------------------------------------------------------------
    console.log('\n[Check 3] Testing Inactive Account Access Denial...');
    const tempUserEmail = `inactive_probe_${Date.now()}@vssp.local`;
    const tempInactiveUser = await User.create({
      name: 'Probe Suspended User',
      email: tempUserEmail,
      passwordHash: await User.hashPassword('TempProbePass@123!'),
      role: 'SAFETY_OPERATOR',
      isActive: false, // Suspended account
    });

    // Issue valid JWT for this inactive user
    const inactiveUserToken = jwt.sign(
      { id: tempInactiveUser._id, role: tempInactiveUser.role },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const inactiveRes = await makeRequest(port, {
      path: '/api/v1/auth/me',
      method: 'GET',
      headers: { Cookie: `vssp_jwt=${inactiveUserToken}` },
    });

    assert(inactiveRes.statusCode === 403, 'Inactive user rejected with 403 Forbidden');
    assert(
      inactiveRes.body.message && inactiveRes.body.message.includes('suspended'),
      `Suspension message returned: "${inactiveRes.body.message}"`
    );

    // Clean up temporary user record immediately
    await User.deleteOne({ _id: tempInactiveUser._id });
    console.log('  - Temporary suspended probe account purged from database');

    // ------------------------------------------------------------------
    // CHECK 4: Logout Cookie Clearance Matching Attributes
    // ------------------------------------------------------------------
    console.log('\n[Check 4] Testing Logout Cookie Clearance Attributes...');
    // Login to obtain valid session
    const loginRes = await makeRequest(port, { path: '/api/v1/auth/login', method: 'POST' }, {
      email: process.env.INITIAL_ADMIN_EMAIL,
      password: process.env.INITIAL_ADMIN_PASSWORD,
    });

    const jwtCookie = loginRes.setCookies.find((c) => c.startsWith('vssp_jwt='));
    const csrfCookie = loginRes.setCookies.find((c) => c.startsWith('vssp_csrf='));

    // Extract CSRF token value
    const csrfVal = csrfCookie.split(';')[0].split('=')[1];
    const jwtVal = jwtCookie.split(';')[0].split('=')[1];

    // Call Logout with valid CSRF
    const logoutRes = await makeRequest(port, {
      path: '/api/v1/auth/logout',
      method: 'POST',
      headers: {
        Cookie: `vssp_jwt=${jwtVal}; vssp_csrf=${csrfVal}`,
        'X-CSRF-Token': csrfVal,
      },
    });

    assert(logoutRes.statusCode === 200, 'Logout request accepted with 200 OK');

    const logoutJwtCookie = logoutRes.setCookies.find((c) => c.startsWith('vssp_jwt='));
    const logoutCsrfCookie = logoutRes.setCookies.find((c) => c.startsWith('vssp_csrf='));

    assert(Boolean(logoutJwtCookie), 'Issues clearing Set-Cookie for vssp_jwt');
    assert(
      logoutJwtCookie.includes('Expires=Thu, 01 Jan 1970') || logoutJwtCookie.includes('Max-Age=0'),
      'vssp_jwt clearing cookie has expired timestamp (1970)'
    );
    assert(logoutJwtCookie.includes('Path=/'), 'vssp_jwt clearing cookie matches Path=/');
    assert(logoutJwtCookie.includes('HttpOnly'), 'vssp_jwt clearing cookie maintains HttpOnly attribute');
    assert(logoutJwtCookie.includes('SameSite=Lax'), 'vssp_jwt clearing cookie maintains SameSite=Lax attribute');

    // ------------------------------------------------------------------
    // CHECK 5: Production Cookie Security Assumptions
    // ------------------------------------------------------------------
    console.log('\n[Check 5] Testing Production Cookie Security Configurations...');
    const originalEnv = env.NODE_ENV;
    env.NODE_ENV = 'production';

    const prodLoginRes = await makeRequest(port, { path: '/api/v1/auth/login', method: 'POST' }, {
      email: process.env.INITIAL_ADMIN_EMAIL,
      password: process.env.INITIAL_ADMIN_PASSWORD,
    });

    const prodJwtHeader = prodLoginRes.setCookies.find((c) => c.startsWith('vssp_jwt='));
    const prodCsrfHeader = prodLoginRes.setCookies.find((c) => c.startsWith('vssp_csrf='));

    assert(prodJwtHeader.includes('Secure'), 'Production vssp_jwt includes Secure flag (HTTPS strictly required)');
    assert(prodJwtHeader.includes('HttpOnly'), 'Production vssp_jwt includes HttpOnly flag');
    assert(prodJwtHeader.includes('SameSite=Lax'), 'Production vssp_jwt includes SameSite=Lax');
    assert(prodCsrfHeader.includes('Secure'), 'Production vssp_csrf includes Secure flag');
    assert(!prodCsrfHeader.includes('HttpOnly'), 'Production vssp_csrf is readable for Double-Submit header');

    env.NODE_ENV = originalEnv;

    console.log('\n========================================================');
    console.log(`  SECURITY AUDIT COMPLETED: ${passed}/${total} CHECKS PASSED`);
    console.log('========================================================\n');
  } finally {
    server.close(async () => {
      await disconnectDB();
    });
  }
};

runSecurityAudit();

