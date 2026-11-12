/**
 * Phase 3 Batch 3: Escalation & Notifications E2E Verification Suite
 * Driven by Playwright + locally installed Google Chrome
 */
const { chromium } = require('playwright');
const http = require('http');
const path = require('path');
const fs = require('fs');

const backendApp = require('../../backend/src/app');
const { connectDB, disconnectDB } = require('../../backend/src/config/db');
const Alert = require('../../backend/src/models/Alert');
const Camera = require('../../backend/src/models/Camera');
const User = require('../../backend/src/models/User');
const NotificationLog = require('../../backend/src/models/NotificationLog');

const BACKEND_PORT = 5000;
const FRONTEND_PORT = 5173;

const ARTIFACTS_DIR = 'C:/Users/Santosh Gupta/.gemini/antigravity/brain/0e8c53a1-34cc-46f0-b330-8f79648a8e70';

const runBatch3E2E = async () => {
  console.log('========================================================');
  console.log('  VSSP PHASE 3 BATCH 3: FRONTEND E2E VERIFICATION SUITE');
  console.log('========================================================\n');

  let backendServer = null;
  let viteServer = null;
  let browser = null;
  let createdProbeAlert = null;
  let createdProbeNotif = null;

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

    // Create / ensure probe camera and alert for escalation visualization
    let cam = await Camera.findOne({ isActive: true });
    if (!cam) {
      cam = await Camera.create({
        cameraCode: 'CAM-E2E-B3-01',
        name: 'Refinery South Gate',
        site: 'Plant 1',
        location: 'Zone 1',
        status: 'ONLINE',
        streamStatus: 'UNAVAILABLE',
        isActive: true,
      });
    }

    const testDetectedAt = new Date(Date.now() - 35 * 60 * 1000); // 35 min ago
    createdProbeAlert = await Alert.create({
      alertCode: `ALT-E2E-B3-${Date.now()}`,
      eventId: `EVT-E2E-B3-${Date.now()}`,
      camera: cam._id,
      cameraCode: cam.cameraCode || 'CAM-01',
      violationType: 'RESTRICTED_ACCESS',
      violationName: 'Restricted Area Access Violation',
      location: cam.location || 'Zone 1 North Bay',
      severity: 'CRITICAL',
      status: 'PENDING',
      confidence: 0.96,
      detectedAt: testDetectedAt,
      escalationLevel: 2,
      escalatedAtL2: new Date(Date.now() - 30 * 60 * 1000),
      escalationHistory: [
        {
          level: 2,
          previousLevel: 1,
          escalatedAt: new Date(Date.now() - 30 * 60 * 1000),
          reason: 'CRITICAL SLA Level 2 threshold (5m) breached at 30.0m elapsed',
        },
      ],
      metadata: {
        evidenceStatus: 'AVAILABLE',
        workFrontCode: 'WF-E2E-TEST',
        contractor: 'Larsen & Alpha Industrial Ltd',
        riskLevel: 'CRITICAL',
      },
    });

    const adminUser = await User.findOne({ email: 'admin@vssp.local' });
    if (!adminUser) {
      throw new Error('Admin user admin@vssp.local not found');
    }

    createdProbeNotif = await NotificationLog.create({
      alert: createdProbeAlert._id,
      alertCode: createdProbeAlert.alertCode,
      severity: createdProbeAlert.severity,
      escalationLevel: 2,
      channel: 'IN_APP',
      recipientKey: `USER:${adminUser._id}`,
      recipientUser: adminUser._id,
      recipientRole: 'ADMIN',
      recipientContact: 'a***n@vssp.local',
      recipientName: adminUser.name,
      title: `ESCALATION [L2]: ${createdProbeAlert.alertCode} Overdue`,
      message: 'CRITICAL alert escalated to Level 2. Response required immediately.',
      deliveryStatus: 'DELIVERED_IN_APP',
      dispatchedAt: new Date(),
      retryCount: 0,
      isRead: false,
    });

    console.log(`  - Seeded probe alert (${createdProbeAlert._id}) at Level 2 with in-app notification`);

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
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();

    // ------------------------------------------------------------------
    // TEST 1: Login Flow
    // ------------------------------------------------------------------
    console.log('\n[Test 1] Logging in as ADMIN...');
    await page.goto(`http://localhost:${FRONTEND_PORT}/login`);
    await page.fill('#email', 'admin@vssp.local');
    await page.fill('#password', 'AdminSecurePass@2026!');
    await page.click('button[type="submit"]');

    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 8000 });
    assert(!page.url().includes('/login'), 'Authenticated navigation redirected away from /login successfully');

    // ------------------------------------------------------------------
    // TEST 2: Notification Bell in Topbar
    // ------------------------------------------------------------------
    console.log('\n[Test 2] Verifying Notification Bell in Topbar...');
    const bellButton = page.locator('button[aria-label="View notifications"]');
    await bellButton.waitFor({ state: 'visible', timeout: 5000 });
    assert(await bellButton.isVisible(), 'Notification Bell is rendered in Topbar');

    // Unread count badge
    const badge = page.locator('button[aria-label="View notifications"] span.bg-rose-600');
    await badge.waitFor({ state: 'visible', timeout: 5000 });
    const badgeVisible = await badge.isVisible();
    assert(badgeVisible, 'Notification unread counter badge is visible');

    // Click bell to open dropdown panel
    await bellButton.click();
    const dropdown = page.locator('h3:has-text("Notifications")');
    await dropdown.waitFor({ state: 'visible', timeout: 3000 });
    assert(await dropdown.isVisible(), 'Notification dropdown panel opens on click');

    // Check notification content
    const notifItem = page.locator('text=ESCALATION');
    await notifItem.first().waitFor({ state: 'visible', timeout: 5000 });
    assert(await notifItem.first().isVisible(), 'Escalation notification is rendered in panel');

    const bellScreenshotPath = path.join(ARTIFACTS_DIR, 'batch3_notification_bell.png');
    await page.screenshot({ path: bellScreenshotPath });
    console.log(`  - Screenshot saved: ${bellScreenshotPath}`);

    // Close dropdown
    await bellButton.click();

    // ------------------------------------------------------------------
    // TEST 3: Alerts Page & Escalation Level Filter
    // ------------------------------------------------------------------
    console.log('\n[Test 3] Verifying Alerts Page Escalation Filter & Table...');
    await page.goto(`http://localhost:${FRONTEND_PORT}/alerts`);
    await page.waitForSelector('table', { timeout: 5000 });

    // Verify Escalation Level filter select
    const escalationFilter = page.locator('[data-testid="escalation-filter-select"]');
    await escalationFilter.waitFor({ state: 'visible', timeout: 5000 });
    assert(await escalationFilter.isVisible(), 'Escalation Level filter select exists on Alerts Page');

    // Verify filter options
    const options = await escalationFilter.locator('option').allTextContents();
    assert(options.includes('All Levels'), 'Filter contains "All Levels"');
    assert(options.includes('L1 Normal'), 'Filter contains "L1 Normal"');
    assert(options.includes('L2 Supervisor'), 'Filter contains "L2 Supervisor"');
    assert(options.includes('L3 Critical'), 'Filter contains "L3 Critical"');

    // Verify Escalation column in table header
    const tableHeader = page.locator('thead');
    const headerText = await tableHeader.innerText();
    assert(headerText.includes('Escalation') || headerText.includes('ESCALATION'), 'Table header includes Escalation column');

    // Filter by Level 2
    await escalationFilter.selectOption('2');
    await page.waitForTimeout(600);

    const alertsScreenshotPath = path.join(ARTIFACTS_DIR, 'batch3_alerts_table.png');
    await page.screenshot({ path: alertsScreenshotPath });
    console.log(`  - Screenshot saved: ${alertsScreenshotPath}`);

    // ------------------------------------------------------------------
    // TEST 4: Alert Detail Modal & Escalation Timeline
    // ------------------------------------------------------------------
    console.log('\n[Test 4] Verifying Alert Detail Modal Tabs & Escalation Timeline...');
    // Click on visible Inspect button of the first alert
    const inspectBtn = page.locator('button:visible:has-text("Inspect")').first();
    await inspectBtn.waitFor({ state: 'visible', timeout: 5000 });
    await inspectBtn.click();

    // Wait for modal
    const modal = page.getByRole('dialog');
    await modal.waitFor({ state: 'visible', timeout: 5000 });
    assert(await modal.isVisible(), 'Alert Detail Modal opens when Inspect clicked');

    // Verify SLA Escalation Milestone Timeline card
    const timelineHeading = page.locator('text=SLA Escalation Timeline');
    await timelineHeading.waitFor({ state: 'visible', timeout: 5000 });
    assert(await timelineHeading.isVisible(), 'SLA Escalation Timeline card is rendered');

    // Verify tabs
    const overviewTab = page.locator('button:has-text("Incident Overview")');
    const notifsTab = page.locator('button:has-text("Notification")');
    assert(await overviewTab.isVisible(), '"Incident Overview" tab is rendered');
    assert(await notifsTab.isVisible(), '"Notification & Dispatch Logs" tab is rendered');

    const modalOverviewPath = path.join(ARTIFACTS_DIR, 'batch3_alert_modal_overview.png');
    await page.screenshot({ path: modalOverviewPath });
    console.log(`  - Screenshot saved: ${modalOverviewPath}`);

    // Switch to Notification Logs tab
    await notifsTab.click();
    await page.waitForTimeout(500);

    // Verify notification logs content or empty state
    const notifLogSection = page.locator('text=Audited notification dispatch records');
    await notifLogSection.waitFor({ state: 'visible', timeout: 5000 });
    assert(await notifLogSection.isVisible(), 'Notification logs tab displays delivery section');

    const modalNotifsPath = path.join(ARTIFACTS_DIR, 'batch3_alert_modal_notifications.png');
    await page.screenshot({ path: modalNotifsPath });
    console.log(`  - Screenshot saved: ${modalNotifsPath}`);

    // Close modal
    const dismissBtn = page.locator('button:has-text("Dismiss")');
    if (await dismissBtn.isVisible()) {
      await dismissBtn.click();
    } else {
      const closeBtn = page.locator('button:has(svg.lucide-x)');
      if (await closeBtn.isVisible()) await closeBtn.click();
    }

    // ------------------------------------------------------------------
    // TEST 5: Mobile Viewport (375x667)
    // ------------------------------------------------------------------
    console.log('\n[Test 5] Testing Mobile Responsiveness (375x667)...');
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(600);

    // Check mobile card view
    const mobileCards = page.locator('div.lg\\:hidden div[data-testid^="alert-card-"]');
    await mobileCards.first().waitFor({ state: 'visible', timeout: 5000 });
    assert(await mobileCards.first().isVisible(), 'Mobile alert cards rendered cleanly');

    const mobileScreenshotPath = path.join(ARTIFACTS_DIR, 'batch3_mobile_375.png');
    await page.screenshot({ path: mobileScreenshotPath });
    console.log(`  - Screenshot saved: ${mobileScreenshotPath}`);

    console.log('\n========================================================');
    console.log(`  BATCH 3 E2E SUITE RESULTS: ${passedTests}/${totalTests} CHECKS PASSED`);
    console.log('========================================================\n');

  } catch (err) {
    console.error('Error during E2E verification:', err);
    throw err;
  } finally {
    // Teardown
    console.log('[Teardown] Cleaning test probe records and shutting down servers...');
    try {
      if (createdProbeAlert) {
        await Alert.deleteOne({ _id: createdProbeAlert._id });
      }
      if (createdProbeNotif) {
        await NotificationLog.deleteOne({ _id: createdProbeNotif._id });
      }
    } catch (e) {
      console.warn('Probe cleanup warning:', e.message);
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

runBatch3E2E().catch((e) => {
  console.error(e);
  process.exit(1);
});
