const fs = require('fs');

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB in bytes
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Validates image buffer magic numbers (file signature)
 * Protects against MIME spoofing and disguised executables
 * @param {Buffer} buffer
 * @returns {{ valid: boolean, fileType?: string, error?: string }}
 */
const validateFileSignature = (buffer) => {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 12) {
    return { valid: false, error: 'File buffer is invalid or too small to verify signature' };
  }

  // 1. JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { valid: true, fileType: 'image/jpeg' };
  }

  // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { valid: true, fileType: 'image/png' };
  }

  // 3. WebP: RIFF (bytes 0-3) and WEBP (bytes 8-11)
  const riff = buffer.toString('ascii', 0, 4);
  const webp = buffer.toString('ascii', 8, 12);
  if (riff === 'RIFF' && webp === 'WEBP') {
    return { valid: true, fileType: 'image/webp' };
  }

  return {
    valid: false,
    error: 'Invalid file signature: File is not a genuine JPEG, PNG, or WebP image.',
  };
};

/**
 * Inspects and validates an on-disk image file
 * @param {string} filePath
 * @returns {{ valid: boolean, fileType?: string, fileSize?: number, error?: string }}
 */
const validateEvidenceFileOnDisk = (filePath) => {
  if (!fs.existsSync(filePath)) {
    return { valid: false, error: 'File does not exist on disk' };
  }

  const stats = fs.statSync(filePath);
  if (stats.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds the 5 MB limit (${(stats.size / 1024 / 1024).toFixed(2)} MB)`,
    };
  }

  if (stats.size === 0) {
    return { valid: false, error: 'File is empty (0 bytes)' };
  }

  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.alloc(16);
  fs.readSync(fd, buffer, 0, 16, 0);
  fs.closeSync(fd);

  const sigResult = validateFileSignature(buffer);
  if (!sigResult.valid) {
    return sigResult;
  }

  return {
    valid: true,
    fileType: sigResult.fileType,
    fileSize: stats.size,
  };
};

module.exports = {
  MAX_FILE_SIZE,
  ALLOWED_MIME_TYPES,
  validateFileSignature,
  validateEvidenceFileOnDisk,
};

