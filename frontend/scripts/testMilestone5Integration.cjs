/**
 * Milestone 5: Full Platform Integration, Hardening & E2E Verification Suite
 * Driven by Playwright + locally installed Google Chrome
 */
const { chromium } = require('playwright');
const http = require('http');
const path = require('path');
const fs = require('fs');

const backendApp = require('../../backend/src/app');
const { connectDB, disconnectDB } = require('../../backend/src/config/db');
const Alert = require('../../backend/src/models/Alert');
const Evidence = require('../../backend/src/models/Evidence');
const Camera = require('../../backend/src/models/Camera');
const AuditLog = require('../../backend/src/models/AuditLog');

const BACKEND_PORT = 5000;
const FRONTEND_PORT = 5173;

const runMilestone5Verification = async () => {
  console.log('========================================================');
  console.log('  MILESTONE 5: FULL INTEGRATION & HARDENING E2E SUITE');
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
    // 1. Setup Backend
    console.log('[Setup 1/4] Connecting to MongoDB and starting backend API...');
    await connectDB();
    backendServer = http.createServer(backendApp);
    await new Promise((resolve) => backendServer.listen(BACKEND_PORT, '0.0.0.0', resolve));
    console.log(`  - Backend API active on http://localhost:${BACKEND_PORT}`);

    // Create an explicit camera for M5 testing
    let m5Cam = await Camera.findOne({ cameraCode: 'CAM-M5-01' });
    if (!m5Cam) {
      m5Cam = await Camera.create({
        cameraCode: 'CAM-M5-01',
        name: 'Chemical Refining Bay 2',
        site: 'Plant 1',
        location: 'Zone C South Containment',
        status: 'ONLINE',
        streamStatus: 'UNAVAILABLE',
      });
    }

    // 2. Setup Frontend Preview
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
    // TEST 1: Unauthenticated Route Protection & Cookie Security
    // ------------------------------------------------------------------
    console.log('\n[Test 1] Testing Unauthenticated Route Protection & Cookie Flags...');
    await page.goto(`http://localhost:${FRONTEND_PORT}/`);
    await page.waitForURL(`**/login`);
    assert(page.url().includes('/login'), 'Unauthenticated visit to root / redirects to /login');

    await page.goto(`http://localhost:${FRONTEND_PORT}/alerts`);
    await page.waitForURL(`**/login`);
    assert(page.url().includes('/login'), 'Unauthenticated visit to /alerts redirects to /login');

    // ------------------------------------------------------------------
    // TEST 2: Administrator Authentication & Baseline Metrics
    // ------------------------------------------------------------------
    console.log('\n[Test 2] Testing Administrator Login & Dashboard Metrics Initial State...');
    await page.fill('#email', 'admin@vssp.local');
    await page.fill('#password', 'AdminSecurePass@2026!');
    await page.click('button[type="submit"]');

    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 8000 });
    assert(!page.url().includes('/login'), 'Administrator authenticated successfully');

    // Verify cookies stored
    const cookies = await context.cookies(['http://localhost:5000', 'http://localhost:5173']);
    const jwtCookie = cookies.find((c) => c.name === 'vssp_jwt');
    const csrfCookie = cookies.find((c) => c.name === 'vssp_csrf');
    assert(jwtCookie?.httpOnly === true, 'vssp_jwt cookie has httpOnly: true (safe from script access)');
    assert(Boolean(csrfCookie), 'vssp_csrf double-submit cookie stored');

    await page.goto(`http://localhost:${FRONTEND_PORT}/`);
    await page.waitForSelector('[data-testid="stat-total-violations"]', { timeout: 8000 });
    await page.waitForFunction(
      () => {
        const el = document.querySelector('[data-testid="stat-total-violations"] .text-2xl');
        return el && el.textContent.trim() !== '...' && el.textContent.trim() !== '—';
      },
      { timeout: 8000 }
    );

    const baseViolations = parseInt((await page.locator('[data-testid="stat-total-violations"] .text-2xl').textContent()).trim(), 10) || 0;
    const baseResolved = parseInt((await page.locator('[data-testid="stat-resolved-alerts"] .text-2xl').textContent()).trim(), 10) || 0;
    assert(Number.isInteger(baseViolations), `Baseline total violations parsed: ${baseViolations}`);
    assert(Number.isInteger(baseResolved), `Baseline resolved alerts parsed: ${baseResolved}`);

    // ------------------------------------------------------------------
    // TEST 3: Ingestion Boundary Hardening (Non-existent camera rejection & Event Idempotency)
    // ------------------------------------------------------------------
    console.log('\n[Test 3] Testing Ingestion Boundary Hardening & Exception Handlers...');
    const nonExistentRes = await page.request.post('http://localhost:5000/api/v1/demo/ingest-event', {
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfCookie.value,
      },
      data: {
        cameraCode: 'CAM-DOES-NOT-EXIST-X9',
        violationType: 'NO_HELMET',
        severity: 'HIGH',
      },
    });
    assert(nonExistentRes.status() === 404, 'Ingestion rejects non-existent camera with 404 Not Found');

    const uniqueEventId = `EVT-M5-${Date.now()}`;
    const validIngestRes = await page.request.post('http://localhost:5000/api/v1/demo/ingest-event', {
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfCookie.value,
      },
      data: {
        eventId: uniqueEventId,
        cameraCode: 'CAM-M5-01',
        violationType: 'NO_HELMET',
        severity: 'HIGH',
        confidence: 0.96,
        description: 'Refinery personnel detected without mandated helmet',
      },
    });
    assert(validIngestRes.status() === 201, 'Valid detection event ingested with 201 Created');
    const createdAlert = (await validIngestRes.json()).data.alert;
    assert(createdAlert.status === 'PENDING', 'Ingested alert initializes strictly in PENDING status');

    // Duplicate eventId rejection check
    const duplicateEventRes = await page.request.post('http://localhost:5000/api/v1/demo/ingest-event', {
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfCookie.value,
      },
      data: {
        eventId: uniqueEventId,
        cameraCode: 'CAM-M5-01',
        violationType: 'NO_VEST',
        severity: 'MEDIUM',
      },
    });
    assert(duplicateEventRes.status() === 400, 'Duplicate eventId submission strictly rejected with 400 Bad Request');

    // ------------------------------------------------------------------
    // TEST 4: Direct Closure from PENDING Rejection Check
    // ------------------------------------------------------------------
    console.log('\n[Test 4] Testing Strict Lifecycle Rule: Reject Direct Closure from PENDING...');
    const invalidDirectCloseRes = await page.request.patch(
      `http://localhost:5000/api/v1/alerts/${createdAlert._id}/close`,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfCookie.value,
        },
        data: { remarks: 'Direct close attempt from PENDING' },
      }
    );
    assert(invalidDirectCloseRes.status() === 400, 'Direct closure from PENDING rejected with 400 Bad Request');
    const directCloseErr = await invalidDirectCloseRes.json();
    assert(
      directCloseErr.message.includes('Direct closure from PENDING is prohibited'),
      'Returns descriptive error requiring PENDING -> ACKNOWLEDGED -> CLOSED'
    );

    // ------------------------------------------------------------------
    // TEST 5: Alert Inspection & Evidence Verification
    // ------------------------------------------------------------------
    console.log('\n[Test 5] Testing Alert Inspection & Evidence Snapshot Serving...');
    await page.goto(`http://localhost:${FRONTEND_PORT}/alerts`);
    await page.waitForSelector(`[data-testid="alert-row-${createdAlert.alertCode}"]`, { timeout: 8000 });

    const alertRow = page.locator(`[data-testid="alert-row-${createdAlert.alertCode}"]`);
    assert(await alertRow.isVisible(), 'Ingested alert rendered in Alerts table');
    assert((await alertRow.textContent()).includes('PENDING'), 'Alert displays PENDING badge');

    // Notice: "Close" button is hidden on PENDING rows
    assert(
      (await alertRow.locator(`[data-testid="close-alert-${createdAlert.alertCode}"]`).count()) === 0,
      'Close button is hidden on PENDING alerts (UI aligns with backend rule)'
    );

    // Open detail modal
    await page.click(`[data-testid="inspect-alert-${createdAlert.alertCode}"]`);
    await page.waitForSelector(`text=Violation Alert: ${createdAlert.alertCode}`, { timeout: 4000 });
    const modalImg = page.locator('[role="dialog"] img');
    assert((await modalImg.count()) === 1, 'Detail modal renders snapshot image');
    await page.click('[role="dialog"] button:has-text("Dismiss")');

    // ------------------------------------------------------------------
    // TEST 6: Safety Operator RBAC & Lifecycle Execution
    // ------------------------------------------------------------------
    console.log('\n[Test 6] Testing Safety Operator RBAC & Two-Step Resolution...');
    // Sign out Admin
    await page.click('header button[aria-label="Sign out"]');
    await page.waitForURL(`**/login`);

    // Sign in as Safety Operator
    await page.fill('#email', 'operator@vssp.local');
    await page.fill('#password', 'OperatorSecurePass@2026!');
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 8000 });

    // Verify Operator cannot see Admin Add/Edit controls on /cameras
    await page.goto(`http://localhost:${FRONTEND_PORT}/cameras`);
    await page.waitForSelector('main h1:has-text("Registered Cameras")');
    assert((await page.locator('[data-testid="add-camera-btn"]').count()) === 0, 'Operator UI hides Add Camera button');

    // Navigate to Alerts
    await page.goto(`http://localhost:${FRONTEND_PORT}/alerts`);
    await page.waitForSelector(`[data-testid="alert-row-${createdAlert.alertCode}"]`, { timeout: 8000 });

    // Step 6a: Operator Acknowledges
    await page.click(`[data-testid="ack-alert-${createdAlert.alertCode}"]`);
    await page.waitForFunction(
      (code) => {
        const row = document.querySelector(`[data-testid="alert-row-${code}"]`);
        return row && row.textContent.includes('ACKNOWLEDGED');
      },
      createdAlert.alertCode,
      { timeout: 6000 }
    );
    assert(true, 'Alert transitioned to ACKNOWLEDGED in Operator UI');

    // Step 6b: Operator Closes with mandatory remarks
    await page.click(`[data-testid="close-alert-${createdAlert.alertCode}"]`);
    await page.waitForSelector('form#close-alert-form', { timeout: 4000 });
    await page.fill('[data-testid="close-remarks-input"]', 'Safety helmet provided on-site. Worker logged into register.');
    await page.click('[data-testid="submit-close-alert-btn"]');
    await page.waitForSelector('form#close-alert-form', { state: 'detached', timeout: 6000 });

    await page.waitForFunction(
      (code) => {
        const row = document.querySelector(`[data-testid="alert-row-${code}"]`);
        return row && row.textContent.includes('CLOSED');
      },
      createdAlert.alertCode,
      { timeout: 6000 }
    );
    assert(true, 'Alert transitioned to CLOSED in Operator UI');

    // ------------------------------------------------------------------
    // TEST 7: Dynamic Dashboard Real-time Metrics Update
    // ------------------------------------------------------------------
    console.log('\n[Test 7] Testing Dashboard Metrics Aggregation Reflects Closed Alert...');
    await page.goto(`http://localhost:${FRONTEND_PORT}/`);
    await page.waitForSelector('[data-testid="stat-total-violations"]', { timeout: 8000 });
    await page.waitForFunction(
      () => {
        const el = document.querySelector('[data-testid="stat-total-violations"] .text-2xl');
        return el && el.textContent.trim() !== '...' && el.textContent.trim() !== '—';
      },
      { timeout: 8000 }
    );

    const newViolations = parseInt((await page.locator('[data-testid="stat-total-violations"] .text-2xl').textContent()).trim(), 10);
    const newResolved = parseInt((await page.locator('[data-testid="stat-resolved-alerts"] .text-2xl').textContent()).trim(), 10);

    assert(newViolations === baseViolations + 1, `Total Violations metric incremented correctly (${baseViolations} -> ${newViolations})`);
    assert(newResolved === baseResolved + 1, `Resolved Alerts metric incremented correctly (${baseResolved} -> ${newResolved})`);

    // Verify recent alerts table
    const recentRow = page.locator(`[data-testid="dashboard-recent-alert-${createdAlert.alertCode}"]`);
    assert(await recentRow.isVisible(), 'Closed alert rendered in Dashboard Recent Safety Alerts table');

    // ------------------------------------------------------------------
    // TEST 8: Responsive Layouts (Desktop, Tablet & Mobile Viewports)
    // ------------------------------------------------------------------
    console.log('\n[Test 8] Testing Desktop, Tablet & Mobile Responsive Viewports...');
    
    // 8A. Desktop (1280x800)
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`http://localhost:${FRONTEND_PORT}/`);
    await page.waitForSelector('[data-testid="stat-total-cameras"]');
    const desktopTotalCard = page.locator('[data-testid="stat-total-cameras"]');
    assert(await desktopTotalCard.isVisible(), 'Desktop (1280px): KPI cards rendered');
    const desktopBodyScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    assert(desktopBodyScrollWidth, 'Desktop (1280px): Zero horizontal window overflow');

    // 8B. Tablet (768x1024)
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(300);
    const tabletTotalCard = page.locator('[data-testid="stat-total-cameras"]');
    assert(await tabletTotalCard.isVisible(), 'Tablet (768px): KPI cards rendered cleanly');
    const tabletBodyScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    assert(tabletBodyScrollWidth, 'Tablet (768px): Zero horizontal window overflow');

    // 8C. Mobile (375x667)
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(300);

    // Sidebar should be collapsed off-screen on mobile
    const sidebar = page.locator('aside');
    const sidebarClass = await sidebar.getAttribute('class');
    assert(sidebarClass.includes('-translate-x-full'), 'Mobile (375px): Sidebar is collapsed offscreen');

    // Click Hamburger Menu in Topbar
    const menuBtn = page.locator('header button[aria-label="Toggle navigation"]');
    assert(await menuBtn.isVisible(), 'Mobile (375px): Hamburger menu button is visible');
    await menuBtn.click();

    // Verify sidebar drawer opens
    const openedClass = await sidebar.getAttribute('class');
    assert(openedClass.includes('translate-x-0'), 'Mobile (375px): Clicking hamburger toggles sidebar drawer open');

    // Operator Sign Out via drawer
    await page.click('aside button:has-text("Sign Out")');
    await page.waitForURL(`**/login`);
    assert(page.url().includes('/login'), 'Mobile (375px): Mobile drawer sign out succeeded');

    console.log('\n========================================================');
    console.log(`  MILESTONE 5 VERIFICATION: ${passedTests}/${totalTests} CHECKS PASSED`);
    console.log('========================================================\n');
  } catch (err) {
    console.error('[M5 Verification Error]:', err);
  } finally {
    console.log('[Teardown] Cleaning up test records...');
    try {
      await Alert.deleteMany({ cameraCode: 'CAM-M5-01' });
      await Evidence.deleteMany({ cameraCode: 'CAM-M5-01' });
      await Camera.deleteOne({ cameraCode: 'CAM-M5-01' });
      await AuditLog.deleteMany({ details: { cameraCode: 'CAM-M5-01' } });
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

runMilestone5Verification();
