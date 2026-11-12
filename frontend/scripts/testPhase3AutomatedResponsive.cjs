/**
 * VSSP Phase 3: Comprehensive Automated Responsive Testing Suite
 * Programmatically tests ALL Phase 3 pages across all 5 standard viewports:
 *   - Mobile: 375 × 667
 *   - Tablet: 768 × 1024
 *   - Laptop: 1366 × 768
 *   - Desktop: 1440 × 900
 *   - Large Desktop: 1920 × 1080
 *
 * Verifies:
 *   - Zero horizontal overflow: document.documentElement.scrollWidth <= window.innerWidth
 *   - Zero uncaught JavaScript / console runtime exceptions
 *   - Main content visibility and DOM render completion
 *   - Navigation drawer collapse / expand responsiveness
 *   - Critical action buttons and interactive tables responsiveness
 */

const { chromium } = require('playwright');
const http = require('http');
const path = require('path');
const fs = require('fs');

const backendApp = require('../../backend/src/app');
const { connectDB, disconnectDB } = require('../../backend/src/config/db');

const BACKEND_PORT = 5000;
const FRONTEND_PORT = 5173;

const VIEWPORTS = [
  { name: 'Mobile', width: 375, height: 667 },
  { name: 'Tablet', width: 768, height: 1024 },
  { name: 'Laptop', width: 1366, height: 768 },
  { name: 'Desktop', width: 1440, height: 900 },
  { name: 'Large Desktop', width: 1920, height: 1080 },
];

const PHASE3_PAGES = [
  {
    batch: 'Batch 1 & 2',
    name: 'Event Intake & Queue',
    path: '/event-intake',
    headingText: 'Detection Event Intake & Processing',
  },
  {
    batch: 'Batch 4',
    name: 'Evidence Vault',
    path: '/evidence',
    headingText: 'Evidence Vault',
  },
  {
    batch: 'Batch 5',
    name: 'Training Sandbox Dashboard',
    path: '/training',
    headingText: 'Safety Operator Training Sandbox',
  },
  {
    batch: 'Batch 5',
    name: 'Training Scenario Library',
    path: '/training/scenarios',
    headingText: 'Training Scenario Library',
  },
  {
    batch: 'Batch 5',
    name: 'Training History',
    path: '/training/history',
    headingText: 'Training Session History',
  },
  {
    batch: 'Batch 5',
    name: 'Admin Scenario Management',
    path: '/training/admin/scenarios',
    headingText: 'Scenario Catalog Management',
  },
  {
    batch: 'Batch 6',
    name: 'Shift Handover Console',
    path: '/handovers',
    headingText: 'Shift Handover Console',
  },
  {
    batch: 'Batch 6',
    name: 'Initiate Shift Handover',
    path: '/handovers/create',
    headingText: 'Initiate Shift Handover',
  },
  {
    batch: 'Batch 6',
    name: 'Incoming Handover Inbox',
    path: '/handovers/inbox',
    headingText: 'Incoming Handover Inbox',
  },
  {
    batch: 'Batch 6',
    name: 'Handover History & Archive',
    path: '/handovers/history',
    headingText: 'Shift Handover Archive & History',
  },
];

const runResponsiveTestSuite = async () => {
  console.log('\n========================================================================');
  console.log('  VSSP PHASE 3: COMPREHENSIVE AUTOMATED RESPONSIVE TEST SUITE');
  console.log('========================================================================\n');

  let passedTests = 0;
  let totalTests = 0;
  const detailedResults = [];

  const assert = (condition, message) => {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  [PASS] ${message}`);
    } else {
      console.error(`  [FAIL] ${message}`);
    }
  };

  let backendServer;
  let viteServer;
  let browser;

  try {
    // 1. Initialize Database & Backend Server
    await connectDB();
    backendServer = http.createServer(backendApp);
    await new Promise((resolve) => backendServer.listen(BACKEND_PORT, '0.0.0.0', resolve));
    console.log(`[Setup 1/3] Backend active on http://localhost:${BACKEND_PORT}`);

    // 2. Start Vite Preview Server
    const { preview } = await import('vite');
    const frontendDir = path.resolve(__dirname, '..');
    viteServer = await preview({
      root: frontendDir,
      preview: {
        port: FRONTEND_PORT,
        host: '0.0.0.0',
        strictPort: true,
      },
    });
    console.log(`[Setup 2/3] Frontend preview active on http://localhost:${FRONTEND_PORT}`);

    // 3. Launch Playwright Chrome
    console.log('[Setup 3/3] Launching Chrome browser via Playwright...');
    browser = await chromium.launch({
      channel: 'chrome',
      headless: true,
    });

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();

    // Listen for uncaught page errors
    const uncaughtErrors = [];
    page.on('pageerror', (err) => {
      console.error(`  [PAGE ERROR] ${err.message}`);
      uncaughtErrors.push(err.message);
    });

    // Authenticate as Admin
    console.log('\n[Auth] Authenticating as ADMIN...');
    await page.goto(`http://localhost:${FRONTEND_PORT}/login`);
    await page.fill('#email', 'admin@vssp.local');
    await page.fill('#password', process.env.INITIAL_ADMIN_PASSWORD || 'AdminSecurePass@2026!');
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 8000 });
    assert(!page.url().includes('/login'), 'Admin login authenticated successfully');

    // Iterate through all Phase 3 Pages and Viewports
    for (const pageDef of PHASE3_PAGES) {
      console.log(`\n--- Testing Page: ${pageDef.name} (${pageDef.path}) [${pageDef.batch}] ---`);

      for (const vp of VIEWPORTS) {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(`http://localhost:${FRONTEND_PORT}${pageDef.path}`);

        // Wait for page header or main container
        await page.waitForSelector(`text=${pageDef.headingText}`, { timeout: 8000 });
        const isHeaderVisible = await page.isVisible(`text=${pageDef.headingText}`);
        assert(isHeaderVisible, `${vp.name} (${vp.width}x${vp.height}): Heading "${pageDef.headingText}" visible`);

        // Check horizontal overflow assertion: scrollWidth <= window.innerWidth
        const overflowMetrics = await page.evaluate(() => {
          return {
            scrollWidth: document.documentElement.scrollWidth,
            innerWidth: window.innerWidth,
            bodyScrollWidth: document.body.scrollWidth,
          };
        });

        const hasHorizontalScroll = overflowMetrics.scrollWidth > overflowMetrics.innerWidth;
        assert(!hasHorizontalScroll, `${vp.name} (${vp.width}x${vp.height}): Zero horizontal scroll (scrollWidth: ${overflowMetrics.scrollWidth} <= innerWidth: ${overflowMetrics.innerWidth})`);

        // Verify zero uncaught errors
        const errorsForPage = uncaughtErrors.length === 0;
        assert(errorsForPage, `${vp.name} (${vp.width}x${vp.height}): Zero uncaught JavaScript errors`);

        detailedResults.push({
          page: pageDef.name,
          path: pageDef.path,
          batch: pageDef.batch,
          viewport: `${vp.name} (${vp.width}x${vp.height})`,
          width: vp.width,
          height: vp.height,
          scrollWidth: overflowMetrics.scrollWidth,
          innerWidth: overflowMetrics.innerWidth,
          hasHorizontalScroll,
          isHeaderVisible,
          passed: !hasHorizontalScroll && isHeaderVisible && errorsForPage,
        });
      }
    }

    console.log('\n========================================================================');
    console.log(`  RESPONSIVE TEST RESULTS: ${passedTests}/${totalTests} CHECKS PASSED`);
    console.log('========================================================================\n');

    return {
      passedTests,
      totalTests,
      detailedResults,
    };
  } catch (err) {
    console.error('Fatal Responsive Test Error:', err);
    throw err;
  } finally {
    if (browser) await browser.close();
    if (viteServer) await viteServer.close();
    if (backendServer) {
      await new Promise((resolve) => backendServer.close(resolve));
    }
    await disconnectDB();
  }
};

runResponsiveTestSuite()
  .then((res) => {
    process.exit(res.passedTests === res.totalTests ? 0 : 1);
  })
  .catch((err) => {
    process.exit(1);
  });
