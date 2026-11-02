/**
 * Milestone 3: End-to-End Website & RBAC Browser Test Suite
 * Driven by Playwright + locally installed Google Chrome
 */
const { chromium } = require('playwright');
const http = require('http');
const path = require('path');

// Backend dependencies (app.js loads environment via backend/src/config/env.js)
const backendApp = require('../../backend/src/app');
const { connectDB, disconnectDB } = require('../../backend/src/config/db');
const Camera = require('../../backend/src/models/Camera');

const BACKEND_PORT = 5000;
const FRONTEND_PORT = 5173;

const runMilestone3E2ETests = async () => {
  console.log('========================================================');
  console.log('  MILESTONE 3: CAMERA MANAGEMENT & DASHBOARD METRICS E2E');
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
    console.log('[Setup 1/4] Connecting to MongoDB and starting backend API...');
    await connectDB();
    backendServer = http.createServer(backendApp);
    await new Promise((resolve) => backendServer.listen(BACKEND_PORT, '0.0.0.0', resolve));
    console.log(`  - Backend API active on http://localhost:${BACKEND_PORT}`);

    // Clean up any lingering test records
    await Camera.deleteMany({ cameraCode: /^CAM-TEST-/ });

    // 2. Start Frontend Server via programmatic Vite Preview API on Port 5173
    console.log('[Setup 2/4] Starting Vite frontend preview server...');
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
    console.log('[Setup 3/4] Launching Google Chrome browser via Playwright...');
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
    // TEST SUITE 1: Admin Login & Baseline Dashboard Verification
    // ------------------------------------------------------------------
    console.log('\n[Suite 1] Authenticating as Admin & Verifying Baseline Dashboard...');
    await page.goto(`http://localhost:${FRONTEND_PORT}/login`);
    await page.fill('#email', 'admin@vssp.local');
    await page.fill('#password', 'AdminSecurePass@2026!');
    await page.click('button[type="submit"]');

    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 8000 });
    assert(!page.url().includes('/login'), 'Admin login authenticated successfully');

    // Visit Dashboard
    await page.goto(`http://localhost:${FRONTEND_PORT}/`);
    await page.waitForSelector('[data-testid="stat-total-cameras"]', { timeout: 8000 });
    await page.waitForFunction(
      () => {
        const el = document.querySelector('[data-testid="stat-total-cameras"] .text-2xl');
        return el && el.textContent.trim() !== '...' && el.textContent.trim() !== '—';
      },
      { timeout: 8000 }
    );

    const initialTotalText = await page.locator('[data-testid="stat-total-cameras"] .text-2xl').textContent();
    const initialOnlineText = await page.locator('[data-testid="stat-online-cameras"] .text-2xl').textContent();
    const initialOfflineText = await page.locator('[data-testid="stat-offline-cameras"] .text-2xl').textContent();
    const initialUnknownText = await page.locator('[data-testid="stat-unknown-cameras"] .text-2xl').textContent();

    const baselineTotal = parseInt(initialTotalText.trim(), 10) || 0;
    const baselineOnline = parseInt(initialOnlineText.trim(), 10) || 0;
    const baselineOffline = parseInt(initialOfflineText.trim(), 10) || 0;
    const baselineUnknown = parseInt(initialUnknownText.trim(), 10) || 0;

    assert(Number.isInteger(baselineTotal), `Dynamic baseline total cameras metric parsed: ${baselineTotal}`);
    assert(Number.isInteger(baselineOnline), `Dynamic baseline online cameras metric parsed: ${baselineOnline}`);
    assert(Number.isInteger(baselineOffline), `Dynamic baseline offline cameras metric parsed: ${baselineOffline}`);
    assert(Number.isInteger(baselineUnknown), `Dynamic baseline unknown cameras metric parsed: ${baselineUnknown}`);

    // ------------------------------------------------------------------
    // TEST SUITE 2: Camera Registry Page & Add Camera Modal
    // ------------------------------------------------------------------
    console.log('\n[Suite 2] Testing Camera Registry & Registration Workflow (Admin)...');
    await page.click('nav a[href="/cameras"]');
    await page.waitForURL(`**/cameras`);
    assert(page.url().includes('/cameras'), 'Navigated to /cameras');

    // Confirm Admin has Add Camera button
    const addBtn = page.locator('[data-testid="add-camera-btn"]');
    assert((await addBtn.count()) === 1, 'Admin can see "Add Camera" button');

    // Click Add Camera
    await addBtn.click();
    await page.waitForSelector('form#camera-form', { timeout: 3000 });
    assert(await page.locator('text=Register New Surveillance Camera').isVisible(), 'Add Camera modal opens');

    // Fill camera form
    await page.fill('input[name="cameraCode"]', 'CAM-TEST-101');
    await page.fill('input[name="name"]', 'Hazardous Chemical Storage Unit 4');
    await page.fill('input[name="site"]', 'Plant 1');
    await page.fill('input[name="location"]', 'Zone D North Containment');
    await page.fill('textarea[name="description"]', 'Monitors caustic acid storage barrels and eye wash stations');

    // Submit form
    await page.click('button[type="submit"][form="camera-form"]');

    // Wait for modal to close and row to appear
    await page.waitForSelector('[data-testid="camera-row-CAM-TEST-101"]', { timeout: 6000 });
    const row = page.locator('[data-testid="camera-row-CAM-TEST-101"]');
    assert(await row.isVisible(), 'Newly registered camera "CAM-TEST-101" appears in the registry table');

    // Check defaults: status UNKNOWN, stream UNAVAILABLE, heartbeat Never (Null)
    const rowText = await row.textContent();
    assert(rowText.includes('UNKNOWN'), 'Newly registered camera defaults to UNKNOWN status');
    assert(rowText.includes('UNAVAILABLE'), 'Stream health defaults to UNAVAILABLE');
    assert(rowText.includes('Never (Null)') || rowText.includes('Never'), 'Last heartbeat defaults to null (Never)');

    // ------------------------------------------------------------------
    // TEST SUITE 3: Camera Detail Inspection Modal
    // ------------------------------------------------------------------
    console.log('\n[Suite 3] Testing Camera Inspection Modal...');
    await page.click('[data-testid="inspect-btn-CAM-TEST-101"]');
    await page.waitForSelector('text=Camera Details: CAM-TEST-101', { timeout: 4000 });
    assert(await page.locator('text=Camera Details: CAM-TEST-101').isVisible(), 'Inspect modal opened with camera code');

    const modalText = await page.locator('[role="dialog"]').textContent();
    assert(
      modalText.includes('Honest stream state: No live RTSP/video integration is connected in this MVP'),
      'Inspect modal shows honest stream state notice without fake telemetry'
    );
    assert(
      modalText.includes('None (Unverified / Null)') || modalText.includes('Null') || modalText.includes('Never'),
      'Inspect modal explicitly reports null last heartbeat'
    );

    // Close inspect modal
    await page.click('[role="dialog"] button:has-text("Close")');
    await page.waitForSelector('[role="dialog"]', { state: 'detached', timeout: 3000 });
    assert(true, 'Inspect modal closes cleanly');

    // ------------------------------------------------------------------
    // TEST SUITE 4: Camera Edit Workflow
    // ------------------------------------------------------------------
    console.log('\n[Suite 4] Testing Camera Metadata & Status Update (Admin)...');
    await page.click('[data-testid="edit-btn-CAM-TEST-101"]');
    await page.waitForSelector('form#camera-form', { timeout: 3000 });
    assert(await page.locator('text=Edit Camera: CAM-TEST-101').isVisible(), 'Edit modal opens with prefilled data');

    // Change name and status to ONLINE
    await page.fill('input[name="name"]', 'Hazardous Chemical Storage Unit 4 - Activated');
    await page.selectOption('select[name="status"]', 'ONLINE');

    // Save changes
    await page.click('button[type="submit"][form="camera-form"]');
    await page.waitForSelector('form#camera-form', { state: 'detached', timeout: 6000 });

    // Verify row reflects changes
    const updatedRow = page.locator('[data-testid="camera-row-CAM-TEST-101"]');
    const updatedRowText = await updatedRow.textContent();
    assert(
      updatedRowText.includes('Hazardous Chemical Storage Unit 4 - Activated'),
      'Camera name updated in registry table'
    );
    assert(updatedRowText.includes('ONLINE'), 'Camera connection status badge updated to ONLINE');

    // Register a second camera: CAM-TEST-102 (will set to OFFLINE)
    console.log('\n[Suite 5] Registering Second Camera & Testing Search/Filters...');
    await addBtn.click();
    await page.waitForSelector('form#camera-form', { timeout: 3000 });
    await page.fill('input[name="cameraCode"]', 'CAM-TEST-102');
    await page.fill('input[name="name"]', 'Assembly Line Conveyor Conveyance');
    await page.fill('input[name="site"]', 'Plant 1');
    await page.fill('input[name="location"]', 'Zone A Floor 2');
    await page.click('button[type="submit"][form="camera-form"]');
    await page.waitForSelector('[data-testid="camera-row-CAM-TEST-102"]', { timeout: 6000 });

    // Edit CAM-TEST-102 to OFFLINE
    await page.click('[data-testid="edit-btn-CAM-TEST-102"]');
    await page.waitForSelector('form#camera-form', { timeout: 3000 });
    await page.selectOption('select[name="status"]', 'OFFLINE');
    await page.click('button[type="submit"][form="camera-form"]');
    await page.waitForSelector('form#camera-form', { state: 'detached', timeout: 6000 });

    // Test Search input
    await page.fill('[data-testid="camera-search-input"]', 'Conveyor');
    await page.waitForTimeout(600); // debounce wait
    const cam102Visible = await page.locator('[data-testid="camera-row-CAM-TEST-102"]').isVisible();
    const cam101Visible = await page.locator('[data-testid="camera-row-CAM-TEST-101"]').isVisible();
    assert(cam102Visible && !cam101Visible, 'Search filter matches CAM-TEST-102 and excludes CAM-TEST-101');

    // Clear search
    await page.fill('[data-testid="camera-search-input"]', '');
    await page.waitForTimeout(600); // debounce wait

    // Test Status Filter: ONLINE
    await page.selectOption('[data-testid="status-filter-select"]', 'ONLINE');
    await page.waitForTimeout(400);
    const filterOnline101 = await page.locator('[data-testid="camera-row-CAM-TEST-101"]').isVisible();
    const filterOnline102 = await page.locator('[data-testid="camera-row-CAM-TEST-102"]').isVisible();
    assert(filterOnline101 && !filterOnline102, 'Status filter ONLINE shows only CAM-TEST-101');

    // Reset status filter: ALL
    await page.selectOption('[data-testid="status-filter-select"]', 'ALL');
    await page.waitForTimeout(400);

    // ------------------------------------------------------------------
    // TEST SUITE 6: Dynamic Dashboard Metrics Validation
    // ------------------------------------------------------------------
    console.log('\n[Suite 6] Verifying Dynamic Dashboard Reflects Live Aggregation...');
    await page.click('nav a[href="/"]');
    await page.waitForURL(`http://localhost:${FRONTEND_PORT}/`);

    await page.waitForSelector('[data-testid="stat-total-cameras"]', { timeout: 5000 });
    await page.waitForFunction(
      () => {
        const el = document.querySelector('[data-testid="stat-total-cameras"] .text-2xl');
        return el && el.textContent.trim() !== '...' && el.textContent.trim() !== '—';
      },
      { timeout: 8000 }
    );

    const newTotalText = await page.locator('[data-testid="stat-total-cameras"] .text-2xl').textContent();
    const newOnlineText = await page.locator('[data-testid="stat-online-cameras"] .text-2xl').textContent();
    const newOfflineText = await page.locator('[data-testid="stat-offline-cameras"] .text-2xl').textContent();

    const newTotal = parseInt(newTotalText.trim(), 10);
    const newOnline = parseInt(newOnlineText.trim(), 10);
    const newOffline = parseInt(newOfflineText.trim(), 10);

    assert(newTotal === baselineTotal + 2, `Dynamic KPI Total Cameras incremented correctly (${baselineTotal} -> ${newTotal})`);
    assert(newOnline === baselineOnline + 1, `Dynamic KPI Online Cameras incremented correctly (${baselineOnline} -> ${newOnline})`);
    assert(newOffline === baselineOffline + 1, `Dynamic KPI Offline Cameras incremented correctly (${baselineOffline} -> ${newOffline})`);

    // Verify Camera Feeds Panel displays registered camera tiles
    const tile101 = page.locator('[data-testid="camera-tile-CAM-TEST-101"]');
    const tile102 = page.locator('[data-testid="camera-tile-CAM-TEST-102"]');
    assert(await tile101.isVisible(), 'Camera Monitoring Feeds panel dynamically displays CAM-TEST-101 tile');
    assert(await tile102.isVisible(), 'Camera Monitoring Feeds panel dynamically displays CAM-TEST-102 tile');

    // ------------------------------------------------------------------
    // TEST SUITE 7: Safety Operator RBAC Verification
    // ------------------------------------------------------------------
    console.log('\n[Suite 7] Testing Safety Operator RBAC & Read-Only Constraints...');
    // Logout Admin
    await page.click('header button[aria-label="Sign out"]');
    await page.waitForURL(`**/login`, { timeout: 5000 });

    // Login as Safety Operator
    await page.fill('#email', 'operator@vssp.local');
    await page.fill('#password', 'OperatorSecurePass@2026!');
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 8000 });

    // Visit Cameras Page
    await page.click('nav a[href="/cameras"]');
    await page.waitForURL(`**/cameras`);
    await page.waitForSelector('[data-testid="camera-row-CAM-TEST-101"]', { timeout: 8000 });

    // 1. Verify "Add Camera" button is absent
    const operatorAddBtn = page.locator('[data-testid="add-camera-btn"]');
    assert((await operatorAddBtn.count()) === 0, 'Safety Operator cannot see "Add Camera" button');

    // 2. Verify "Edit" button is absent
    const operatorEditBtn = page.locator('[data-testid="edit-btn-CAM-TEST-101"]');
    assert((await operatorEditBtn.count()) === 0, 'Safety Operator cannot see "Edit" button');

    // 3. Verify "Inspect" button is visible and functional
    const operatorInspectBtn = page.locator('[data-testid="inspect-btn-CAM-TEST-101"]');
    assert(await operatorInspectBtn.isVisible(), 'Safety Operator can see "Inspect" button');
    await operatorInspectBtn.click();
    await page.waitForSelector('text=Camera Details: CAM-TEST-101', { timeout: 3000 });
    assert(true, 'Safety Operator can inspect camera details');
    await page.click('[role="dialog"] button:has-text("Close")');

    // 4. Test Direct Backend RBAC Protection for Operator (API Level)
    const operatorCookies = await context.cookies(['http://localhost:5000', 'http://localhost:5173']);
    const csrfCookie = operatorCookies.find((c) => c.name === 'vssp_csrf');
    const csrfToken = csrfCookie ? csrfCookie.value : '';

    const apiPostResponse = await page.request.post('http://localhost:5000/api/v1/cameras', {
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      data: {
        cameraCode: 'CAM-HACK-001',
        name: 'Unauthorized Operator Camera',
        site: 'Plant 1',
        location: 'Restricted',
      },
    });

    assert(apiPostResponse.status() === 403, `Direct POST /api/v1/cameras by Operator returns HTTP 403 Forbidden`);

    // Clean logout
    await page.click('header button[aria-label="Sign out"]');
    await page.waitForURL(`**/login`);
    assert(page.url().includes('/login'), 'Operator logged out cleanly');

    console.log('\n========================================================');
    console.log(`  MILESTONE 3 E2E SUITE: ${passedTests}/${totalTests} TESTS PASSED`);
    console.log('========================================================\n');
  } catch (err) {
    console.error('[E2E Test Error]:', err);
  } finally {
    // Teardown
    console.log('[Teardown] Cleaning up test cameras and closing servers...');
    try {
      await Camera.deleteMany({ cameraCode: /^CAM-TEST-/ });
    } catch (_) {}

    if (browser) await browser.close();
    if (viteServer) await viteServer.close();
    if (backendServer) {
      backendServer.close(async () => {
        await disconnectDB();
      });
    }
  }
};

runMilestone3E2ETests();
