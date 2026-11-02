const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const Evidence = require('../models/Evidence');
const { sendSuccess, sendError } = require('../utils/response');
const { evidenceQuerySchema } = require('../validators/alertValidator');
const { logAudit } = require('../utils/auditLogger');
const { validateEvidenceFileOnDisk } = require('../utils/fileValidator');

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const EVIDENCE_BASE_DIR = path.resolve(__dirname, '../../uploads/evidence');

/**
 * @route   GET /api/v1/evidence
 * @desc    List evidence snapshot records with pagination and filtering
 * @access  Protected (ADMIN, SAFETY_OPERATOR)
 */
const getEvidenceList = async (req, res, next) => {
  try {
    const parseResult = evidenceQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      return sendError(res, 'Invalid query parameters', parseResult.error.issues, 400);
    }

    const { page, limit, cameraCode, alertCode } = parseResult.data;
    const filter = { isActive: true };

    if (cameraCode && cameraCode.trim()) {
      filter.cameraCode = cameraCode.trim().toUpperCase();
    }

    if (alertCode && alertCode.trim()) {
      filter.alertCode = alertCode.trim().toUpperCase();
    }

    const skip = (page - 1) * limit;

    const [evidence, total] = await Promise.all([
      Evidence.find(filter)
        .sort({ capturedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('alert', 'alertCode eventId violationName severity status detectedAt')
        .populate('camera', 'cameraCode name site location'),
      Evidence.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return sendSuccess(
      res,
      'Evidence records retrieved successfully',
      { evidence },
      {
        page,
        limit,
        total,
        totalPages,
      }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/evidence/:id
 * @desc    Get detailed evidence metadata by ID
 * @access  Protected (ADMIN, SAFETY_OPERATOR)
 */
const getEvidenceById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid evidence identifier format', null, 400);
    }

    const evidence = await Evidence.findOne({ _id: id, isActive: true })
      .populate('alert', 'alertCode eventId violationName severity status detectedAt closureRemarks')
      .populate('camera', 'cameraCode name site location');

    if (!evidence) {
      return sendError(res, 'Evidence record not found', null, 404);
    }

    return sendSuccess(res, 'Evidence metadata retrieved successfully', { evidence });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/evidence/:id/file
 * @desc    Securely stream snapshot image file (JPEG, PNG, WebP only)
 * @access  Protected (ADMIN, SAFETY_OPERATOR)
 */
const getEvidenceFile = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid evidence identifier format', null, 400);
    }

    const evidence = await Evidence.findOne({ _id: id, isActive: true });
    if (!evidence) {
      return sendError(res, 'Evidence record not found', null, 404);
    }

    // Verify MIME type is strictly JPEG, PNG, or WebP
    if (!ALLOWED_MIME_TYPES.includes(evidence.fileType)) {
      return sendError(res, 'Unsupported evidence file format. Allowed types: JPEG, PNG, WebP.', null, 415);
    }

    // Prevent path traversal by resolving and checking strictly within EVIDENCE_BASE_DIR
    const safeFileName = path.basename(evidence.fileName);
    const resolvedPath = path.resolve(EVIDENCE_BASE_DIR, safeFileName);

    if (!resolvedPath.startsWith(EVIDENCE_BASE_DIR)) {
      return sendError(res, 'Access denied: Path traversal detected', null, 403);
    }

    if (!fs.existsSync(resolvedPath)) {
      // Fallback: check if the exact filePath exists
      const fallbackPath = path.resolve(EVIDENCE_BASE_DIR, path.basename(evidence.filePath));
      if (!fs.existsSync(fallbackPath)) {
        return sendError(res, 'Snapshot image file not found on server disk', null, 404);
      }
      return sendFileSecurely(res, fallbackPath, evidence, req);
    }

    return sendFileSecurely(res, resolvedPath, evidence, req);
  } catch (error) {
    next(error);
  }
};

const sendFileSecurely = (res, filePath, evidence, req) => {
  // Validate file signature and size (max 5 MB) prior to streaming
  const validation = validateEvidenceFileOnDisk(filePath);
  if (!validation.valid) {
    return sendError(res, `Evidence integrity verification failed: ${validation.error}`, null, 415);
  }

  // Security headers for file delivery
  res.setHeader('Content-Type', evidence.fileType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'");
  res.setHeader('Cache-Control', 'private, max-age=86400'); // 24 hours client cache
  res.setHeader('Content-Disposition', `inline; filename="${path.basename(filePath)}"`);

  // Log audit event asynchronously
  logAudit({
    action: 'EVIDENCE_VIEWED',
    entityType: 'EVIDENCE',
    entityId: evidence._id,
    req,
    details: {
      evidenceCode: evidence.evidenceCode,
      alertCode: evidence.alertCode,
      cameraCode: evidence.cameraCode,
    },
  });

  return res.sendFile(filePath);
};

module.exports = {
  getEvidenceList,
  getEvidenceById,
  getEvidenceFile,
};

