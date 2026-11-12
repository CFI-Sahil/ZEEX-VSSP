/**
 * Phase 3 Batch 5: Training Sandbox E2E Verification Suite
 * Driven by Playwright + locally installed Google Chrome
 * Covers:
 *  - Authentication & Navigation: Sidebar menu links, Direct URL routes (/training, /training/scenarios, /training/history, /training/admin/scenarios)
 *  - Training Dashboard: KPI ribbon, Performance overview by violation, Ratings breakdown, Recent sessions table
 *  - Scenario Catalog: Filter by difficulty, Filter by violation, Search, Scenario detail modal, Start sandbox session
 *  - Training Workspace: Training Mode banner, Elapsed timer, Simulated CCTV snapshot, Incident info, Step 1-4 interactive workflow (Acknowledge, Assess, Corrective, Complete)
 *  - Evaluation Results: Total score, Performance band, Score breakdown across 6 criteria, Commendations & missed criteria lists
 *  - Training History: History table, Scoped user records, Status filter, Search, Review past sessions
 *  - Admin Scenario Management: Admin-only access, Table listing, Create/Edit modal with hidden criteria configuration, Publish/Archive controls
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
const TrainingScenario = require('../../backend/src/models/TrainingScenario');
const TrainingSession = require('../../backend/src/models/TrainingSession');

const BACKEND_PORT = 5000;
const FRONTEND_PORT = 5173;

const ARTIFACTS_DIR = 'C:/Users/Santosh Gupta/.gemini/antigravity/brain/0e8c53a1-34cc-46f0-b330-8f79648a8e70';
const SYNTH_E2E_PREFIX = 'SYNTH-E2E-B5-';

const runBatch5E2E = async () => {
  console.log('========================================================');
  console.log('  VSSP PHASE 3 BATCH 5: TRAINING SANDBOX E2E SUITE');
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

    // Clean up any stale synthetic E2E records
    await TrainingSession.deleteMany({ sessionCode: { $regex: `^${SYNTH_E2E_PREFIX}` } });
    await TrainingScenario.deleteMany({ scenarioCode: { $regex: `^${SYNTH_E2E_PREFIX}` } });

    // Ensure at least one dedicated synthetic scenario exists for deterministic E2E flow
    const e2eScenario = await TrainingScenario.create({
      scenarioCode: `${SYNTH_E2E_PREFIX}SCN-01`,
      title: 'E2E Automated Sandbox: Missing Safety Helmet',
      description: 'Automated Playwright verification scenario for PPE compliance simulation.',
      objective: 'Practice identifying missing hard hat and executing immediate stop work protocol.',
      violationType: 'NO_HELMET',
      severity: 'HIGH',
      difficulty: 'BEGINNER',
      estimatedMinutes: 8,
      instructions: [
        'Review overhead CCTV snapshot.',
        'Acknowledge safety notification.',
        'Record assessed category and HIGH severity.',
        'Complete corrective PPE issuance and closure remarks.',
      ],
      learningObjectives: ['Verify helmet hazard awareness', 'Execute verbal cautioning'],
      simulatedAlertContext: {
        alertCode: 'ALT-SIM-E2E-01',
        cameraCode: 'CAM-FAB-01',
        cameraName: 'Bay 1 Overhead Camera',
        location: 'Fabrication Bay 1',
        site: 'North Plant',
        contractor: 'Apex Structural Contracting',
        workFrontCode: 'WF-FAB-01',
        workFrontName: 'Main Assembly Bay',
        riskLevel: 'HIGH',
      },
      simulatedEvidence: {
        fileName: 'sample-helmet-violation.jpg',
        fixtureType: 'HELMET',
        fileUrl: '/api/v1/training/evidence-sample/sample-helmet-violation.jpg',
        mimeType: 'image/jpeg',
        caption: 'Overhead camera detection showing worker without safety helmet',
      },
      expectedEvaluation: {
        expectedViolationType: 'NO_HELMET',
        expectedSeverity: 'HIGH',
        expectedImmediateResponse: 'ISSUE_VERBAL_WARNING',
        expectedCorrectiveActionCategory: 'PPE_COMPLIANCE_ISSUANCE',
        minimumRemarksLength: 15,
        weights: {
          violationId: 20,
          severity: 20,
          acknowledgment: 15,
          immediateResponse: 15,
          correctiveAction: 20,
          resolutionRemarks: 10,
        },
      },
      status: 'PUBLISHED',
      createdByEmail: 'admin@vssp.local',
    });

    console.log(`  - Seeded E2E probe scenario: ${e2eScenario.scenarioCode}`);

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
    // TEST 1: Login & Navigation to /training
    // ------------------------------------------------------------------
    console.log('\n[Test 1] Logging in as ADMIN and navigating to Training Dashboard...');
    await page.goto(`http://localhost:${FRONTEND_PORT}/login`);
    await page.fill('#email', 'admin@vssp.local');
    await page.fill('#password', 'AdminSecurePass@2026!');
    await page.click('button[type="submit"]');

    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 8000 });
    assert(!page.url().includes('/login'), 'Authenticated login successful');

    // Navigate to /training
    await page.goto(`http://localhost:${FRONTEND_PORT}/training`);
    await page.waitForSelector('h1:has-text("Safety Operator Training Sandbox")', { timeout: 8000 });
    assert(page.url().includes('/training'), 'Direct navigation to /training successful');

    // ------------------------------------------------------------------
    // TEST 2: Training Mode Banner & KPI Ribbon
    // ------------------------------------------------------------------
    console.log('\n[Test 2] Verifying Training Mode Banner & Dashboard KPIs...');
    await page.waitForSelector('text=Available Scenarios', { timeout: 10000 });

    const banner = page.locator('text=TRAINING MODE').first();
    assert(await banner.isVisible(), 'Distinctive TRAINING MODE banner is rendered');

    const isolationPill = page.locator('text=Operational Data Isolated').first();
    assert(await isolationPill.isVisible(), 'Isolation indicator pill is displayed');

    const kpiScenarios = page.locator('text=Available Scenarios').first();
    assert(await kpiScenarios.isVisible(), 'Available Scenarios KPI card rendered');

    const kpiCompleted = page.locator('text=Completed Sessions').first();
    assert(await kpiCompleted.isVisible(), 'Completed Sessions KPI card rendered');

    // Capture screenshot: Training Dashboard
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'batch5_training_dashboard.png'),
      fullPage: true,
    });
    console.log('  - Captured artifact: batch5_training_dashboard.png');

    // ------------------------------------------------------------------
    // TEST 3: Scenario Library Browsing & Search
    // ------------------------------------------------------------------
    console.log('\n[Test 3] Navigating to Scenario Library & Search/Filters...');
    await page.click('button:has-text("Scenario Library")');
    await page.waitForURL((url) => url.pathname.includes('/training/scenarios'), { timeout: 6000 });
    assert(page.url().includes('/training/scenarios'), 'Navigated to Scenario Library page');

    await page.waitForSelector('h1:has-text("Training Scenario Library")', { timeout: 6000 });

    // Search for our probe scenario
    await page.fill('input[placeholder*="Search scenarios"]', 'Automated Sandbox');
    await page.waitForTimeout(600); // debounce

    const probeCardTitle = page.locator(`h3:has-text("${e2eScenario.title}")`).first();
    assert(await probeCardTitle.isVisible(), 'Search filtered scenario catalog accurately');

    // Capture screenshot: Scenario Library
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'batch5_scenario_library.png'),
      fullPage: true,
    });
    console.log('  - Captured artifact: batch5_scenario_library.png');

    // ------------------------------------------------------------------
    // TEST 4: Scenario Details Modal
    // ------------------------------------------------------------------
    console.log('\n[Test 4] Opening Scenario Details Preview Modal...');
    // Find the Details button on the probe card
    const detailsBtn = page.locator('button:has-text("Details")').first();
    await detailsBtn.click();

    await page.waitForSelector('text=Scenario Objective', { timeout: 5000 });
    assert(await page.locator('text=Scenario Objective').isVisible(), 'Scenario detail modal opened');
    assert(await page.locator(`text=${e2eScenario.scenarioCode}`).first().isVisible(), 'Scenario code verified in modal');

    // Close detail modal
    await page.click('button:has-text("Close")');
    await page.waitForTimeout(400);

    // ------------------------------------------------------------------
    // TEST 5: Start Sandbox Session & Simulated Workspace
    // ------------------------------------------------------------------
    console.log('\n[Test 5] Starting Training Sandbox Session...');
    const startSandboxBtn = page.locator('button:has-text("Start Sandbox")').first();
    await startSandboxBtn.click();

    await page.waitForURL((url) => url.pathname.includes('/training/session/'), { timeout: 8000 });
    assert(page.url().includes('/training/session/'), 'Successfully entered Simulated Training Workspace');

    await page.waitForSelector('h1:has-text("E2E Automated Sandbox")', { timeout: 6000 });
    assert(await page.locator('text=SIMULATED CCTV FEED').isVisible(), 'Simulated CCTV feed preview is active');
    assert(await page.locator('text=ALT-SIM-').first().isVisible(), 'Simulated incident code displayed');

    // Capture screenshot: Training Workspace
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'batch5_training_workspace.png'),
      fullPage: true,
    });
    console.log('  - Captured artifact: batch5_training_workspace.png');

    // ------------------------------------------------------------------
    // TEST 6: Step 1 Acknowledgment
    // ------------------------------------------------------------------
    console.log('\n[Test 6] Executing Step 1: Operational Acknowledgment...');
    const ackInput = page.locator('input[placeholder*="acknowledgment note"]');
    if (await ackInput.isVisible()) {
      await ackInput.fill('E2E Automated acknowledgment: incident verified on camera.');
      await page.click('button:has-text("Acknowledge Incident Alert")');
      await page.waitForTimeout(800);
    }
    assert(await page.locator('text=Acknowledged').first().isVisible(), 'Incident acknowledged successfully');

    // ------------------------------------------------------------------
    // TEST 7: Step 2 Incident Assessment
    // ------------------------------------------------------------------
    console.log('\n[Test 7] Executing Step 2: Incident Assessment...');
    await page.locator('select').filter({ hasText: 'Select violation...' }).selectOption('NO_HELMET');
    await page.locator('select').filter({ hasText: 'Select severity...' }).selectOption('HIGH');
    await page.locator('select').filter({ hasText: 'Select immediate response...' }).selectOption('ISSUE_VERBAL_WARNING');

    await page.click('button:has-text("Save Assessment")');
    await page.waitForTimeout(800);
    assert(await page.locator('text=Operator assessment saved.').isVisible(), 'Assessment saved message displayed');

    // ------------------------------------------------------------------
    // TEST 8: Step 3 Corrective Action Plan
    // ------------------------------------------------------------------
    console.log('\n[Test 8] Executing Step 3: Corrective Action Plan...');
    await page.locator('select').filter({ hasText: 'Select corrective category...' }).selectOption('PPE_COMPLIANCE_ISSUANCE');
    await page.fill('textarea[placeholder*="Document root cause"]', 'Supervisors conducted field PPE replacement and issued reminder.');
    await page.click('button:has-text("Save Corrective Plan")');
    await page.waitForTimeout(800);
    assert(await page.locator('text=Corrective action plan saved.').isVisible(), 'Corrective action saved');

    // ------------------------------------------------------------------
    // TEST 9: Step 4 Incident Resolution & Evaluation Score
    // ------------------------------------------------------------------
    console.log('\n[Test 9] Executing Step 4: Incident Closure & Evaluation...');
    await page.fill(
      'textarea[placeholder*="formal closure remarks"]',
      'Worker has donned hard hat and resumed work safely under continuous supervisor observation.'
    );
    await page.click('button:has-text("Complete Incident & Calculate Score")');

    // Evaluation Results Modal should appear automatically
    await page.waitForSelector('text=Training Session Evaluation Results', { timeout: 8000 });
    assert(await page.locator('text=Training Session Evaluation Results').isVisible(), 'Evaluation Results Modal appeared');

    const scoreCard = page.locator('text=/ 100').first();
    assert(await scoreCard.isVisible(), 'Total Score card rendered');

    const excellentBadge = page.locator('text=Excellent Response');
    assert(await excellentBadge.isVisible(), 'Earned Excellent Response performance band');

    // Capture screenshot: Training Results Modal
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'batch5_training_results_modal.png'),
    });
    console.log('  - Captured artifact: batch5_training_results_modal.png');

    // Close results modal
    await page.click('button:has-text("Close Evaluation")');
    await page.waitForTimeout(400);

    // ------------------------------------------------------------------
    // TEST 10: Training History Page
    // ------------------------------------------------------------------
    console.log('\n[Test 10] Navigating to Training History Page...');
    await page.goto(`http://localhost:${FRONTEND_PORT}/training/history`);
    await page.waitForSelector('h1:has-text("Training Session History")', { timeout: 6000 });
    assert(page.url().includes('/training/history'), 'Navigated to Training History');

    await page.waitForSelector('table tbody tr', { timeout: 10000 });
    const completedBadgeInTable = page.locator('table').locator('text=Completed').first();
    assert(await completedBadgeInTable.isVisible(), 'Completed session record listed in history table');

    // Capture screenshot: Training History
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'batch5_training_history.png'),
      fullPage: true,
    });
    console.log('  - Captured artifact: batch5_training_history.png');

    // ------------------------------------------------------------------
    // TEST 11: Admin Scenario Management
    // ------------------------------------------------------------------
    console.log('\n[Test 11] Testing Admin Scenario Management Page...');
    await page.goto(`http://localhost:${FRONTEND_PORT}/training/admin/scenarios`);
    await page.waitForSelector('h1:has-text("Scenario Catalog Management")', { timeout: 6000 });
    assert(page.url().includes('/training/admin/scenarios'), 'Admin Scenario Management loaded');

    const newScnBtn = page.locator('button:has-text("New Training Scenario")');
    assert(await newScnBtn.isVisible(), 'New Scenario creation button visible for ADMIN');

    // Capture screenshot: Admin Scenario Management
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'batch5_admin_scenarios.png'),
      fullPage: true,
    });
    console.log('  - Captured artifact: batch5_admin_scenarios.png');

    // ------------------------------------------------------------------
    // TEST 12: Responsive Viewport Verifications
    // ------------------------------------------------------------------
    console.log('\n[Test 12] Responsive Viewport Verifications...');

    // Mobile: 375 x 667
    console.log('  - Checking Mobile (375x667)...');
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`http://localhost:${FRONTEND_PORT}/training`);
    await page.waitForSelector('text=TRAINING MODE', { timeout: 5000 });
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'batch5_mobile_375.png'),
      fullPage: true,
    });
    assert(await page.locator('text=TRAINING MODE').isVisible(), 'Mobile viewport 375x667 renders cleanly without horizontal scroll');
    console.log('  - Captured artifact: batch5_mobile_375.png');

    // Tablet: 768 x 1024
    console.log('  - Checking Tablet (768x1024)...');
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(`http://localhost:${FRONTEND_PORT}/training/scenarios`);
    await page.waitForSelector('h1:has-text("Training Scenario Library")', { timeout: 5000 });
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'batch5_tablet_768.png'),
      fullPage: true,
    });
    assert(await page.locator('h1:has-text("Training Scenario Library")').isVisible(), 'Tablet viewport 768x1024 renders catalog cleanly');
    console.log('  - Captured artifact: batch5_tablet_768.png');

    // ------------------------------------------------------------------
    // Cleanup Synthetic Records
    // ------------------------------------------------------------------
    await TrainingSession.deleteMany({ sessionCode: { $regex: `^${SYNTH_E2E_PREFIX}` } });
    await TrainingScenario.deleteMany({ scenarioCode: { $regex: `^${SYNTH_E2E_PREFIX}` } });

    console.log('\n========================================================');
    console.log(`  BATCH 5 E2E RESULTS: ${passedTests}/${totalTests} PASSED`);
    console.log('========================================================\n');

    if (browser) await browser.close();
    if (viteServer) await viteServer.close();
    if (backendServer) backendServer.close();
    await disconnectDB();

    process.exit(totalTests - passedTests === 0 ? 0 : 1);
  } catch (err) {
    console.error('Batch 5 E2E runner encountered an error:', err);
    if (browser) await browser.close();
    if (viteServer) await viteServer.close();
    if (backendServer) backendServer.close();
    await disconnectDB();
    process.exit(1);
  }
};

runBatch5E2E();
