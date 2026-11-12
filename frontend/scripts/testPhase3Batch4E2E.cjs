/**
 * Phase 3 Batch 4: Enhanced Evidence Vault E2E Verification Suite
 * Driven by Playwright + locally installed Google Chrome
 * Covers all 25 frontend integration and E2E requirements
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
const User = require('../../backend/src/models/User');

const BACKEND_PORT = 5000;
const FRONTEND_PORT = 5173;

const ARTIFACTS_DIR = 'C:/Users/Santosh Gupta/.gemini/antigravity/brain/0e8c53a1-34cc-46f0-b330-8f79648a8e70';
const SYNTH_E2E_PREFIX = 'SYNTH-E2E-B4-';

const runBatch4E2E = async () => {
  console.log('========================================================');
  console.log('  VSSP PHASE 3 BATCH 4: EVIDENCE VAULT E2E SUITE');
  console.log('========================================================\n');

  let backendServer = null;
  let viteServer = null;
  let browser = null;
  let createdProbeCam = null;
  let createdProbeAlert = null;
  let createdProbeEvidence = null;

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

    // Clean up any prior stale synthetic E2E records
    await Evidence.deleteMany({ evidenceCode: { $regex: `^${SYNTH_E2E_PREFIX}` } });
    await Alert.deleteMany({ alertCode: { $regex: `^${SYNTH_E2E_PREFIX}` } });
    await Camera.deleteMany({ cameraCode: { $regex: `^${SYNTH_E2E_PREFIX}` } });

    // Create / ensure dedicated probe camera, alert and evidence for reliable E2E checks
    createdProbeCam = await Camera.create({
      cameraCode: `${SYNTH_E2E_PREFIX}CAM-01`,
      name: 'Turbine Hall Main Vault Feed',
      site: 'Plant 1 Alpha',
      location: 'Section 4 High Bay',
      status: 'ONLINE',
      streamStatus: 'UNAVAILABLE',
      isActive: true,
    });

    createdProbeAlert = await Alert.create({
      alertCode: `${SYNTH_E2E_PREFIX}ALT-01`,
      eventId: `${SYNTH_E2E_PREFIX}EVT-01`,
      camera: createdProbeCam._id,
      cameraCode: createdProbeCam.cameraCode,
      violationType: 'NO_HELMET',
      violationName: 'Critical Safety Helmet Non-Compliance',
      severity: 'CRITICAL',
      confidence: 0.98,
      location: createdProbeCam.location,
      status: 'PENDING',
      detectedAt: new Date(),
      metadata: {
        evidenceStatus: 'EVIDENCE_ATTACHED',
        workFrontCode: 'WF-TURBINE-01',
        contractor: 'Apex Heavy Engineering',
        riskLevel: 'CRITICAL',
      },
    });

    createdProbeEvidence = await Evidence.create({
      evidenceCode: `${SYNTH_E2E_PREFIX}EVD-01`,
      alert: createdProbeAlert._id,
      alertCode: createdProbeAlert.alertCode,
      camera: createdProbeCam._id,
      cameraCode: createdProbeCam.cameraCode,
      fileName: 'sample-helmet-violation.jpg',
      filePath: 'src/assets/evidence/sample-helmet-violation.jpg',
      fileType: 'image/jpeg',
      fileSize: 74093,
      storageDriver: 'local',
      capturedAt: new Date(),
      checksumSha256: 'E55A4CD04B3D12E181DAF9CD0A6BE2900ACD3194C40FB886B974264C7B51F378',
      lastIntegrityStatus: 'VERIFIED',
      lastVerifiedAt: new Date(),
      isActive: true,
    });

    console.log(`  - Seeded E2E probe evidence (${createdProbeEvidence.evidenceCode}) linked to ${createdProbeAlert.alertCode}`);

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
      permissions: ['clipboard-read', 'clipboard-write'],
    });
    const page = await context.newPage();

    // ------------------------------------------------------------------
    // TEST 1: Login & Navigation to /evidence
    // ------------------------------------------------------------------
    console.log('\n[Test 1] Logging in as ADMIN & navigating to Evidence Vault...');
    await page.goto(`http://localhost:${FRONTEND_PORT}/login`);
    await page.fill('#email', 'admin@vssp.local');
    await page.fill('#password', 'AdminSecurePass@2026!');
    await page.click('button[type="submit"]');

    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 8000 });
    assert(!page.url().includes('/login'), 'Authenticated login successful');

    // Navigate to /evidence via Topbar/Sidebar or direct router link
    await page.goto(`http://localhost:${FRONTEND_PORT}/evidence`);
    await page.waitForSelector('h1:has-text("Evidence Vault")', { timeout: 6000 });
    assert(page.url().includes('/evidence'), 'Direct navigation to /evidence successful');

    // ------------------------------------------------------------------
    // TEST 2: Evidence Vault Header & Badges
    // ------------------------------------------------------------------
    console.log('\n[Test 2] Verifying Evidence Vault Header & Badges...');
    const headerTitle = page.locator('h1:has-text("Evidence Vault")');
    assert(await headerTitle.isVisible(), 'Evidence Vault header title is visible');

    const headerBadge = page.locator('span:has-text("Preserved Records")');
    assert(await headerBadge.isVisible(), 'Header preserved records badge is visible');

    // ------------------------------------------------------------------
    // TEST 3: 4 KPI Summary Ribbon Cards
    // ------------------------------------------------------------------
    console.log('\n[Test 3] Verifying 4 KPI Summary Ribbon Cards...');
    const kpiTotal = page.locator('text=Total Evidence');
    const kpiCloud = page.locator('text=Cloudinary Assets');
    const kpiStorage = page.locator('text=Recorded Storage');
    const kpiIncidents = page.locator('text=Associated Incidents');

    await kpiTotal.waitFor({ state: 'visible', timeout: 5000 });
    assert(await kpiTotal.isVisible(), 'KPI Card 1: Total Evidence renders');
    assert(await kpiCloud.isVisible(), 'KPI Card 2: Cloudinary Assets renders');
    assert(await kpiStorage.isVisible(), 'KPI Card 3: Recorded Storage renders');
    assert(await kpiIncidents.isVisible(), 'KPI Card 4: Associated Incidents renders');

    // ------------------------------------------------------------------
    // TEST 4: Grid View Cards Rendering
    // ------------------------------------------------------------------
    console.log('\n[Test 4] Verifying Visual Gallery Grid View Cards...');
    const gridCards = page.locator('[data-testid^="evidence-card-"]');
    await gridCards.first().waitFor({ state: 'visible', timeout: 6000 });
    const gridCount = await gridCards.count();
    assert(gridCount > 0, `Grid view renders evidence cards (found ${gridCount})`);

    // Capture Grid Screenshot
    const gridScreenshotPath = path.join(ARTIFACTS_DIR, 'batch4_evidence_grid.png');
    await page.screenshot({ path: gridScreenshotPath });
    console.log(`  - Screenshot saved: ${gridScreenshotPath}`);

    // ------------------------------------------------------------------
    // TEST 5: Table View Mode Toggle
    // ------------------------------------------------------------------
    console.log('\n[Test 5] Testing Grid to Table View Mode Toggle...');
    const tableBtn = page.locator('[data-testid="evidence-view-table-btn"]');
    await tableBtn.click();
    await page.waitForTimeout(500);

    const tableRows = page.locator('[data-testid^="evidence-table-row-"]');
    await tableRows.first().waitFor({ state: 'visible', timeout: 5000 });
    assert(await tableRows.first().isVisible(), 'Table view rows render cleanly on toggle');

    const tableHeaders = page.locator('thead');
    const headerText = (await tableHeaders.innerText()).toUpperCase();
    assert(headerText.includes('EVIDENCE CODE'), 'Table header includes Evidence Code');
    assert(headerText.includes('ALERT CODE'), 'Table header includes Alert Code');
    assert(headerText.includes('VIOLATION'), 'Table header includes Violation Detected');
    assert(headerText.includes('STORAGE'), 'Table header includes Storage');

    // Capture Table Screenshot
    const tableScreenshotPath = path.join(ARTIFACTS_DIR, 'batch4_evidence_table.png');
    await page.screenshot({ path: tableScreenshotPath });
    console.log(`  - Screenshot saved: ${tableScreenshotPath}`);

    // Switch back to grid view for filter tests
    const gridBtn = page.locator('[data-testid="evidence-view-grid-btn"]');
    await gridBtn.click();
    await page.waitForTimeout(400);

    // ------------------------------------------------------------------
    // TEST 6: Omnisearch Filtering with Debounce
    // ------------------------------------------------------------------
    console.log('\n[Test 6] Testing Omnisearch Filtering...');
    const searchInput = page.locator('[data-testid="evidence-search-input"]');
    await searchInput.fill(createdProbeEvidence.evidenceCode);
    await page.waitForTimeout(700); // Wait for 300ms debounce + API round-trip

    const filteredCards = page.locator(`[data-testid="evidence-card-${createdProbeEvidence.evidenceCode}"]`);
    assert(await filteredCards.isVisible(), `Omnisearch finds probe card ${createdProbeEvidence.evidenceCode}`);

    // Clear search
    await searchInput.fill('');
    await page.waitForTimeout(700);

    // ------------------------------------------------------------------
    // TEST 7: Camera Filter
    // ------------------------------------------------------------------
    console.log('\n[Test 7] Testing Camera Filter Dropdown...');
    const cameraFilter = page.locator('[data-testid="evidence-camera-filter"]');
    assert(await cameraFilter.isVisible(), 'Camera filter select is rendered');

    // ------------------------------------------------------------------
    // TEST 8: Severity Filter
    // ------------------------------------------------------------------
    console.log('\n[Test 8] Testing Severity Filter...');
    const severityFilter = page.locator('[data-testid="evidence-severity-filter"]');
    await severityFilter.selectOption('CRITICAL');
    await page.waitForTimeout(600);
    assert(await severityFilter.inputValue() === 'CRITICAL', 'Severity filter selected CRITICAL');

    // ------------------------------------------------------------------
    // TEST 9: Violation Type Filter
    // ------------------------------------------------------------------
    console.log('\n[Test 9] Testing Violation Type Filter...');
    const violationFilter = page.locator('[data-testid="evidence-violation-filter"]');
    await violationFilter.selectOption('NO_HELMET');
    await page.waitForTimeout(600);
    assert(await violationFilter.inputValue() === 'NO_HELMET', 'Violation filter selected NO_HELMET');

    // ------------------------------------------------------------------
    // TEST 10: Storage Driver Filter
    // ------------------------------------------------------------------
    console.log('\n[Test 10] Testing Storage Driver Filter...');
    const driverFilter = page.locator('[data-testid="evidence-driver-filter"]');
    await driverFilter.selectOption('local');
    await page.waitForTimeout(600);
    assert(await driverFilter.inputValue() === 'local', 'Storage driver filter selected local');

    // ------------------------------------------------------------------
    // TEST 11: Sort Selector
    // ------------------------------------------------------------------
    console.log('\n[Test 11] Testing Sort Selector...');
    const sortSelect = page.locator('[data-testid="evidence-sort-select"]');
    await sortSelect.selectOption('capturedAt:asc');
    await page.waitForTimeout(600);
    assert(await sortSelect.inputValue() === 'capturedAt:asc', 'Sort selector selected Oldest First');

    // ------------------------------------------------------------------
    // TEST 12: Reset Filters Button
    // ------------------------------------------------------------------
    console.log('\n[Test 12] Testing Reset Filters Button...');
    const resetBtn = page.locator('[data-testid="evidence-reset-filters-btn"]');
    await resetBtn.waitFor({ state: 'visible', timeout: 4000 });
    await resetBtn.click();
    await page.waitForTimeout(700);

    assert(await severityFilter.inputValue() === 'ALL', 'Severity reset to ALL');
    assert(await violationFilter.inputValue() === 'ALL', 'Violation reset to ALL');
    assert(await driverFilter.inputValue() === 'ALL', 'Storage driver reset to ALL');

    // ------------------------------------------------------------------
    // TEST 13 & 14: Pagination Controls & Page Size Selector
    // ------------------------------------------------------------------
    console.log('\n[Tests 13 & 14] Testing Pagination Controls & Page Size...');
    const limitSelect = page.locator('[data-testid="evidence-page-limit-select"]');
    await limitSelect.waitFor({ state: 'visible', timeout: 4000 });
    await limitSelect.selectOption('24');
    await page.waitForTimeout(600);
    assert(await limitSelect.inputValue() === '24', 'Page limit changed to 24');

    const prevPageBtn = page.locator('[data-testid="evidence-prev-page-btn"]');
    const nextPageBtn = page.locator('[data-testid="evidence-next-page-btn"]');
    assert(await prevPageBtn.isVisible(), 'Pagination Previous button is visible');
    assert(await nextPageBtn.isVisible(), 'Pagination Next button is visible');

    // ------------------------------------------------------------------
    // TEST 15: Open EvidenceDetailModal
    // ------------------------------------------------------------------
    console.log('\n[Test 15] Opening EvidenceDetailModal on card inspect...');
    // Filter specifically to our probe card to ensure deterministic modal contents
    await searchInput.fill(createdProbeEvidence.evidenceCode);
    await page.waitForTimeout(700);

    const inspectBtn = page.locator(`[data-testid="inspect-evidence-${createdProbeEvidence.evidenceCode}"]`);
    await inspectBtn.waitFor({ state: 'visible', timeout: 5000 });
    await inspectBtn.click();

    // Verify modal opened
    const modal = page.locator('div[role="dialog"]');
    await modal.waitFor({ state: 'visible', timeout: 5000 });
    assert(await modal.isVisible(), 'EvidenceDetailModal opened successfully');

    // ------------------------------------------------------------------
    // TEST 16: Interactive Zoom Canvas Controls
    // ------------------------------------------------------------------
    console.log('\n[Test 16] Testing Zoom Canvas Controls (+, -, 1:1, fullscreen)...');
    const zoomInBtn = page.locator('button[aria-label="Zoom In"]');
    const zoomOutBtn = page.locator('button[aria-label="Zoom Out"]');
    const zoomResetBtn = page.locator('button[aria-label="Reset Zoom"]');
    const fullscreenBtn = page.locator('button[aria-label="Toggle Fullscreen"]');

    assert(await zoomInBtn.isVisible(), 'Zoom In button is visible');
    assert(await zoomOutBtn.isVisible(), 'Zoom Out button is visible');
    assert(await zoomResetBtn.isVisible(), 'Reset Zoom button is visible');
    assert(await fullscreenBtn.isVisible(), 'Fullscreen toggle button is visible');

    // Click Zoom In
    await zoomInBtn.click();
    await page.waitForTimeout(300);
    const zoomLabel = page.locator('span:has-text("125%")');
    assert(await zoomLabel.isVisible(), 'Zoom level updated to 125% upon Zoom In');

    // Capture Zoom Screenshot
    const zoomScreenshotPath = path.join(ARTIFACTS_DIR, 'batch4_evidence_zoom.png');
    await page.screenshot({ path: zoomScreenshotPath });
    console.log(`  - Screenshot saved: ${zoomScreenshotPath}`);

    // Reset zoom
    await zoomResetBtn.click();
    await page.waitForTimeout(200);

    // ------------------------------------------------------------------
    // TEST 17: Incident Context Card
    // ------------------------------------------------------------------
    console.log('\n[Test 17] Verifying Incident Context Card...');
    const incidentCard = modal.locator('text=Associated Safety Incident');
    assert(await incidentCard.isVisible(), 'Incident Context card heading is rendered');
    const alertCodeText = modal.locator(`text=${createdProbeAlert.alertCode}`);
    assert(await alertCodeText.isVisible(), `Linked alertCode ${createdProbeAlert.alertCode} rendered in modal`);

    // ------------------------------------------------------------------
    // TEST 18: Inspect Linked Alert Deep Link
    // ------------------------------------------------------------------
    console.log('\n[Test 18] Verifying "Inspect Linked Alert" Button...');
    const inspectAlertBtn = modal.locator('button:has-text("Inspect Linked Alert")');
    assert(await inspectAlertBtn.isVisible(), '"Inspect Linked Alert" action button is rendered');

    // ------------------------------------------------------------------
    // TEST 19: Camera & Hardware Context Card
    // ------------------------------------------------------------------
    console.log('\n[Test 19] Verifying Camera & Hardware Context Card...');
    const cameraCard = modal.locator('text=Monitoring Camera');
    assert(await cameraCard.isVisible(), 'Camera context card is rendered');
    const cameraCodeText = modal.locator(`text=${createdProbeCam.cameraCode}`);
    assert(await cameraCodeText.isVisible(), `Camera code ${createdProbeCam.cameraCode} rendered`);

    // ------------------------------------------------------------------
    // TEST 20: Forensic Storage Card
    // ------------------------------------------------------------------
    console.log('\n[Test 20] Verifying Forensic Storage Card Details...');
    const storageCard = modal.locator('text=Forensic Storage & Integrity');
    assert(await storageCard.isVisible(), 'Forensic storage card heading rendered');

    // ------------------------------------------------------------------
    // TEST 21: SHA-256 Copy Button & Feedback
    // ------------------------------------------------------------------
    console.log('\n[Test 21] Testing SHA-256 Checksum Copy Button...');
    const copyHashBtn = modal.locator('button:has-text("Copy Hash")');
    assert(await copyHashBtn.isVisible(), 'Copy Hash button is visible');
    await copyHashBtn.click();
    await page.waitForTimeout(400);

    const copiedFeedback = modal.locator('span:has-text("Copied")');
    assert(await copiedFeedback.isVisible(), 'Copy button shows visual feedback ("Copied")');

    // ------------------------------------------------------------------
    // TEST 22: Forensic Integrity Status Badge & Active Verification
    // ------------------------------------------------------------------
    console.log('\n[Test 22] Verifying Forensic Integrity Badge & Active Verification...');
    const verifyHashBtn = modal.locator('[data-testid="evidence-modal-verify-btn"]');
    assert(await verifyHashBtn.isVisible(), 'Verify Hash button is visible in modal');
    await verifyHashBtn.click();
    await page.waitForTimeout(600);

    const verifiedBadge = modal.locator('span:has-text("SHA-256 Verified")');
    assert(await verifiedBadge.isVisible(), 'Evidence with SHA-256 displays "SHA-256 Verified" badge');

    // ------------------------------------------------------------------
    // TEST 23: Authenticated Download Button in Modal
    // ------------------------------------------------------------------
    console.log('\n[Test 23] Testing Authenticated Download Action...');
    const downloadBtn = modal.locator('[data-testid="evidence-modal-download-btn"]');
    assert(await downloadBtn.isVisible(), 'Download Snapshot button rendered in modal footer');

    // Capture Modal Detail Screenshot
    const modalDetailScreenshotPath = path.join(ARTIFACTS_DIR, 'batch4_evidence_detail_modal.png');
    await page.screenshot({ path: modalDetailScreenshotPath });
    console.log(`  - Screenshot saved: ${modalDetailScreenshotPath}`);

    // Close modal
    const closeBtn = modal.locator('button:has-text("Close")');
    await closeBtn.click();
    await page.waitForTimeout(400);

    // Clear search filter
    await searchInput.fill('');
    await page.waitForTimeout(700);

    // ------------------------------------------------------------------
    // TEST 24: Responsive Viewports (Tablet & Mobile)
    // ------------------------------------------------------------------
    console.log('\n[Test 24] Testing Responsive Viewports (Tablet 768x1024 & Mobile 375x667)...');
    // Tablet (768x1024)
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(600);
    const tabletKpi = page.locator('text=Total Evidence');
    assert(await tabletKpi.isVisible(), 'Tablet (768x1024) renders KPI cards cleanly');

    const tabletScreenshotPath = path.join(ARTIFACTS_DIR, 'batch4_responsive_tablet_768.png');
    await page.screenshot({ path: tabletScreenshotPath });
    console.log(`  - Screenshot saved: ${tabletScreenshotPath}`);

    // Mobile (375x667)
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(600);
    const mobileHeader = page.locator('h1:has-text("Evidence Vault")');
    assert(await mobileHeader.isVisible(), 'Mobile (375x667) renders Evidence Vault header cleanly');

    const mobileScreenshotPath = path.join(ARTIFACTS_DIR, 'batch4_responsive_mobile_375.png');
    await page.screenshot({ path: mobileScreenshotPath });
    console.log(`  - Screenshot saved: ${mobileScreenshotPath}`);

    // ------------------------------------------------------------------
    // TEST 25: Verify All Required Screenshots Created
    // ------------------------------------------------------------------
    console.log('\n[Test 25] Verifying Generated Artifact Screenshots...');
    const expectedScreenshots = [
      'batch4_evidence_grid.png',
      'batch4_evidence_table.png',
      'batch4_evidence_detail_modal.png',
      'batch4_evidence_zoom.png',
      'batch4_responsive_tablet_768.png',
      'batch4_responsive_mobile_375.png',
    ];

    for (const fileName of expectedScreenshots) {
      const fullPath = path.join(ARTIFACTS_DIR, fileName);
      assert(fs.existsSync(fullPath), `Artifact screenshot exists: ${fileName}`);
    }

    console.log('\n========================================================');
    console.log(`  BATCH 4 E2E RESULTS: ${passedTests}/${totalTests} CHECKS PASSED`);
    console.log('========================================================\n');

    if (passedTests !== totalTests) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Unhandled error during E2E testing:', err);
    process.exit(1);
  } finally {
    // Teardown
    console.log('[Teardown] Cleaning test probe records and stopping servers...');
    try {
      if (createdProbeEvidence) {
        await Evidence.deleteOne({ _id: createdProbeEvidence._id });
      }
      if (createdProbeAlert) {
        await Alert.deleteOne({ _id: createdProbeAlert._id });
      }
      if (createdProbeCam) {
        await Camera.deleteOne({ _id: createdProbeCam._id });
      }
    } catch (cleanErr) {
      console.warn('Probe cleanup warning:', cleanErr.message);
    }

    if (browser) await browser.close();
    if (viteServer) await viteServer.close();
    if (backendServer) {
      await new Promise((resolve) => backendServer.close(resolve));
    }
    await disconnectDB();
    console.log('Teardown complete.');
  }
};

runBatch4E2E().catch((e) => {
  console.error(e);
  process.exit(1);
});
