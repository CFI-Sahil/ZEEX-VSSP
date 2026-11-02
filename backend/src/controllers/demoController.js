const path = require('path');
const fs = require('fs');
const Alert = require('../models/Alert');
const Evidence = require('../models/Evidence');
const Camera = require('../models/Camera');
const { sendSuccess, sendError } = require('../utils/response');
const { ingestDemoEventSchema } = require('../validators/alertValidator');
const { logAudit } = require('../utils/auditLogger');
const { validateEvidenceFileOnDisk } = require('../utils/fileValidator');
const storageService = require('../services/storageService');

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
 * @desc    Simulate/ingest a safety detection event for demonstration (DEV ONLY)
 * @access  Protected (ADMIN, SAFETY_OPERATOR) - Development only
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

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const alertCode = `ALT-${randomSuffix}`;
    const evidenceCode = `EVD-${randomSuffix}`;

    const violationName = customName || VIOLATION_NAMES[violationType] || 'Safety Violation';

    // Requirement 3: File stored in private directory or Cloudinary, max 5MB, valid image signature
    const uploadsDir = path.resolve(__dirname, '../../uploads/evidence');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const sampleFileName =
      violationType === 'NO_HELMET'
        ? 'sample-helmet-violation.jpg'
        : 'sample-zone-breach.png';
    const filePath = path.join(uploadsDir, sampleFileName);

    // If file doesn't exist, create a valid 1x1 PNG image with proper magic numbers
    if (!fs.existsSync(filePath)) {
      const validPngBase64 =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      fs.writeFileSync(filePath, Buffer.from(validPngBase64, 'base64'));
    }

    // Delegate persistence to storageService (handles both local disk and Cloudinary)
    let storedEvidence;
    try {
      storedEvidence = await storageService.saveEvidenceSnapshot({
        localFilePath: filePath,
        fileName: sampleFileName,
        evidenceCode,
      });
    } catch (storageErr) {
      return sendError(
        res,
        `Evidence snapshot storage failed: ${storageErr.message}`,
        null,
        400
      );
    }

    // 1. Create Alert in PENDING status
    const alert = new Alert({
      alertCode,
      eventId,
      camera: camera._id,
      cameraCode: camera.cameraCode,
      violationType,
      violationName,
      severity,
      confidence: confidence || 0.92,
      status: 'PENDING',
      description: description || `Automated vision detection: ${violationName} detected at ${camera.name}`,
      location: camera.location,
      detectedAt: new Date(),
    });

    // 2. Create Associated Evidence
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
      capturedAt: new Date(),
      uploadedBy: req?.user?._id || null,
      description: `Snapshot evidence for ${alertCode}`,
    });

    alert.evidence = evidence._id;

    await Promise.all([alert.save(), evidence.save()]);

    // Requirement 6: Record operational audit events
    await logAudit({
      action: 'ALERT_CREATED',
      entityType: 'ALERT',
      entityId: alert._id,
      req,
      details: {
        alertCode,
        eventId,
        cameraCode: camera.cameraCode,
        violationType,
        severity,
        source: 'DEMO_DETECTION_INGESTION',
      },
    });

    const populatedAlert = await Alert.findById(alert._id)
      .populate('camera', 'cameraCode name site location status')
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
