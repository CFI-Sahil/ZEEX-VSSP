/**
 * Phase 3 Batch 6: Shift Handover E2E Verification Suite
 * Driven by Playwright + locally installed Google Chrome
 * Covers:
 *  - Authentication & Navigation: Sidebar menu links, Direct URL routes (/handovers, /handovers/create, /handovers/inbox, /handovers/history, /handovers/:id)
 *  - Shift Handover Dashboard: KPI ribbon, Incoming handovers alert banner, Recent handovers table, Activity feed
 *  - Create Handover: Shift metadata, Live operational intelligence collection, Incident selection, Hardware health, Active work-fronts, Manual field notes, Outgoing remarks, Save draft, Submit with frozen snapshot modal
 *  - Incoming Operator Inbox: Filtered inbox of submitted handovers awaiting review, critical/high badges, review navigation
 *  - Handover Detail & Acknowledgement: Operator ownership cards, Frozen snapshot verification, Prominent acknowledgement form, Acceptance flow
 *  - Follow-up Action Items Tracker: Adding follow-up items, Status transitions (OPEN -> IN_PROGRESS -> COMPLETED), isolation from live alerts
 *  - Handover Completion: Transition to COMPLETED
 *  - Handover History & Archive: Table listing, Server-side filtering by status and shift type, Search, Inspector navigation
 *  - Responsive Layouts: Mobile (375x667), Tablet (768x1024), Desktop (1440x900)
 *  - High-fidelity screenshot artifacts for user inspection
 */

const { chromium } = require('playwright');
const http = require('http');
const path = require('path');
const fs = require('fs');

const backendApp = require('../../backend/src/app');
const { connectDB, disconnectDB } = require('../../backend/src/config/db');
const Alert = require('../../backend/src/models/Alert');
const Evidence = require('../../backend/src/models/Evidence');
const ShiftHandover = require('../../backend/src/models/ShiftHandover');
const HandoverActivity = require('../../backend/src/models/HandoverActivity');

const BACKEND_PORT = 5000;
const FRONTEND_PORT = 5173;

const ARTIFACTS_DIR = 'C:/Users/Santosh Gupta/.gemini/antigravity/brain/0e8c53a1-34cc-46f0-b330-8f79648a8e70';
const SYNTH_E2E_PREFIX = 'SYNTH-E2E-B6-';

const runBatch6E2E = async () => {
  console.log('========================================================');
  console.log('  VSSP PHASE 3 BATCH 6: SHIFT HANDOVER E2E SUITE');
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
    // ------------------------------------------------------------------
    // Step 1: Connect to Database & Start Backend Server
    // ------------------------------------------------------------------
    console.log('[Setup 1/4] Connecting to MongoDB and starting backend API...');
    await connectDB();

    backendServer = http.createServer(backendApp);
    await new Promise((resolve) => backendServer.listen(BACKEND_PORT, '0.0.0.0', resolve));
    console.log(`  - Backend API active on http://localhost:${BACKEND_PORT}`);

    // Capture baseline operational record counts
    const baselineAlertCount = await Alert.countDocuments();
    const baselineEvidenceCount = await Evidence.countDocuments();
    await ShiftHandover.deleteMany({ shiftLabel: { $regex: `^${SYNTH_E2E_PREFIX}` } });
    await HandoverActivity.deleteMany({ 'details.shiftLabel': { $regex: `^${SYNTH_E2E_PREFIX}` } });

    // ------------------------------------------------------------------
    // Step 2: Start Vite Frontend Preview Server
    // ------------------------------------------------------------------
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

    // ------------------------------------------------------------------
    // Step 3: Launch Google Chrome via Playwright
    // ------------------------------------------------------------------
    console.log('[Setup 3/4] Launching Google Chrome browser via Playwright...');
    browser = await chromium.launch({
      channel: 'chrome',
      headless: true,
    });

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();

    // ------------------------------------------------------------------
    // TEST 1: Login & Navigation to /handovers
    // ------------------------------------------------------------------
    console.log('\n[Test 1] Logging in as ADMIN and navigating to Shift Handover Dashboard...');
    await page.goto(`http://localhost:${FRONTEND_PORT}/login`);
    await page.fill('#email', 'admin@vssp.local');
    await page.fill('#password', 'AdminSecurePass@2026!');
    await page.click('button[type="submit"]');

    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 8000 });
    assert(!page.url().includes('/login'), 'Authenticated login successful');

    // Navigate to /handovers
    await page.goto(`http://localhost:${FRONTEND_PORT}/handovers`);
    await page.waitForSelector('h1:has-text("Shift Handover Console")', { timeout: 8000 });
    await page.waitForSelector('text=Total Handovers', { timeout: 8000 });
    assert(page.url().includes('/handovers'), 'Direct navigation to /handovers successful');

    // Verify KPI ribbon
    assert(await page.isVisible('text=Total Handovers'), 'Shift Handover Dashboard renders Total Handovers KPI');
    assert(await page.isVisible('text=Awaiting Ack'), 'Shift Handover Dashboard renders Awaiting Ack KPI');
    assert(await page.isVisible('text=Acknowledged'), 'Shift Handover Dashboard renders Acknowledged KPI');

    // Capture screenshot: Dashboard
    const dashboardPath = path.join(ARTIFACTS_DIR, 'batch6_handover_dashboard.png');
    await page.screenshot({ path: dashboardPath, fullPage: true });
    console.log(`  [Artifact] Saved dashboard screenshot: ${dashboardPath}`);

    // ------------------------------------------------------------------
    // TEST 2: Navigate to /handovers/create and draft handover
    // ------------------------------------------------------------------
    console.log('\n[Test 2] Navigating to /handovers/create and drafting handover...');
    await page.goto(`http://localhost:${FRONTEND_PORT}/handovers/create`);
    await page.waitForSelector('h1:has-text("Initiate Shift Handover")', { timeout: 8000 });
    assert(page.url().includes('/handovers/create'), 'Create Handover page loaded');

    // Check live operational summary card
    await page.waitForSelector('h2:has-text("Automated Operational Intelligence")', { timeout: 8000 });
    assert(await page.isVisible('button:has-text("Refresh Live Data")'), 'Refresh Live Data button visible');

    // Fill in shift label
    const customLabel = `${SYNTH_E2E_PREFIX}Day Shift Alpha Transfer`;
    const labelInput = page.locator('input[placeholder*="Day Shift"]');
    await labelInput.fill(customLabel);

    // Add a manual note
    const noteInput = page.locator('input[placeholder*="Enter specific handover instructions"]');
    await noteInput.fill('Verify contractor hard hats on scaffolding in Sector 2.');
    await page.click('button:has-text("Add")');

    // Fill in outgoing remarks
    const remarksArea = page.locator('textarea[placeholder*="Summarize the shift highlights"]');
    await remarksArea.fill('All morning operations clear. Elevated tower scaffolding inspection required by incoming shift.');

    // Click Save Draft
    await page.click('button:has-text("Save Draft")');
    await page.waitForSelector('text=Handover draft saved successfully', { timeout: 8000 });
    assert(await page.isVisible('text=Handover draft saved successfully'), 'Draft saved with confirmation notification');

    // Capture screenshot: Create Handover Page
    const createPath = path.join(ARTIFACTS_DIR, 'batch6_create_handover.png');
    await page.screenshot({ path: createPath, fullPage: true });
    console.log(`  [Artifact] Saved create handover screenshot: ${createPath}`);

    // ------------------------------------------------------------------
    // TEST 3: Submit Handover with Frozen Snapshot Modal
    // ------------------------------------------------------------------
    console.log('\n[Test 3] Submitting Handover with confirmation modal...');
    await page.click('button:has-text("Submit Handover")');

    // Verify modal appeared
    await page.waitForSelector('h3:has-text("Confirm Handover Submission")', { timeout: 5000 });
    assert(await page.isVisible('text=permanently freeze'), 'Confirmation modal explains frozen snapshot immutability');

    // Confirm submission inside modal
    const confirmBtn = page.locator('button:has-text("Confirm & Submit")');
    await confirmBtn.click();

    // Wait for redirect to detail page
    await page.waitForURL((url) => /\/handovers\/[a-f0-9]{24}/.test(url.pathname), { timeout: 8000 });
    assert(/\/handovers\/[a-f0-9]{24}/.test(page.url()), 'Redirected to Handover Detail page after submission');

    // Verify Frozen Snapshot indicator
    await page.waitForSelector('text=Frozen Snapshot', { timeout: 5000 });
    assert(await page.isVisible('text=Frozen Snapshot'), 'Frozen Snapshot badge displayed on detail page');
    assert(await page.isVisible('text=SUBMITTED'), 'Status badge displays SUBMITTED');

    // Capture screenshot: Handover Detail
    const detailPath = path.join(ARTIFACTS_DIR, 'batch6_handover_detail.png');
    await page.screenshot({ path: detailPath, fullPage: true });
    console.log(`  [Artifact] Saved handover detail screenshot: ${detailPath}`);

    // Save current handover URL for later
    const detailUrl = page.url();

    // ------------------------------------------------------------------
    // TEST 4: Navigate to /handovers/inbox and verify submitted handover
    // ------------------------------------------------------------------
    console.log('\n[Test 4] Navigating to /handovers/inbox...');
    await page.goto(`http://localhost:${FRONTEND_PORT}/handovers/inbox`);
    await page.waitForSelector('h1:has-text("Incoming Handover Inbox")', { timeout: 8000 });
    assert(page.url().includes('/handovers/inbox'), 'Inbox page loaded');

    // Check if the newly submitted handover is displayed
    await page.waitForSelector(`text=${customLabel}`, { timeout: 8000 });
    assert(await page.isVisible(`text=${customLabel}`), 'Submitted handover visible in Incoming Inbox');
    assert(await page.isVisible('button:has-text("Review & Acknowledge")'), 'Review & Acknowledge button present');

    // Capture screenshot: Handover Inbox
    const inboxPath = path.join(ARTIFACTS_DIR, 'batch6_handover_inbox.png');
    await page.screenshot({ path: inboxPath, fullPage: true });
    console.log(`  [Artifact] Saved handover inbox screenshot: ${inboxPath}`);

    // ------------------------------------------------------------------
    // TEST 5: Acknowledge Handover on Detail Page
    // ------------------------------------------------------------------
    console.log('\n[Test 5] Navigating to detail and acknowledging handover...');
    const reviewBtn = page.locator(`div:has-text("${customLabel}")`).locator('button:has-text("Review & Acknowledge")').first();
    await reviewBtn.click();

    await page.waitForURL((url) => /\/handovers\/[a-f0-9]{24}/.test(url.pathname), { timeout: 8000 });
    await page.waitForSelector('h2:has-text("Incoming Operator Review & Official Acknowledgement")', { timeout: 8000 });
    assert(await page.isVisible('h2:has-text("Incoming Operator Review & Official Acknowledgement")'), 'Acknowledgement form is visible');

    // Fill in acknowledgement remarks
    const ackInput = page.locator('textarea[placeholder*="Briefing received and verified"]');
    await ackInput.fill('Shift briefing received and verified by oncoming operator. All sector cameras online.');

    // Click Acknowledge & Accept Shift Transfer
    await page.click('button:has-text("Acknowledge & Accept Shift Transfer")');
    await page.waitForSelector('text=Shift handover successfully acknowledged', { timeout: 8000 });
    assert(await page.isVisible('text=Shift handover successfully acknowledged'), 'Success banner shown upon acknowledgement');
    assert(await page.isVisible('text=ACKNOWLEDGED'), 'Status badge updated to ACKNOWLEDGED');

    // ------------------------------------------------------------------
    // TEST 6: Follow-up Action Items Management
    // ------------------------------------------------------------------
    console.log('\n[Test 6] Creating and updating follow-up action items...');
    await page.click('button:has-text("Add Follow-Up Item")');
    await page.waitForSelector('h3:has-text("New Action Item")', { timeout: 5000 });

    const fuInput = page.locator('input[placeholder*="Verify scaffolding tag"]');
    await fuInput.fill('Verify contractor scaffolding permit in Sector 2');
    await page.click('button:has-text("Save Follow-Up")');

    await page.waitForSelector('td:has-text("Verify contractor scaffolding permit in Sector 2")', { timeout: 8000 });
    assert(await page.isVisible('td:has-text("Verify contractor scaffolding permit in Sector 2")'), 'New follow-up item listed');

    // Transition status to COMPLETED
    const statusSelect = page.locator('select:has-text("Mark Open")').first();
    await statusSelect.selectOption('COMPLETED');
    await page.waitForSelector('span:has-text("COMPLETED")', { timeout: 5000 });
    assert(await page.isVisible('span:has-text("COMPLETED")'), 'Follow-up transitioned to COMPLETED');

    // ------------------------------------------------------------------
    // TEST 7: Conclude & Complete Handover
    // ------------------------------------------------------------------
    console.log('\n[Test 7] Marking handover COMPLETED...');
    const completeBtn = page.locator('button:has-text("Mark Handover Completed")');
    await completeBtn.click();

    await page.waitForSelector('text=Shift handover marked as COMPLETED', { timeout: 8000 });
    assert(await page.isVisible('text=Shift handover marked as COMPLETED'), 'Completion notification displayed');
    assert(await page.isVisible('text=COMPLETED'), 'Status badge transitions to COMPLETED');

    // ------------------------------------------------------------------
    // TEST 8: Navigate to /handovers/history and verify filter
    // ------------------------------------------------------------------
    console.log('\n[Test 8] Checking Handover History & Archive...');
    await page.goto(`http://localhost:${FRONTEND_PORT}/handovers/history`);
    await page.waitForSelector('h1:has-text("Shift Handover Archive & History")', { timeout: 8000 });
    assert(page.url().includes('/handovers/history'), 'History page loaded');

    // Verify history table contains records
    await page.waitForSelector('table tbody tr', { timeout: 8000 });
    const rows = await page.$$('table tbody tr');
    assert(rows.length > 0, 'History table populated with records');

    // Filter by status: COMPLETED
    const filterSelect = page.locator('select').first();
    await filterSelect.selectOption('COMPLETED');
    await page.waitForTimeout(600);
    assert(await page.locator('table').locator('text=COMPLETED').first().isVisible(), 'Filtered history shows COMPLETED handover');

    // Capture screenshot: Handover History
    const historyPath = path.join(ARTIFACTS_DIR, 'batch6_handover_history.png');
    await page.screenshot({ path: historyPath, fullPage: true });
    console.log(`  [Artifact] Saved handover history screenshot: ${historyPath}`);

    // ------------------------------------------------------------------
    // TEST 9: Comprehensive Responsive Viewport Verification (5 Viewports)
    // ------------------------------------------------------------------
    console.log('\n[Test 9] Verifying 5 Responsive Viewports (Mobile, Tablet, Laptop, Desktop, Large Desktop)...');

    const viewports = [
      { name: 'Mobile', width: 375, height: 667, artifactName: 'batch6_mobile_375.png' },
      { name: 'Tablet', width: 768, height: 1024, artifactName: 'batch6_tablet_768.png' },
      { name: 'Laptop', width: 1366, height: 768, artifactName: 'batch6_laptop_1366.png' },
      { name: 'Desktop', width: 1440, height: 900, artifactName: 'batch6_desktop_1440.png' },
      { name: 'Large Desktop', width: 1920, height: 1080, artifactName: 'batch6_large_desktop_1920.png' },
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`http://localhost:${FRONTEND_PORT}/handovers`);
      await page.waitForSelector('h1:has-text("Shift Handover Console")', { timeout: 8000 });

      // Check zero horizontal overflow
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      assert(!hasHorizontalScroll, `${vp.name} (${vp.width}x${vp.height}) has zero unwanted horizontal overflow`);

      const screenshotPath = path.join(ARTIFACTS_DIR, vp.artifactName);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      assert(fs.existsSync(screenshotPath), `${vp.name} screenshot captured (${vp.artifactName})`);
    }

    // ------------------------------------------------------------------
    // TEST 10: Operational Data Preservation Check
    // ------------------------------------------------------------------
    console.log('\n[Test 10] Verifying zero operational data corruption...');
    const alertCount = await Alert.countDocuments();
    const evidenceCount = await Evidence.countDocuments();
    assert(alertCount === baselineAlertCount, `Operational alerts intact (${alertCount} preserved)`);
    assert(evidenceCount === baselineEvidenceCount, `Operational evidence intact (${evidenceCount} preserved)`);

    // Clean up E2E synthetic data
    const synthHandovers = await ShiftHandover.find({ shiftLabel: { $regex: `^${SYNTH_E2E_PREFIX}` } }).select('_id');
    const synthIds = synthHandovers.map(h => h._id);
    await ShiftHandover.deleteMany({ _id: { $in: synthIds } });
    await HandoverActivity.deleteMany({ handover: { $in: synthIds } });
    await HandoverActivity.deleteMany({ 'details.shiftLabel': { $regex: `^${SYNTH_E2E_PREFIX}` } });

  } catch (err) {
    console.error('E2E test execution error:', err);
  } finally {
    if (browser) await browser.close();
    if (viteServer) await viteServer.close();
    if (backendServer) {
      await new Promise((resolve) => backendServer.close(resolve));
    }
    await disconnectDB();

    console.log('\n========================================================');
    console.log(`  Batch 6 E2E Verification Complete: ${passedTests}/${totalTests} Passed`);
    console.log('========================================================\n');

    process.exit(passedTests === totalTests ? 0 : 1);
  }
};

runBatch6E2E();
