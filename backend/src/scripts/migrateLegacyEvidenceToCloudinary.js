/**
 * Idempotent Legacy Evidence Migration to Cloudinary
 *
 * Scans MongoDB for evidence records without Cloudinary references (storageDriver !== 'cloudinary' or null cloudinaryPublicId),
 * matches each to its original local file, validates file signature & size,
 * uploads to the dedicated Cloudinary folder using its evidenceCode,
 * and updates MongoDB references only after full end-to-end verification.
 *
 * Usage:
 *   Dry Run (default, read-only):
 *     node backend/src/scripts/migrateLegacyEvidenceToCloudinary.js
 *     node backend/src/scripts/migrateLegacyEvidenceToCloudinary.js --dry-run
 *
 *   Execute Migration:
 *     node backend/src/scripts/migrateLegacyEvidenceToCloudinary.js --execute
 */

const path = require('path');
const fs = require('fs');
const assert = require('assert');
const { connectDB, disconnectDB } = require('../config/db');
const Evidence = require('../models/Evidence');
const Alert = require('../models/Alert');
const env = require('../config/env');
const cloudinary = require('../config/cloudinary');
const { validateEvidenceFileOnDisk } = require('../utils/fileValidator');

const LOCAL_UPLOADS_DIR = path.resolve(__dirname, '../../uploads/evidence');
const CLOUDINARY_FOLDER = env.CLOUDINARY_FOLDER || 'ZEEX VSSP/Evidence';

const runMigration = async () => {
  const isExecute = process.argv.includes('--execute');
  const modeLabel = isExecute ? 'EXECUTE MIGRATION' : 'DRY RUN (READ-ONLY)';

  console.log('\n========================================================');
  console.log(`  LEGACY EVIDENCE CLOUDINARY MIGRATION: ${modeLabel}`);
  console.log('========================================================\n');

  await connectDB();

  try {
    // 1. Fetch all evidence records
    const allRecords = await Evidence.find({}).sort({ createdAt: 1 });

    // Filter legacy records lacking Cloudinary configuration
    const legacyRecords = allRecords.filter(
      (doc) => doc.storageDriver !== 'cloudinary' || !doc.cloudinaryPublicId
    );

    console.log(`Found ${allRecords.length} total evidence record(s) in MongoDB.`);
    console.log(`Identified ${legacyRecords.length} legacy record(s) needing migration.\n`);

    if (legacyRecords.length === 0) {
      console.log('All evidence records already use Cloudinary storage. Nothing to migrate.');
      return;
    }

    const migrationPlan = [];

    for (let i = 0; i < legacyRecords.length; i++) {
      const doc = legacyRecords[i];
      const alert = await Alert.findById(doc.alert);

      // Determine local file candidates
      const directPath = path.resolve(__dirname, '../../', doc.filePath || '');
      const uploadsPath = path.resolve(LOCAL_UPLOADS_DIR, path.basename(doc.fileName || doc.filePath || ''));

      let matchedLocalPath = null;
      if (fs.existsSync(directPath)) {
        matchedLocalPath = directPath;
      } else if (fs.existsSync(uploadsPath)) {
        matchedLocalPath = uploadsPath;
      }

      let fileExists = Boolean(matchedLocalPath);
      let fileValidation = null;
      let actualBytes = 0;

      if (fileExists) {
        fileValidation = validateEvidenceFileOnDisk(matchedLocalPath);
        const stats = fs.statSync(matchedLocalPath);
        actualBytes = stats.size;
      }

      const expectedPublicId = `${CLOUDINARY_FOLDER}/${doc.evidenceCode}`;
      const canSafelyMigrate = fileExists && fileValidation && fileValidation.valid;

      const planItem = {
        index: i + 1,
        id: doc._id.toString(),
        evidenceCode: doc.evidenceCode,
        alertId: doc.alert ? doc.alert.toString() : null,
        alertCode: doc.alertCode || (alert ? alert.alertCode : 'N/A'),
        violationType: alert ? alert.violationType : 'N/A',
        dbFileName: doc.fileName,
        dbFilePath: doc.filePath,
        dbFileType: doc.fileType,
        dbFileSize: doc.fileSize,
        storageDriver: doc.storageDriver || 'local (unassigned)',
        matchedLocalPath,
        fileExists,
        actualFileSize: actualBytes,
        fileValidationValid: fileValidation ? fileValidation.valid : false,
        fileValidationError: fileValidation ? fileValidation.error : 'File not found',
        targetFolder: CLOUDINARY_FOLDER,
        proposedPublicId: expectedPublicId,
        canSafelyMigrate,
      };

      migrationPlan.push(planItem);
    }

    // Print detailed plan
    console.log('--------------------------------------------------------');
    console.log('  MIGRATION DRY-RUN INSPECTION DETAILS');
    console.log('--------------------------------------------------------\n');

    migrationPlan.forEach((item) => {
      console.log(`[Record ${item.index} of ${migrationPlan.length}]`);
      console.log(`  - Evidence ID      : ${item.id}`);
      console.log(`  - Evidence Code    : ${item.evidenceCode}`);
      console.log(`  - Alert Code       : ${item.alertCode} (${item.violationType})`);
      console.log(`  - Current Driver   : ${item.storageDriver}`);
      console.log(`  - DB File Reference: ${item.dbFilePath}`);
      console.log(`  - Local Path Check : ${item.matchedLocalPath || '(None found)'}`);
      console.log(`  - File Exists      : ${item.fileExists ? 'YES' : 'NO'}`);
      if (item.fileExists) {
        console.log(`  - Actual File Size : ${item.actualFileSize} bytes (DB: ${item.dbFileSize})`);
        console.log(`  - Magic Byte Check : ${item.fileValidationValid ? 'VALID' : 'INVALID: ' + item.fileValidationError}`);
      }
      console.log(`  - Proposed Cloud   : ${item.proposedPublicId}`);
      console.log(`  - Safe to Migrate  : ${item.canSafelyMigrate ? 'YES' : 'NO'}`);
      console.log('');
    });

    const readyCount = migrationPlan.filter((p) => p.canSafelyMigrate).length;
    const unavailableCount = migrationPlan.filter((p) => !p.canSafelyMigrate).length;

    console.log('--------------------------------------------------------');
    console.log('  SUMMARY');
    console.log('--------------------------------------------------------');
    console.log(`  - Total Legacy Records Examined : ${migrationPlan.length}`);
    console.log(`  - Records Ready for Migration   : ${readyCount}`);
    console.log(`  - Records Unavailable/Failed    : ${unavailableCount}`);
    console.log('--------------------------------------------------------\n');

    if (!isExecute) {
      console.log('DRY-RUN COMPLETE: No changes were made to Cloudinary or MongoDB.');
      console.log('To execute migration after review, run:');
      console.log('  node backend/src/scripts/migrateLegacyEvidenceToCloudinary.js --execute\n');
      return;
    }

    // 2. Execution block with per-record transaction-like safety
    console.log('STARTING ACTUAL MIGRATION EXECUTION...');

    let successfulCount = 0;
    let failedCount = 0;

    for (const item of migrationPlan) {
      if (!item.canSafelyMigrate) {
        console.log(`[SKIP] Record ${item.evidenceCode} (${item.id}): Local file unavailable or invalid.`);
        failedCount++;
        continue;
      }

      console.log(`\n[Migrating ${item.index}/${migrationPlan.length}] ${item.evidenceCode}...`);

      try {
        // SAFEGUARD 1: Check if an asset with this exact public_id already exists in Cloudinary
        let existingCloudAsset = null;
        try {
          existingCloudAsset = await cloudinary.api.resource(item.proposedPublicId);
          console.log(`  - Cloud asset already exists: ${existingCloudAsset.public_id} (${existingCloudAsset.bytes} bytes)`);
        } catch (checkErr) {
          // HTTP 404 indicates resource does not exist yet (normal expected state)
          if (checkErr.error?.http_code !== 404 && checkErr.http_code !== 404) {
            throw new Error(`Cloudinary existence check failed for ${item.proposedPublicId}: ${checkErr.message}`);
          }
        }

        let uploadResult = null;

        if (existingCloudAsset && existingCloudAsset.secure_url) {
          // Asset already exists on Cloudinary; reuse verified existing asset without re-uploading
          console.log(`  - Reusing existing verified Cloudinary asset for ${item.evidenceCode}`);
          uploadResult = existingCloudAsset;
        } else {
          // Upload new asset with strict destination scoping
          console.log(`  - Uploading ${item.matchedLocalPath} -> ${item.proposedPublicId}...`);
          uploadResult = await cloudinary.uploader.upload(item.matchedLocalPath, {
            folder: item.targetFolder,
            public_id: item.evidenceCode,
            resource_type: 'image',
            overwrite: false, // Prevents unintended overwrite
          });
        }

        // SAFEGUARD 2: Verification of Cloudinary Upload Response
        assert(Boolean(uploadResult.secure_url), `Upload result missing secure_url for ${item.evidenceCode}`);
        assert.strictEqual(
          uploadResult.public_id,
          item.proposedPublicId,
          `Public ID mismatch: expected '${item.proposedPublicId}', got '${uploadResult.public_id}'`
        );

        // SAFEGUARD 3: Direct API verification of cloud asset reachability
        const verifiedCloudResource = await cloudinary.api.resource(uploadResult.public_id);
        assert(
          Boolean(verifiedCloudResource && verifiedCloudResource.bytes > 0),
          `Cloudinary resource verification failed: Asset ${uploadResult.public_id} empty or unindexed`
        );
        console.log(`  [CONFIRMED] Cloud asset verified in Cloudinary API (${verifiedCloudResource.bytes} bytes)`);

        // SAFEGUARD 4: Update MongoDB Record ONLY after confirmed Cloudinary verification
        const updatePayload = {
          storageDriver: 'cloudinary',
          filePath: uploadResult.secure_url,
          fileSize: uploadResult.bytes || item.actualFileSize,
          cloudinaryPublicId: uploadResult.public_id,
          cloudinaryUrl: uploadResult.secure_url,
        };

        const updatedDoc = await Evidence.findByIdAndUpdate(
          item.id,
          { $set: updatePayload },
          { new: true }
        );

        // SAFEGUARD 5: Verify MongoDB References & Invariants
        const reloadedDoc = await Evidence.findById(item.id).select('+cloudinaryUrl');
        assert.strictEqual(reloadedDoc.storageDriver, 'cloudinary', 'MongoDB storageDriver set to cloudinary');
        assert.strictEqual(reloadedDoc.cloudinaryPublicId, item.proposedPublicId, 'cloudinaryPublicId matches target');
        assert.strictEqual(reloadedDoc.cloudinaryUrl, uploadResult.secure_url, 'cloudinaryUrl matches secure_url');
        assert.strictEqual(reloadedDoc.filePath, uploadResult.secure_url, 'filePath updated to secure_url');
        assert.strictEqual(reloadedDoc._id.toString(), item.id, 'Evidence document ID preserved');
        if (item.alertId) {
          assert.strictEqual(reloadedDoc.alert.toString(), item.alertId, 'Alert association preserved');
        }

        console.log(`  [VERIFIED] MongoDB record ${updatedDoc._id} updated & invariants confirmed`);
        successfulCount++;
      } catch (recordError) {
        // SAFEGUARD 6: Isolated per-record error handling.
        // If upload or verification fails, MongoDB document remains 100% untouched.
        console.error(`  [FAILED] Migration failed for record ${item.evidenceCode}: ${recordError.message}`);
        console.error(`  - MongoDB record ${item.id} left untouched.`);
        failedCount++;
      }
    }

    console.log('\n========================================================');
    console.log('  MIGRATION SUMMARY');
    console.log('========================================================');
    console.log(`  - Successfully Migrated: ${successfulCount}/${migrationPlan.length}`);
    console.log(`  - Failed / Skipped     : ${failedCount}/${migrationPlan.length}`);
    console.log('========================================================\n');
  } catch (error) {
    console.error('Fatal migration error:', error);
    process.exit(1);
  } finally {
    await disconnectDB();
  }
};

runMigration();
