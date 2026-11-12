/**
 * VSSP Phase 3 Batch 6: Shift Handover Backend Test Suite
 * Minimum 65 verification points covering:
 *  - Operational Summary: Live intelligence extraction, candidate alerts, camera issues, active work-fronts
 *  - Draft Management: Creation, validation, updates, unauthorized edit protection, summary refresh
 *  - Handover Submission & Immutability: Status transition, frozen snapshot, immutability enforcement, duplicate rejection
 *  - Incoming Operator Inbox: Filtered inbox retrieval, visibility of submitted handovers
 *  - Incoming Acknowledgement: Role verification, acknowledgement transition, remarks capture, duplicate ack prevention
 *  - Follow-up Management: Creation, status transitions (OPEN, IN_PROGRESS, COMPLETED), isolation from operational alerts
 *  - Handover Completion & Cancellation: Lifecycle completion, draft cancellation with reasons, state guard enforcement
 *  - Dual-scoped Dashboard & History: Admin platform-wide KPIs, Operator scoped KPIs, server-side pagination, filters
 *  - Audit Logging: Verification of all 9 HANDOVER_* audit action enums
 *  - Operational Data Isolation: 0 operational Alerts modified, 0 Evidence touched, 0 DetectionEvents altered
 *  - Clean synthetic teardown (SYNTH-B6-)
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
const ShiftHandover = require('../models/ShiftHandover');
const HandoverActivity = require('../models/HandoverActivity');

const PORT = 5009;
const SYNTH_PREFIX = 'SYNTH-B6-';
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

const runBatch6TestSuite = async () => {
  console.log('================================================================');
  console.log('  VSSP Phase 3 Batch 6: Shift Handover Backend Verification');
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
      WorkFront.init(),
      User.init(),
      ShiftHandover.init(),
      HandoverActivity.init(),
    ]);

    // -------------------------------------------------------------------------
    // Baseline Operational Record Counts (Must remain strictly immutable)
    // -------------------------------------------------------------------------
    const testStartTime = new Date();
    const baselineAlerts = await Alert.countDocuments();
    const baselineEvidence = await Evidence.countDocuments();
    const baselineCameras = await Camera.countDocuments();
    const baselineWorkFronts = await WorkFront.countDocuments();
    let baselineEvents = 0;
    try { baselineEvents = await DetectionEvent.countDocuments(); } catch (_) {}
    let baselineNotifications = 0;
    try { baselineNotifications = await NotificationLog.countDocuments(); } catch (_) {}

    console.log(`[Baseline] Alerts: ${baselineAlerts}, Evidence: ${baselineEvidence}, Cameras: ${baselineCameras}, WorkFronts: ${baselineWorkFronts}\n`);

    // -------------------------------------------------------------------------
    // Cleanup prior synthetic handover test artifacts
    // -------------------------------------------------------------------------
    const priorHandovers = await ShiftHandover.find({
      $or: [
        { shiftLabel: { $regex: `^${SYNTH_PREFIX}` } },
        { handoverCode: { $regex: '^SHO-SYNTH' } },
      ],
    }, '_id').lean();
    const priorIds = priorHandovers.map((h) => h._id);

    await HandoverActivity.deleteMany({
      $or: [
        { handover: { $in: priorIds } },
        { 'details.shiftLabel': { $regex: `^${SYNTH_PREFIX}` } },
      ],
    });
    await ShiftHandover.deleteMany({
      $or: [
        { _id: { $in: priorIds } },
        { shiftLabel: { $regex: `^${SYNTH_PREFIX}` } },
        { handoverCode: { $regex: '^SHO-SYNTH' } },
      ],
    });
    await AuditLog.deleteMany({
      $or: [
        { entityId: { $in: priorIds } },
        { 'details.shiftLabel': { $regex: `^${SYNTH_PREFIX}` } },
        { 'details.handoverCode': { $regex: '^SHO-SYNTH' } },
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

    assert(adminLoginRes.status === 200, 'Admin successfully authenticated');
    assert(opLoginRes.status === 200, 'Operator successfully authenticated');
    assert(adminCsrfToken.length > 0, 'Admin CSRF token extracted');
    assert(opCsrfToken.length > 0, 'Operator CSRF token extracted');

    const adminUser = await User.findOne({ email: 'admin@vssp.local' });
    const opUser = await User.findOne({ email: 'operator@vssp.local' });

    // -------------------------------------------------------------------------
    // 1. Operational Intelligence Collection Endpoint
    // -------------------------------------------------------------------------
    console.log('\n--- Test Group 1: Automated Operational Information Collection Engine ---');
    const summaryRes = await request('GET', '/api/v1/handovers/operational-summary', null, opHeaders);
    assert(summaryRes.status === 200, 'GET /handovers/operational-summary returns 200 OK');
    assert(summaryRes.data?.success === true, 'Operational summary returns success envelope');
    assert(typeof summaryRes.data?.data?.operationalSummary?.pendingAlertsCount === 'number', 'Summary contains pendingAlertsCount');
    assert(typeof summaryRes.data?.data?.operationalSummary?.criticalCount === 'number', 'Summary contains criticalCount');
    assert(typeof summaryRes.data?.data?.operationalSummary?.highPriorityCount === 'number', 'Summary contains highPriorityCount');
    assert(typeof summaryRes.data?.data?.operationalSummary?.escalationsCount === 'number', 'Summary contains escalationsCount');
    assert(Array.isArray(summaryRes.data?.data?.candidateIncidents), 'Summary contains candidateIncidents array');
    assert(Array.isArray(summaryRes.data?.data?.cameraIssues), 'Summary contains cameraIssues array');
    assert(Array.isArray(summaryRes.data?.data?.workFrontObservations), 'Summary contains workFrontObservations array');

    // -------------------------------------------------------------------------
    // 2. Draft Handover Creation & Validation
    // -------------------------------------------------------------------------
    console.log('\n--- Test Group 2: Handover Draft Creation & Validation ---');

    // Unauthenticated creation rejected
    const unauthCreate = await request('POST', '/api/v1/handovers', {
      shiftLabel: `${SYNTH_PREFIX}Unauth`,
    });
    assert(unauthCreate.status === 401, 'POST /handovers without auth returns 401 Unauthorized');

    // Missing CSRF token rejected
    const noCsrfCreate = await request('POST', '/api/v1/handovers', {
      shiftLabel: `${SYNTH_PREFIX}NoCsrf`,
    }, { Cookie: opCookieHeader });
    assert(noCsrfCreate.status === 403, 'POST /handovers without CSRF token returns 403 Forbidden');

    // Invalid payload: label too short
    const invalidCreate = await request('POST', '/api/v1/handovers', {
      shiftLabel: 'X',
    }, opHeaders);
    assert(invalidCreate.status === 400, 'POST /handovers with 1-char shiftLabel returns 400 Bad Request');

    // Valid Draft creation by Operator
    const createPayload = {
      shiftDate: new Date().toISOString(),
      shiftType: 'DAY',
      shiftLabel: `${SYNTH_PREFIX}Morning Shift Handover`,
      outgoingRemarks: 'Routine safety surveillance completed. Sector 2 scaffolding requires inspection.',
      manualNotes: [
        {
          category: 'SAFETY_OBSERVATION',
          priority: 'HIGH',
          note: 'Ensure workers wearing chin straps on Sector 4 elevated platform.',
        },
        {
          category: 'EQUIPMENT_HOLD',
          priority: 'MEDIUM',
          note: 'Camera CAM-03 power adapter replaced; monitoring for flickering.',
        },
      ],
    };

    const draftCreateRes = await request('POST', '/api/v1/handovers', createPayload, opHeaders);
    assert(draftCreateRes.status === 201, 'POST /handovers by Operator returns 201 Created');
    assert(draftCreateRes.data?.success === true, 'Draft creation returns success envelope');
    const createdHandover = draftCreateRes.data?.data;
    assert(createdHandover?.status === 'DRAFT', 'Created handover has status DRAFT');
    assert(createdHandover?.handoverCode?.startsWith('SHO-'), 'Handover code begins with SHO-');
    assert(createdHandover?.shiftLabel === createPayload.shiftLabel, 'Shift label matches payload');
    assert(createdHandover?.shiftType === 'DAY', 'Shift type matches DAY');
    assert(createdHandover?.manualNotes?.length === 2, '2 manual notes attached to draft');
    assert(createdHandover?.outgoingOperator?.toString() === opUser._id.toString(), 'Outgoing operator is set to current operator');
    assert(typeof createdHandover?.operationalSummary?.pendingAlertsCount === 'number', 'Draft automatically captured operationalSummary');

    const handoverId = createdHandover._id;

    // Verify AuditLog for creation
    const createAudit = await AuditLog.findOne({
      action: 'HANDOVER_CREATED',
      entityId: handoverId,
    });
    assert(createAudit !== null, 'HANDOVER_CREATED action logged in AuditLog');
    assert(createAudit?.entityType === 'SHIFT_HANDOVER', 'AuditLog entityType is SHIFT_HANDOVER');

    // Verify HandoverActivity for creation
    const createActivity = await HandoverActivity.findOne({
      handover: handoverId,
      action: 'HANDOVER_CREATED',
    });
    assert(createActivity !== null, 'HandoverActivity record CREATED logged');

    // -------------------------------------------------------------------------
    // 3. Draft Handover Updating & Editing
    // -------------------------------------------------------------------------
    console.log('\n--- Test Group 3: Draft Handover Editing & Protection ---');

    // Update draft by author
    const updatePayload = {
      shiftLabel: `${SYNTH_PREFIX}Morning Shift Handover - Updated`,
      outgoingRemarks: 'Updated outgoing remarks: Sector 2 scaffolding verified OK.',
    };
    const updateRes = await request('PATCH', `/api/v1/handovers/${handoverId}`, updatePayload, opHeaders);
    assert(updateRes.status === 200, 'PATCH /handovers/:id by author returns 200 OK');
    assert(updateRes.data?.data?.shiftLabel === updatePayload.shiftLabel, 'Shift label successfully updated');
    assert(updateRes.data?.data?.outgoingRemarks === updatePayload.outgoingRemarks, 'Remarks successfully updated');

    // Verify AuditLog for update
    const updateAudit = await AuditLog.findOne({
      action: 'HANDOVER_UPDATED',
      entityId: handoverId,
    });
    assert(updateAudit !== null, 'HANDOVER_UPDATED action logged in AuditLog');

    // Refresh operational summary on draft
    const refreshRes = await request('POST', `/api/v1/handovers/${handoverId}/refresh-summary`, {}, opHeaders);
    assert(refreshRes.status === 200, 'POST /handovers/:id/refresh-summary returns 200 OK');
    assert(refreshRes.data?.data?.operationalSummary?.collectedAt !== undefined, 'Operational summary refreshed with timestamp');

    // Verify AuditLog for refresh
    const refreshAudit = await AuditLog.findOne({
      action: 'HANDOVER_SUMMARY_REFRESHED',
      entityId: handoverId,
    });
    assert(refreshAudit !== null, 'HANDOVER_SUMMARY_REFRESHED action logged in AuditLog');

    // -------------------------------------------------------------------------
    // 4. Handover Submission & Immutability Enforcement
    // -------------------------------------------------------------------------
    console.log('\n--- Test Group 4: Handover Submission & Immutability ---');

    // Submit draft handover
    const submitRes = await request('POST', `/api/v1/handovers/${handoverId}/submit`, {
      outgoingRemarks: 'Final signoff before shift transfer.',
    }, opHeaders);

    assert(submitRes.status === 200, 'POST /handovers/:id/submit returns 200 OK');
    assert(submitRes.data?.data?.status === 'SUBMITTED', 'Status transitions to SUBMITTED');
    assert(submitRes.data?.data?.submittedAt !== null, 'submittedAt timestamp is recorded');
    assert(submitRes.data?.data?.submittedSnapshot !== null, 'submittedSnapshot is populated');
    assert(submitRes.data?.data?.submittedSnapshot?.outgoingRemarks === 'Final signoff before shift transfer.', 'Snapshot captured final remarks');
    assert(typeof submitRes.data?.data?.submittedSnapshot?.operationalSummary?.pendingAlertsCount === 'number', 'Snapshot captured operational summary');

    // Verify AuditLog for submission
    const submitAudit = await AuditLog.findOne({
      action: 'HANDOVER_SUBMITTED',
      entityId: handoverId,
    });
    assert(submitAudit !== null, 'HANDOVER_SUBMITTED action logged in AuditLog');

    // Immutability Guard: Cannot edit once SUBMITTED
    const mutateAttempt = await request('PATCH', `/api/v1/handovers/${handoverId}`, {
      shiftLabel: 'Tampered Shift Label',
    }, opHeaders);
    assert(mutateAttempt.status === 400, 'Attempt to edit SUBMITTED handover returns 400 Bad Request');

    // Immutability Guard: Cannot refresh summary once SUBMITTED
    const refreshAttempt = await request('POST', `/api/v1/handovers/${handoverId}/refresh-summary`, {}, opHeaders);
    assert(refreshAttempt.status === 400, 'Attempt to refresh summary on SUBMITTED handover returns 400 Bad Request');

    // Duplicate submission rejected
    const dupSubmit = await request('POST', `/api/v1/handovers/${handoverId}/submit`, {}, opHeaders);
    assert(dupSubmit.status === 400, 'Duplicate submission of already SUBMITTED handover returns 400 Bad Request');

    // -------------------------------------------------------------------------
    // 5. Incoming Operator Inbox
    // -------------------------------------------------------------------------
    console.log('\n--- Test Group 5: Incoming Operator Inbox ---');

    const inboxRes = await request('GET', '/api/v1/handovers/inbox', null, adminHeaders);
    assert(inboxRes.status === 200, 'GET /handovers/inbox returns 200 OK');
    assert(Array.isArray(inboxRes.data?.data), 'Inbox returns array of submitted handovers');
    const inInbox = inboxRes.data?.data?.some((h) => h._id.toString() === handoverId.toString());
    assert(inInbox, 'Submitted handover is visible in the incoming inbox');

    // -------------------------------------------------------------------------
    // 6. Incoming Operator Acknowledgement & Claim Controls
    // -------------------------------------------------------------------------
    console.log('\n--- Test Group 6: Incoming Operator Acknowledgement & Claim Controls ---');

    // Outgoing author operator attempting self-acknowledgement is rejected
    const selfAck = await request('POST', `/api/v1/handovers/${handoverId}/acknowledge`, { remarks: 'Self ack' }, opHeaders);
    assert(selfAck.status === 403, 'Outgoing author attempting self-acknowledgement returns 403 Forbidden');

    // Admin acknowledges on behalf of oncoming shift
    const ackPayload = {
      remarks: 'Shift briefing received and verified. Station cameras online.',
    };
    const ackRes = await request('POST', `/api/v1/handovers/${handoverId}/acknowledge`, ackPayload, adminHeaders);
    assert(ackRes.status === 200, 'POST /handovers/:id/acknowledge by Admin returns 200 OK');
    assert(ackRes.data?.data?.status === 'ACKNOWLEDGED', 'Status transitions to ACKNOWLEDGED');
    assert(ackRes.data?.data?.acknowledgement?.acknowledgedAt !== null, 'acknowledgedAt timestamp is recorded');
    assert(ackRes.data?.data?.acknowledgement?.remarks === ackPayload.remarks, 'Acknowledgement remarks recorded');

    // Verify AuditLog for acknowledgement
    const ackAudit = await AuditLog.findOne({
      action: 'HANDOVER_ACKNOWLEDGED',
      entityId: handoverId,
    });
    assert(ackAudit !== null, 'HANDOVER_ACKNOWLEDGED action logged in AuditLog');

    // Duplicate acknowledgement rejected
    const dupAck = await request('POST', `/api/v1/handovers/${handoverId}/acknowledge`, { remarks: 'Repeat' }, adminHeaders);
    assert(dupAck.status === 400, 'Duplicate acknowledgement on ACKNOWLEDGED handover returns 400 Bad Request');

    // Handover no longer in incoming inbox
    const inboxAfterAck = await request('GET', '/api/v1/handovers/inbox', null, adminHeaders);
    const stillInInbox = inboxAfterAck.data?.data?.some((h) => h._id.toString() === handoverId.toString());
    assert(!stillInInbox, 'Acknowledged handover is cleared from the incoming inbox');

    // Atomic Claim Verification on an unassigned submitted handover
    const unassignedDraft = await request('POST', '/api/v1/handovers', {
      shiftLabel: `${SYNTH_PREFIX}Unassigned Handover For Claim`,
      shiftType: 'SWING',
    }, adminHeaders);
    const unassignedId = unassignedDraft.data?.data?._id;
    await request('POST', `/api/v1/handovers/${unassignedId}/submit`, {}, adminHeaders);

    // Operator claims the unassigned handover
    const claimRes = await request('POST', `/api/v1/handovers/${unassignedId}/claim`, {}, opHeaders);
    assert(claimRes.status === 200, 'POST /handovers/:id/claim by oncoming operator returns 200 OK');
    assert(claimRes.data?.data?.incomingOperator?.toString() === opUser._id.toString(), 'Handover incomingOperator assigned to claimant');

    // Operator acknowledges the claimed handover
    const ackClaimed = await request('POST', `/api/v1/handovers/${unassignedId}/acknowledge`, { remarks: 'Claimed and accepted' }, opHeaders);
    assert(ackClaimed.status === 200, 'Oncoming operator acknowledges claimed handover (200 OK)');

    // -------------------------------------------------------------------------
    // 7. Follow-up Action Items Management
    // -------------------------------------------------------------------------
    console.log('\n--- Test Group 7: Follow-up Action Items Tracking ---');

    const fuPayload = {
      description: 'Follow up with Subcontractor A on missing safety harness at tower',
      priority: 'HIGH',
      relatedAlertCode: 'ALT-SYNTH-01',
      remarks: 'Requested by outgoing supervisor',
    };

    const fuCreateRes = await request('POST', `/api/v1/handovers/${handoverId}/follow-ups`, fuPayload, adminHeaders);
    assert(fuCreateRes.status === 201, 'POST /handovers/:id/follow-ups returns 201 Created');
    assert(fuCreateRes.data?.data?.followUps?.length === 1, 'Follow-up array contains 1 item');
    const createdFollowUp = fuCreateRes.data?.data?.followUps[0];
    assert(createdFollowUp?.description === fuPayload.description, 'Follow-up description matches');
    assert(createdFollowUp?.priority === 'HIGH', 'Follow-up priority is HIGH');
    assert(createdFollowUp?.status === 'OPEN', 'Follow-up initial status is OPEN');

    const followUpId = createdFollowUp?._id;

    // Verify AuditLog for follow-up creation
    const fuAudit = await AuditLog.findOne({
      action: 'HANDOVER_FOLLOWUP_CREATED',
      entityId: handoverId,
    });
    assert(fuAudit !== null, 'HANDOVER_FOLLOWUP_CREATED action logged in AuditLog');

    // Transition follow-up status: OPEN -> IN_PROGRESS
    const fuProgRes = await request('PATCH', `/api/v1/handovers/${handoverId}/follow-ups/${followUpId}`, {
      status: 'IN_PROGRESS',
      remarks: 'Contacted Subcontractor supervisor via radio',
    }, adminHeaders);
    assert(fuProgRes.status === 200, 'PATCH /follow-ups/:id to IN_PROGRESS returns 200 OK');
    const updatedFu1 = fuProgRes.data?.data?.followUps?.find((f) => f._id.toString() === followUpId.toString());
    assert(updatedFu1?.status === 'IN_PROGRESS', 'Follow-up status transitioned to IN_PROGRESS');

    // Transition follow-up status: IN_PROGRESS -> COMPLETED
    const fuCompRes = await request('PATCH', `/api/v1/handovers/${handoverId}/follow-ups/${followUpId}`, {
      status: 'COMPLETED',
      remarks: 'Harness issued and verified on camera',
    }, adminHeaders);
    assert(fuCompRes.status === 200, 'PATCH /follow-ups/:id to COMPLETED returns 200 OK');
    const updatedFu2 = fuCompRes.data?.data?.followUps?.find((f) => f._id.toString() === followUpId.toString());
    assert(updatedFu2?.status === 'COMPLETED', 'Follow-up status transitioned to COMPLETED');

    // Verify AuditLog for follow-up update
    const fuUpdateAudit = await AuditLog.findOne({
      action: 'HANDOVER_FOLLOWUP_UPDATED',
      entityId: handoverId,
    });
    assert(fuUpdateAudit !== null, 'HANDOVER_FOLLOWUP_UPDATED action logged in AuditLog');

    // Invalid follow-up ID rejected
    const fakeFuRes = await request('PATCH', `/api/v1/handovers/${handoverId}/follow-ups/507f1f77bcf86cd799439011`, {
      status: 'BLOCKED',
    }, adminHeaders);
    assert(fakeFuRes.status === 404, 'Updating non-existent follow-up returns 404 Not Found');

    // -------------------------------------------------------------------------
    // 8. Handover Completion & Cancellation
    // -------------------------------------------------------------------------
    console.log('\n--- Test Group 8: Handover Completion & Cancellation ---');

    // Complete the acknowledged handover
    const completeRes = await request('POST', `/api/v1/handovers/${handoverId}/complete`, {}, adminHeaders);
    assert(completeRes.status === 200, 'POST /handovers/:id/complete returns 200 OK');
    assert(completeRes.data?.data?.status === 'COMPLETED', 'Status transitions to COMPLETED');
    assert(completeRes.data?.data?.completedAt !== null, 'completedAt timestamp recorded');

    // Verify AuditLog for completion
    const completeAudit = await AuditLog.findOne({
      action: 'HANDOVER_COMPLETED',
      entityId: handoverId,
    });
    assert(completeAudit !== null, 'HANDOVER_COMPLETED action logged in AuditLog');

    // Attempting to cancel COMPLETED handover rejected
    const cancelCompAttempt = await request('POST', `/api/v1/handovers/${handoverId}/cancel`, {
      cancellationReason: 'Invalid cancel',
    }, adminHeaders);
    assert(cancelCompAttempt.status === 400, 'Attempting to cancel COMPLETED handover returns 400 Bad Request');

    // Create a 2nd Draft Handover to test cancellation
    const draft2Res = await request('POST', '/api/v1/handovers', {
      shiftLabel: `${SYNTH_PREFIX}Draft For Cancellation`,
      shiftType: 'NIGHT',
    }, opHeaders);
    const draft2Id = draft2Res.data?.data?._id;
    assert(draft2Res.status === 201, 'Second draft handover created');

    // Cancel without reason rejected
    const cancelNoReason = await request('POST', `/api/v1/handovers/${draft2Id}/cancel`, {}, opHeaders);
    assert(cancelNoReason.status === 400, 'POST /handovers/:id/cancel without cancellationReason returns 400 Bad Request');

    // Cancel with valid reason
    const cancelRes = await request('POST', `/api/v1/handovers/${draft2Id}/cancel`, {
      cancellationReason: 'Shift cancelled due to severe weather conditions',
    }, opHeaders);
    assert(cancelRes.status === 200, 'POST /handovers/:id/cancel with reason returns 200 OK');
    assert(cancelRes.data?.data?.status === 'CANCELLED', 'Status transitions to CANCELLED');
    assert(cancelRes.data?.data?.cancelledAt !== null, 'cancelledAt timestamp recorded');

    // Verify AuditLog for cancellation
    const cancelAudit = await AuditLog.findOne({
      action: 'HANDOVER_CANCELLED',
      entityId: draft2Id,
    });
    assert(cancelAudit !== null, 'HANDOVER_CANCELLED action logged in AuditLog');

    // -------------------------------------------------------------------------
    // 9. Dual-Scoped Dashboard KPIs
    // -------------------------------------------------------------------------
    console.log('\n--- Test Group 9: Dual-Scoped Dashboard KPIs ---');

    // Admin Dashboard (Platform-wide)
    const adminDash = await request('GET', '/api/v1/handovers/dashboard', null, adminHeaders);
    assert(adminDash.status === 200, 'GET /handovers/dashboard as Admin returns 200 OK');
    assert(adminDash.data?.data?.scope === 'PLATFORM', 'Admin dashboard scope is PLATFORM');
    assert(typeof adminDash.data?.data?.kpis?.totalHandovers === 'number', 'Dashboard contains totalHandovers KPI');
    assert(typeof adminDash.data?.data?.kpis?.completedCount === 'number', 'Dashboard contains completedCount KPI');
    assert(typeof adminDash.data?.data?.kpis?.submittedCount === 'number', 'Dashboard contains submittedCount KPI');
    assert(Array.isArray(adminDash.data?.data?.recentHandovers), 'Dashboard contains recentHandovers array');
    assert(Array.isArray(adminDash.data?.data?.recentActivities), 'Dashboard contains recentActivities array');

    // Operator Dashboard (Personal scoped)
    const opDash = await request('GET', '/api/v1/handovers/dashboard', null, opHeaders);
    assert(opDash.status === 200, 'GET /handovers/dashboard as Operator returns 200 OK');
    assert(opDash.data?.data?.scope === 'PERSONAL', 'Operator dashboard scope is PERSONAL');
    assert(typeof opDash.data?.data?.kpis?.totalHandovers === 'number', 'Operator dashboard contains personal totalHandovers');

    // -------------------------------------------------------------------------
    // 10. Filtered & Paginated History
    // -------------------------------------------------------------------------
    console.log('\n--- Test Group 10: Filtered & Paginated History ---');

    // Status filter
    const compHistory = await request('GET', '/api/v1/handovers?status=COMPLETED', null, adminHeaders);
    assert(compHistory.status === 200, 'GET /handovers?status=COMPLETED returns 200 OK');
    assert(compHistory.data?.data?.handovers?.every((h) => h.status === 'COMPLETED'), 'All returned handovers have COMPLETED status');

    // ShiftType filter
    const dayHistory = await request('GET', '/api/v1/handovers?shiftType=DAY', null, adminHeaders);
    assert(dayHistory.status === 200, 'GET /handovers?shiftType=DAY returns 200 OK');
    assert(dayHistory.data?.data?.handovers?.every((h) => h.shiftType === 'DAY'), 'All returned handovers have DAY shiftType');

    // Pagination limit & page
    const paged = await request('GET', '/api/v1/handovers?limit=1&page=1', null, adminHeaders);
    assert(paged.status === 200, 'GET /handovers?limit=1 returns 200 OK');
    assert(paged.data?.data?.pagination?.limit === 1, 'Pagination limit is 1');
    assert(paged.data?.data?.pagination?.page === 1, 'Pagination page is 1');

    // Limit cap enforcement (max 50)
    const capPaged = await request('GET', '/api/v1/handovers?limit=200', null, adminHeaders);
    assert(capPaged.status === 200, 'GET /handovers?limit=200 returns 200 OK');
    assert(capPaged.data?.data?.pagination?.limit <= 50, 'Pagination limit capped at maximum 50');

    // ReDoS protection / safe search
    const safeSearch = await request('GET', `/api/v1/handovers?search=${encodeURIComponent('SYNTH-B6-[.*+?')}`, null, adminHeaders);
    assert(safeSearch.status === 200, 'Search with regex special characters is escaped safely (returns 200)');

    // -------------------------------------------------------------------------
    // 11. Operational Data Strict Isolation Verification
    // -------------------------------------------------------------------------
    console.log('\n--- Test Group 11: Operational Data Strict Isolation ---');

    const finalAlerts = await Alert.countDocuments();
    const finalEvidence = await Evidence.countDocuments();
    const finalCameras = await Camera.countDocuments();
    const finalWorkFronts = await WorkFront.countDocuments();
    let finalEvents = 0;
    try { finalEvents = await DetectionEvent.countDocuments(); } catch (_) {}

    assert(finalAlerts === baselineAlerts, `Alert records count strictly preserved (Before: ${baselineAlerts}, After: ${finalAlerts})`);
    assert(finalEvidence === baselineEvidence, `Evidence records count strictly preserved (Before: ${baselineEvidence}, After: ${finalEvidence})`);
    assert(finalCameras === baselineCameras, `Camera records count strictly preserved (Before: ${baselineCameras}, After: ${finalCameras})`);
    assert(finalWorkFronts === baselineWorkFronts, `WorkFront records count strictly preserved (Before: ${baselineWorkFronts}, After: ${finalWorkFronts})`);
    assert(finalEvents === baselineEvents, `DetectionEvent records count strictly preserved (Before: ${baselineEvents}, After: ${finalEvents})`);

    // Verify no operational alert was modified
    const modifiedOperationalAlerts = await Alert.find({
      updatedAt: { $gt: testStartTime },
      alertCode: { $not: { $regex: '^ALT-SYNTH' } },
    });
    assert(modifiedOperationalAlerts.length === 0, 'Zero operational Alerts were mutated during handover lifecycle');

    // -------------------------------------------------------------------------
    // 12. Synthetic Test Teardown
    // -------------------------------------------------------------------------
    console.log('\n--- Test Group 12: Synthetic Teardown ---');
    const synthHandovers = await ShiftHandover.find({
      $or: [
        { shiftLabel: { $regex: `^${SYNTH_PREFIX}` } },
        { handoverCode: { $regex: '^SHO-SYNTH' } },
      ],
    }, '_id').lean();
    const synthIds = synthHandovers.map((h) => h._id);

    await HandoverActivity.deleteMany({
      $or: [
        { handover: { $in: synthIds } },
        { 'details.shiftLabel': { $regex: `^${SYNTH_PREFIX}` } },
      ],
    });

    await ShiftHandover.deleteMany({
      $or: [
        { _id: { $in: synthIds } },
        { shiftLabel: { $regex: `^${SYNTH_PREFIX}` } },
        { handoverCode: { $regex: '^SHO-SYNTH' } },
      ],
    });

    await AuditLog.deleteMany({
      $or: [
        { entityId: { $in: synthIds } },
        { 'details.shiftLabel': { $regex: `^${SYNTH_PREFIX}` } },
        { 'details.handoverCode': { $regex: '^SHO-SYNTH' } },
      ],
    });

    const lingeringHandovers = await ShiftHandover.countDocuments({
      shiftLabel: { $regex: `^${SYNTH_PREFIX}` },
    });
    const lingeringActivities = await HandoverActivity.countDocuments({
      handover: { $in: synthIds },
    });
    assert(lingeringHandovers === 0, 'All synthetic test handovers safely deleted');
    assert(lingeringActivities === 0, 'All synthetic test handover activities safely deleted');

  } catch (err) {
    console.error('Test suite execution error:', err);
    failed++;
  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await disconnectDB();

    console.log('\n================================================================');
    console.log(`  Phase 3 Batch 6 Backend Test Results: ${passed} Passed, ${failed} Failed`);
    console.log('================================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  }
};

runBatch6TestSuite();
