/**
 * Website-Based End-to-End Automated Browser Test Suite
 * Driven by Playwright + locally installed Google Chrome
 */
const { chromium } = require('playwright');
const http = require('http');
const path = require('path');

// Load backend app and db
const backendApp = require('../../backend/src/app');
const { connectDB, disconnectDB } = require('../../backend/src/config/db');

const BACKEND_PORT = 5000;
const FRONTEND_PORT = 5173;

const runWebsiteE2ETests = async () => {
  console.log('========================================================');
  console.log('  MILESTONE 2: WEBSITE-BASED E2E BROWSER TEST SUITE');
  console.log('========================================================\n');

  let backendServer = null;
  let viteServer = null;
  let browser = null;

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
    // 1. Connect MongoDB & Start Backend on Port 5000
    console.log('[Setup 1/3] Connecting to MongoDB and starting backend API...');
    await connectDB();
    backendServer = http.createServer(backendApp);
    await new Promise((resolve) => backendServer.listen(BACKEND_PORT, '0.0.0.0', resolve));
    console.log(`  - Backend API active on http://localhost:${BACKEND_PORT}`);

    // 2. Start Frontend Server via programmatic Vite Preview API on Port 5173
    console.log('[Setup 2/3] Starting Vite frontend preview server...');
    const frontendDir = path.resolve(__dirname, '..');
    const { preview } = await import('vite');
    viteServer = await preview({
      root: frontendDir,
      preview: {
        port: FRONTEND_PORT,
        host: '0.0.0.0',
        strictPort: true,
      },
    });
    console.log(`  - Frontend server active on http://localhost:${FRONTEND_PORT}`);

    // 3. Launch Chrome via Playwright
    console.log('[Setup 3/3] Launching Google Chrome browser via Playwright...');
    browser = await chromium.launch({
      channel: 'chrome',
      headless: true,
    });
    console.log('  - Chrome launched successfully');

    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();

    // ------------------------------------------------------------------
    // TEST 1: Unauthenticated Navigation Redirects to /login
    // ------------------------------------------------------------------
    console.log('\n[Test 1] Testing Unauthenticated Route Protection...');
    await page.goto(`http://localhost:${FRONTEND_PORT}/`);
    await page.waitForURL(`**/login`);
    assert(page.url().includes('/login'), 'Unauthenticated visit to / redirects to /login');

    await page.goto(`http://localhost:${FRONTEND_PORT}/cameras`);
    await page.waitForURL(`**/login`);
    assert(page.url().includes('/login'), 'Unauthenticated visit to /cameras redirects to /login');

    // ------------------------------------------------------------------
    // TEST 2: Invalid Login Submission & UI Error Alert
    // ------------------------------------------------------------------
    console.log('\n[Test 2] Testing Invalid Credentials in Website Form...');
    await page.goto(`http://localhost:${FRONTEND_PORT}/login`);

    await page.fill('#email', 'admin@vssp.local');
    await page.fill('#password', 'WrongPassword999!');
    await page.click('button[type="submit"]');

    // Wait for alert box
    const alertElement = await page.waitForSelector('[role="alert"]', { timeout: 5000 });
    const alertText = await alertElement.textContent();
    assert(
      alertText.includes('Invalid email or password'),
      `UI displays error alert: "${alertText.trim()}"`
    );
    assert(page.url().includes('/login'), 'User remains on /login after failed authentication');

    // ------------------------------------------------------------------
    // TEST 3: Successful Administrator Login & Dashboard Navigation
    // ------------------------------------------------------------------
    console.log('\n[Test 3] Testing Successful Administrator Login via Form...');
    await page.fill('#email', 'admin@vssp.local');
    await page.fill('#password', 'AdminSecurePass@2026!');
    await page.click('button[type="submit"]');

    // Wait for redirect away from /login
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 8000 });
    assert(!page.url().includes('/login'), 'Successful login authenticates and leaves /login');

    // Navigate to Dashboard root
    await page.click('nav a[href="/"]');
    await page.waitForURL(`http://localhost:${FRONTEND_PORT}/`);
    assert(page.url() === `http://localhost:${FRONTEND_PORT}/`, 'Navigates to Dashboard (/)');

    // Verify UI components rendered
    const pageHeading = await page.textContent('main h1');
    assert(pageHeading.includes('Safety Dashboard'), 'Renders "Safety Dashboard" heading');

    const topbarText = await page.textContent('header');
    assert(topbarText.includes('System Administrator'), 'Topbar renders authenticated user: "System Administrator"');
    assert(topbarText.includes('ADMINISTRATOR'), 'Topbar renders role badge: "ADMINISTRATOR"');

    // Inspect Browser Cookies
    const cookies = await context.cookies(['http://localhost:5000', 'http://localhost:5173']);
    const jwtCookie = cookies.find((c) => c.name === 'vssp_jwt');
    const csrfCookie = cookies.find((c) => c.name === 'vssp_csrf');

    assert(Boolean(jwtCookie), 'Browser has vssp_jwt session cookie stored');
    assert(jwtCookie?.httpOnly === true, 'vssp_jwt cookie has httpOnly: true (safe from XSS)');
    assert(Boolean(csrfCookie), 'Browser has vssp_csrf double-submit cookie stored');

    // ------------------------------------------------------------------
    // TEST 4: Page Refresh Session Persistence
    // ------------------------------------------------------------------
    console.log('\n[Test 4] Testing Session Persistence Across Page Refresh...');
    await page.reload();
    await page.waitForURL(`http://localhost:${FRONTEND_PORT}/`);
    const refreshedHeading = await page.textContent('main h1');
    assert(refreshedHeading.includes('Safety Dashboard'), 'User remains authenticated on Dashboard after page reload');

    const topbarAfterReload = await page.textContent('header');
    assert(topbarAfterReload.includes('System Administrator'), 'User profile and role persist across refresh');

    // ------------------------------------------------------------------
    // TEST 5: Protected Operational Pages Navigation
    // ------------------------------------------------------------------
    console.log('\n[Test 5] Testing Navigation to Protected Operational Pages...');
    
    // Cameras Page
    await page.click('nav a[href="/cameras"]');
    await page.waitForURL(`**/cameras`);
    const camerasHeading = await page.textContent('main h1');
    assert(camerasHeading.includes('Registered Cameras'), 'Navigates to Cameras page (/cameras)');
    const adminAddBtnCount = await page.locator('button:has-text("Add Camera")').count();
    assert(adminAddBtnCount === 1, 'Administrator UI renders "Add Camera" management button');

    // Alerts Page
    await page.click('nav a[href="/alerts"]');
    await page.waitForURL(`**/alerts`);
    const alertsHeading = await page.textContent('main h1');
    assert(alertsHeading.includes('Safety Violations & Alerts'), 'Navigates to Alerts page (/alerts)');

    // Evidence Page
    await page.click('nav a[href="/evidence"]');
    await page.waitForURL(`**/evidence`);
    const evidenceHeading = await page.textContent('main h1');
    assert(evidenceHeading.includes('Evidence Vault'), 'Navigates to Evidence page (/evidence)');

    // ------------------------------------------------------------------
    // TEST 6: Website Logout Action
    // ------------------------------------------------------------------
    console.log('\n[Test 6] Testing Website Logout Action...');
    await page.click('header button[aria-label="Sign out"]');
    await page.waitForURL(`**/login`, { timeout: 5000 });
    assert(page.url().includes('/login'), 'Clicking Sign Out button redirects browser back to /login');

    const cookiesAfterLogout = await context.cookies(['http://localhost:5000', 'http://localhost:5173']);
    const jwtAfterLogout = cookiesAfterLogout.find((c) => c.name === 'vssp_jwt');
    assert(!jwtAfterLogout, 'vssp_jwt session cookie is cleared after logout');

    // ------------------------------------------------------------------
    // TEST 7: Route Protection Denies Post-Logout Access
    // ------------------------------------------------------------------
    console.log('\n[Test 7] Testing Route Protection Denies Access After Logout...');
    await page.goto(`http://localhost:${FRONTEND_PORT}/cameras`);
    await page.waitForURL(`**/login`);
    await page.waitForSelector('#email');
    await page.waitForTimeout(500);
    assert(page.url().includes('/login'), 'Direct URL access to /cameras is denied and redirected to /login');

    // ------------------------------------------------------------------
    // TEST 8: Safety Operator Login & Role Display
    // ------------------------------------------------------------------
    console.log('\n[Test 8] Testing Safety Operator Login & Role Badge Display...');
    await page.fill('#email', 'operator@vssp.local');
    await page.fill('#password', 'OperatorSecurePass@2026!');
    await page.click('button[type="submit"]');

    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 8000 });
    assert(!page.url().includes('/login'), 'Safety Operator logs in successfully');

    const operatorHeader = await page.textContent('header');
    assert(operatorHeader.includes('Primary Safety Operator'), 'Topbar renders operator name: "Primary Safety Operator"');
    assert(operatorHeader.includes('SAFETY OPERATOR'), 'Topbar renders role badge: "SAFETY OPERATOR"');

    // Verify Safety Operator cannot see Admin-only UI buttons
    await page.click('nav a[href="/cameras"]');
    await page.waitForURL(`**/cameras`);
    const operatorAddBtnCount = await page.locator('button:has-text("Add Camera")').count();
    assert(operatorAddBtnCount === 0, 'Safety Operator UI strictly hides ADMIN-only "Add Camera" button');

    // Final clean logout for operator
    await page.click('header button[aria-label="Sign out"]');
    await page.waitForURL(`**/login`);
    assert(page.url().includes('/login'), 'Safety Operator logged out cleanly');

    console.log('\n========================================================');
    console.log(`  WEBSITE E2E BROWSER SUITE: ${passedTests}/${totalTests} TESTS PASSED`);
    console.log('========================================================\n');
  } catch (err) {
    console.error('[E2E Test Error]:', err);
  } finally {
    if (browser) await browser.close();
    if (viteServer) {
      await viteServer.close();
    }
    if (backendServer) {
      backendServer.close(async () => {
        await disconnectDB();
      });
    }
  }
};

runWebsiteE2ETests();
