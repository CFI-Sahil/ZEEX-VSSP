/**
 * Milestone 4: End-to-End Website & RBAC Browser Test Suite
 * Driven by Playwright + locally installed Google Chrome
 */
const { chromium } = require('playwright');
const http = require('http');
const path = require('path');

// Backend dependencies (app.js loads environment via backend/src/config/env.js)
const backendApp = require('../../backend/src/app');
const { connectDB, disconnectDB } = require('../../backend/src/config/db');
const Alert = require('../../backend/src/models/Alert');
const Evidence = require('../../backend/src/models/Evidence');
const Camera = require('../../backend/src/models/Camera');
const AuditLog = require('../../backend/src/models/AuditLog');

const BACKEND_PORT = 5000;
const FRONTEND_PORT = 5173;

const runMilestone4E2ETests = async () => {
  console.log('========================================================');
  console.log('  MILESTONE 4: ALERTS, EVIDENCE & LIFECYCLE E2E SUITE');
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

    // Create a dedicated test camera for Milestone 4 tests
    let testCam = await Camera.findOne({ cameraCode: 'CAM-M4-01' });
    if (!testCam) {
      testCam = await Camera.create({
        cameraCode: 'CAM-M4-01',
        name: 'Gantry Crane Bay 3',
        site: 'Plant 1',
        location: 'Zone B South',
        status: 'ONLINE',
        streamStatus: 'UNAVAILABLE',
      });
    }

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
    // SUITE 1: Admin Login & Baseline Dashboard Metrics
    // ------------------------------------------------------------------
    console.log('\n[Suite 1] Authenticating as Admin & Reading Baseline Dashboard...');
    await page.goto(`http://localhost:${FRONTEND_PORT}/login`);
    await page.fill('#email', 'admin@vssp.local');
    await page.fill('#password', 'AdminSecurePass@2026!');
    await page.click('button[type="submit"]');

    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 8000 });
    assert(!page.url().includes('/login'), 'Admin logged in successfully');

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
    const basePending = parseInt((await page.locator('[data-testid="stat-pending-alerts"] .text-2xl').textContent()).trim(), 10) || 0;
    const baseResolved = parseInt((await page.locator('[data-testid="stat-resolved-alerts"] .text-2xl').textContent()).trim(), 10) || 0;

    assert(Number.isInteger(baseViolations), `Baseline total violations metric: ${baseViolations}`);
    assert(Number.isInteger(basePending), `Baseline pending alerts metric: ${basePending}`);
    assert(Number.isInteger(baseResolved), `Baseline resolved alerts metric: ${baseResolved}`);

    // ------------------------------------------------------------------
    // SUITE 2: Trigger Demo Event Ingestion via UI
    // ------------------------------------------------------------------
    console.log('\n[Suite 2] Testing Demo Safety Violation Event Ingestion...');
    await page.click('nav a[href="/alerts"]');
    await page.waitForURL(`**/alerts`);
    assert(page.url().includes('/alerts'), 'Navigated to /alerts');

    // Open Demo Ingest Modal
    const simulateBtn = page.locator('[data-testid="simulate-event-btn"]');
    assert((await simulateBtn.count()) === 1, 'Simulate Violation Event trigger button is visible');
    await simulateBtn.click();

    await page.waitForSelector('form#demo-ingest-form', { timeout: 4000 });
    assert(await page.locator('text=Simulate Detection Event (Dev Tool)').isVisible(), 'Demo Ingest Modal opens');

    // Fill event details
    await page.selectOption('[data-testid="simulate-camera-select"]', 'CAM-M4-01');
    await page.selectOption('[data-testid="simulate-type-select"]', 'NO_HELMET');
    await page.selectOption('[data-testid="simulate-severity-select"]', 'HIGH');

    // Submit event
    await page.click('[data-testid="submit-simulate-event-btn"]');
    await page.waitForSelector('form#demo-ingest-form', { state: 'detached', timeout: 6000 });

    // Verify newly ingested alert is rendered in the table
    await page.waitForSelector('tr[data-testid^="alert-row-"]', { timeout: 6000 });
    const firstRow = page.locator('tr[data-testid^="alert-row-"]').first();
    const rowTestId = await firstRow.getAttribute('data-testid');
    const createdAlertCode = rowTestId.replace('alert-row-', '');

    const firstRowText = await firstRow.textContent();
    assert(firstRowText.includes('Missing Safety Helmet'), 'Ingested violation "Missing Safety Helmet" appears in table');
    assert(firstRowText.includes('CAM-M4-01'), 'Incident camera matches CAM-M4-01');
    assert(firstRowText.includes('HIGH'), 'Severity matches HIGH');
    assert(firstRowText.includes('PENDING'), 'New alert strictly has PENDING status badge');

    // ------------------------------------------------------------------
    // SUITE 3: Alert Detail & Evidence Snapshot Inspection
    // ------------------------------------------------------------------
    console.log('\n[Suite 3] Testing Alert Detail Modal and Evidence Snapshot Preview...');
    await page.click(`[data-testid="inspect-alert-${createdAlertCode}"]`);
    await page.waitForSelector(`text=Violation Alert: ${createdAlertCode}`, { timeout: 4000 });

    const modal = page.locator('[role="dialog"]');
    const modalText = await modal.textContent();
    assert(modalText.includes('Missing Safety Helmet'), 'Detail modal shows violation title');
    assert(modalText.includes('AI Confidence'), 'Detail modal displays AI confidence score');
    assert(modalText.includes('Captured Snapshot Evidence'), 'Detail modal renders snapshot section');

    // Verify snapshot image is rendered and loaded
    const evidenceImg = modal.locator('img');
    assert((await evidenceImg.count()) === 1, 'Evidence snapshot image element is rendered');
    const imgSrc = await evidenceImg.getAttribute('src');
    assert(imgSrc.includes('/evidence/'), 'Snapshot image source points to secure /evidence/:id/file route');

    // Close modal
    await modal.locator('button:has-text("Dismiss")').click();
    await page.waitForSelector('[role="dialog"]', { state: 'detached', timeout: 3000 });

    // ------------------------------------------------------------------
    // SUITE 4: Evidence Vault Page Navigation & Inspection
    // ------------------------------------------------------------------
    console.log('\n[Suite 4] Testing Evidence Vault Gallery...');
    await page.click('nav a[href="/evidence"]');
    await page.waitForURL(`**/evidence`);
    assert(page.url().includes('/evidence'), 'Navigated to /evidence');

    await page.waitForSelector('div[data-testid^="evidence-card-"]', { timeout: 6000 });
    const evCard = page.locator('div[data-testid^="evidence-card-"]').first();
    assert(await evCard.isVisible(), 'Evidence card rendered in gallery grid');

    // Click Inspect on evidence card
    await evCard.locator('button:has-text("Inspect")').click();
    await page.waitForSelector('text=Cryptographically preserved snapshot image', { timeout: 4000 });
    assert(true, 'Evidence Full Detail Modal opens with snapshot');
    await page.locator('[role="dialog"] button:has-text("Close")').click();
    await page.waitForSelector('[role="dialog"]', { state: 'detached', timeout: 3000 });

    // ------------------------------------------------------------------
    // SUITE 5: Safety Operator Login & Lifecycle (ACKNOWLEDGE & CLOSE)
    // ------------------------------------------------------------------
    console.log('\n[Suite 5] Testing Safety Operator Lifecycle Workflow...');
    // Sign out Admin
    await page.click('header button[aria-label="Sign out"]');
    await page.waitForURL(`**/login`, { timeout: 5000 });

    // Sign in as Safety Operator
    await page.fill('#email', 'operator@vssp.local');
    await page.fill('#password', 'OperatorSecurePass@2026!');
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 8000 });

    // Navigate to Alerts
    await page.click('nav a[href="/alerts"]');
    await page.waitForURL(`**/alerts`);
    await page.waitForSelector(`[data-testid="alert-row-${createdAlertCode}"]`, { timeout: 6000 });

    // Step 5a: Acknowledge Alert
    const targetRow = page.locator(`[data-testid="alert-row-${createdAlertCode}"]`);
    const ackBtn = targetRow.locator(`[data-testid="ack-alert-${createdAlertCode}"]`);
    assert((await ackBtn.count()) === 1, 'Operator can see "Acknowledge" button on PENDING alert');
    await ackBtn.click();

    // Wait for row status to update to ACKNOWLEDGED
    await page.waitForFunction(
      (code) => {
        const row = document.querySelector(`[data-testid="alert-row-${code}"]`);
        return row && row.textContent.includes('ACKNOWLEDGED');
      },
      createdAlertCode,
      { timeout: 6000 }
    );
    assert(true, 'Alert status transitioned to ACKNOWLEDGED in UI');
    assert((await targetRow.locator(`[data-testid="ack-alert-${createdAlertCode}"]`).count()) === 0, '"Acknowledge" button removed after acknowledgment');

    // Step 5b: Close Alert with mandatory remarks
    const closeBtn = targetRow.locator(`[data-testid="close-alert-${createdAlertCode}"]`);
    assert((await closeBtn.count()) === 1, 'Operator can see "Close" button on ACKNOWLEDGED alert');
    await closeBtn.click();

    await page.waitForSelector('form#close-alert-form', { timeout: 4000 });
    assert(await page.locator(`text=Close Safety Alert: ${createdAlertCode}`).isVisible(), 'Close Alert Modal opens');

    // Enter remarks
    await page.fill('[data-testid="close-remarks-input"]', 'Worker issued PPE helmet and acknowledged site safety rule.');
    await page.click('[data-testid="submit-close-alert-btn"]');
    await page.waitForSelector('form#close-alert-form', { state: 'detached', timeout: 6000 });

    // Verify row status updates to CLOSED
    await page.waitForFunction(
      (code) => {
        const row = document.querySelector(`[data-testid="alert-row-${code}"]`);
        return row && row.textContent.includes('CLOSED');
      },
      createdAlertCode,
      { timeout: 6000 }
    );
    assert(true, 'Alert status transitioned to CLOSED in UI');
    assert((await targetRow.locator(`[data-testid="close-alert-${createdAlertCode}"]`).count()) === 0, '"Close" button removed after alert is CLOSED');

    // ------------------------------------------------------------------
    // SUITE 6: Dashboard Dynamic Reflection
    // ------------------------------------------------------------------
    console.log('\n[Suite 6] Verifying Dashboard Dynamic Aggregation Reflects Alert...');
    await page.click('nav a[href="/"]');
    await page.waitForURL(`http://localhost:${FRONTEND_PORT}/`);

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

    assert(newViolations === baseViolations + 1, `Dashboard Total Violations incremented (${baseViolations} -> ${newViolations})`);
    assert(newResolved === baseResolved + 1, `Dashboard Resolved Alerts incremented (${baseResolved} -> ${newResolved})`);

    // Verify Recent Safety Alerts table on dashboard shows the closed alert
    const dashAlertRow = page.locator(`[data-testid="dashboard-recent-alert-${createdAlertCode}"]`);
    assert(await dashAlertRow.isVisible(), 'Dashboard Recent Safety Alerts table renders newly closed alert');
    assert((await dashAlertRow.textContent()).includes('CLOSED'), 'Dashboard row displays CLOSED badge');

    // Operator Clean Logout
    await page.click('header button[aria-label="Sign out"]');
    await page.waitForURL(`**/login`);
    assert(page.url().includes('/login'), 'Operator logged out cleanly');

    console.log('\n========================================================');
    console.log(`  MILESTONE 4 E2E SUITE: ${passedTests}/${totalTests} TESTS PASSED`);
    console.log('========================================================\n');
  } catch (err) {
    console.error('[E2E Test Error]:', err);
  } finally {
    // Teardown test records
    console.log('[Teardown] Cleaning up test records and stopping servers...');
    try {
      await Alert.deleteMany({ cameraCode: 'CAM-M4-01' });
      await Evidence.deleteMany({ cameraCode: 'CAM-M4-01' });
      await Camera.deleteOne({ cameraCode: 'CAM-M4-01' });
      await AuditLog.deleteMany({ details: { cameraCode: 'CAM-M4-01' } });
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

runMilestone4E2ETests();

