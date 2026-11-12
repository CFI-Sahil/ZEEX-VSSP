const Alert = require('../models/Alert');
const Evidence = require('../models/Evidence');
const cloudinary = require('../config/cloudinary');
const env = require('../config/env');

/**
 * Checks whether an error from Cloudinary represents a transient network/server failure
 */
const isTransientError = (err) => {
  if (!err) return false;
  const msg = (err.message || err.error?.message || '').toLowerCase();
  const code = err.http_code || err.error?.http_code;

  if (code >= 500 || code === 429) return true;
  if (
    msg.includes('etimedout') ||
    msg.includes('econnreset') ||
    msg.includes('network') ||
    msg.includes('timeout') ||
    msg.includes('aborted') ||
    msg.includes('econnrefused')
  ) {
    return true;
  }
  return false;
};

/**
 * Checks whether an error from Cloudinary confirms that the resource was not found
 */
const isNotFoundError = (err) => {
  if (!err) return false;
  const msg = (err.message || err.error?.message || '').toLowerCase();
  const code = err.http_code || err.error?.http_code;
  if (code === 404) return true;
  if (msg.includes('not found') || msg.includes('does not exist')) return true;
  return false;
};

/**
 * Executes a sweep to recover incomplete Alert/Evidence relationships
 * Eligible alerts have an explicit persisted evidenceIntent and missing evidence
 * Works across PENDING, ACKNOWLEDGED, and CLOSED alerts without altering operational status
 */
const sweepEvidenceRecovery = async () => {
  const hasCloudinaryCredentials = Boolean(
    env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET
  );

  // Recovery eligibility query
  const eligibleAlerts = await Alert.find({
    evidence: null,
    'metadata.evidenceIntent.evidenceCode': { $exists: true, $ne: null },
    'metadata.evidenceStatus': { $in: ['EVIDENCE_PENDING_UPLOAD', 'EVIDENCE_RECOVERY_PENDING'] },
    isActive: true,
  }).limit(10);

  let recoveredCount = 0;
  let unrecoverableCount = 0;
  let transientErrorCount = 0;

  for (const alert of eligibleAlerts) {
    alert.metadata = alert.metadata || {};
    const intent = alert.metadata.evidenceIntent;
    if (!intent || !intent.evidenceCode) continue;
    const evidenceCode = intent.evidenceCode;
    const publicId = intent.publicId || `${env.CLOUDINARY_FOLDER || 'ZEEX VSSP/Evidence'}/${evidenceCode}`;

    // If Cloudinary credentials are not configured, log diagnostic and pause
    if (!hasCloudinaryCredentials) {
      alert.metadata.lastTransientError = 'Cloudinary credentials not configured; recovery deferred';
      alert.markModified('metadata');
      await alert.save();
      transientErrorCount++;
      continue;
    }

    try {
      // Tier 4 Cloudinary resource check
      const cloudAsset = await cloudinary.api.resource(publicId);

      if (cloudAsset && cloudAsset.secure_url) {
        // Confirm or create Evidence document
        let evidence = await Evidence.findOne({ evidenceCode });
        if (!evidence) {
          evidence = new Evidence({
            evidenceCode,
            alert: alert._id,
            alertCode: alert.alertCode,
            camera: alert.camera,
            cameraCode: alert.cameraCode,
            fileName: intent.fileName || `${evidenceCode}.jpg`,
            filePath: cloudAsset.secure_url,
            fileType: cloudAsset.format ? `image/${cloudAsset.format}` : 'image/jpeg',
            fileSize: cloudAsset.bytes || 1024,
            storageDriver: 'cloudinary',
            cloudinaryPublicId: cloudAsset.public_id,
            cloudinaryUrl: cloudAsset.secure_url,
            capturedAt: intent.stagedAt || alert.detectedAt || new Date(),
            description: `Snapshot evidence recovered for ${alert.alertCode}`,
          });
          await evidence.save();
        }

        // Finalize Alert without altering its operational status
        alert.evidence = evidence._id;
        alert.metadata.evidenceStatus = 'EVIDENCE_AVAILABLE';
        delete alert.metadata.evidenceIntent;
        alert.markModified('metadata');
        await alert.save();

        recoveredCount++;
        console.log(`[EvidenceRecovery] Successfully recovered evidence for alert ${alert.alertCode}`);
      }
    } catch (err) {
      if (isNotFoundError(err)) {
        // Confirmed missing asset on Cloudinary
        const currentCount = (alert.metadata.evidenceNotFoundCount || 0) + 1;
        alert.metadata.evidenceNotFoundCount = currentCount;

        if (currentCount >= 3) {
          // Terminal failure: 3 confirmed missing asset sweeps
          alert.metadata.evidenceStatus = 'EVIDENCE_INCOMPLETE_UNRECOVERABLE';
          delete alert.metadata.evidenceIntent;
          unrecoverableCount++;
          console.warn(
            `[EvidenceRecovery] Alert ${alert.alertCode} marked EVIDENCE_INCOMPLETE_UNRECOVERABLE after 3 confirmed 404s`
          );
        } else {
          alert.metadata.evidenceStatus = 'EVIDENCE_RECOVERY_PENDING';
        }
        alert.markModified('metadata');
        await alert.save();
      } else if (isTransientError(err)) {
        // Transient network or server error: stays retryable, missing count is NOT incremented
        alert.metadata.evidenceStatus = 'EVIDENCE_RECOVERY_PENDING';
        alert.metadata.lastTransientError = err.message;
        alert.markModified('metadata');
        await alert.save();
        transientErrorCount++;
        console.warn(
          `[EvidenceRecovery] Transient error checking Cloudinary for ${alert.alertCode}: ${err.message}`
        );
      } else {
        // Unexpected error: record in metadata, keep retryable
        alert.metadata.lastTransientError = err.message;
        alert.markModified('metadata');
        await alert.save();
        transientErrorCount++;
      }
    }
  }

  return { recoveredCount, unrecoverableCount, transientErrorCount };
};

module.exports = {
  isTransientError,
  isNotFoundError,
  sweepEvidenceRecovery,
};

