const crypto = require('crypto');
const ShiftHandover = require('../models/ShiftHandover');
const HandoverActivity = require('../models/HandoverActivity');
const Alert = require('../models/Alert');
const Camera = require('../models/Camera');
const WorkFront = require('../models/WorkFront');
const User = require('../models/User');
const { logAudit } = require('../utils/auditLogger');
const { escapeRegex } = require('../validators/shiftHandoverValidator');

/**
 * Gathers current operational intelligence across Alerts, Cameras, and Work-Fronts
 * Read-only analysis that never mutates live operational records.
 */
const collectOperationalSummary = async () => {
  // 1. Pending & Active Alerts
  const activeAlerts = await Alert.find({
    status: { $in: ['PENDING', 'ACKNOWLEDGED'] },
    isActive: true,
  })
    .sort({ severity: 1, detectedAt: -1 })
    .populate('camera', 'cameraCode name location status')
    .populate('workFront', 'workFrontCode name contractor supervisor')
    .lean();

  let criticalCount = 0;
  let highPriorityCount = 0;
  let escalationsCount = 0;

  const candidateIncidents = [];
  const escalationSnapshots = [];

  for (const alert of activeAlerts) {
    if (alert.severity === 'CRITICAL') criticalCount++;
    if (alert.severity === 'HIGH') highPriorityCount++;
    if (alert.escalationLevel > 1) {
      escalationsCount++;
      escalationSnapshots.push({
        alertId: alert._id,
        alertCode: alert.alertCode,
        escalationLevel: alert.escalationLevel,
        escalatedAt: alert.escalatedAtL2 || alert.escalatedAtL3 || alert.detectedAt,
        severity: alert.severity,
        contractor: alert.contractor || alert.workFront?.contractor || 'General',
        status: alert.status,
      });
    }

    candidateIncidents.push({
      alertId: alert._id,
      alertCode: alert.alertCode,
      violationType: alert.violationType,
      violationName: alert.violationName,
      severity: alert.severity,
      status: alert.status,
      detectedAt: alert.detectedAt,
      cameraCode: alert.cameraCode || alert.camera?.cameraCode || '',
      workFrontCode: alert.workFrontCode || alert.workFront?.workFrontCode || '',
      contractor: alert.contractor || alert.workFront?.contractor || '',
      escalationLevel: alert.escalationLevel || 1,
      flaggedForFollowUp: alert.severity === 'CRITICAL' || alert.escalationLevel > 1,
      notes: '',
    });
  }

  // 2. Camera System Health Issues
  const cameraIssuesDocs = await Camera.find({
    $or: [{ status: { $in: ['OFFLINE', 'UNKNOWN'] } }, { streamStatus: 'UNAVAILABLE' }],
    isActive: true,
  })
    .select('cameraCode name status location lastSeenAt')
    .lean();

  const cameraIssues = cameraIssuesDocs.map((c) => ({
    cameraId: c._id,
    cameraCode: c.cameraCode,
    name: c.name,
    status: c.status,
    location: c.location,
    lastSeenAt: c.lastSeenAt,
  }));

  // 3. Active Work-Front Observations
  const activeWorkFronts = await WorkFront.find({
    status: 'ACTIVE',
    isActive: true,
  })
    .select('workFrontCode name contractor supervisor riskLevel status')
    .lean();

  const workFrontObservations = activeWorkFronts.map((wf) => {
    const alertsInWf = activeAlerts.filter(
      (a) => a.workFrontCode === wf.workFrontCode || a.workFront?._id?.toString() === wf._id.toString()
    ).length;

    return {
      workFrontId: wf._id,
      workFrontCode: wf.workFrontCode,
      name: wf.name,
      contractor: wf.contractor,
      supervisorName: wf.supervisor?.name || 'Assigned Supervisor',
      riskLevel: wf.riskLevel || 'MEDIUM',
      status: wf.status,
      activeAlertsCount: alertsInWf,
    };
  });

  return {
    operationalSummary: {
      pendingAlertsCount: activeAlerts.length,
      criticalCount,
      highPriorityCount,
      escalationsCount,
      unresolvedCorrectiveCount: activeAlerts.filter((a) => a.status === 'ACKNOWLEDGED').length,
      offlineCamerasCount: cameraIssues.length,
      activeWorkFrontsCount: activeWorkFronts.length,
      collectedAt: new Date(),
    },
    candidateIncidents,
    escalationSnapshots,
    cameraIssues,
    workFrontObservations,
  };
};

/**
 * Creates a new draft Shift Handover
 */
const createHandover = async (data, user, req = null) => {
  const randSuffix = crypto.randomBytes(2).toString('hex').toUpperCase();
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const handoverCode = `SHO-${dateStr}-${randSuffix}`;

  // Automatically pull live operational context
  const liveContext = await collectOperationalSummary();

  // Filter selected incidents if user specified alert IDs; otherwise default to critical and high alerts
  let selectedIncidents = [];
  if (data.selectedAlertIds && data.selectedAlertIds.length > 0) {
    const selectedSet = new Set(data.selectedAlertIds.map(String));
    selectedIncidents = liveContext.candidateIncidents.filter((inc) =>
      selectedSet.has(inc.alertId.toString())
    );
  } else {
    // Default to critical and high priority incidents
    selectedIncidents = liveContext.candidateIncidents.filter(
      (inc) => inc.severity === 'CRITICAL' || inc.severity === 'HIGH' || inc.escalationLevel > 1
    );
  }

  let incomingOperator = null;
  let incomingOperatorEmail = null;
  let incomingOperatorName = null;

  if (data.incomingOperatorId) {
    const incUser = await User.findById(data.incomingOperatorId);
    if (incUser && incUser.isActive) {
      incomingOperator = incUser._id;
      incomingOperatorEmail = incUser.email;
      incomingOperatorName = incUser.name;
    }
  }

  const handover = await ShiftHandover.create({
    handoverCode,
    shiftDate: data.shiftDate || new Date(),
    shiftType: data.shiftType || 'DAY',
    shiftLabel: data.shiftLabel,
    outgoingOperator: user._id,
    outgoingOperatorEmail: user.email,
    outgoingOperatorName: user.name || 'Outgoing Operator',
    incomingOperator,
    incomingOperatorEmail,
    incomingOperatorName,
    status: 'DRAFT',
    operationalSummary: liveContext.operationalSummary,
    selectedIncidents,
    escalationSnapshots: liveContext.escalationSnapshots,
    cameraIssues: liveContext.cameraIssues,
    workFrontObservations: liveContext.workFrontObservations,
    manualNotes: data.manualNotes || [],
    outgoingRemarks: data.outgoingRemarks || '',
  });

  await HandoverActivity.create({
    handover: handover._id,
    user: user._id,
    userEmail: user.email,
    action: 'HANDOVER_CREATED',
    details: {
      handoverCode,
      shiftLabel: handover.shiftLabel,
      criticalCount: liveContext.operationalSummary.criticalCount,
    },
  });

  await logAudit({
    action: 'HANDOVER_CREATED',
    entityType: 'SHIFT_HANDOVER',
    entityId: handover._id,
    req,
    details: {
      handoverCode,
      shiftLabel: handover.shiftLabel,
      outgoingOperator: user.email,
    },
  });

  return handover;
};

/**
 * Retrieves a single handover by ID with authorization checks
 */
const getHandoverById = async (id, user) => {
  const handover = await ShiftHandover.findById(id)
    .populate('outgoingOperator', 'name email role')
    .populate('incomingOperator', 'name email role')
    .populate('acknowledgement.acknowledgedBy', 'name email role')
    .populate('followUps.assignedTo', 'name email role');

  if (!handover) {
    const error = new Error('Shift handover not found');
    error.statusCode = 404;
    throw error;
  }

  // Draft isolation: Draft handovers are only visible to the outgoing author or ADMIN
  const isAdmin = user?.role === 'ADMIN';
  const isAuthor = handover.outgoingOperator._id.toString() === user._id.toString();

  if (handover.status === 'DRAFT' && !isAdmin && !isAuthor) {
    const error = new Error('Access denied: Draft handovers are private to the author.');
    error.statusCode = 403;
    throw error;
  }

  return handover;
};

/**
 * Updates a draft handover
 */
const updateDraftHandover = async (id, data, user, req = null) => {
  const handover = await ShiftHandover.findById(id);
  if (!handover) {
    const error = new Error('Shift handover not found');
    error.statusCode = 404;
    throw error;
  }

  if (handover.status !== 'DRAFT') {
    const error = new Error(`Cannot modify handover in ${handover.status} state. Only DRAFT handovers can be edited.`);
    error.statusCode = 400;
    throw error;
  }

  const isAdmin = user?.role === 'ADMIN';
  const isAuthor = handover.outgoingOperator.toString() === user._id.toString();
  if (!isAdmin && !isAuthor) {
    const error = new Error('Access denied: You can only edit your own draft handovers.');
    error.statusCode = 403;
    throw error;
  }

  if (data.shiftLabel) handover.shiftLabel = data.shiftLabel;
  if (data.shiftType) handover.shiftType = data.shiftType;
  if (data.shiftDate) handover.shiftDate = data.shiftDate;
  if (data.outgoingRemarks !== undefined) handover.outgoingRemarks = data.outgoingRemarks;
  if (data.manualNotes) handover.manualNotes = data.manualNotes;

  if (data.incomingOperatorId !== undefined) {
    if (data.incomingOperatorId) {
      const incUser = await User.findById(data.incomingOperatorId);
      if (incUser && incUser.isActive) {
        handover.incomingOperator = incUser._id;
        handover.incomingOperatorEmail = incUser.email;
        handover.incomingOperatorName = incUser.name;
      }
    } else {
      handover.incomingOperator = null;
      handover.incomingOperatorEmail = null;
      handover.incomingOperatorName = null;
    }
  }

  // Update incident selection
  if (data.selectedIncidents) {
    handover.selectedIncidents = data.selectedIncidents;
  }

  await handover.save();

  await HandoverActivity.create({
    handover: handover._id,
    user: user._id,
    userEmail: user.email,
    action: 'HANDOVER_UPDATED',
    details: { shiftLabel: handover.shiftLabel },
  });

  await logAudit({
    action: 'HANDOVER_UPDATED',
    entityType: 'SHIFT_HANDOVER',
    entityId: handover._id,
    req,
    details: { handoverCode: handover.handoverCode },
  });

  return handover;
};

/**
 * Refreshes operational snapshot for a draft handover
 */
const refreshHandoverSummary = async (id, user, req = null) => {
  const handover = await ShiftHandover.findById(id);
  if (!handover) {
    const error = new Error('Shift handover not found');
    error.statusCode = 404;
    throw error;
  }

  if (handover.status !== 'DRAFT') {
    const error = new Error('Only DRAFT handovers can be refreshed with live operational data.');
    error.statusCode = 400;
    throw error;
  }

  const isAdmin = user?.role === 'ADMIN';
  const isAuthor = handover.outgoingOperator.toString() === user._id.toString();
  if (!isAdmin && !isAuthor) {
    const error = new Error('Access denied to refresh this handover.');
    error.statusCode = 403;
    throw error;
  }

  const liveContext = await collectOperationalSummary();
  handover.operationalSummary = liveContext.operationalSummary;
  handover.cameraIssues = liveContext.cameraIssues;
  handover.workFrontObservations = liveContext.workFrontObservations;
  handover.escalationSnapshots = liveContext.escalationSnapshots;

  await handover.save();

  await HandoverActivity.create({
    handover: handover._id,
    user: user._id,
    userEmail: user.email,
    action: 'SUMMARY_REFRESHED',
    details: {
      pendingAlertsCount: liveContext.operationalSummary.pendingAlertsCount,
      criticalCount: liveContext.operationalSummary.criticalCount,
    },
  });

  await logAudit({
    action: 'HANDOVER_SUMMARY_REFRESHED',
    entityType: 'SHIFT_HANDOVER',
    entityId: handover._id,
    req,
    details: { handoverCode: handover.handoverCode },
  });

  return {
    ...handover.toObject(),
    handover,
    candidateIncidents: liveContext.candidateIncidents,
  };
};

/**
 * Submits draft handover and freezes original snapshot permanently
 */
const submitHandover = async (id, submitData = {}, user, req = null) => {
  const handover = await ShiftHandover.findById(id);
  if (!handover) {
    const error = new Error('Shift handover not found');
    error.statusCode = 404;
    throw error;
  }

  if (handover.status === 'SUBMITTED') {
    const error = new Error('This shift handover has already been submitted.');
    error.statusCode = 400;
    throw error;
  }

  if (handover.status !== 'DRAFT') {
    const error = new Error(`Cannot submit handover in ${handover.status} state.`);
    error.statusCode = 400;
    throw error;
  }

  const isAdmin = user?.role === 'ADMIN';
  const isAuthor = handover.outgoingOperator.toString() === user._id.toString();
  if (!isAdmin && !isAuthor) {
    const error = new Error('Access denied: You can only submit your own draft handover.');
    error.statusCode = 403;
    throw error;
  }

  const submittedAt = new Date();
  const snapshotRemarks =
    submitData.outgoingRemarks !== undefined ? submitData.outgoingRemarks : handover.outgoingRemarks;

  // Create immutable frozen snapshot atomically
  const updatedHandover = await ShiftHandover.findOneAndUpdate(
    { _id: id, status: 'DRAFT' },
    {
      $set: {
        status: 'SUBMITTED',
        submittedAt,
        outgoingRemarks: snapshotRemarks,
        submittedSnapshot: {
          operationalSummary: handover.operationalSummary,
          selectedIncidents: handover.selectedIncidents,
          escalationSnapshots: handover.escalationSnapshots,
          cameraIssues: handover.cameraIssues,
          workFrontObservations: handover.workFrontObservations,
          manualNotes: handover.manualNotes,
          outgoingRemarks: snapshotRemarks,
          frozenAt: submittedAt,
        },
      },
    },
    { new: true }
  );

  if (!updatedHandover) {
    const error = new Error('Handover submission conflict: This handover has already been submitted or transitioned out of DRAFT.');
    error.statusCode = 400;
    throw error;
  }

  await HandoverActivity.create({
    handover: updatedHandover._id,
    user: user._id,
    userEmail: user.email,
    action: 'HANDOVER_SUBMITTED',
    details: {
      submittedAt,
      criticalCount: updatedHandover.operationalSummary?.criticalCount || 0,
      incidentsCount: updatedHandover.selectedIncidents?.length || 0,
    },
  });

  await logAudit({
    action: 'HANDOVER_SUBMITTED',
    entityType: 'SHIFT_HANDOVER',
    entityId: updatedHandover._id,
    req,
    details: {
      handoverCode: updatedHandover.handoverCode,
      submittedAt,
    },
  });

  return updatedHandover;
};

/**
 * Atomically claims an unassigned submitted handover by an oncoming operator
 */
const claimHandover = async (id, user, req = null) => {
  const handover = await ShiftHandover.findById(id);
  if (!handover) {
    const error = new Error('Shift handover not found');
    error.statusCode = 404;
    throw error;
  }

  if (handover.status !== 'SUBMITTED') {
    const error = new Error(`Only SUBMITTED handovers can be claimed. Current status is ${handover.status}.`);
    error.statusCode = 400;
    throw error;
  }

  const isAdmin = user?.role === 'ADMIN';
  const isAuthor = handover.outgoingOperator.toString() === user._id.toString();

  if (!isAdmin && isAuthor) {
    const error = new Error('Access denied: Outgoing operator cannot claim their own shift handover.');
    error.statusCode = 403;
    throw error;
  }

  if (handover.incomingOperator && handover.incomingOperator.toString() !== user._id.toString() && !isAdmin) {
    const error = new Error(
      `Access denied: Handover is already assigned to ${handover.incomingOperatorEmail || 'another operator'}.`
    );
    error.statusCode = 403;
    throw error;
  }

  if (handover.incomingOperator && handover.incomingOperator.toString() === user._id.toString()) {
    return handover; // Already claimed by this operator
  }

  const claimedAt = new Date();
  const updatedHandover = await ShiftHandover.findOneAndUpdate(
    { _id: id, status: 'SUBMITTED', incomingOperator: null },
    {
      $set: {
        incomingOperator: user._id,
        incomingOperatorEmail: user.email,
        incomingOperatorName: user.name || user.username || 'Incoming Operator',
        claimedAt,
      },
    },
    { new: true }
  );

  if (!updatedHandover) {
    const error = new Error('Handover was already claimed by another operator.');
    error.statusCode = 409;
    throw error;
  }

  await HandoverActivity.create({
    handover: updatedHandover._id,
    user: user._id,
    userEmail: user.email,
    action: 'HANDOVER_UPDATED',
    details: { action: 'CLAIMED', claimedAt },
  });

  await logAudit({
    action: 'HANDOVER_UPDATED',
    entityType: 'SHIFT_HANDOVER',
    entityId: updatedHandover._id,
    req,
    details: { handoverCode: updatedHandover.handoverCode, claimedBy: user.email },
  });

  return updatedHandover;
};

/**
 * Incoming operator reviews and acknowledges handover
 */
const acknowledgeHandover = async (id, ackData = {}, user, req = null) => {
  const handover = await ShiftHandover.findById(id);
  if (!handover) {
    const error = new Error('Shift handover not found');
    error.statusCode = 404;
    throw error;
  }

  if (handover.status === 'DRAFT') {
    const error = new Error('Cannot acknowledge a DRAFT handover. Handover must be submitted first.');
    error.statusCode = 400;
    throw error;
  }

  if (handover.status === 'ACKNOWLEDGED' || handover.status === 'COMPLETED') {
    const error = new Error('This handover has already been acknowledged.');
    error.statusCode = 400;
    throw error;
  }

  if (handover.status !== 'SUBMITTED') {
    const error = new Error(`Cannot acknowledge handover in ${handover.status} state.`);
    error.statusCode = 400;
    throw error;
  }

  const isAdmin = user?.role === 'ADMIN';
  const isAuthor = handover.outgoingOperator.toString() === user._id.toString();

  // Outgoing operator cannot self-acknowledge handover (must be verified by incoming operator or admin)
  if (!isAdmin && isAuthor) {
    const error = new Error('Access denied: Outgoing operator cannot acknowledge their own shift handover.');
    error.statusCode = 403;
    throw error;
  }

  // Assignment verification: if assigned to a specific operator, only they or ADMIN can acknowledge
  if (handover.incomingOperator && handover.incomingOperator.toString() !== user._id.toString() && !isAdmin) {
    const error = new Error(
      `Access denied: This handover was assigned to ${handover.incomingOperatorEmail || 'another operator'}.`
    );
    error.statusCode = 403;
    throw error;
  }

  const acknowledgedAt = new Date();
  const updateFields = {
    status: 'ACKNOWLEDGED',
    'acknowledgement.acknowledgedBy': user._id,
    'acknowledgement.acknowledgedByEmail': user.email,
    'acknowledgement.acknowledgedByName': user.name || user.username || 'Incoming Operator',
    'acknowledgement.acknowledgedAt': acknowledgedAt,
    'acknowledgement.remarks': ackData.remarks || '',
  };

  if (!handover.incomingOperator) {
    updateFields.incomingOperator = user._id;
    updateFields.incomingOperatorEmail = user.email;
    updateFields.incomingOperatorName = user.name || user.username || 'Incoming Operator';
    updateFields.claimedAt = acknowledgedAt;
  }

  // Atomic transition to prevent duplicate acknowledgement
  const updatedHandover = await ShiftHandover.findOneAndUpdate(
    { _id: id, status: 'SUBMITTED' },
    { $set: updateFields },
    { new: true }
  );

  if (!updatedHandover) {
    const error = new Error('Acknowledgement conflict: Handover is no longer in SUBMITTED state.');
    error.statusCode = 400;
    throw error;
  }

  await HandoverActivity.create({
    handover: updatedHandover._id,
    user: user._id,
    userEmail: user.email,
    action: 'HANDOVER_ACKNOWLEDGED',
    details: {
      acknowledgedAt,
      remarks: ackData.remarks || '',
    },
  });

  await logAudit({
    action: 'HANDOVER_ACKNOWLEDGED',
    entityType: 'SHIFT_HANDOVER',
    entityId: updatedHandover._id,
    req,
    details: {
      handoverCode: updatedHandover.handoverCode,
      acknowledgedBy: user.email,
    },
  });

  return updatedHandover;
};

/**
 * Creates a follow-up action item attached to a handover
 */
const createFollowUp = async (id, followUpData, user, req = null) => {
  const handover = await ShiftHandover.findById(id);
  if (!handover) {
    const error = new Error('Shift handover not found');
    error.statusCode = 404;
    throw error;
  }

  if (handover.status === 'DRAFT' || handover.status === 'CANCELLED') {
    const error = new Error(`Cannot add follow-up items to a handover in ${handover.status} state.`);
    error.statusCode = 400;
    throw error;
  }

  const randSuffix = crypto.randomBytes(2).toString('hex').toUpperCase();
  const followUpId = `FUP-${Date.now().toString().slice(-6)}-${randSuffix}`;

  const followUp = {
    followUpId,
    description: followUpData.description,
    relatedAlertCode: followUpData.relatedAlertCode || null,
    priority: followUpData.priority || 'MEDIUM',
    assignedTo: followUpData.assignedTo || user._id,
    assignedToEmail: followUpData.assignedTo ? null : user.email,
    status: 'OPEN',
    remarks: followUpData.remarks || '',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  handover.followUps.push(followUp);
  await handover.save();

  await HandoverActivity.create({
    handover: handover._id,
    user: user._id,
    userEmail: user.email,
    action: 'FOLLOWUP_CREATED',
    details: {
      followUpId,
      description: followUp.description,
    },
  });

  await logAudit({
    action: 'HANDOVER_FOLLOWUP_CREATED',
    entityType: 'SHIFT_HANDOVER',
    entityId: handover._id,
    req,
    details: {
      handoverCode: handover.handoverCode,
      followUpId,
    },
  });

  return handover;
};

/**
 * Updates status and remarks of an existing follow-up item
 */
const updateFollowUp = async (id, followUpId, updateData, user, req = null) => {
  const handover = await ShiftHandover.findById(id);
  if (!handover) {
    const error = new Error('Shift handover not found');
    error.statusCode = 404;
    throw error;
  }

  const item = handover.followUps.find(
    (f) => f.followUpId === followUpId || f._id?.toString() === followUpId
  );
  if (!item) {
    const error = new Error(`Follow-up item '${followUpId}' not found on this handover.`);
    error.statusCode = 404;
    throw error;
  }

  if (updateData.status) {
    item.status = updateData.status;
    if (updateData.status === 'COMPLETED') {
      item.completedAt = new Date();
    } else {
      item.completedAt = null;
    }
  }

  if (updateData.remarks !== undefined) {
    item.remarks = updateData.remarks;
  }
  item.updatedAt = new Date();

  await handover.save();

  await HandoverActivity.create({
    handover: handover._id,
    user: user._id,
    userEmail: user.email,
    action: 'FOLLOWUP_UPDATED',
    details: {
      followUpId,
      status: item.status,
    },
  });

  await logAudit({
    action: 'HANDOVER_FOLLOWUP_UPDATED',
    entityType: 'SHIFT_HANDOVER',
    entityId: handover._id,
    req,
    details: {
      handoverCode: handover.handoverCode,
      followUpId,
      status: item.status,
    },
  });

  return handover;
};

/**
 * Marks an acknowledged handover as COMPLETED
 */
const completeHandover = async (id, user, req = null) => {
  const handover = await ShiftHandover.findById(id);
  if (!handover) {
    const error = new Error('Shift handover not found');
    error.statusCode = 404;
    throw error;
  }

  if (handover.status !== 'ACKNOWLEDGED') {
    const error = new Error(`Only ACKNOWLEDGED handovers can be marked COMPLETED. Current status: ${handover.status}.`);
    error.statusCode = 400;
    throw error;
  }

  const isAdmin = user?.role === 'ADMIN';

  // Verify that required follow-up action items have been addressed
  const openFollowUps = (handover.followUps || []).filter(
    (f) => f.status === 'OPEN' || f.status === 'IN_PROGRESS' || f.status === 'BLOCKED'
  );

  if (openFollowUps.length > 0 && !isAdmin) {
    const error = new Error(
      `Cannot complete handover: ${openFollowUps.length} follow-up item(s) remain open or blocked (${openFollowUps.map((f) => f.followUpId).join(', ')}). All follow-up tasks must be marked COMPLETED before concluding the shift.`
    );
    error.statusCode = 400;
    throw error;
  }

  const completedAt = new Date();
  const updatedHandover = await ShiftHandover.findOneAndUpdate(
    { _id: id, status: 'ACKNOWLEDGED' },
    { $set: { status: 'COMPLETED', completedAt } },
    { new: true }
  );

  if (!updatedHandover) {
    const error = new Error('Handover completion conflict: Handover is no longer in ACKNOWLEDGED state.');
    error.statusCode = 400;
    throw error;
  }

  await HandoverActivity.create({
    handover: updatedHandover._id,
    user: user._id,
    userEmail: user.email,
    action: 'HANDOVER_COMPLETED',
    details: { completedAt },
  });

  await logAudit({
    action: 'HANDOVER_COMPLETED',
    entityType: 'SHIFT_HANDOVER',
    entityId: updatedHandover._id,
    req,
    details: { handoverCode: updatedHandover.handoverCode },
  });

  return updatedHandover;
};

/**
 * Cancels a draft handover
 */
const cancelHandover = async (id, cancellationReason, user, req = null) => {
  const handover = await ShiftHandover.findById(id);
  if (!handover) {
    const error = new Error('Shift handover not found');
    error.statusCode = 404;
    throw error;
  }

  const isAdmin = user?.role === 'ADMIN';
  const isAuthor = handover.outgoingOperator.toString() === user._id.toString();

  if (handover.status !== 'DRAFT') {
    const error = new Error(`Only DRAFT handovers can be cancelled. Cannot cancel a handover with status '${handover.status}'.`);
    error.statusCode = 400;
    throw error;
  }

  if (!isAdmin && !isAuthor) {
    const error = new Error('Access denied to cancel this handover.');
    error.statusCode = 403;
    throw error;
  }

  const cancelledAt = new Date();
  const updatedHandover = await ShiftHandover.findOneAndUpdate(
    { _id: id, status: 'DRAFT' },
    {
      $set: {
        status: 'CANCELLED',
        cancelledAt,
        cancellationReason: cancellationReason || 'Cancelled by operator',
      },
    },
    { new: true }
  );

  if (!updatedHandover) {
    const error = new Error(`Only DRAFT handovers can be cancelled. Handover is currently in '${handover.status}' state.`);
    error.statusCode = 400;
    throw error;
  }

  await HandoverActivity.create({
    handover: updatedHandover._id,
    user: user._id,
    userEmail: user.email,
    action: 'HANDOVER_CANCELLED',
    details: { cancellationReason: updatedHandover.cancellationReason },
  });

  await logAudit({
    action: 'HANDOVER_CANCELLED',
    entityType: 'SHIFT_HANDOVER',
    entityId: updatedHandover._id,
    req,
    details: { handoverCode: updatedHandover.handoverCode },
  });

  return updatedHandover;
};

/**
 * Dashboard KPIs and analytics
 */
const getHandoverDashboard = async (user) => {
  const isAdmin = user?.role === 'ADMIN';
  const scope = isAdmin ? 'PLATFORM' : 'PERSONAL';

  const filterScope = isAdmin
    ? {}
    : {
        $or: [
          { outgoingOperator: user._id },
          { incomingOperator: user._id },
          { 'acknowledgement.acknowledgedBy': user._id },
        ],
      };

  const [
    totalHandovers,
    awaitingAckCount,
    acknowledgedCount,
    completedCount,
    allHandovers,
    recentActivities,
  ] = await Promise.all([
    ShiftHandover.countDocuments({ ...filterScope, status: { $ne: 'CANCELLED' } }),
    ShiftHandover.countDocuments({ ...filterScope, status: 'SUBMITTED' }),
    ShiftHandover.countDocuments({ ...filterScope, status: 'ACKNOWLEDGED' }),
    ShiftHandover.countDocuments({ ...filterScope, status: 'COMPLETED' }),
    ShiftHandover.find({ ...filterScope, status: { $in: ['SUBMITTED', 'ACKNOWLEDGED'] } })
      .select('operationalSummary followUps')
      .lean(),
    HandoverActivity.find({})
      .sort({ timestamp: -1 })
      .limit(6)
      .lean(),
  ]);

  let openFollowUpsCount = 0;
  let criticalUnresolvedCount = 0;

  allHandovers.forEach((h) => {
    criticalUnresolvedCount += h.operationalSummary?.criticalCount || 0;
    if (h.followUps) {
      openFollowUpsCount += h.followUps.filter((f) => f.status === 'OPEN' || f.status === 'IN_PROGRESS').length;
    }
  });

  // Recent handovers
  const recentHandovers = await ShiftHandover.find(
    isAdmin ? {} : { $or: [{ status: { $ne: 'DRAFT' } }, { outgoingOperator: user._id }] }
  )
    .sort({ createdAt: -1 })
    .limit(5)
    .populate('outgoingOperator', 'name email')
    .populate('incomingOperator', 'name email')
    .lean();

  return {
    kpis: {
      totalHandovers,
      submittedCount: awaitingAckCount,
      awaitingAckCount,
      acknowledgedCount,
      openFollowUpsCount,
      criticalUnresolvedCount,
      completedCount,
    },
    scope,
    recentHandovers,
    recentActivities,
  };
};

/**
 * Incoming handover inbox (handovers in SUBMITTED state awaiting current operator or unassigned)
 */
const getHandoverInbox = async (user) => {
  const isAdmin = user?.role === 'ADMIN';

  const filter = { status: 'SUBMITTED' };
  if (!isAdmin) {
    filter.$or = [{ incomingOperator: user._id }, { incomingOperator: null }];
  }

  const handovers = await ShiftHandover.find(filter)
    .sort({ submittedAt: -1 })
    .populate('outgoingOperator', 'name email')
    .populate('incomingOperator', 'name email')
    .lean();

  return handovers;
};

/**
 * Filtered, paginated list of handovers
 */
const listHandovers = async (query = {}, user) => {
  const isAdmin = user?.role === 'ADMIN';
  const filter = {};

  // Draft visibility constraint: operators only see their own drafts
  if (!isAdmin) {
    if (query.status === 'DRAFT') {
      filter.status = 'DRAFT';
      filter.outgoingOperator = user._id;
    } else if (query.status && query.status !== 'ALL') {
      filter.status = query.status;
    } else {
      filter.$or = [{ status: { $ne: 'DRAFT' } }, { outgoingOperator: user._id }];
    }
  } else if (query.status && query.status !== 'ALL') {
    filter.status = query.status;
  }

  if (query.shiftType && query.shiftType !== 'ALL') {
    filter.shiftType = query.shiftType;
  }

  if (query.startDate || query.endDate) {
    filter.shiftDate = {};
    if (query.startDate) filter.shiftDate.$gte = new Date(query.startDate);
    if (query.endDate) filter.shiftDate.$lte = new Date(query.endDate);
  }

  if (query.search) {
    const escaped = escapeRegex(query.search);
    const searchCondition = [
      { handoverCode: { $regex: escaped, $options: 'i' } },
      { shiftLabel: { $regex: escaped, $options: 'i' } },
      { outgoingOperatorEmail: { $regex: escaped, $options: 'i' } },
      { outgoingOperatorName: { $regex: escaped, $options: 'i' } },
      { incomingOperatorEmail: { $regex: escaped, $options: 'i' } },
    ];

    if (filter.$or) {
      filter.$and = [{ $or: filter.$or }, { $or: searchCondition }];
      delete filter.$or;
    } else {
      filter.$or = searchCondition;
    }
  }

  const page = Math.max(1, parseInt(query.page || 1, 10));
  const limit = Math.min(50, Math.max(1, parseInt(query.limit || 10, 10)));
  const skip = (page - 1) * limit;

  const allowedSortFields = ['createdAt', 'shiftDate', 'submittedAt'];
  const sortField = allowedSortFields.includes(query.sortBy) ? query.sortBy : 'createdAt';
  const sortOrder = query.sortOrder === 1 ? 1 : -1;

  const [total, handovers] = await Promise.all([
    ShiftHandover.countDocuments(filter),
    ShiftHandover.find(filter)
      .sort({ [sortField]: sortOrder })
      .skip(skip)
      .limit(limit)
      .populate('outgoingOperator', 'name email')
      .populate('incomingOperator', 'name email')
      .lean(),
  ]);

  return {
    handovers,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

module.exports = {
  collectOperationalSummary,
  createHandover,
  getHandoverById,
  updateDraftHandover,
  refreshHandoverSummary,
  submitHandover,
  claimHandover,
  acknowledgeHandover,
  createFollowUp,
  updateFollowUp,
  completeHandover,
  cancelHandover,
  getHandoverDashboard,
  getHandoverInbox,
  listHandovers,
};
