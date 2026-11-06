const fs = require('fs');
const path = require('path');
const cloudinary = require('../config/cloudinary');
const env = require('../config/env');
const { validateFileSignature, validateEvidenceFileOnDisk } = require('../utils/fileValidator');

const LOCAL_UPLOADS_DIR = path.resolve(__dirname, '../../uploads/evidence');
const BUNDLED_ASSETS_DIR = path.resolve(__dirname, '../assets/evidence');
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Persists an evidence snapshot image based on configured STORAGE_DRIVER (local or cloudinary)
 *
 * @param {Object} options
 * @param {string} [options.localFilePath] - Path to existing local image file
 * @param {Buffer} [options.buffer] - Image buffer
 * @param {string} options.fileName - Target file name
 * @param {string} options.evidenceCode - Unique evidence code (e.g., EVD-1234)
 * @param {string} [options.driver] - Explicit driver override ('local' | 'cloudinary')
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
  let resolvedSourcePath = localFilePath;

  // If localFilePath is provided but doesn't exist at the given path, check bundled assets
  if (localFilePath && !fs.existsSync(localFilePath)) {
    const fixturePath = path.resolve(BUNDLED_ASSETS_DIR, path.basename(localFilePath));
    if (fs.existsSync(fixturePath)) {
      resolvedSourcePath = fixturePath;
    }
  }

  if (buffer && Buffer.isBuffer(buffer)) {
    if (buffer.length > 5 * 1024 * 1024) {
      throw new Error('Evidence snapshot exceeds maximum permitted size of 5 MB');
    }
    fileValidation = validateFileSignature(buffer);
    if (!fileValidation.valid) {
      throw new Error(`Evidence snapshot validation failed: ${fileValidation.error}`);
    }
    fileValidation.fileSize = buffer.length;
  } else if (resolvedSourcePath) {
    if (!fs.existsSync(resolvedSourcePath)) {
      throw new Error('Snapshot source file not found on disk');
    }
    fileValidation = validateEvidenceFileOnDisk(resolvedSourcePath);
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

  const hasCloudinaryCredentials = Boolean(
    env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET
  );

  const effectiveDriver = (() => {
    if (driver) return driver;
    if (process.env.STORAGE_DRIVER) return process.env.STORAGE_DRIVER;
    if (env.STORAGE_DRIVER === 'cloudinary') return 'cloudinary';
    // In production with valid Cloudinary credentials, automatically use Cloudinary to avoid ephemeral container loss
    if (env.NODE_ENV === 'production' && hasCloudinaryCredentials) {
      return 'cloudinary';
    }
    return env.STORAGE_DRIVER || 'local';
  })();

  const targetFileName =
    fileName || `${evidenceCode || 'snapshot'}.${fileValidation.fileType.split('/')[1]}`;

  // 1. Cloudinary Storage Driver
  if (effectiveDriver === 'cloudinary') {
    let uploadResult;

    if (resolvedSourcePath && fs.existsSync(resolvedSourcePath)) {
      uploadResult = await cloudinary.uploader.upload(resolvedSourcePath, {
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

  if (buffer && (!fs.existsSync(destPath) || resolvedSourcePath !== destPath)) {
    fs.writeFileSync(destPath, buffer);
  } else if (resolvedSourcePath && resolvedSourcePath !== destPath && !fs.existsSync(destPath)) {
    fs.copyFileSync(resolvedSourcePath, destPath);
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
 * Implements a resilient 4-tier asset retrieval strategy:
 *   Tier 1: Cloudinary URL proxy (for cloud-stored assets)
 *   Tier 2: Primary local uploads directory (uploads/evidence/)
 *   Tier 3: Bundled fixtures directory fallback (src/assets/evidence/ - deployed with code)
 *   Tier 4: Dynamic Cloudinary fallback check (if cloud credentials exist)
 *
 * @param {Object} evidence - Mongoose Evidence document
 * @returns {Promise<Object>} { buffer | filePath, fileType, fileSize, isBuffer, storageDriver }
 */
const getEvidenceAsset = async (evidence) => {
  const isCloudinary =
    evidence.storageDriver === 'cloudinary' ||
    (evidence.cloudinaryUrl && evidence.cloudinaryUrl.startsWith('http')) ||
    (evidence.filePath && evidence.filePath.startsWith('http'));

  // Tier 1: Cloudinary asset retrieval (Server-to-Server proxy)
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

  // Tier 2 & 3: Local disk asset retrieval with multi-tier fallback
  const safeFileName = path.basename(evidence.fileName || '');
  const safeDbPath = path.basename(evidence.filePath || '');

  let candidatePath = null;

  // Tier 2 Check: Primary LOCAL_UPLOADS_DIR
  if (safeFileName) {
    const p = path.resolve(LOCAL_UPLOADS_DIR, safeFileName);
    if (p.startsWith(LOCAL_UPLOADS_DIR) && fs.existsSync(p)) {
      candidatePath = p;
    }
  }
  if (!candidatePath && safeDbPath) {
    const p = path.resolve(LOCAL_UPLOADS_DIR, safeDbPath);
    if (p.startsWith(LOCAL_UPLOADS_DIR) && fs.existsSync(p)) {
      candidatePath = p;
    }
  }

  // Tier 3 Check: BUNDLED_ASSETS_DIR (static fixtures deployed with application code)
  if (!candidatePath && fs.existsSync(BUNDLED_ASSETS_DIR)) {
    if (safeFileName) {
      const p = path.resolve(BUNDLED_ASSETS_DIR, safeFileName);
      if (p.startsWith(BUNDLED_ASSETS_DIR) && fs.existsSync(p)) {
        candidatePath = p;
      }
    }
    if (!candidatePath && safeDbPath) {
      const p = path.resolve(BUNDLED_ASSETS_DIR, safeDbPath);
      if (p.startsWith(BUNDLED_ASSETS_DIR) && fs.existsSync(p)) {
        candidatePath = p;
      }
    }
  }

  // If a valid local disk file was located in Tier 2 or 3
  if (candidatePath) {
    const validation = validateEvidenceFileOnDisk(candidatePath);
    if (!validation.valid) {
      throw new Error(`Evidence integrity check failed: ${validation.error}`);
    }

    return {
      filePath: candidatePath,
      fileType: evidence.fileType,
      fileSize: validation.fileSize,
      isBuffer: false,
      storageDriver: 'local',
    };
  }

  // Tier 4 Check: Check Cloudinary if credentials exist (e.g., if asset was migrated to cloud)
  const hasCloudinary = Boolean(
    env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET
  );

  if (hasCloudinary && evidence.evidenceCode) {
    try {
      const publicId = `${env.CLOUDINARY_FOLDER || 'ZEEX VSSP/Evidence'}/${evidence.evidenceCode}`;
      const cloudAsset = await cloudinary.api.resource(publicId);
      if (cloudAsset && cloudAsset.secure_url) {
        const response = await fetch(cloudAsset.secure_url, { signal: AbortSignal.timeout(15000) });
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const validation = validateFileSignature(buffer);
          if (validation.valid) {
            return {
              buffer,
              fileType: evidence.fileType,
              fileSize: buffer.length,
              isBuffer: true,
              storageDriver: 'cloudinary',
            };
          }
        }
      }
    } catch (_) {
      // Asset not found in Cloudinary; fall through to descriptive error
    }
  }

  throw new Error('Snapshot image file not found on local disk or cloud storage');
};

module.exports = {
  saveEvidenceSnapshot,
  getEvidenceAsset,
  LOCAL_UPLOADS_DIR,
  BUNDLED_ASSETS_DIR,
};
