const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Alert = require('../models/Alert');
const Evidence = require('../models/Evidence');
const Camera = require('../models/Camera');
const { sendSuccess, sendError } = require('../utils/response');
const { ingestDemoEventSchema } = require('../validators/alertValidator');
const { logAudit } = require('../utils/auditLogger');
const { validateEvidenceFileOnDisk } = require('../utils/fileValidator');
const storageService = require('../services/storageService');
const alertEnrichmentService = require('../services/alertEnrichmentService');
const notificationService = require('../services/notificationService');
const notificationDispatcher = require('../services/notificationDispatcher');

const VIOLATION_NAMES = {
  NO_HELMET: 'Missing Safety Helmet',
  NO_VEST: 'Missing High-Vis Vest',
  UNAUTHORIZED_ZONE: 'Unauthorized Zone Entry',
  NO_SAFETY_BOOTS: 'Missing Protective Footwear',
  RESTRICTED_ACCESS: 'Restricted Facility Breach',
  OTHER: 'General Safety Non-Compliance',
};

/**
 * @route   POST /api/v1/demo/ingest-event
 * @desc    Simulate/ingest a safety detection event for demonstration
 * @access  Protected (ADMIN, SAFETY_OPERATOR)
 */
const ingestDemoEvent = async (req, res, next) => {
  try {
    const parseResult = ingestDemoEventSchema.safeParse(req.body);
    if (!parseResult.success) {
      return sendError(
        res,
        'Invalid detection event payload',
        parseResult.error.issues.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        })),
        400
      );
    }

    const {
      eventId: customEventId,
      cameraCode,
      violationType,
      violationName: customName,
      severity,
      confidence,
      description,
    } = parseResult.data;

    // Requirement 1: Ingestion must accept only existing, active registered cameras. Never create automatically.
    const camera = await Camera.findOne({ cameraCode: cameraCode.toUpperCase(), isActive: true });
    if (!camera) {
      return sendError(
        res,
        `Camera '${cameraCode.toUpperCase()}' is not a registered, active camera. Detection events must target existing registered cameras only.`,
        [{ field: 'cameraCode', message: 'Camera record not found in active registry' }],
        404
      );
    }

    // Requirement 2: Prevent duplicate eventId submissions
    const eventId =
      customEventId || `EVT-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const existingEvent = await Alert.findOne({ eventId });
    if (existingEvent) {
      return sendError(
        res,
        `Duplicate detection event: eventId '${eventId}' has already been processed.`,
        [{ field: 'eventId', message: 'Event identifier already exists' }],
        400
      );
    }

    // Step 1: Generate high-entropy collision-resistant identifiers
    const uniqueSuffix = `${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const alertCode = `ALT-${uniqueSuffix}`;
    const evidenceCode = `EVD-${uniqueSuffix}`;
    const publicId = `${process.env.CLOUDINARY_FOLDER || 'ZEEX VSSP/Evidence'}/${evidenceCode}`;

    const violationName = customName || VIOLATION_NAMES[violationType] || 'Safety Violation';

    // File stored in private directory or Cloudinary, max 5MB, valid image signature
    const uploadsDir = path.resolve(__dirname, '../../uploads/evidence');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const sampleFileName =
      violationType === 'NO_HELMET'
        ? 'sample-helmet-violation.jpg'
        : 'sample-zone-breach.png';
    const filePath = path.join(uploadsDir, sampleFileName);

    // If file doesn't exist in uploads, copy from bundled fixtures or fallback to 1x1 image
    if (!fs.existsSync(filePath)) {
      const bundledPath = path.join(storageService.BUNDLED_ASSETS_DIR || path.resolve(__dirname, '../assets/evidence'), sampleFileName);
      if (fs.existsSync(bundledPath)) {
        fs.copyFileSync(bundledPath, filePath);
      } else {
        const validPngBase64 =
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
        fs.writeFileSync(filePath, Buffer.from(validPngBase64, 'base64'));
      }
    }

    // Resolve Work-Front operational context via enrichment service (Batch 3)
    const enrichment = await alertEnrichmentService.resolveContext(camera);

    // Step 2: Build Alert with durable evidence intent in MongoDB
    const alertData = {
      alertCode,
      eventId,
      camera: camera._id,
      cameraCode: camera.cameraCode,
      violationType,
      violationName,
      severity,
      confidence: confidence || 0.92,
      status: 'PENDING',
      escalationLevel: 1,
      description: description || `Automated vision detection: ${violationName} detected at ${camera.name}`,
      location: camera.location,
      detectedAt: new Date(),
      evidence: null,
      metadata: {
        evidenceStatus: 'EVIDENCE_PENDING_UPLOAD',
        evidenceIntent: {
          evidenceCode,
          publicId,
          fileName: sampleFileName,
          stagedAt: new Date(),
        },
      },
    };

    // Attach backend-derived operational context if camera has an eligible Work-Front mapping
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

    // Step 3: Persist Alert FIRST in MongoDB (confirm persistence before upload)
    const alert = new Alert(alertData);
    await alert.save();

    // Step 4: Delegate upload to storageService with overwrite: false
    let storedEvidence;
    try {
      storedEvidence = await storageService.saveEvidenceSnapshot({
        localFilePath: filePath,
        fileName: sampleFileName,
        evidenceCode,
      });
    } catch (storageErr) {
      // Alert remains safely in MongoDB with evidenceStatus = 'EVIDENCE_RECOVERY_PENDING'
      alert.metadata.evidenceStatus = 'EVIDENCE_RECOVERY_PENDING';
      alert.metadata.lastTransientError = storageErr.message;
      alert.markModified('metadata');
      await alert.save();

      return sendError(
        res,
        `Evidence snapshot storage failed: ${storageErr.message}`,
        null,
        400
      );
    }

    // Step 5: Create and persist Associated Evidence
    const evidence = new Evidence({
      evidenceCode,
      alert: alert._id,
      alertCode: alert.alertCode,
      camera: camera._id,
      cameraCode: camera.cameraCode,
      fileName: storedEvidence.fileName,
      filePath: storedEvidence.filePath,
      fileType: storedEvidence.fileType,
      fileSize: storedEvidence.fileSize,
      storageDriver: storedEvidence.storageDriver,
      cloudinaryPublicId: storedEvidence.cloudinaryPublicId,
      cloudinaryUrl: storedEvidence.cloudinaryUrl,
      checksumSha256: storedEvidence.checksumSha256 || null,
      lastIntegrityStatus: storedEvidence.checksumSha256 ? 'VERIFIED' : 'NOT_YET_VERIFIED',
      lastVerifiedAt: storedEvidence.checksumSha256 ? new Date() : null,
      capturedAt: new Date(),
      uploadedBy: req?.user?._id || null,
      description: `Snapshot evidence for ${alertCode}`,
    });
    await evidence.save();

    // Step 6: Link Evidence and finalize Alert evidence status
    alert.evidence = evidence._id;
    alert.metadata.evidenceStatus = 'EVIDENCE_AVAILABLE';
    delete alert.metadata.evidenceIntent;
    alert.markModified('metadata');
    await alert.save();

    // Record operational audit event
    const auditDetails = {
      alertCode,
      eventId,
      cameraCode: camera.cameraCode,
      violationType,
      severity,
      source: 'DEMO_DETECTION_INGESTION',
      isEnriched: Boolean(enrichment.isEnriched),
    };

    if (enrichment.isEnriched && enrichment.context) {
      auditDetails.workFrontCode = enrichment.context.workFrontCode;
      auditDetails.contractor = enrichment.context.contractor;
    }

    await logAudit({
      action: 'ALERT_CREATED',
      entityType: 'ALERT',
      entityId: alert._id,
      req,
      details: auditDetails,
    });

    // Step 7: Generate and dispatch initial Level 1 notifications
    try {
      const notifResult = await notificationService.generateInitialAlertNotifications(alert);
      if (notifResult.stagedNotifications && notifResult.stagedNotifications.length > 0) {
        notificationDispatcher.dispatchBatch(notifResult.stagedNotifications).catch((err) => {
          console.error('[DemoController] Initial notification dispatch error:', err.message);
        });
      }
    } catch (notifErr) {
      console.error('[DemoController] Failed to generate initial notifications:', notifErr.message);
    }

    const populatedAlert = await Alert.findById(alert._id)
      .populate('camera', 'cameraCode name site location status')
      .populate('workFront', 'workFrontCode name site zone contractor status')
      .populate('evidence');

    return sendSuccess(
      res,
      'Detection event ingested and safety alert created successfully',
      {
        alert: populatedAlert,
        evidence,
      },
      null,
      201
    );
  } catch (error) {
    if (error.code === 11000) {
      return sendError(
        res,
        'Duplicate event or alert identifier detected. Submissions must have unique identifiers.',
        [{ field: 'eventId', message: 'Identifier collision' }],
        400
      );
    }
    next(error);
  }
};

module.exports = {
  ingestDemoEvent,
};
