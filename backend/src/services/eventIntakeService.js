const DetectionEvent = require('../models/DetectionEvent');
const Camera = require('../models/Camera');
const { getDetectionDefinition } = require('../constants/detectionRegistry');
const { eventIntakeSchema, eventQuerySchema } = require('../validators/eventIntakeValidator');
const { logAudit } = require('../utils/auditLogger');

/**
 * Strips dangerous prototype properties and sanitizes payload for storage
 */
const sanitizePayload = (raw) => {
  if (!raw || typeof raw !== 'object') return {};
  const clean = {};
  for (const [key, val] of Object.entries(raw)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    if (typeof val === 'string') {
      clean[key] = val.slice(0, 1000); // Prevent gigantic string blobs
    } else if (typeof val === 'number' || typeof val === 'boolean' || val === null) {
      clean[key] = val;
    } else if (typeof val === 'object' && !Array.isArray(val)) {
      clean[key] = sanitizePayload(val);
    }
  }
  return clean;
};

/**
 * Ingests and validates an incoming detection event
 * Does NOT create alerts or evidence records (Phase 3 Batch 1 scope boundary).
 *
 * @param {Object} rawPayload - Raw incoming payload from request body
 * @param {Object} context - Execution context { user, ipAddress, req }
 * @returns {Promise<Object>} { success, statusCode, event, message, validationErrors }
 */
const receiveEvent = async (rawPayload, { user, ipAddress, req } = {}) => {
  // Step 1: Validate payload schema & types via Zod
  const parseResult = eventIntakeSchema.safeParse(rawPayload);

  if (!parseResult.success) {
    const validationErrors = parseResult.error.issues.map((err) => ({
      field: err.path.join('.'),
      message: err.message,
    }));

    const safeEventId =
      typeof rawPayload?.eventId === 'string' && rawPayload.eventId.trim().length >= 3
        ? `REJ-${rawPayload.eventId.trim().toUpperCase()}-${Date.now().toString(36).toUpperCase()}`
        : `REJ-MALFORMED-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const rejectedEvent = new DetectionEvent({
      eventId: safeEventId,
      source: rawPayload?.source === 'EXTERNAL_CV' ? 'EXTERNAL_CV' : 'DEMO',
      camera: null,
      cameraCode:
        typeof rawPayload?.cameraCode === 'string'
          ? rawPayload.cameraCode.trim().toUpperCase().slice(0, 50)
          : 'UNKNOWN',
      violationType:
        typeof rawPayload?.violationType === 'string'
          ? rawPayload.violationType.trim().toUpperCase().slice(0, 50)
          : null,
      violationName: null,
      severity: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(rawPayload?.severity)
        ? rawPayload.severity
        : null,
      confidence: typeof rawPayload?.confidence === 'number' ? rawPayload.confidence : null,
      status: 'REJECTED',
      rejectionReason: 'Event payload validation failed: mandatory fields missing or malformed',
      validationErrors,
      payload: sanitizePayload(rawPayload),
      receivedAt: new Date(),
      submittedBy: user?._id || null,
      ipAddress: ipAddress || '',
    });

    await rejectedEvent.save();

    if (req) {
      logAudit({
        action: 'EVENT_INTAKE_REJECTED',
        entityType: 'EVENT',
        entityId: safeEventId,
        req,
        details: {
          reason: rejectedEvent.rejectionReason,
          errorsCount: validationErrors.length,
          cameraCode: rejectedEvent.cameraCode,
        },
      });
    }

    return {
      success: false,
      statusCode: 400,
      message: 'Event payload validation failed',
      intakeStatus: 'REJECTED',
      eventId: safeEventId,
      validationErrors,
    };
  }

  const data = parseResult.data;

  // Step 2: Check eventId uniqueness if supplied, or generate a cryptographically safe one
  let normalizedEventId;
  if (data.eventId) {
    normalizedEventId = data.eventId.trim().toUpperCase();
    const existingAccepted = await DetectionEvent.findOne({
      eventId: normalizedEventId,
      status: 'ACCEPTED',
    });

    if (existingAccepted) {
      const duplicateRejectionId = `REJ-${normalizedEventId}-${Date.now().toString(36).toUpperCase()}`;
      const duplicateRecord = new DetectionEvent({
        eventId: duplicateRejectionId,
        source: data.source || 'DEMO',
        camera: existingAccepted.camera,
        cameraCode: data.cameraCode,
        violationType: data.violationType,
        violationName: data.violationName || null,
        severity: data.severity,
        confidence: data.confidence,
        status: 'REJECTED',
        rejectionReason: `Duplicate event identifier: Event ID '${normalizedEventId}' has already been accepted`,
        validationErrors: [
          {
            field: 'eventId',
            message: `Event identifier '${normalizedEventId}' has already been processed and accepted`,
          },
        ],
        payload: {
          attemptedEventId: normalizedEventId,
          ...sanitizePayload(data),
        },
        receivedAt: new Date(),
        submittedBy: user?._id || null,
        ipAddress: ipAddress || '',
      });

      await duplicateRecord.save();

      if (req) {
        logAudit({
          action: 'EVENT_INTAKE_REJECTED',
          entityType: 'EVENT',
          entityId: duplicateRejectionId,
          req,
          details: {
            reason: duplicateRecord.rejectionReason,
            attemptedEventId: normalizedEventId,
          },
        });
      }

      return {
        success: false,
        statusCode: 409,
        message: `Duplicate detection event: eventId '${normalizedEventId}' has already been accepted`,
        intakeStatus: 'REJECTED',
        eventId: duplicateRejectionId,
        validationErrors: duplicateRecord.validationErrors,
      };
    }
  } else {
    normalizedEventId = `EVT-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  // Step 3: Camera Verification (active registered camera check, stream status is irrelevant)
  const camera = await Camera.findOne({
    cameraCode: data.cameraCode.toUpperCase(),
  });

  if (!camera || !camera.isActive) {
    const rejectionReason = !camera
      ? `Camera '${data.cameraCode.toUpperCase()}' is not a registered camera in fleet registry`
      : `Camera '${data.cameraCode.toUpperCase()}' is registered but currently deactivated`;

    const rejectedCameraEvent = new DetectionEvent({
      eventId: normalizedEventId,
      source: data.source || 'DEMO',
      camera: camera ? camera._id : null,
      cameraCode: data.cameraCode.toUpperCase(),
      violationType: data.violationType,
      violationName: data.violationName || null,
      severity: data.severity,
      confidence: data.confidence,
      status: 'REJECTED',
      rejectionReason,
      validationErrors: [
        {
          field: 'cameraCode',
          message: rejectionReason,
        },
      ],
      payload: sanitizePayload(data),
      receivedAt: new Date(),
      submittedBy: user?._id || null,
      ipAddress: ipAddress || '',
    });

    await rejectedCameraEvent.save();

    if (req) {
      logAudit({
        action: 'EVENT_INTAKE_REJECTED',
        entityType: 'EVENT',
        entityId: normalizedEventId,
        req,
        details: {
          reason: rejectionReason,
          cameraCode: data.cameraCode.toUpperCase(),
        },
      });
    }

    return {
      success: false,
      statusCode: 422,
      message: rejectionReason,
      intakeStatus: 'REJECTED',
      eventId: normalizedEventId,
      validationErrors: rejectedCameraEvent.validationErrors,
    };
  }

  // Step 4: Resolve Canonical Violation Name
  const detectionDef = getDetectionDefinition(data.violationType);
  const violationName = data.violationName || detectionDef?.name || data.violationType;

  // Step 5: Persist Accepted Event
  // Strictly DOES NOT create Alert or Evidence (Phase 3 Batch 1 boundary)
  const acceptedEvent = new DetectionEvent({
    eventId: normalizedEventId,
    source: data.source || 'DEMO',
    camera: camera._id,
    cameraCode: camera.cameraCode,
    violationType: data.violationType,
    violationName,
    severity: data.severity,
    confidence: data.confidence,
    status: 'ACCEPTED',
    rejectionReason: null,
    validationErrors: [],
    payload: sanitizePayload(data),
    evidenceMetadata: data.evidenceMetadata || null,
    occurredAt: data.occurredAt ? new Date(data.occurredAt) : new Date(),
    receivedAt: new Date(),
    processedByRuleEngine: false, // Ready for Batch 2 consumption
    processingStatus: 'PENDING',
    associatedAlert: null,
    submittedBy: user?._id || null,
    ipAddress: ipAddress || '',
  });

  await acceptedEvent.save();

  if (req) {
    logAudit({
      action: 'EVENT_INTAKE_ACCEPTED',
      entityType: 'EVENT',
      entityId: normalizedEventId,
      req,
      details: {
        cameraCode: camera.cameraCode,
        violationType: data.violationType,
        severity: data.severity,
        source: acceptedEvent.source,
      },
    });
  }

  return {
    success: true,
    statusCode: 201,
    message: 'Detection event successfully ingested and accepted',
    intakeStatus: 'ACCEPTED',
    event: {
      id: acceptedEvent._id,
      eventId: acceptedEvent.eventId,
      source: acceptedEvent.source,
      cameraCode: acceptedEvent.cameraCode,
      violationType: acceptedEvent.violationType,
      violationName: acceptedEvent.violationName,
      severity: acceptedEvent.severity,
      confidence: acceptedEvent.confidence,
      status: acceptedEvent.status,
      occurredAt: acceptedEvent.occurredAt,
      receivedAt: acceptedEvent.receivedAt,
      processedByRuleEngine: acceptedEvent.processedByRuleEngine,
      camera: {
        id: camera._id,
        cameraCode: camera.cameraCode,
        name: camera.name,
        site: camera.site,
        location: camera.location,
        streamStatus: camera.streamStatus,
      },
    },
  };
};

/**
 * Lists paginated detection event intake records with filters
 */
const getIntakeEvents = async (queryParams) => {
  const parseResult = eventQuerySchema.safeParse(queryParams);
  if (!parseResult.success) {
    throw new Error(`Invalid query parameters: ${parseResult.error.issues.map((i) => i.message).join(', ')}`);
  }

  const { page, limit, search, status, source, cameraCode } = parseResult.data;
  const filter = {};

  if (status && status !== 'ALL') {
    filter.status = status;
  }

  if (source && source !== 'ALL') {
    filter.source = source;
  }

  if (cameraCode && cameraCode.trim()) {
    filter.cameraCode = cameraCode.trim().toUpperCase();
  }

  if (search && search.trim()) {
    const searchRegex = new RegExp(search.trim(), 'i');
    filter.$or = [{ eventId: searchRegex }, { cameraCode: searchRegex }, { violationType: searchRegex }];
  }

  const skip = (page - 1) * limit;

  const [events, total] = await Promise.all([
    DetectionEvent.find(filter)
      .sort({ receivedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('camera', 'cameraCode name site location status streamStatus')
      .populate('associatedAlert', 'alertCode violationType severity status detectedAt')
      .populate('submittedBy', 'name email role'),
    DetectionEvent.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / limit) || 1;

  return {
    events,
    meta: {
      page,
      limit,
      total,
      totalPages,
    },
  };
};

/**
 * Aggregates high-level intake metrics
 */
const getIntakeStats = async () => {
  const [total, accepted, rejected, failed, uniqueCameras] = await Promise.all([
    DetectionEvent.countDocuments(),
    DetectionEvent.countDocuments({ status: 'ACCEPTED' }),
    DetectionEvent.countDocuments({ status: 'REJECTED' }),
    DetectionEvent.countDocuments({ status: 'FAILED' }),
    DetectionEvent.distinct('cameraCode'),
  ]);

  const acceptanceRate = total > 0 ? Number(((accepted / total) * 100).toFixed(1)) : 100.0;

  return {
    total,
    accepted,
    rejected,
    failed,
    acceptanceRate,
    uniqueCamerasCount: uniqueCameras.length,
  };
};

/**
 * Retrieves a single detection event intake record by ID
 */
const getIntakeEventById = async (id) => {
  const event = await DetectionEvent.findById(id)
    .populate('camera', 'cameraCode name site location status streamStatus workFront')
    .populate('associatedAlert')
    .populate('submittedBy', 'name email role');
  return event;
};

module.exports = {
  receiveEvent,
  getIntakeEvents,
  getIntakeStats,
  getIntakeEventById,
};

