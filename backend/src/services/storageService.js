const fs = require('fs');
const path = require('path');
const cloudinary = require('../config/cloudinary');
const env = require('../config/env');
const { validateFileSignature, validateEvidenceFileOnDisk } = require('../utils/fileValidator');

const LOCAL_UPLOADS_DIR = path.resolve(__dirname, '../../uploads/evidence');
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Persists an evidence snapshot image based on configured STORAGE_DRIVER (local or cloudinary)
 *
 * @param {Object} options
 * @param {string} [options.localFilePath] - Path to existing local image file
 * @param {Buffer} [options.buffer] - Image buffer
 * @param {string} options.fileName - Target file name
 * @param {string} options.evidenceCode - Unique evidence code (e.g., EVD-1234)
 * @returns {Promise<Object>} Storage metadata to populate Evidence document
 */
const saveEvidenceSnapshot = async ({
  localFilePath,
  buffer,
  fileName,
  evidenceCode,
  driver,
}) => {
  let fileValidation;

  if (buffer && Buffer.isBuffer(buffer)) {
    if (buffer.length > 5 * 1024 * 1024) {
      throw new Error('Evidence snapshot exceeds maximum permitted size of 5 MB');
    }
    fileValidation = validateFileSignature(buffer);
    if (!fileValidation.valid) {
      throw new Error(`Evidence snapshot validation failed: ${fileValidation.error}`);
    }
    fileValidation.fileSize = buffer.length;
  } else if (localFilePath) {
    if (!fs.existsSync(localFilePath)) {
      throw new Error('Snapshot source file not found on disk');
    }
    fileValidation = validateEvidenceFileOnDisk(localFilePath);
    if (!fileValidation.valid) {
      throw new Error(`Evidence snapshot validation failed: ${fileValidation.error}`);
    }
  } else {
    throw new Error('Either localFilePath or buffer must be provided');
  }

  if (!ALLOWED_MIME_TYPES.includes(fileValidation.fileType)) {
    throw new Error(
      `Unsupported file type: ${fileValidation.fileType}. Permitted: image/jpeg, image/png, image/webp`
    );
  }

  const effectiveDriver = driver || process.env.STORAGE_DRIVER || env.STORAGE_DRIVER;
  const targetFileName =
    fileName || `${evidenceCode || 'snapshot'}.${fileValidation.fileType.split('/')[1]}`;

  // 1. Cloudinary Storage Driver
  if (effectiveDriver === 'cloudinary') {
    let uploadResult;

    if (localFilePath && fs.existsSync(localFilePath)) {
      uploadResult = await cloudinary.uploader.upload(localFilePath, {
        folder: env.CLOUDINARY_FOLDER || 'ZEEX VSSP/Evidence',
        public_id: evidenceCode,
        resource_type: 'image',
        overwrite: true,
      });
    } else if (buffer) {
      uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: env.CLOUDINARY_FOLDER || 'ZEEX VSSP/Evidence',
            public_id: evidenceCode,
            resource_type: 'image',
            overwrite: true,
          },
          (err, result) => {
            if (err) return reject(err);
            resolve(result);
          }
        );
        stream.end(buffer);
      });
    }

    return {
      storageDriver: 'cloudinary',
      filePath: uploadResult.secure_url,
      fileName: targetFileName,
      fileType: fileValidation.fileType,
      fileSize: uploadResult.bytes || fileValidation.fileSize,
      cloudinaryPublicId: uploadResult.public_id,
      cloudinaryUrl: uploadResult.secure_url,
    };
  }

  // 2. Local Storage Driver (Default for Development)
  if (!fs.existsSync(LOCAL_UPLOADS_DIR)) {
    fs.mkdirSync(LOCAL_UPLOADS_DIR, { recursive: true });
  }

  const destPath = path.join(LOCAL_UPLOADS_DIR, targetFileName);

  if (buffer && (!fs.existsSync(destPath) || localFilePath !== destPath)) {
    fs.writeFileSync(destPath, buffer);
  }

  return {
    storageDriver: 'local',
    filePath: `uploads/evidence/${targetFileName}`,
    fileName: targetFileName,
    fileType: fileValidation.fileType,
    fileSize: fileValidation.fileSize,
    cloudinaryPublicId: null,
    cloudinaryUrl: null,
  };
};

/**
 * Retrieves an evidence snapshot file stream or buffer securely
 *
 * @param {Object} evidence - Mongoose Evidence document
 * @returns {Promise<Object>} { buffer | filePath, fileType, fileSize, isBuffer }
 */
const getEvidenceAsset = async (evidence) => {
  const isCloudinary =
    evidence.storageDriver === 'cloudinary' ||
    (evidence.cloudinaryUrl && evidence.cloudinaryUrl.startsWith('http')) ||
    (evidence.filePath && evidence.filePath.startsWith('http'));

  // A. Cloudinary asset retrieval (Server-to-Server proxy)
  if (isCloudinary) {
    const targetUrl = evidence.cloudinaryUrl || evidence.filePath;
    const response = await fetch(targetUrl, { signal: AbortSignal.timeout(15000) });

    if (!response.ok) {
      throw new Error(`Failed to retrieve evidence asset from cloud storage (HTTP ${response.status})`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Verify magic bytes of downloaded image
    const validation = validateFileSignature(buffer);
    if (!validation.valid) {
      throw new Error(`Cloud asset signature corrupted: ${validation.error}`);
    }

    return {
      buffer,
      fileType: evidence.fileType,
      fileSize: buffer.length,
      isBuffer: true,
      storageDriver: 'cloudinary',
    };
  }

  // B. Local disk asset retrieval
  const safeFileName = path.basename(evidence.fileName);
  let resolvedPath = path.resolve(LOCAL_UPLOADS_DIR, safeFileName);

  if (!resolvedPath.startsWith(LOCAL_UPLOADS_DIR)) {
    throw new Error('Access denied: Path traversal attempt detected');
  }

  if (!fs.existsSync(resolvedPath)) {
    // Fallback: check basename of filePath
    const fallbackPath = path.resolve(LOCAL_UPLOADS_DIR, path.basename(evidence.filePath));
    if (!fs.existsSync(fallbackPath)) {
      throw new Error('Snapshot image file not found on local disk');
    }
    resolvedPath = fallbackPath;
  }

  const validation = validateEvidenceFileOnDisk(resolvedPath);
  if (!validation.valid) {
    throw new Error(`Evidence integrity check failed: ${validation.error}`);
  }

  return {
    filePath: resolvedPath,
    fileType: evidence.fileType,
    fileSize: validation.fileSize,
    isBuffer: false,
    storageDriver: 'local',
  };
};

module.exports = {
  saveEvidenceSnapshot,
  getEvidenceAsset,
  LOCAL_UPLOADS_DIR,
};

