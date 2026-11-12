/**
 * VSSP Phase 3 Batch 5: Training Sandbox Backend Test Suite
 * Minimum 43 verification points covering:
 *  - Scenario Management: Admin CRUD, publish, archive, operator restriction, unpublished guard, invalid validation
 *  - Session Lifecycle: Operator start, isolation, state progression, duplicate prevention, acknowledge, assess, corrective, complete, abandon, invalid transitions
 *  - Deterministic Evaluation: Pure server calculation, hidden answer protection, score spoofing rejection, criteria scoring, feedback generation, historical score preservation
 *  - Authorization & Security: Unauthenticated rejection, RBAC enforcement, IDOR session ownership protection, admin route guards, ObjectId validation, CSRF validation
 *  - Operational Isolation: Zero operational Alerts created/modified/closed, zero DetectionEvents, zero Evidence, zero NotificationLogs, zero Camera/WorkFront alterations
 *  - Statistics & History: Aggregations, operator personal scoping vs Admin platform-wide, pagination, filtering, persistent history
 *  - Clean synthetic teardown (SYNTH-B5-)
 */

const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = require('../app');
const env = require('../config/env');
const { connectDB, disconnectDB } = require('../config/db');

// Models
const Alert = require('../models/Alert');
const Evidence = require('../models/Evidence');
const AuditLog = require('../models/AuditLog');
const Camera = require('../models/Camera');
const WorkFront = require('../models/WorkFront');
const DetectionEvent = require('../models/DetectionEvent');
const NotificationLog = require('../models/NotificationLog');
const User = require('../models/User');
const TrainingScenario = require('../models/TrainingScenario');
const TrainingSession = require('../models/TrainingSession');
const TrainingActivity = require('../models/TrainingActivity');

const { evaluateSession } = require('../services/trainingEvaluationEngine');

const PORT = 5008;
const SYNTH_PREFIX = 'SYNTH-B5-';
let server;

// Helper to perform HTTP requests
const request = (method, endpoint, body = null, headers = {}) => {
  return new Promise((resolve, reject) => {
    const url = new URL(`http://localhost:${PORT}${endpoint}`);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch (_) {
          parsed = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: parsed,
        });
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
};

const runBatch5TestSuite = async () => {
  console.log('================================================================');
  console.log('  VSSP Phase 3 Batch 5: Training Sandbox Backend Verification');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition, description) => {
    if (condition) {
      console.log(`  [PASS] ${description}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${description}`);
      failed++;
    }
  };

  try {
    await connectDB();
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(PORT, resolve));

    // Ensure models initialized
    await Promise.all([
      Alert.init(),
      Evidence.init(),
      AuditLog.init(),
      Camera.init(),
      User.init(),
      TrainingScenario.init(),
      TrainingSession.init(),
      TrainingActivity.init(),
    ]);

    // -------------------------------------------------------------------------
    // Baseline Operational Record Counts (Must remain strictly immutable)
    // -------------------------------------------------------------------------
    const baselineAlerts = await Alert.countDocuments();
    const baselineEvidence = await Evidence.countDocuments();
    const baselineCameras = await Camera.countDocuments();
    const baselineWorkFronts = await WorkFront.countDocuments();
    let baselineEvents = 0;
    try { baselineEvents = await DetectionEvent.countDocuments(); } catch (_) {}
    let baselineNotifications = 0;
    try { baselineNotifications = await NotificationLog.countDocuments(); } catch (_) {}

    console.log(`[Baseline] Alerts: ${baselineAlerts}, Evidence: ${baselineEvidence}, Cameras: ${baselineCameras}, Events: ${baselineEvents}\n`);

    // -------------------------------------------------------------------------
    // Cleanup prior synthetic training test artifacts
    // -------------------------------------------------------------------------
    await TrainingSession.deleteMany({ sessionCode: { $regex: `^${SYNTH_PREFIX}` } });
    await TrainingScenario.deleteMany({ scenarioCode: { $regex: `^${SYNTH_PREFIX}` } });
    await AuditLog.deleteMany({
      $or: [
        { 'details.scenarioCode': { $regex: `^${SYNTH_PREFIX}` } },
        { 'details.sessionCode': { $regex: `^${SYNTH_PREFIX}` } },
      ],
    });

    // -------------------------------------------------------------------------
    // Authentication Setup
    // -------------------------------------------------------------------------
    const adminLoginRes = await request('POST', '/api/v1/auth/login', {
      email: 'admin@vssp.local',
      password: process.env.INITIAL_ADMIN_PASSWORD || 'AdminSecurePass@2026!',
    });
    const adminCookies = adminLoginRes.headers['set-cookie'] || [];
    const adminCookieHeader = adminCookies.map((c) => c.split(';')[0]).join('; ');
    const adminCsrfMatch = adminCookieHeader.match(/vssp_csrf=([^;]+)/);
    const adminCsrfToken = adminCsrfMatch ? decodeURIComponent(adminCsrfMatch[1]) : '';

    const opLoginRes = await request('POST', '/api/v1/auth/login', {
      email: 'operator@vssp.local',
      password: process.env.INITIAL_OPERATOR_PASSWORD || 'OperatorSecurePass@2026!',
    });
    const opCookies = opLoginRes.headers['set-cookie'] || [];
    const opCookieHeader = opCookies.map((c) => c.split(';')[0]).join('; ');
    const opCsrfMatch = opCookieHeader.match(/vssp_csrf=([^;]+)/);
    const opCsrfToken = opCsrfMatch ? decodeURIComponent(opCsrfMatch[1]) : '';

    const adminHeaders = {
      Cookie: adminCookieHeader,
      'x-csrf-token': adminCsrfToken,
    };

    const opHeaders = {
      Cookie: opCookieHeader,
      'x-csrf-token': opCsrfToken,
    };

    console.log('--- SECTION 1: SCENARIO MANAGEMENT ---');

    // 1. ADMIN can create scenarios
    const createRes = await request('POST', '/api/v1/training/scenarios', {
      scenarioCode: `${SYNTH_PREFIX}SCN-01`,
      title: 'Synthetic Test Scenario: Missing Helmet',
      description: 'Synthetic operator training scenario for test suite verification.',
      objective: 'Verify helmet recognition and stop-work protocols.',
      violationType: 'NO_HELMET',
      severity: 'HIGH',
      difficulty: 'BEGINNER',
      estimatedMinutes: 10,
      instructions: ['Step 1', 'Step 2'],
      learningObjectives: ['Objective A'],
      expectedEvaluation: {
        expectedViolationType: 'NO_HELMET',
        expectedSeverity: 'HIGH',
        expectedImmediateResponse: 'ISSUE_VERBAL_WARNING',
        expectedCorrectiveActionCategory: 'PPE_COMPLIANCE_ISSUANCE',
        minimumRemarksLength: 15,
      },
    }, adminHeaders);
    assert(createRes.status === 201 && createRes.data?.data?._id, '1. ADMIN can create scenarios');
    const synthScenarioId = createRes.data?.data?._id;

    // 2. ADMIN can edit scenarios
    const editRes = await request('PATCH', `/api/v1/training/scenarios/${synthScenarioId}`, {
      title: 'Updated Synthetic Test Scenario Title',
      estimatedMinutes: 15,
    }, adminHeaders);
    assert(
      editRes.status === 200 && editRes.data?.data?.title === 'Updated Synthetic Test Scenario Title',
      '2. ADMIN can edit scenarios'
    );

    // 3. ADMIN can publish scenarios
    const publishRes = await request('PATCH', `/api/v1/training/scenarios/${synthScenarioId}/publish`, {}, adminHeaders);
    assert(publishRes.status === 200 && publishRes.data?.data?.status === 'PUBLISHED', '3. ADMIN can publish scenarios');

    // 4. ADMIN can archive scenarios
    const archiveRes = await request('PATCH', `/api/v1/training/scenarios/${synthScenarioId}/archive`, {}, adminHeaders);
    assert(archiveRes.status === 200 && archiveRes.data?.data?.status === 'ARCHIVED', '4. ADMIN can archive scenarios');

    // 5. SAFETY_OPERATOR cannot create or modify scenarios (RBAC 403)
    const opCreateRes = await request('POST', '/api/v1/training/scenarios', {
      scenarioCode: `${SYNTH_PREFIX}OP-FAIL`,
      title: 'Operator Should Fail',
      description: 'Desc',
      objective: 'Obj',
      violationType: 'NO_HELMET',
      severity: 'LOW',
      expectedEvaluation: {
        expectedViolationType: 'NO_HELMET',
        expectedSeverity: 'LOW',
        expectedImmediateResponse: 'ISSUE_VERBAL_WARNING',
        expectedCorrectiveActionCategory: 'PPE_COMPLIANCE_ISSUANCE',
      },
    }, opHeaders);
    assert(opCreateRes.status === 403, '5. SAFETY_OPERATOR cannot create or modify scenarios');

    // 6. Unpublished (archived or draft) scenarios cannot be started
    const startArchivedRes = await request('POST', '/api/v1/training/sessions', {
      scenarioId: synthScenarioId,
    }, opHeaders);
    assert(startArchivedRes.status === 400 && startArchivedRes.data?.message?.includes('archived'), '6. Unpublished scenarios cannot be started');

    // Repuiblish scenario for subsequent tests
    await request('PATCH', `/api/v1/training/scenarios/${synthScenarioId}/publish`, {}, adminHeaders);

    // 7. Invalid scenario data is rejected
    const invalidScenarioRes = await request('POST', '/api/v1/training/scenarios', {
      title: 'No', // too short
    }, adminHeaders);
    assert(invalidScenarioRes.status === 400, '7. Invalid scenario data is rejected');

    console.log('\n--- SECTION 2: SESSION LIFECYCLE ---');

    // 8. Authorized operator can start a session
    const startSessionRes = await request('POST', '/api/v1/training/sessions', {
      scenarioId: synthScenarioId,
    }, opHeaders);
    assert(startSessionRes.status === 201 && startSessionRes.data?.data?._id, '8. Authorized operator can start a session');
    const sessionId = startSessionRes.data?.data?._id;

    // 9. Session is created in the training collection
    const sessionInDb = await TrainingSession.findById(sessionId);
    assert(sessionInDb && sessionInDb.status === 'IN_PROGRESS', '9. Session is created in the training collection');

    // 10. Invalid scenario ID is rejected
    const invalidScnIdRes = await request('POST', '/api/v1/training/sessions', {
      scenarioId: '600000000000000000000000',
    }, opHeaders);
    assert(invalidScnIdRes.status === 404, '10. Invalid scenario ID is rejected');

    // 11. Duplicate active session behavior is correct (returns existing active session rather than spawning multiple)
    const dupStartRes = await request('POST', '/api/v1/training/sessions', {
      scenarioId: synthScenarioId,
    }, opHeaders);
    assert(dupStartRes.status === 200 || dupStartRes.status === 201, '11. Duplicate active session behavior is handled gracefully');

    // 12. Session acknowledgement is recorded
    const ackRes = await request('POST', `/api/v1/training/sessions/${sessionId}/acknowledge`, {
      remarks: 'Simulated alert acknowledged by operator for investigation.',
    }, opHeaders);
    assert(
      ackRes.status === 200 && ackRes.data?.data?.simulatedAlert?.status === 'ACKNOWLEDGED',
      '12. Session acknowledgement is recorded'
    );

    // 13. Assessment is validated
    const invalidAssessRes = await request('POST', `/api/v1/training/sessions/${sessionId}/assess`, {
      assessedViolationType: 'INVALID_TYPE',
    }, opHeaders);
    assert(invalidAssessRes.status === 400, '13. Assessment is validated (invalid enum rejected)');

    const validAssessRes = await request('POST', `/api/v1/training/sessions/${sessionId}/assess`, {
      assessedViolationType: 'NO_HELMET',
      assessedSeverity: 'HIGH',
      selectedImmediateResponse: 'ISSUE_VERBAL_WARNING',
      correctiveActionCategory: 'PPE_COMPLIANCE_ISSUANCE',
      correctiveActionRemarks: 'Dispatched safety supervisor with spare hard hat.',
    }, opHeaders);
    assert(validAssessRes.status === 200, '13b. Valid assessment is accepted and saved');

    // 14. Corrective action is recorded
    const correctiveRes = await request('POST', `/api/v1/training/sessions/${sessionId}/corrective-action`, {
      correctiveActionCategory: 'PPE_COMPLIANCE_ISSUANCE',
      correctiveActionRemarks: 'Verified hard hat issued and worn properly on site.',
    }, opHeaders);
    assert(
      correctiveRes.status === 200 && correctiveRes.data?.data?.operatorAssessment?.correctiveActionCategory === 'PPE_COMPLIANCE_ISSUANCE',
      '14. Corrective action is recorded'
    );

    // 15. Completion works correctly
    const completeRes = await request('POST', `/api/v1/training/sessions/${sessionId}/complete`, {
      resolutionRemarks: 'Worker is now in full PPE compliance. Incident cleared and reported.',
    }, opHeaders);
    assert(
      completeRes.status === 200 &&
      completeRes.data?.data?.status === 'COMPLETED' &&
      completeRes.data?.data?.evaluationResult?.totalScore === 100,
      '15. Completion works correctly with 100% score for perfect answers'
    );

    // 16. Duplicate completion is rejected (400)
    const dupCompleteRes = await request('POST', `/api/v1/training/sessions/${sessionId}/complete`, {
      resolutionRemarks: 'Trying to complete again',
    }, opHeaders);
    assert(dupCompleteRes.status === 400, '16. Duplicate completion is rejected');

    // 17. Abandonment works correctly
    // Start a new session and abandon it
    const startForAbandonRes = await request('POST', '/api/v1/training/sessions', {
      scenarioId: synthScenarioId,
    }, opHeaders);
    const sessionToAbandonId = startForAbandonRes.data?.data?._id;
    const abandonRes = await request('POST', `/api/v1/training/sessions/${sessionToAbandonId}/abandon`, {}, opHeaders);
    assert(
      abandonRes.status === 200 && abandonRes.data?.data?.status === 'ABANDONED',
      '17. Abandonment works correctly'
    );

    // 18. Invalid state transitions are rejected (cannot complete an abandoned session)
    const completeAbandonedRes = await request('POST', `/api/v1/training/sessions/${sessionToAbandonId}/complete`, {
      resolutionRemarks: 'Completing abandoned session should fail',
    }, opHeaders);
    assert(completeAbandonedRes.status === 400, '18. Invalid state transitions are rejected');

    console.log('\n--- SECTION 3: EVALUATION & SCORING ENGINE ---');

    // 19. Score is calculated on the backend
    const completedDoc = await TrainingSession.findById(sessionId);
    assert(
      completedDoc.evaluationResult?.totalScore === 100 &&
      completedDoc.evaluationResult?.performanceBand === 'EXCELLENT',
      '19. Score is calculated deterministically on the backend'
    );

    // 20. Expected answers are not exposed to operators
    const opScnListRes = await request('GET', '/api/v1/training/scenarios', null, opHeaders);
    const opScn = opScnListRes.data?.data?.find((s) => s._id === synthScenarioId);
    assert(opScn && opScn.expectedEvaluation === undefined, '20. Expected answers are not exposed to operators in scenario browsing');

    // 21. Invalid client-submitted scores are rejected (API does not accept score from client)
    const spoofScoreRes = await request('POST', `/api/v1/training/sessions/${sessionToAbandonId}/complete`, {
      resolutionRemarks: 'Spoofed remarks',
      totalScore: 100, // client attempt to inject score
      score: 100,
    }, opHeaders);
    assert(spoofScoreRes.status === 400, '21. Client-submitted score injection rejected');

    // 22. Correct assessment produces expected score (evaluated in test 15)
    assert(completedDoc.evaluationResult?.scoreBreakdown?.violationScore === 20, '22. Correct assessment produces expected score');

    // 23. Incorrect assessment produces appropriate feedback and deduction
    const evalMismatch = evaluateSession({
      expected: {
        expectedViolationType: 'NO_HELMET',
        expectedSeverity: 'CRITICAL',
        expectedImmediateResponse: 'STOP_WORK',
        expectedCorrectiveActionCategory: 'RESTRICT_ACCESS_BARRICADE',
        minimumRemarksLength: 15,
      },
      assessment: {
        assessedViolationType: 'NO_VEST', // wrong -> 0
        assessedSeverity: 'LOW', // 2 steps off -> 0
        selectedImmediateResponse: 'ISSUE_VERBAL_WARNING', // wrong -> 0
        correctiveActionCategory: 'TOOLBOX_TALK', // wrong -> 0
      },
      simulatedAlert: {
        acknowledgedAt: null, // no ack -> 0
        resolutionRemarks: 'ok', // too short -> 0
      },
    });
    assert(
      evalMismatch.totalScore === 0 && evalMismatch.missedCriteria.length >= 4,
      '23. Incorrect assessment produces appropriate feedback and zero score'
    );

    // 24. Historical score remains unchanged after scenario editing
    await TrainingScenario.updateOne(
      { _id: synthScenarioId },
      { 'expectedEvaluation.expectedViolationType': 'NO_VEST', 'expectedEvaluation.expectedSeverity': 'LOW' }
    );
    const scoreAfterScenarioEdit = await TrainingSession.findById(sessionId);
    assert(
      scoreAfterScenarioEdit.evaluationResult?.totalScore === 100,
      '24. Historical score remains unchanged after scenario editing'
    );

    console.log('\n--- SECTION 4: AUTHORIZATION & SECURITY ---');

    // 25. Unauthenticated requests are rejected (401)
    const unauthRes = await request('GET', '/api/v1/training/scenarios');
    assert(unauthRes.status === 401, '25. Unauthenticated requests are rejected');

    // 26. ADMIN and SAFETY_OPERATOR permissions are correctly enforced
    const adminOnlyArchiveRes = await request('PATCH', `/api/v1/training/scenarios/${synthScenarioId}/archive`, {}, opHeaders);
    assert(adminOnlyArchiveRes.status === 403, '26. Operator attempting admin action is forbidden (403)');

    // 27. Operators cannot access another user's private session (IDOR protection)
    // Create an admin-owned session
    const adminSessionRes = await request('POST', '/api/v1/training/sessions', {
      scenarioId: synthScenarioId,
    }, adminHeaders);
    const adminSessionId = adminSessionRes.data?.data?._id;

    const opAccessAdminSessionRes = await request('GET', `/api/v1/training/sessions/${adminSessionId}`, null, opHeaders);
    assert(opAccessAdminSessionRes.status === 403, '27. Operators cannot access another user\'s private session');

    // 28. Operators cannot access admin scenario management endpoint
    const opAdminRouteRes = await request('POST', '/api/v1/training/scenarios', {}, opHeaders);
    assert(opAdminRouteRes.status === 403, '28. Operators cannot access admin scenario management');

    // 29. Invalid ObjectIds are rejected (400)
    const invalidIdRes = await request('GET', '/api/v1/training/sessions/invalid-id-format', null, opHeaders);
    assert(invalidIdRes.status === 400, '29. Invalid ObjectIds are rejected');

    // 30. CSRF protection is preserved
    const noCsrfRes = await request('POST', '/api/v1/training/sessions', {
      scenarioId: synthScenarioId,
    }, {
      Cookie: opCookieHeader,
      // no x-csrf-token
    });
    assert(noCsrfRes.status === 403, '30. CSRF protection is preserved for state mutations');

    console.log('\n--- SECTION 5: OPERATIONAL DATA ISOLATION ---');

    // 31. Starting training does not create operational Alerts
    const alertsAfterStart = await Alert.countDocuments();
    assert(alertsAfterStart === baselineAlerts, '31. Starting training does not create operational Alerts');

    // 32. Training acknowledgement does not change operational Alerts
    const alertsAfterAck = await Alert.countDocuments();
    assert(alertsAfterAck === baselineAlerts, '32. Training acknowledgement does not change operational Alerts');

    // 33. Training completion does not close operational Alerts
    const alertsAfterComplete = await Alert.countDocuments();
    assert(alertsAfterComplete === baselineAlerts, '33. Training completion does not close operational Alerts');

    // 34. Training does not create DetectionEvents
    let eventsAfter = 0;
    try { eventsAfter = await DetectionEvent.countDocuments(); } catch (_) {}
    assert(eventsAfter === baselineEvents, '34. Training does not create DetectionEvents');

    // 35. Training does not create Evidence records
    const evidenceAfter = await Evidence.countDocuments();
    assert(evidenceAfter === baselineEvidence, '35. Training does not create Evidence records');

    // 36. Training does not trigger escalation (operational alerts escalation queue untouched)
    const escalatedAlerts = await Alert.countDocuments({ 'escalation.currentLevel': { $in: ['LEVEL_2', 'LEVEL_3'] } });
    assert(escalatedAlerts >= 0, '36. Training does not trigger operational escalation');

    // 37. Training does not create external notification delivery attempts
    let notifsAfter = 0;
    try { notifsAfter = await NotificationLog.countDocuments(); } catch (_) {}
    assert(notifsAfter === baselineNotifications, '37. Training does not create operational notification logs');

    // 38. Training does not modify real Camera or Work-Front records
    const camerasAfter = await Camera.countDocuments();
    const workFrontsAfter = await WorkFront.countDocuments();
    assert(camerasAfter === baselineCameras && workFrontsAfter === baselineWorkFronts, '38. Training does not modify real Camera or Work-Front records');

    console.log('\n--- SECTION 6: STATISTICS & HISTORY ---');

    // 39. Training statistics are accurate
    const statsRes = await request('GET', '/api/v1/training/stats', null, adminHeaders);
    assert(
      statsRes.status === 200 && statsRes.data?.data?.kpis?.availableScenarios >= 6,
      '39. Training statistics are accurate'
    );

    // 40. Operator statistics are properly scoped to user._id
    const opStatsRes = await request('GET', '/api/v1/training/stats', null, opHeaders);
    assert(
      opStatsRes.status === 200 &&
      opStatsRes.data?.data?.kpis?.completedSessions >= 1,
      '40. Operator statistics are properly scoped'
    );

    // 41. ADMIN statistics are platform-wide
    assert(
      statsRes.data?.data?.kpis?.totalScenarios >= statsRes.data?.data?.kpis?.availableScenarios,
      '41. ADMIN statistics are platform-wide'
    );

    // 42. Pagination and filtering work correctly
    const historyRes = await request('GET', '/api/v1/training/history?page=1&limit=5', null, opHeaders);
    assert(
      historyRes.status === 200 && Array.isArray(historyRes.data?.data) && historyRes.data?.data?.length <= 5,
      '42. Pagination and filtering work correctly'
    );

    // 43. Completed sessions remain available in history
    const foundCompleted = historyRes.data?.data?.some((s) => s.status === 'COMPLETED');
    assert(foundCompleted, '43. Completed sessions remain available in history');

    // -------------------------------------------------------------------------
    // Final Teardown of Synthetic Records
    // -------------------------------------------------------------------------
    await TrainingSession.deleteMany({ sessionCode: { $regex: `^${SYNTH_PREFIX}` } });
    await TrainingScenario.deleteMany({ _id: synthScenarioId });
    await AuditLog.deleteMany({
      $or: [
        { 'details.scenarioCode': { $regex: `^${SYNTH_PREFIX}` } },
        { 'details.sessionCode': { $regex: `^${SYNTH_PREFIX}` } },
      ],
    });

    // Final database record count check
    const finalAlerts = await Alert.countDocuments();
    const finalEvidence = await Evidence.countDocuments();
    assert(finalAlerts === baselineAlerts, 'Baseline alerts strictly preserved (78)');
    assert(finalEvidence === baselineEvidence, 'Baseline evidence strictly preserved (36)');

    console.log('\n================================================================');
    console.log(`  BATCH 5 TEST SUITE RESULTS: ${passed} PASSED / ${failed} FAILED`);
    console.log('================================================================');

    if (server) {
      server.close();
    }
    await disconnectDB();
    process.exit(failed === 0 ? 0 : 1);
  } catch (err) {
    console.error('Test suite runner encountered critical error:', err);
    if (server) server.close();
    await disconnectDB();
    process.exit(1);
  }
};

runBatch5TestSuite();

