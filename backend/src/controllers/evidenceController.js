const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const Evidence = require('../models/Evidence');
const Alert = require('../models/Alert');
const { sendSuccess, sendError } = require('../utils/response');
const { evidenceVaultQuerySchema, escapeRegex } = require('../validators/evidenceValidator');
const { logAudit } = require('../utils/auditLogger');
const { validateEvidenceFileOnDisk, computeSha256 } = require('../utils/fileValidator');
const storageService = require('../services/storageService');

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * @route   GET /api/v1/evidence
 * @desc    Enhanced list of evidence snapshot records with multi-field search, filters, sorting, and pagination
 * @access  Protected (ADMIN, SAFETY_OPERATOR)
 */
const getEvidenceList = async (req, res, next) => {
  try {
    const parseResult = evidenceVaultQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      return sendError(res, 'Invalid query parameters', parseResult.error.issues, 400);
    }

    const {
      page,
      limit,
      search,
      camera,
      cameraCode,
      alert,
      alertCode,
      severity,
      violationType,
      storageDriver,
      capturedFrom,
      capturedTo,
      startDate,
      endDate,
      sortBy,
      sortOrder,
    } = parseResult.data;

    const filter = { isActive: true };

    // 1. Multi-Field Text Search (Safe regex-escaped matching)
    if (search && search.trim()) {
      const escaped = escapeRegex(search.trim());
      filter.$or = [
        { evidenceCode: { $regex: escaped, $options: 'i' } },
        { alertCode: { $regex: escaped, $options: 'i' } },
        { cameraCode: { $regex: escaped, $options: 'i' } },
        { fileName: { $regex: escaped, $options: 'i' } },
      ];
    }

    // 2. Camera & Alert Direct Filters
    if (camera) {
      if (mongoose.Types.ObjectId.isValid(camera)) {
        filter.camera = camera;
      } else {
        filter.cameraCode = camera.trim().toUpperCase();
      }
    } else if (cameraCode && cameraCode.trim()) {
      filter.cameraCode = cameraCode.trim().toUpperCase();
    }

    if (alert) {
      if (mongoose.Types.ObjectId.isValid(alert)) {
        filter.alert = alert;
      } else {
        filter.alertCode = alert.trim().toUpperCase();
      }
    } else if (alertCode && alertCode.trim()) {
      filter.alertCode = alertCode.trim().toUpperCase();
    }

    // 3. Storage Driver Filter
    if (storageDriver && storageDriver.toLowerCase() !== 'all') {
      filter.storageDriver = storageDriver.toLowerCase();
    }

    // 4. Date Range Filter (capturedAt bounds)
    const fromDate = capturedFrom || startDate;
    const toDate = capturedTo || endDate;
    if (fromDate || toDate) {
      filter.capturedAt = {};
      if (fromDate) {
        filter.capturedAt.$gte = new Date(fromDate);
      }
      if (toDate) {
        filter.capturedAt.$lte = new Date(toDate);
      }
    }

    // 5. Cross-Entity Filters: Severity & Violation Type (Indexed via Alert collection)
    if (severity !== 'ALL' || violationType !== 'ALL') {
      const alertQuery = { isActive: true };
      if (severity !== 'ALL') {
        alertQuery.severity = severity;
      }
      if (violationType !== 'ALL') {
        alertQuery.violationType = violationType;
      }

      const matchingAlertIds = await Alert.find(alertQuery).distinct('_id');
      // Intersect with existing alert filter if present
      if (filter.alert) {
        filter.alert = { $in: matchingAlertIds, ...filter.alert };
      } else {
        filter.alert = { $in: matchingAlertIds };
      }
    }

    // 6. Sorting Allowlist
    const sortFieldMap = {
      capturedAt: 'capturedAt',
      fileSize: 'fileSize',
      alertCode: 'alertCode',
      evidenceCode: 'evidenceCode',
    };
    const sortField = sortFieldMap[sortBy] || 'capturedAt';
    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    const sortOptions = { [sortField]: sortDirection };

    // If sorting by non-unique field, tiebreak with _id for deterministic pagination
    if (sortField !== '_id') {
      sortOptions._id = sortDirection;
    }

    const skip = (page - 1) * limit;

    const [evidence, total] = await Promise.all([
      Evidence.find(filter)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .populate('alert', 'alertCode eventId violationName severity status detectedAt workFrontCode contractor riskLevel')
        .populate('camera', 'cameraCode name site location')
        .lean(),
      Evidence.countDocuments(filter),
    ]);

    const enrichedEvidence = evidence.map((ev) => ({
      ...ev,
      integrityStatus: ev.lastIntegrityStatus || (ev.checksumSha256 ? 'NOT_YET_VERIFIED' : 'NOT_YET_VERIFIED'),
    }));

    const totalPages = Math.ceil(total / limit) || 1;
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return sendSuccess(
      res,
      'Evidence records retrieved successfully',
      { evidence: enrichedEvidence },
      {
        page,
        limit,
        total,
        totalPages,
        hasNextPage,
        hasPrevPage,
      }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/evidence/stats
 * @desc    Aggregate repository metrics for the Evidence Vault overview
 * @access  Protected (ADMIN, SAFETY_OPERATOR)
 */
const getEvidenceStats = async (req, res, next) => {
  try {
    const [statsResult, distinctAlertIds, recoveryCounts] = await Promise.all([
      Evidence.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: null,
            totalCount: { $sum: 1 },
            cloudinaryCount: {
              $sum: { $cond: [{ $eq: ['$storageDriver', 'cloudinary'] }, 1, 0] },
            },
            localCount: {
              $sum: { $cond: [{ $eq: ['$storageDriver', 'local'] }, 1, 0] },
            },
            totalSizeBytes: { $sum: { $ifNull: ['$fileSize', 0] } },
            jpegCount: {
              $sum: { $cond: [{ $eq: ['$fileType', 'image/jpeg'] }, 1, 0] },
            },
            pngCount: {
              $sum: { $cond: [{ $eq: ['$fileType', 'image/png'] }, 1, 0] },
            },
            webpCount: {
              $sum: { $cond: [{ $eq: ['$fileType', 'image/webp'] }, 1, 0] },
            },
          },
        },
      ]),
      Evidence.distinct('alert', { isActive: true, alert: { $ne: null } }),
      Alert.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: '$metadata.evidenceStatus',
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const raw = statsResult[0] || {
      totalCount: 0,
      cloudinaryCount: 0,
      localCount: 0,
      totalSizeBytes: 0,
      jpegCount: 0,
      pngCount: 0,
      webpCount: 0,
    };

    const totalCount = raw.totalCount || 0;
    const cloudinaryCount = raw.cloudinaryCount || 0;
    const localCount = raw.localCount || 0;
    const cloudinaryPercentage =
      totalCount > 0 ? parseFloat(((cloudinaryCount / totalCount) * 100).toFixed(1)) : 0;
    const totalSizeBytes = raw.totalSizeBytes || 0;

    // Human-readable formatted size
    let formattedSize = '0 KB';
    if (totalSizeBytes > 1024 * 1024) {
      formattedSize = `${(totalSizeBytes / (1024 * 1024)).toFixed(2)} MB`;
    } else if (totalSizeBytes > 0) {
      formattedSize = `${(totalSizeBytes / 1024).toFixed(1)} KB`;
    }

    // Process recovery status map from Alerts
    const recoveryMap = {};
    (recoveryCounts || []).forEach((r) => {
      if (r._id) recoveryMap[r._id] = r.count;
    });

    const stats = {
      totalCount,
      cloudinaryCount,
      localCount,
      cloudinaryPercentage,
      totalSizeBytes,
      formattedSize,
      distinctAlerts: distinctAlertIds.length,
      mimeBreakdown: {
        jpeg: raw.jpegCount || 0,
        png: raw.pngCount || 0,
        webp: raw.webpCount || 0,
      },
      recoveryBacklog: {
        pending: recoveryMap['EVIDENCE_RECOVERY_PENDING'] || 0,
        unrecoverable: recoveryMap['EVIDENCE_INCOMPLETE_UNRECOVERABLE'] || 0,
      },
    };

    return sendSuccess(res, 'Evidence vault statistics retrieved successfully', stats);
  } catch (error) {
    next(error);
  }
};

/**
 * Cryptographic SHA-256 verification: retrieves current bytes and recalculates SHA-256
 * @param {Object} evidence - Evidence document
 * @returns {Promise<{ integrityStatus: string, originalChecksum: string|null, currentChecksum: string|null, isMatch: boolean, error?: string, verifiedAt: Date }>}
 */
const verifyAssetIntegrity = async (evidence) => {
  // 1. If no baseline checksum was recorded at ingestion, it cannot be verified
  if (!evidence.checksumSha256) {
    return {
      integrityStatus: 'NOT_YET_VERIFIED',
      originalChecksum: null,
      currentChecksum: null,
      isMatch: false,
      verifiedAt: new Date(),
    };
  }

  // 2. Retrieve actual current bytes via storageService 4-tier fallback
  let asset;
  try {
    asset = await storageService.getEvidenceAsset(evidence);
  } catch (storageErr) {
    // Requirement 5: Temporary Cloudinary retrieval failures do not incorrectly report an integrity mismatch
    return {
      integrityStatus: 'UNABLE_TO_VERIFY',
      originalChecksum: evidence.checksumSha256,
      currentChecksum: null,
      isMatch: false,
      verifiedAt: new Date(),
      error: storageErr.message,
    };
  }

  // 3. Compute SHA-256 from current retrieved bytes
  const currentChecksum = computeSha256(asset.buffer || asset.filePath);

  // 4. Compare current hash against stored original checksum
  const isMatch = Boolean(
    currentChecksum &&
    evidence.checksumSha256 &&
    currentChecksum.toUpperCase() === evidence.checksumSha256.toUpperCase()
  );
  const integrityStatus = isMatch ? 'VERIFIED' : 'INTEGRITY_MISMATCH';

  return {
    integrityStatus,
    originalChecksum: evidence.checksumSha256,
    currentChecksum,
    isMatch,
    verifiedAt: new Date(),
  };
};

/**
 * @route   POST /api/v1/evidence/:id/verify
 * @desc    Actively verifies cryptographic SHA-256 integrity by re-reading asset bytes
 * @access  Protected (ADMIN, SAFETY_OPERATOR)
 */
const verifyEvidenceIntegrity = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid evidence identifier format', null, 400);
    }

    const evidence = await Evidence.findOne({ _id: id, isActive: true }).select('+cloudinaryUrl');
    if (!evidence) {
      return sendError(res, 'Evidence record not found', null, 404);
    }

    const verificationResult = await verifyAssetIntegrity(evidence);

    // Persist verified status and timestamp without EVER mutating baseline checksumSha256
    if (verificationResult.integrityStatus !== 'UNABLE_TO_VERIFY') {
      evidence.lastIntegrityStatus = verificationResult.integrityStatus;
      evidence.lastVerifiedAt = verificationResult.verifiedAt;
      await evidence.save();
    }

    return sendSuccess(res, 'Evidence cryptographic integrity verified', {
      evidenceId: evidence._id,
      evidenceCode: evidence.evidenceCode,
      integrityStatus: verificationResult.integrityStatus,
      originalChecksum: verificationResult.originalChecksum,
      currentChecksum: verificationResult.currentChecksum,
      verifiedAt: verificationResult.verifiedAt,
      error: verificationResult.error || null,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/evidence/:id
 * @desc    Get detailed evidence metadata by ID with populated operational context and honest checksum status
 * @access  Protected (ADMIN, SAFETY_OPERATOR)
 */
const getEvidenceById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid evidence identifier format', null, 400);
    }

    const evidence = await Evidence.findOne({ _id: id, isActive: true })
      .select('+cloudinaryUrl')
      .populate('alert', 'alertCode eventId violationName severity status detectedAt workFrontCode contractor riskLevel closureRemarks')
      .populate('camera', 'cameraCode name site location');

    if (!evidence) {
      return sendError(res, 'Evidence record not found', null, 404);
    }

    // Determine honest cryptographic integrity status
    let integrityStatus = 'NOT_YET_VERIFIED';
    if (!evidence.checksumSha256) {
      integrityStatus = 'NOT_YET_VERIFIED';
    } else if (req.query.verify === 'true' || !evidence.lastIntegrityStatus || evidence.lastIntegrityStatus === 'NOT_YET_VERIFIED') {
      // Actively verify current bytes if requested or not yet verified
      const activeCheck = await verifyAssetIntegrity(evidence);
      integrityStatus = activeCheck.integrityStatus;
      if (activeCheck.integrityStatus !== 'UNABLE_TO_VERIFY') {
        evidence.lastIntegrityStatus = activeCheck.integrityStatus;
        evidence.lastVerifiedAt = activeCheck.verifiedAt;
        await evidence.save();
      }
    } else {
      // Use cached verification result to avoid expensive repeated re-downloads
      integrityStatus = evidence.lastIntegrityStatus;
    }

    const evidenceJson = evidence.toJSON();
    const enrichedEvidence = {
      ...evidenceJson,
      integrityStatus,
    };

    return sendSuccess(res, 'Evidence metadata retrieved successfully', { evidence: enrichedEvidence });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/evidence/:id/file
 * @desc    Securely stream or download snapshot image file (JPEG, PNG, WebP only)
 * @access  Protected (ADMIN, SAFETY_OPERATOR)
 */
const getEvidenceFile = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid evidence identifier format', null, 400);
    }

    // Explicitly select +cloudinaryUrl for server-side proxying
    const evidence = await Evidence.findOne({ _id: id, isActive: true }).select('+cloudinaryUrl');
    if (!evidence) {
      return sendError(res, 'Evidence record not found', null, 404);
    }

    // Verify MIME type is strictly JPEG, PNG, or WebP
    if (!ALLOWED_MIME_TYPES.includes(evidence.fileType)) {
      return sendError(res, 'Unsupported evidence file format. Allowed types: JPEG, PNG, WebP.', null, 415);
    }

    // Retrieve file asset via unified storageService (handles Cloudinary and local disk)
    let asset;
    try {
      asset = await storageService.getEvidenceAsset(evidence);
    } catch (storageErr) {
      return sendError(res, `Unable to retrieve evidence snapshot: ${storageErr.message}`, null, 404);
    }

    const isDownload = req.query.download === 'true';
    const safeFileName = path.basename(evidence.fileName || `${evidence.evidenceCode}.jpg`);
    const dispositionType = isDownload ? 'attachment' : 'inline';

    // Security headers for file delivery
    res.setHeader('Content-Type', evidence.fileType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    res.setHeader('Cache-Control', 'private, max-age=86400'); // 24 hours client cache
    res.setHeader('Content-Disposition', `${dispositionType}; filename="${safeFileName}"`);

    // Differentiate audit action: EVIDENCE_DOWNLOADED vs EVIDENCE_VIEWED
    const auditAction = isDownload ? 'EVIDENCE_DOWNLOADED' : 'EVIDENCE_VIEWED';
    await logAudit({
      action: auditAction,
      entityType: 'EVIDENCE',
      entityId: evidence._id,
      req,
      details: {
        evidenceCode: evidence.evidenceCode,
        alertCode: evidence.alertCode,
        cameraCode: evidence.cameraCode,
        storageDriver: asset.storageDriver,
        fileSize: evidence.fileSize,
        isDownload,
      },
    });

    if (asset.isBuffer) {
      return res.status(200).send(asset.buffer);
    }

    return res.sendFile(asset.filePath);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getEvidenceList,
  getEvidenceStats,
  getEvidenceById,
  getEvidenceFile,
  verifyEvidenceIntegrity,
  verifyAssetIntegrity,
};
