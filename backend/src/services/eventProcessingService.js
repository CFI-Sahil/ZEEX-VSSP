const mongoose = require('mongoose');
const DetectionEvent = require('../models/DetectionEvent');
const Alert = require('../models/Alert');
const Camera = require('../models/Camera');
const AuditLog = require('../models/AuditLog');
const { getDetectionDefinition, isValidDetectionCode } = require('../constants/detectionRegistry');
const alertEnrichmentService = require('./alertEnrichmentService');
const notificationService = require('./notificationService');
const notificationDispatcher = require('./notificationDispatcher');
const { logAudit } = require('../utils/auditLogger');

/**
 * Builds the backward-compatible query for pending accepted detection events.
 * Correctly matches legacy Batch 1 events lacking `processingStatus` and recovers expired worker leases.
 *
 * @param {Object} [extraCriteria={}]
 * @returns {Object} MongoDB query filter
 */
const buildPendingFilter = (extraCriteria = {}) => ({
  status: 'ACCEPTED',
  processedByRuleEngine: { $ne: true },
  $or: [
    { processingStatus: 'PENDING' },
    { processingStatus: { $exists: false } },
    { processingStatus: null },
    { processingStatus: 'FAILED' },
    // Worker crash recovery: lease timeout after 30 seconds
    {
      processingStatus: 'PROCESSING',
      processingStartedAt: { $lt: new Date(Date.now() - 30000) },
    },
  ],
  ...extraCriteria,
});

/**
 * Executes a safety audit log for event processing and alert creation without failing the parent workflow
 */
const recordProcessingAudit = async ({ action, entityId, alert, event, req, details = {} }) => {
  try {
    const result = await logAudit({
      action,
      entityType: 'ALERT',
      entityId,
      req,
      details: {
        alertCode: alert?.alertCode,
        eventId: event.eventId,
        cameraCode: event.cameraCode,
        violationType: event.violationType,
        severity: alert?.severity,
        source: event.source,
        isEnriched: Boolean(alert?.workFrontCode),
        workFrontCode: alert?.workFrontCode || null,
        contractor: alert?.contractor || null,
        ...details,
      },
    });
    return Boolean(result);
  } catch (err) {
    console.error('[EventProcessingService] Audit logging non-blocking error:', err.message);
    return false;
  }
};

/**
 * Evaluates canonical rules, assigns deterministic severity with source tracking,
 * enriches with trusted operational context, and creates an Alert atomically.
 *
 * @param {string|mongoose.Types.ObjectId} eventIdentifier - MongoDB _id or eventId string
 * @param {Object} [context={}] - Execution context { user, req }
 * @returns {Promise<Object>} { success, alert, event, ruleEvaluation, message, isExisting }
 */
const processEvent = async (eventIdentifier, { user, req } = {}) => {
  // 1. Identify target event query: allow either ObjectId or eventId string
  const isObjectId = mongoose.Types.ObjectId.isValid(eventIdentifier);
  const targetFilter = isObjectId
    ? { _id: eventIdentifier }
    : { eventId: String(eventIdentifier).trim().toUpperCase() };

  // Check if event exists
  const existingEvent = await DetectionEvent.findOne(targetFilter);
  if (!existingEvent) {
    return {
      success: false,
      statusCode: 404,
      message: `Detection event '${eventIdentifier}' not found in intake registry`,
    };
  }

  // Idempotent shortcut: if already processed and linked to an alert, return existing alert
  if (existingEvent.processedByRuleEngine && existingEvent.associatedAlert) {
    const existingAlert = await Alert.findById(existingEvent.associatedAlert)
      .populate('camera', 'cameraCode name site location status streamStatus')
      .populate('workFront', 'workFrontCode name site zone contractor status')
      .populate('evidence');

    // Check if audit log was missed during previous execution, and safely backfill
    if (existingEvent.ruleEvaluation && existingEvent.ruleEvaluation.auditLogged === false) {
      // Scenario B Check: Does the audit log already exist in the database?
      const existingAudit = await AuditLog.findOne({
        action: 'ALERT_CREATED',
        'details.eventId': existingEvent.eventId,
      });

      if (existingAudit) {
        // Audit log exists: safely update flag without duplicate creation
        existingEvent.ruleEvaluation.auditLogged = true;
        await DetectionEvent.updateOne(
          { _id: existingEvent._id },
          { $set: { 'ruleEvaluation.auditLogged': true, 'ruleEvaluation.auditLeaseAt': null } }
        );
      } else {
        // Scenario A Check: Audit log is missing. Acquire atomic recovery lease to prevent concurrent recovery races
        const leasedEventForAudit = await DetectionEvent.findOneAndUpdate(
          {
            _id: existingEvent._id,
            'ruleEvaluation.auditLogged': false,
            $or: [
              { 'ruleEvaluation.auditLeaseAt': { $exists: false } },
              { 'ruleEvaluation.auditLeaseAt': null },
              { 'ruleEvaluation.auditLeaseAt': { $lt: new Date(Date.now() - 10000) } }, // 10s lease timeout
            ],
          },
          {
            $set: { 'ruleEvaluation.auditLeaseAt': new Date() },
          },
          { new: true }
        );

        if (leasedEventForAudit) {
          // Double-check after acquiring lease to guarantee zero duplicate creation under concurrency
          const recheckAudit = await AuditLog.findOne({
            action: 'ALERT_CREATED',
            'details.eventId': existingEvent.eventId,
          });

          if (!recheckAudit) {
            await recordProcessingAudit({
              action: 'ALERT_CREATED',
              entityId: existingAlert ? existingAlert._id : existingEvent.associatedAlert,
              alert: existingAlert,
              event: existingEvent,
              req,
              details: { recovery: true },
            });
          }

          existingEvent.ruleEvaluation.auditLogged = true;
          await DetectionEvent.updateOne(
            { _id: existingEvent._id },
            { $set: { 'ruleEvaluation.auditLogged': true, 'ruleEvaluation.auditLeaseAt': null } }
          );
        }
      }
    }

    return {
      success: true,
      statusCode: 200,
      isExisting: true,
      message: `Event '${existingEvent.eventId}' has already been processed by rule engine`,
      event: existingEvent,
      alert: existingAlert,
      ruleEvaluation: existingEvent.ruleEvaluation,
    };
  }

  // Reject non-ACCEPTED events
  if (existingEvent.status !== 'ACCEPTED') {
    return {
      success: false,
      statusCode: 400,
      message: `Cannot process event with status '${existingEvent.status}'. Only ACCEPTED events are eligible for rule processing.`,
    };
  }

  // 2. Atomic reservation lease: acquire document lock using findOneAndUpdate
  const leaseFilter = buildPendingFilter({ _id: existingEvent._id });
  const leasedEvent = await DetectionEvent.findOneAndUpdate(
    leaseFilter,
    {
      $set: {
        processingStatus: 'PROCESSING',
        processingStartedAt: new Date(),
        processingError: null,
      },
    },
    { new: true }
  );

  if (!leasedEvent) {
    // If not acquired, check if currently locked by an active worker
    const activeLease = await DetectionEvent.findOne({
      _id: existingEvent._id,
      processingStatus: 'PROCESSING',
    });
    if (activeLease) {
      return {
        success: false,
        statusCode: 409,
        message: `Event '${existingEvent.eventId}' is currently being processed by another worker lease`,
      };
    }

    return {
      success: false,
      statusCode: 409,
      message: `Event '${existingEvent.eventId}' could not be leased for processing`,
    };
  }

  try {
    // 3. Canonical Detection Registry Rule Evaluation
    if (!isValidDetectionCode(leasedEvent.violationType)) {
      const errorMsg = `Violation code '${leasedEvent.violationType}' is not recognized in canonical detection registry`;
      await DetectionEvent.updateOne(
        { _id: leasedEvent._id },
        {
          $set: {
            processingStatus: 'FAILED',
            processingError: errorMsg,
          },
        }
      );
      return {
        success: false,
        statusCode: 422,
        message: errorMsg,
      };
    }

    const detectionDef = getDetectionDefinition(leasedEvent.violationType);
    if (!detectionDef || !detectionDef.isActive) {
      const errorMsg = `Violation definition '${leasedEvent.violationType}' is marked inactive in canonical registry`;
      await DetectionEvent.updateOne(
        { _id: leasedEvent._id },
        {
          $set: {
            processingStatus: 'FAILED',
            processingError: errorMsg,
          },
        }
      );
      return {
        success: false,
        statusCode: 422,
        message: errorMsg,
      };
    }

    // 4. Deterministic Severity Assignment with Source Tracking
    let severity;
    let severitySource;
    if (
      leasedEvent.severity &&
      ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(leasedEvent.severity)
    ) {
      severity = leasedEvent.severity;
      severitySource = 'ASSIGNED_FROM_PAYLOAD';
    } else {
      severity = detectionDef.defaultSeverity || 'MEDIUM';
      severitySource = 'ASSIGNED_FROM_REGISTRY_DEFAULT';
    }

    // 5. Confidence Score Handling (No Arbitrary Suppression)
    const confidence =
      typeof leasedEvent.confidence === 'number' && leasedEvent.confidence >= 0
        ? leasedEvent.confidence
        : 0.92;

    // 6. Camera Fleet & Context Enrichment
    // Technical condition 4: Never discard accepted event if camera was deactivated post-intake
    let cameraDoc = null;
    if (leasedEvent.camera) {
      cameraDoc = await Camera.findById(leasedEvent.camera);
    }
    if (!cameraDoc && leasedEvent.cameraCode) {
      cameraDoc = await Camera.findOne({ cameraCode: leasedEvent.cameraCode.toUpperCase() });
    }

    if (!cameraDoc) {
      const errorMsg = `Associated camera record '${leasedEvent.cameraCode}' could not be located in database`;
      await DetectionEvent.updateOne(
        { _id: leasedEvent._id },
        {
          $set: {
            processingStatus: 'FAILED',
            processingError: errorMsg,
          },
        }
      );
      return {
        success: false,
        statusCode: 422,
        message: errorMsg,
      };
    }

    const cameraStatusAtProcessing = cameraDoc.isActive ? 'ACTIVE' : 'DEACTIVATED';

    // Resolve Work-Front operational context via enrichment service
    const enrichment = await alertEnrichmentService.resolveContext(cameraDoc);

    // 7. Check if Alert already exists for this eventId (Safe Idempotent Recovery)
    let alertDoc = await Alert.findOne({ eventId: leasedEvent.eventId });

    if (!alertDoc) {
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const alertCode = `ALT-${Date.now().toString(36).toUpperCase()}-${randomSuffix}`;
      const violationName = leasedEvent.violationName || detectionDef.name;

      const alertData = {
        alertCode,
        eventId: leasedEvent.eventId,
        detectionEvent: leasedEvent._id,
        camera: cameraDoc._id,
        cameraCode: cameraDoc.cameraCode,
        violationType: leasedEvent.violationType,
        violationName,
        severity,
        confidence,
        status: 'PENDING',
        description:
          leasedEvent.payload?.description ||
          `Automated vision detection: ${violationName} detected at ${cameraDoc.name} (${cameraDoc.location})`,
        location: cameraDoc.location || 'Monitored Site Area',
        detectedAt: leasedEvent.occurredAt || new Date(),
        metadata: {
          severitySource,
          cameraStatusAtProcessing,
          source: leasedEvent.source,
          detectionCategory: detectionDef.category,
        },
      };

      if (enrichment.isEnriched && enrichment.context) {
        alertData.workFront = enrichment.context.workFront;
        alertData.workFrontCode = enrichment.context.workFrontCode;
        alertData.workFrontName = enrichment.context.workFrontName;
        alertData.zone = enrichment.context.zone;
        alertData.contractor = enrichment.context.contractor;
        alertData.activityType = enrichment.context.activityType;
        alertData.riskLevel = enrichment.context.riskLevel;
        alertData.shift = enrichment.context.shift;
      }

      // 8. Atomic Persistence with Preferred MongoDB Transaction on Atlas Replica Set
      let session = null;
      let transactionCommitted = false;
      let stagedNotifications = [];

      try {
        session = await mongoose.startSession();
        session.startTransaction();

        const newAlert = new Alert(alertData);
        await newAlert.save({ session });

        // Stage initial Level 1 notifications within the transaction
        const notifResult = await notificationService.generateInitialAlertNotifications(
          newAlert,
          { session }
        );
        stagedNotifications = notifResult.stagedNotifications;

        const evaluationDetails = {
          ruleCode: leasedEvent.violationType,
          ruleName: violationName,
          category: detectionDef.category,
          severityAssigned: severity,
          severitySource,
          confidenceRecorded: confidence,
          isEnriched: Boolean(enrichment.isEnriched),
          cameraStatusAtProcessing,
          evaluatedAt: new Date(),
          auditLogged: false, // Updated post-commit
        };

        await DetectionEvent.updateOne(
          { _id: leasedEvent._id },
          {
            $set: {
              processedByRuleEngine: true,
              processingStatus: 'COMPLETED',
              associatedAlert: newAlert._id,
              processedAt: new Date(),
              processingError: null,
              ruleEvaluation: evaluationDetails,
            },
          },
          { session }
        );

        await session.commitTransaction();
        transactionCommitted = true;
        alertDoc = newAlert;
      } catch (transErr) {
        if (session && !transactionCommitted) {
          try {
            await session.abortTransaction();
          } catch (_) {}
        }

        // If error indicates transactions are unsupported (e.g. standalone test environment),
        // fallback to sequential save backed by database-enforced unique index
        if (
          transErr.message &&
          (transErr.message.includes('Transaction numbers are only allowed on a replica set') ||
            transErr.message.includes('replica set member or mongos'))
        ) {
          const fallbackAlert = new Alert(alertData);
          await fallbackAlert.save();

          const notifResult = await notificationService.generateInitialAlertNotifications(fallbackAlert);
          stagedNotifications = notifResult.stagedNotifications;

          const evaluationDetails = {
            ruleCode: leasedEvent.violationType,
            ruleName: violationName,
            category: detectionDef.category,
            severityAssigned: severity,
            severitySource,
            confidenceRecorded: confidence,
            isEnriched: Boolean(enrichment.isEnriched),
            cameraStatusAtProcessing,
            evaluatedAt: new Date(),
            auditLogged: false,
          };

          await DetectionEvent.updateOne(
            { _id: leasedEvent._id },
            {
              $set: {
                processedByRuleEngine: true,
                processingStatus: 'COMPLETED',
                associatedAlert: fallbackAlert._id,
                processedAt: new Date(),
                processingError: null,
                ruleEvaluation: evaluationDetails,
              },
            }
          );

          alertDoc = fallbackAlert;
        } else {
          // Genuine transaction error: rethrow to failure recovery
          throw transErr;
        }
      } finally {
        if (session) {
          session.endSession();
        }
      }

      // Post-commit dispatch: strictly executed outside the transaction boundary
      if (stagedNotifications && stagedNotifications.length > 0) {
        notificationDispatcher.dispatchBatch(stagedNotifications).catch((err) => {
          console.error('[EventProcessingService] Notification dispatch error:', err.message);
        });
      }
    } else {
      // Alert already exists in database: link safely without duplicate insert
      const evaluationDetails = {
        ruleCode: leasedEvent.violationType,
        ruleName: leasedEvent.violationName || detectionDef.name,
        category: detectionDef.category,
        severityAssigned: severity,
        severitySource,
        confidenceRecorded: confidence,
        isEnriched: Boolean(enrichment.isEnriched),
        cameraStatusAtProcessing,
        evaluatedAt: new Date(),
        isExistingAlertRecovery: true,
        auditLogged: false,
      };

      await DetectionEvent.updateOne(
        { _id: leasedEvent._id },
        {
          $set: {
            processedByRuleEngine: true,
            processingStatus: 'COMPLETED',
            associatedAlert: alertDoc._id,
            processedAt: new Date(),
            processingError: null,
            ruleEvaluation: evaluationDetails,
          },
        }
      );
    }

    // 9. Failure-Safe Audit Logging (Condition 2)
    const auditSuccess = await recordProcessingAudit({
      action: 'ALERT_CREATED',
      entityId: alertDoc._id,
      alert: alertDoc,
      event: leasedEvent,
      req,
    });

    if (auditSuccess) {
      await DetectionEvent.updateOne(
        { _id: leasedEvent._id },
        { $set: { 'ruleEvaluation.auditLogged': true } }
      );
    }

    // Return populated records
    const populatedAlert = await Alert.findById(alertDoc._id)
      .populate('camera', 'cameraCode name site location status streamStatus')
      .populate('workFront', 'workFrontCode name site zone contractor status')
      .populate('evidence');

    const updatedEvent = await DetectionEvent.findById(leasedEvent._id)
      .populate('camera', 'cameraCode name site location status streamStatus')
      .populate('submittedBy', 'name email role');

    return {
      success: true,
      statusCode: 201,
      message: `Detection event '${leasedEvent.eventId}' successfully evaluated and alert '${alertDoc.alertCode}' generated`,
      alert: populatedAlert,
      event: updatedEvent,
      ruleEvaluation: updatedEvent.ruleEvaluation,
    };
  } catch (error) {
    console.error(`[EventProcessingService] Processing failure for event '${leasedEvent.eventId}':`, error);

    // Safe Failure Recovery: Mark event as FAILED, never delete alert or falsely mark processed
    await DetectionEvent.updateOne(
      { _id: leasedEvent._id },
      {
        $set: {
          processingStatus: 'FAILED',
          processingError: error.message || 'Unknown processing error',
        },
      }
    );

    return {
      success: false,
      statusCode: 500,
      message: `Event processing failed: ${error.message}`,
      eventId: leasedEvent.eventId,
      error: error.message,
    };
  }
};

/**
 * Sweeps and processes pending accepted events in batch queue
 *
 * @param {Object} [options={}]
 * @param {number} [options.limit=10] - Batch size (max 50)
 * @param {Object} [options.context={}] - Execution context { user, req }
 * @returns {Promise<Object>} Batch processing execution metrics
 */
const processQueue = async ({ limit = 10, context = {} } = {}) => {
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);

  // Retrieve eligible event candidates using backward-compatible pending filter
  const candidates = await DetectionEvent.find(buildPendingFilter())
    .sort({ receivedAt: 1 }) // FIFO processing
    .limit(safeLimit)
    .select('_id eventId cameraCode violationType receivedAt');

  const results = [];
  let processedCount = 0;
  let alertsCreated = 0;
  let failedCount = 0;

  for (const candidate of candidates) {
    const outcome = await processEvent(candidate._id, context);
    results.push({
      eventId: candidate.eventId,
      success: outcome.success,
      statusCode: outcome.statusCode,
      message: outcome.message,
      alertCode: outcome.alert?.alertCode || null,
      isExisting: Boolean(outcome.isExisting),
    });

    if (outcome.success) {
      processedCount++;
      if (!outcome.isExisting) {
        alertsCreated++;
      }
    } else {
      failedCount++;
    }
  }

  return {
    candidatesFound: candidates.length,
    processedCount,
    alertsCreated,
    failedCount,
    results,
  };
};

/**
 * Retrieves real-time operational metrics for the event processing pipeline
 *
 * @returns {Promise<Object>} Processing queue status metrics
 */
const getProcessingQueueStats = async () => {
  const [
    totalAccepted,
    pending,
    processing,
    completed,
    failed,
    totalAlertsFromEvents,
  ] = await Promise.all([
    DetectionEvent.countDocuments({ status: 'ACCEPTED' }),
    DetectionEvent.countDocuments(buildPendingFilter()),
    DetectionEvent.countDocuments({
      status: 'ACCEPTED',
      processingStatus: 'PROCESSING',
      processingStartedAt: { $gte: new Date(Date.now() - 30000) },
    }),
    DetectionEvent.countDocuments({ status: 'ACCEPTED', processedByRuleEngine: true }),
    DetectionEvent.countDocuments({ status: 'ACCEPTED', processingStatus: 'FAILED' }),
    Alert.countDocuments({ eventId: { $exists: true, $ne: null } }),
  ]);

  const completionRate =
    totalAccepted > 0 ? Number(((completed / totalAccepted) * 100).toFixed(1)) : 100.0;

  return {
    totalAccepted,
    pending,
    processing,
    completed,
    failed,
    completionRate,
    totalAlertsFromEvents,
  };
};

module.exports = {
  processEvent,
  processQueue,
  getProcessingQueueStats,
  buildPendingFilter,
};

