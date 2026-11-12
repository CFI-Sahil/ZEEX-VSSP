const crypto = require('crypto');
const TrainingScenario = require('../models/TrainingScenario');
const TrainingSession = require('../models/TrainingSession');
const TrainingActivity = require('../models/TrainingActivity');
const { logAudit } = require('../utils/auditLogger');
const { evaluateSession } = require('./trainingEvaluationEngine');
const { escapeRegex } = require('../validators/trainingValidator');

/**
 * Sanitizes scenario object so operators cannot view hidden expectedEvaluation criteria
 * @param {Object} scenarioDoc
 * @param {boolean} isAdmin
 * @returns {Object}
 */
const sanitizeScenario = (scenarioDoc, isAdmin = false) => {
  if (!scenarioDoc) return null;
  const obj = scenarioDoc.toObject ? scenarioDoc.toObject() : { ...scenarioDoc };
  if (!isAdmin) {
    delete obj.expectedEvaluation;
  }
  return obj;
};

/**
 * Sanitizes training session object so active sessions do not leak hidden evaluation criteria
 * @param {Object} sessionDoc
 * @param {boolean} isAdmin
 * @returns {Object}
 */
const sanitizeSession = (sessionDoc, isAdmin = false) => {
  if (!sessionDoc) return null;
  const obj = sessionDoc.toObject ? sessionDoc.toObject() : { ...sessionDoc };
  if (!isAdmin && obj.status !== 'COMPLETED') {
    if (obj.scenarioSnapshot && obj.scenarioSnapshot.expectedEvaluation) {
      const sanitizedSnapshot = { ...obj.scenarioSnapshot };
      delete sanitizedSnapshot.expectedEvaluation;
      obj.scenarioSnapshot = sanitizedSnapshot;
    }
  }
  return obj;
};

/**
 * Seeds default canonical training scenarios if none exist
 */
const seedDefaultScenarios = async (adminUser = null) => {
  const count = await TrainingScenario.countDocuments({ scenarioCode: { $regex: '^SCN-' } });
  if (count > 0) return;

  const defaultScenarios = [
    {
      scenarioCode: 'SCN-PPE-01',
      title: 'Missing Hard Hat in Heavy Fabrication Bay',
      description: 'Worker observed in active structural fabrication zone without an approved protective hard hat.',
      objective: 'Practice identifying PPE non-compliance and executing standard notification and corrective issuance protocols.',
      violationType: 'NO_HELMET',
      severity: 'HIGH',
      difficulty: 'BEGINNER',
      estimatedMinutes: 10,
      instructions: [
        'Review CCTV detection snapshot in Fabrication Bay 1.',
        'Acknowledge the alert within operational SLA guidelines.',
        'Assess the incident violation category and appropriate severity.',
        'Issue mandatory PPE compliance requirement and document resolution.',
      ],
      learningObjectives: [
        'Understand PPE mandatory zones',
        'Recognize high-consequence head injury hazards',
        'Follow standard verbal and written corrective action flow',
      ],
      simulatedAlertContext: {
        alertCode: 'ALT-SIM-001',
        cameraCode: 'CAM-FAB-01',
        cameraName: 'Bay 1 Overhead Camera',
        location: 'Fabrication Bay 1',
        site: 'North Plant',
        contractor: 'Apex Structural Contracting',
        workFrontCode: 'WF-FAB-01',
        workFrontName: 'Main Assembly Bay',
        riskLevel: 'HIGH',
        detectedAtOffsetMinutes: 4,
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
      createdBy: adminUser?._id || null,
      createdByEmail: adminUser?.email || 'admin@vssp.local',
    },
    {
      scenarioCode: 'SCN-PPE-02',
      title: 'Missing High-Visibility Vest near Heavy Equipment Traffic',
      description: 'Logistics personnel identified in the active forklift crossing corridor without high-visibility outerwear.',
      objective: 'Identify pedestrian struck-by hazards and enforce mandatory high-visibility garment protocols.',
      violationType: 'NO_VEST',
      severity: 'MEDIUM',
      difficulty: 'BEGINNER',
      estimatedMinutes: 10,
      instructions: [
        'Examine yard logistics camera snapshot.',
        'Acknowledge the safety notification.',
        'Assess the incident category and severity.',
        'Direct operator to enforce immediate hi-vis vest compliance.',
      ],
      learningObjectives: [
        'Identify mobile equipment blind spots',
        'Reinforce high-visibility standards',
        'Execute immediate field contact',
      ],
      simulatedAlertContext: {
        alertCode: 'ALT-SIM-002',
        cameraCode: 'CAM-YARD-02',
        cameraName: 'Logistics Access Lane Camera',
        location: 'Logistics Corridor',
        site: 'Main Yard',
        contractor: 'Speedy Haulage Services',
        workFrontCode: 'WF-LOG-02',
        workFrontName: 'Loading & Offloading Dock',
        riskLevel: 'MEDIUM',
        detectedAtOffsetMinutes: 8,
      },
      simulatedEvidence: {
        fileName: 'sample-helmet-violation.jpg',
        fixtureType: 'VEST',
        fileUrl: '/api/v1/training/evidence-sample/sample-helmet-violation.jpg',
        mimeType: 'image/jpeg',
        caption: 'Worker operating adjacent to forklift traffic without hi-vis vest',
      },
      expectedEvaluation: {
        expectedViolationType: 'NO_VEST',
        expectedSeverity: 'MEDIUM',
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
      createdBy: adminUser?._id || null,
      createdByEmail: adminUser?.email || 'admin@vssp.local',
    },
    {
      scenarioCode: 'SCN-ZONE-03',
      title: 'Unauthorized Entry into 33kV Electrical Substation Enclosure',
      description: 'Worker breached secondary perimeter security barrier of live high-voltage electrical substation.',
      objective: 'Handle life-critical high-voltage intrusion by ordering immediate work halt and physical isolation.',
      violationType: 'UNAUTHORIZED_ZONE',
      severity: 'CRITICAL',
      difficulty: 'INTERMEDIATE',
      estimatedMinutes: 15,
      instructions: [
        'Review critical perimeter camera snapshot.',
        'Acknowledge critical alarm immediately.',
        'Select STOP_WORK protocol and assess CRITICAL severity.',
        'Record mandatory perimeter barricade and access lockdown.',
      ],
      learningObjectives: [
        'Identify arc-flash and electrocution exclusion boundaries',
        'Apply emergency Stop Work Authority',
        'Document high-consequence corrective barriers',
      ],
      simulatedAlertContext: {
        alertCode: 'ALT-SIM-003',
        cameraCode: 'CAM-SUB-03',
        cameraName: 'Substation Perimeter North',
        location: '33kV Transformer Enclosure',
        site: 'Electrical Substation',
        contractor: 'Delta Power Systems',
        workFrontCode: 'WF-ELE-03',
        workFrontName: 'Grid Transformer Bay',
        riskLevel: 'CRITICAL',
        detectedAtOffsetMinutes: 2,
      },
      simulatedEvidence: {
        fileName: 'sample-zone-breach.png',
        fixtureType: 'ZONE',
        fileUrl: '/api/v1/training/evidence-sample/sample-zone-breach.png',
        mimeType: 'image/png',
        caption: 'Perimeter breach detected within energized switchyard zone',
      },
      expectedEvaluation: {
        expectedViolationType: 'UNAUTHORIZED_ZONE',
        expectedSeverity: 'CRITICAL',
        expectedImmediateResponse: 'STOP_WORK',
        expectedCorrectiveActionCategory: 'RESTRICT_ACCESS_BARRICADE',
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
      createdBy: adminUser?._id || null,
      createdByEmail: adminUser?.email || 'admin@vssp.local',
    },
    {
      scenarioCode: 'SCN-BOOT-04',
      title: 'Unapproved Footwear in Heavy Fabrication Cutting Bay',
      description: 'Operator noted wearing standard running shoes rather than puncture-resistant steel-toe boots.',
      objective: 'Practice routine compliance audits and toolbox talk reinforcement.',
      violationType: 'NO_SAFETY_BOOTS',
      severity: 'LOW',
      difficulty: 'BEGINNER',
      estimatedMinutes: 5,
      instructions: [
        'Review cutting bay foot-level camera feed.',
        'Acknowledge simulated violation.',
        'Classify violation and record LOW severity.',
        'Assign toolbox talk corrective action.',
      ],
      learningObjectives: [
        'Differentiate baseline vs high-severity PPE infractions',
        'Enforce foot-injury prevention controls',
        'Record safety briefings in audit trail',
      ],
      simulatedAlertContext: {
        alertCode: 'ALT-SIM-004',
        cameraCode: 'CAM-SHOP-04',
        cameraName: 'Machine Shop Line 2 Camera',
        location: 'CNC Milling Section',
        site: 'North Plant',
        contractor: 'Internal Maintenance Unit',
        workFrontCode: 'WF-MCH-04',
        workFrontName: 'Precision Milling Line',
        riskLevel: 'LOW',
        detectedAtOffsetMinutes: 12,
      },
      simulatedEvidence: {
        fileName: 'sample-helmet-violation.jpg',
        fixtureType: 'BOOTS',
        fileUrl: '/api/v1/training/evidence-sample/sample-helmet-violation.jpg',
        mimeType: 'image/jpeg',
        caption: 'Worker identified wearing soft footwear in metal chip hazard area',
      },
      expectedEvaluation: {
        expectedViolationType: 'NO_SAFETY_BOOTS',
        expectedSeverity: 'LOW',
        expectedImmediateResponse: 'ISSUE_VERBAL_WARNING',
        expectedCorrectiveActionCategory: 'TOOLBOX_TALK',
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
      createdBy: adminUser?._id || null,
      createdByEmail: adminUser?.email || 'admin@vssp.local',
    },
    {
      scenarioCode: 'SCN-REST-05',
      title: 'Restricted Confined Space Entry without Permit',
      description: 'Technician entered vessel manway without confined space permit verification or standby watcher.',
      objective: 'Implement emergency response for atmospheric hazard and unpermitted confined space entry.',
      violationType: 'RESTRICTED_ACCESS',
      severity: 'CRITICAL',
      difficulty: 'ADVANCED',
      estimatedMinutes: 15,
      instructions: [
        'Review manway monitoring camera.',
        'Acknowledge high-priority notification.',
        'Trigger Stop Work Authority and confirm CRITICAL rating.',
        'Establish physical barrier and air quality validation.',
      ],
      learningObjectives: [
        'Identify atmospheric asphyxiation protocols',
        'Enforce permit-to-work validation',
        'Implement immediate site evacuation controls',
      ],
      simulatedAlertContext: {
        alertCode: 'ALT-SIM-005',
        cameraCode: 'CAM-CONF-05',
        cameraName: 'Vessel Manway Access Camera',
        location: 'Reactor Vessel 2 Pit',
        site: 'Process Plant',
        contractor: 'Vanguard Industrial Services',
        workFrontCode: 'WF-VES-05',
        workFrontName: 'Chemical Tank Servicing',
        riskLevel: 'CRITICAL',
        detectedAtOffsetMinutes: 3,
      },
      simulatedEvidence: {
        fileName: 'sample-zone-breach.png',
        fixtureType: 'ZONE',
        fileUrl: '/api/v1/training/evidence-sample/sample-zone-breach.png',
        mimeType: 'image/png',
        caption: 'Worker entering confined vessel without attendant or gas clearance',
      },
      expectedEvaluation: {
        expectedViolationType: 'RESTRICTED_ACCESS',
        expectedSeverity: 'CRITICAL',
        expectedImmediateResponse: 'STOP_WORK',
        expectedCorrectiveActionCategory: 'RESTRICT_ACCESS_BARRICADE',
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
      createdBy: adminUser?._id || null,
      createdByEmail: adminUser?.email || 'admin@vssp.local',
    },
    {
      scenarioCode: 'SCN-MULT-06',
      title: 'Multi-Risk Zone Breach with Elevated Fall Hazards',
      description: 'Multiple contractors detected working on elevated facade scaffold with missing mid-rails and unattached lanyards.',
      objective: 'Address complex multifaceted hazards requiring contractor safety intervention and stop-work measures.',
      violationType: 'OTHER',
      severity: 'HIGH',
      difficulty: 'ADVANCED',
      estimatedMinutes: 20,
      instructions: [
        'Inspect facade scaffolding camera image.',
        'Acknowledge incident.',
        'Assess compounded hazards as OTHER category with HIGH severity.',
        'Execute contractor penalty and safety stand-down protocol.',
      ],
      learningObjectives: [
        'Recognize multiple simultaneous hazard types',
        'Evaluate systemic contractor non-compliance',
        'Execute comprehensive incident closure notes',
      ],
      simulatedAlertContext: {
        alertCode: 'ALT-SIM-006',
        cameraCode: 'CAM-SCAF-06',
        cameraName: 'Facade Scaffolding Tier 4 Camera',
        location: 'Building B Facade',
        site: 'Commercial Complex',
        contractor: 'Zenith Scaffolding Co',
        workFrontCode: 'WF-SCAF-06',
        workFrontName: 'Exterior Cladding',
        riskLevel: 'HIGH',
        detectedAtOffsetMinutes: 6,
      },
      simulatedEvidence: {
        fileName: 'sample-helmet-violation.jpg',
        fixtureType: 'GENERIC',
        fileUrl: '/api/v1/training/evidence-sample/sample-helmet-violation.jpg',
        mimeType: 'image/jpeg',
        caption: 'Unclipped harness and missing toe-boards at elevated working front',
      },
      expectedEvaluation: {
        expectedViolationType: 'OTHER',
        expectedSeverity: 'HIGH',
        expectedImmediateResponse: 'STOP_WORK',
        expectedCorrectiveActionCategory: 'CONTRACTOR_PENALTY',
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
      createdBy: adminUser?._id || null,
      createdByEmail: adminUser?.email || 'admin@vssp.local',
    },
  ];

  await TrainingScenario.insertMany(defaultScenarios);
};

// ---------------------------------------------------------------------------
// Scenario Management
// ---------------------------------------------------------------------------

const listScenarios = async (query = {}, user) => {
  const isAdmin = user?.role === 'ADMIN';
  const mongoQuery = {};

  if (!isAdmin) {
    mongoQuery.status = 'PUBLISHED';
  } else if (query.status && query.status !== 'ALL') {
    mongoQuery.status = query.status;
  }

  if (query.difficulty && query.difficulty !== 'ALL') {
    mongoQuery.difficulty = query.difficulty;
  }

  if (query.violationType && query.violationType !== 'ALL') {
    mongoQuery.violationType = query.violationType;
  }

  if (query.search) {
    const escaped = escapeRegex(query.search);
    mongoQuery.$or = [
      { title: { $regex: escaped, $options: 'i' } },
      { scenarioCode: { $regex: escaped, $options: 'i' } },
      { description: { $regex: escaped, $options: 'i' } },
    ];
  }

  const page = Math.max(1, parseInt(query.page || 1, 10));
  const limit = Math.min(50, Math.max(1, parseInt(query.limit || 12, 10)));
  const skip = (page - 1) * limit;

  const [total, scenarios] = await Promise.all([
    TrainingScenario.countDocuments(mongoQuery),
    TrainingScenario.find(mongoQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  const sanitized = scenarios.map((s) => sanitizeScenario(s, isAdmin));

  return {
    scenarios: sanitized,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

const getScenarioById = async (id, user) => {
  const isAdmin = user?.role === 'ADMIN';
  const scenario = await TrainingScenario.findById(id);
  if (!scenario) {
    const error = new Error('Training scenario not found');
    error.statusCode = 404;
    throw error;
  }

  if (!isAdmin && scenario.status !== 'PUBLISHED') {
    const error = new Error('Scenario is not available for training');
    error.statusCode = 403;
    throw error;
  }

  return sanitizeScenario(scenario, isAdmin);
};

const createScenario = async (data, user, req = null) => {
  let scenarioCode = data.scenarioCode;
  if (!scenarioCode) {
    scenarioCode = `SCN-${Date.now().toString().slice(-6)}`;
  }

  // Ensure code uniqueness
  const existing = await TrainingScenario.findOne({ scenarioCode });
  if (existing) {
    const error = new Error(`Scenario code '${scenarioCode}' already exists`);
    error.statusCode = 400;
    throw error;
  }

  const scenario = await TrainingScenario.create({
    ...data,
    scenarioCode,
    createdBy: user?._id || null,
    createdByEmail: user?.email || 'admin@vssp.local',
  });

  await logAudit({
    action: 'TRAINING_SCENARIO_CREATED',
    entityType: 'TRAINING_SCENARIO',
    entityId: scenario._id,
    req,
    details: {
      scenarioCode: scenario.scenarioCode,
      title: scenario.title,
      violationType: scenario.violationType,
      severity: scenario.severity,
    },
  });

  return scenario;
};

const updateScenario = async (id, data, user, req = null) => {
  const scenario = await TrainingScenario.findById(id);
  if (!scenario) {
    const error = new Error('Training scenario not found');
    error.statusCode = 404;
    throw error;
  }

  Object.assign(scenario, data);
  await scenario.save();

  await logAudit({
    action: 'TRAINING_SCENARIO_UPDATED',
    entityType: 'TRAINING_SCENARIO',
    entityId: scenario._id,
    req,
    details: {
      scenarioCode: scenario.scenarioCode,
      status: scenario.status,
      title: scenario.title,
    },
  });

  return scenario;
};

const publishScenario = async (id, user, req = null) => {
  const scenario = await TrainingScenario.findById(id);
  if (!scenario) {
    const error = new Error('Training scenario not found');
    error.statusCode = 404;
    throw error;
  }

  scenario.status = 'PUBLISHED';
  await scenario.save();

  await logAudit({
    action: 'TRAINING_SCENARIO_PUBLISHED',
    entityType: 'TRAINING_SCENARIO',
    entityId: scenario._id,
    req,
    details: {
      scenarioCode: scenario.scenarioCode,
      status: 'PUBLISHED',
    },
  });

  return scenario;
};

const archiveScenario = async (id, user, req = null) => {
  const scenario = await TrainingScenario.findById(id);
  if (!scenario) {
    const error = new Error('Training scenario not found');
    error.statusCode = 404;
    throw error;
  }

  scenario.status = 'ARCHIVED';
  await scenario.save();

  await logAudit({
    action: 'TRAINING_SCENARIO_ARCHIVED',
    entityType: 'TRAINING_SCENARIO',
    entityId: scenario._id,
    req,
    details: {
      scenarioCode: scenario.scenarioCode,
      status: 'ARCHIVED',
    },
  });

  return scenario;
};

// ---------------------------------------------------------------------------
// Training Session Lifecycle
// ---------------------------------------------------------------------------

const startSession = async (scenarioId, user, req = null) => {
  const scenario = await TrainingScenario.findById(scenarioId);
  if (!scenario) {
    const error = new Error('Training scenario not found');
    error.statusCode = 404;
    throw error;
  }

  if (scenario.status !== 'PUBLISHED') {
    const error = new Error(`Scenario '${scenario.title}' is ${scenario.status.toLowerCase()} and cannot be started.`);
    error.statusCode = 400;
    throw error;
  }

  // Check for existing active session for this user and scenario
  const existingActive = await TrainingSession.findOne({
    user: user._id,
    scenario: scenario._id,
    status: 'IN_PROGRESS',
  });

  if (existingActive) {
    return sanitizeSession(existingActive, user?.role === 'ADMIN');
  }

  // Create frozen snapshot of scenario
  const scenarioSnapshot = scenario.toObject();

  const randSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  const sessionCode = `TRN-${Date.now().toString().slice(-6)}-${randSuffix}`;
  const simulatedAlertCode = `ALT-SIM-${randSuffix}`;

  const session = await TrainingSession.create({
    sessionCode,
    scenario: scenario._id,
    scenarioSnapshot,
    user: user._id,
    userEmail: user.email,
    userRole: user.role || 'SAFETY_OPERATOR',
    status: 'IN_PROGRESS',
    startedAt: new Date(),
    simulatedAlert: {
      alertCode: simulatedAlertCode,
      status: 'PENDING',
    },
  });

  // Track attempt count on scenario
  await TrainingScenario.updateOne({ _id: scenario._id }, { $inc: { attemptCount: 1 } });

  // Record internal training activity
  await TrainingActivity.create({
    session: session._id,
    user: user._id,
    userEmail: user.email,
    action: 'SESSION_STARTED',
    details: {
      sessionCode,
      scenarioCode: scenario.scenarioCode,
    },
  });

  // Record audit log
  await logAudit({
    action: 'TRAINING_SESSION_STARTED',
    entityType: 'TRAINING_SESSION',
    entityId: session._id,
    req,
    details: {
      sessionCode,
      scenarioCode: scenario.scenarioCode,
      userEmail: user.email,
    },
  });

  return sanitizeSession(session, user?.role === 'ADMIN');
};

const getSessionById = async (id, user) => {
  const session = await TrainingSession.findById(id).populate('scenario', 'title scenarioCode difficulty');
  if (!session) {
    const error = new Error('Training session not found');
    error.statusCode = 404;
    throw error;
  }

  const isAdmin = user?.role === 'ADMIN';
  const isOwner = session.user.toString() === user?._id.toString();

  if (!isAdmin && !isOwner) {
    const error = new Error('Access denied: You cannot view another operator\'s training session.');
    error.statusCode = 403;
    throw error;
  }

  return sanitizeSession(session, isAdmin);
};

const acknowledgeSession = async (id, remarks = '', user, req = null) => {
  const session = await TrainingSession.findById(id);
  if (!session) {
    const error = new Error('Training session not found');
    error.statusCode = 404;
    throw error;
  }

  const isAdmin = user?.role === 'ADMIN';
  const isOwner = session.user.toString() === user?._id.toString();
  if (!isAdmin && !isOwner) {
    const error = new Error('Access denied to modify this session');
    error.statusCode = 403;
    throw error;
  }

  if (session.status !== 'IN_PROGRESS') {
    const error = new Error(`Cannot acknowledge session in ${session.status} state.`);
    error.statusCode = 400;
    throw error;
  }

  session.simulatedAlert.status = 'ACKNOWLEDGED';
  if (!session.simulatedAlert.acknowledgedAt) {
    session.simulatedAlert.acknowledgedAt = new Date();
  }
  session.simulatedAlert.acknowledgedRemarks = remarks;
  await session.save();

  await TrainingActivity.create({
    session: session._id,
    user: user._id,
    userEmail: user.email,
    action: 'SESSION_ACKNOWLEDGED',
    details: { remarks },
  });

  await logAudit({
    action: 'TRAINING_SESSION_ACKNOWLEDGED',
    entityType: 'TRAINING_SESSION',
    entityId: session._id,
    req,
    details: { sessionCode: session.sessionCode },
  });

  return sanitizeSession(session, isAdmin);
};

const assessSession = async (id, assessmentData, user, req = null) => {
  const session = await TrainingSession.findById(id);
  if (!session) {
    const error = new Error('Training session not found');
    error.statusCode = 404;
    throw error;
  }

  const isAdmin = user?.role === 'ADMIN';
  const isOwner = session.user.toString() === user?._id.toString();
  if (!isAdmin && !isOwner) {
    const error = new Error('Access denied to modify this session');
    error.statusCode = 403;
    throw error;
  }

  if (session.status !== 'IN_PROGRESS') {
    const error = new Error(`Cannot assess session in ${session.status} state.`);
    error.statusCode = 400;
    throw error;
  }

  session.operatorAssessment = {
    ...session.operatorAssessment,
    ...assessmentData,
    submittedAt: new Date(),
  };

  await session.save();

  await TrainingActivity.create({
    session: session._id,
    user: user._id,
    userEmail: user.email,
    action: 'ASSESSMENT_SUBMITTED',
    details: {
      assessedViolationType: assessmentData.assessedViolationType,
      assessedSeverity: assessmentData.assessedSeverity,
    },
  });

  await logAudit({
    action: 'TRAINING_ASSESSMENT_SUBMITTED',
    entityType: 'TRAINING_SESSION',
    entityId: session._id,
    req,
    details: { sessionCode: session.sessionCode },
  });

  return sanitizeSession(session, isAdmin);
};

const recordCorrectiveAction = async (id, correctiveData, user, req = null) => {
  const session = await TrainingSession.findById(id);
  if (!session) {
    const error = new Error('Training session not found');
    error.statusCode = 404;
    throw error;
  }

  const isAdmin = user?.role === 'ADMIN';
  const isOwner = session.user.toString() === user?._id.toString();
  if (!isAdmin && !isOwner) {
    const error = new Error('Access denied to modify this session');
    error.statusCode = 403;
    throw error;
  }

  if (session.status !== 'IN_PROGRESS') {
    const error = new Error(`Cannot record corrective action in ${session.status} state.`);
    error.statusCode = 400;
    throw error;
  }

  session.operatorAssessment.correctiveActionCategory = correctiveData.correctiveActionCategory;
  if (correctiveData.correctiveActionRemarks !== undefined) {
    session.operatorAssessment.correctiveActionRemarks = correctiveData.correctiveActionRemarks;
  }

  await session.save();

  await TrainingActivity.create({
    session: session._id,
    user: user._id,
    userEmail: user.email,
    action: 'CORRECTIVE_ACTION_SAVED',
    details: {
      correctiveActionCategory: correctiveData.correctiveActionCategory,
    },
  });

  await logAudit({
    action: 'TRAINING_CORRECTIVE_ACTION_RECORDED',
    entityType: 'TRAINING_SESSION',
    entityId: session._id,
    req,
    details: { sessionCode: session.sessionCode },
  });

  return sanitizeSession(session, isAdmin);
};

const completeSession = async (id, completionData, user, req = null) => {
  const session = await TrainingSession.findById(id);
  if (!session) {
    const error = new Error('Training session not found');
    error.statusCode = 404;
    throw error;
  }

  const isAdmin = user?.role === 'ADMIN';
  const isOwner = session.user.toString() === user?._id.toString();
  if (!isAdmin && !isOwner) {
    const error = new Error('Access denied to modify this session');
    error.statusCode = 403;
    throw error;
  }

  if (session.status === 'COMPLETED') {
    const error = new Error('This training session has already been completed.');
    error.statusCode = 400;
    throw error;
  }

  if (session.status === 'ABANDONED') {
    const error = new Error('Cannot complete an abandoned training session.');
    error.statusCode = 400;
    throw error;
  }

  if (session.status !== 'IN_PROGRESS') {
    const error = new Error(`Cannot complete session in ${session.status} state.`);
    error.statusCode = 400;
    throw error;
  }

  const completedAt = new Date();
  const durationSeconds = Math.max(
    1,
    Math.round((completedAt.getTime() - new Date(session.startedAt).getTime()) / 1000)
  );

  // Update resolution state
  session.simulatedAlert.status = 'RESOLVED';
  session.simulatedAlert.resolvedAt = completedAt;
  session.simulatedAlert.resolutionRemarks = completionData.resolutionRemarks;

  // Run deterministic evaluation engine using frozen scenarioSnapshot
  const evaluation = evaluateSession({
    expected: session.scenarioSnapshot?.expectedEvaluation || {},
    assessment: session.operatorAssessment || {},
    simulatedAlert: session.simulatedAlert || {},
  });

  session.status = 'COMPLETED';
  session.completedAt = completedAt;
  session.durationSeconds = durationSeconds;
  session.evaluationResult = evaluation;

  await session.save();

  // Atomically update scenario completion count and average score
  try {
    const allCompletedForScenario = await TrainingSession.find({
      scenario: session.scenario,
      status: 'COMPLETED',
    }).select('evaluationResult.totalScore');

    const totalCompletions = allCompletedForScenario.length;
    const avgScore =
      totalCompletions > 0
        ? Math.round(
            allCompletedForScenario.reduce((acc, curr) => acc + (curr.evaluationResult?.totalScore || 0), 0) /
              totalCompletions
          )
        : evaluation.totalScore;

    await TrainingScenario.updateOne(
      { _id: session.scenario },
      {
        completionCount: totalCompletions,
        averageScore: avgScore,
      }
    );
  } catch (err) {
    console.warn('[TrainingService] Failed to update scenario average score:', err.message);
  }

  await TrainingActivity.create({
    session: session._id,
    user: user._id,
    userEmail: user.email,
    action: 'SESSION_COMPLETED',
    details: {
      totalScore: evaluation.totalScore,
      performanceBand: evaluation.performanceBand,
      durationSeconds,
    },
  });

  await logAudit({
    action: 'TRAINING_SESSION_COMPLETED',
    entityType: 'TRAINING_SESSION',
    entityId: session._id,
    req,
    details: {
      sessionCode: session.sessionCode,
      totalScore: evaluation.totalScore,
      performanceBand: evaluation.performanceBand,
    },
  });

  return sanitizeSession(session, true); // Completed sessions reveal evaluation feedback
};

const abandonSession = async (id, user, req = null) => {
  const session = await TrainingSession.findById(id);
  if (!session) {
    const error = new Error('Training session not found');
    error.statusCode = 404;
    throw error;
  }

  const isAdmin = user?.role === 'ADMIN';
  const isOwner = session.user.toString() === user?._id.toString();
  if (!isAdmin && !isOwner) {
    const error = new Error('Access denied to modify this session');
    error.statusCode = 403;
    throw error;
  }

  if (session.status !== 'IN_PROGRESS') {
    const error = new Error(`Cannot abandon session in ${session.status} state.`);
    error.statusCode = 400;
    throw error;
  }

  session.status = 'ABANDONED';
  session.completedAt = new Date();
  session.evaluationResult.performanceBand = 'INCOMPLETE';
  await session.save();

  await TrainingActivity.create({
    session: session._id,
    user: user._id,
    userEmail: user.email,
    action: 'SESSION_ABANDONED',
    details: {},
  });

  await logAudit({
    action: 'TRAINING_SESSION_ABANDONED',
    entityType: 'TRAINING_SESSION',
    entityId: session._id,
    req,
    details: { sessionCode: session.sessionCode },
  });

  return sanitizeSession(session, isAdmin);
};

// ---------------------------------------------------------------------------
// Statistics and History
// ---------------------------------------------------------------------------

const getTrainingStats = async (user) => {
  const isAdmin = user?.role === 'ADMIN';

  // Base scope for sessions: if operator, scoped strictly to user._id
  const sessionScope = isAdmin ? {} : { user: user._id };

  const [
    availableScenarios,
    totalScenarios,
    completedSessions,
    inProgressSessions,
    abandonedSessions,
    recentSessions,
    completedScores,
  ] = await Promise.all([
    TrainingScenario.countDocuments({ status: 'PUBLISHED' }),
    isAdmin ? TrainingScenario.countDocuments({}) : 0,
    TrainingSession.countDocuments({ ...sessionScope, status: 'COMPLETED' }),
    TrainingSession.countDocuments({ ...sessionScope, status: 'IN_PROGRESS' }),
    TrainingSession.countDocuments({ ...sessionScope, status: 'ABANDONED' }),
    TrainingSession.find(sessionScope)
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('scenario', 'title scenarioCode violationType severity')
      .lean(),
    TrainingSession.find({ ...sessionScope, status: 'COMPLETED' })
      .select('evaluationResult.totalScore evaluationResult.performanceBand scenarioSnapshot.violationType')
      .lean(),
  ]);

  const totalAttempted = completedSessions + inProgressSessions + abandonedSessions;
  const completionRate = totalAttempted > 0 ? Math.round((completedSessions / totalAttempted) * 100) : 0;

  const totalScoresSum = completedScores.reduce(
    (acc, s) => acc + (s.evaluationResult?.totalScore || 0),
    0
  );
  const averageScore = completedSessions > 0 ? Math.round(totalScoresSum / completedSessions) : 0;

  // Breakdown by violation category
  const violationCounts = {};
  completedScores.forEach((s) => {
    const vType = s.scenarioSnapshot?.violationType || 'OTHER';
    if (!violationCounts[vType]) {
      violationCounts[vType] = { total: 0, sumScore: 0 };
    }
    violationCounts[vType].total += 1;
    violationCounts[vType].sumScore += s.evaluationResult?.totalScore || 0;
  });

  const performanceByViolation = Object.entries(violationCounts).map(([type, data]) => ({
    violationType: type,
    completedCount: data.total,
    averageScore: Math.round(data.sumScore / data.total),
  }));

  // Performance band distribution
  const bandCounts = { EXCELLENT: 0, GOOD: 0, NEEDS_IMPROVEMENT: 0, INCOMPLETE: abandonedSessions };
  completedScores.forEach((s) => {
    const band = s.evaluationResult?.performanceBand || 'NEEDS_IMPROVEMENT';
    if (bandCounts[band] !== undefined) {
      bandCounts[band] += 1;
    }
  });

  return {
    kpis: {
      availableScenarios,
      totalScenarios: isAdmin ? totalScenarios : availableScenarios,
      completedSessions,
      inProgressSessions,
      abandonedSessions,
      averageScore,
      completionRate,
    },
    performanceByViolation,
    performanceBands: bandCounts,
    recentSessions: recentSessions.map((s) => sanitizeSession(s, isAdmin)),
  };
};

const getTrainingHistory = async (query = {}, user) => {
  const isAdmin = user?.role === 'ADMIN';
  const mongoQuery = {};

  if (!isAdmin) {
    mongoQuery.user = user._id;
  } else if (query.userId) {
    mongoQuery.user = query.userId;
  }

  if (query.status && query.status !== 'ALL') {
    mongoQuery.status = query.status;
  }

  if (query.search) {
    const escaped = escapeRegex(query.search);
    mongoQuery.$or = [
      { sessionCode: { $regex: escaped, $options: 'i' } },
      { 'scenarioSnapshot.title': { $regex: escaped, $options: 'i' } },
      { userEmail: { $regex: escaped, $options: 'i' } },
    ];
  }

  const page = Math.max(1, parseInt(query.page || 1, 10));
  const limit = Math.min(50, Math.max(1, parseInt(query.limit || 10, 10)));
  const skip = (page - 1) * limit;

  // Sorting allowlist
  const allowedSortFields = ['startedAt', 'completedAt', 'totalScore', 'createdAt'];
  const sortField = allowedSortFields.includes(query.sortBy) ? query.sortBy : 'startedAt';
  const sortOrder = query.sortOrder === 1 ? 1 : -1;

  const sortOptions = {};
  if (sortField === 'totalScore') {
    sortOptions['evaluationResult.totalScore'] = sortOrder;
  } else {
    sortOptions[sortField] = sortOrder;
  }

  const [total, sessions] = await Promise.all([
    TrainingSession.countDocuments(mongoQuery),
    TrainingSession.find(mongoQuery)
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .populate('scenario', 'title scenarioCode violationType severity difficulty')
      .lean(),
  ]);

  return {
    sessions: sessions.map((s) => sanitizeSession(s, isAdmin)),
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

module.exports = {
  seedDefaultScenarios,
  listScenarios,
  getScenarioById,
  createScenario,
  updateScenario,
  publishScenario,
  archiveScenario,
  startSession,
  getSessionById,
  acknowledgeSession,
  assessSession,
  recordCorrectiveAction,
  completeSession,
  abandonSession,
  getTrainingStats,
  getTrainingHistory,
};

