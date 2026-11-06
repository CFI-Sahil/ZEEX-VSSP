const path = require('path');
const fs = require('fs');
const http = require('http');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const { connectDB, disconnectDB } = require('../config/db');
const Evidence = require('../models/Evidence');
const AuditLog = require('../models/AuditLog');
const storageService = require('../services/storageService');
const app = require('../app');

const TEST_PORT = 5099;
let server;

const TARGET_IDS = [
  '6aeddcd0abb724d26e2c8870',
  '6aedda4092a83a95f8a5878a',
  '6aeddcd0abb724d26e2c8881',
  '6aedda4092a83a95f8a587af',
  '6aeddcd0abb724d26e2c884d',
  '6aeddcd0abb724d26e2c8860',
  '6aedda4192a83a95f8a587d5',
  '6aedda4092a83a95f8a5879f',
];

const CLOUDINARY_SAMPLE_ID = '6ae5ddc857afdb38a074cde5'; // EVD-8150

function makeRequest(method, urlPath, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: TEST_PORT,
      path: urlPath,
      method,
      headers: {
        ...headers,
      },
    };

    if (body) {
      const dataStr = typeof body === 'string' ? body : JSON.stringify(body);
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(dataStr);
    }

    const req = http.request(options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const rawBuffer = Buffer.concat(chunks);
        let json = null;
        try {
          json = JSON.parse(rawBuffer.toString('utf8'));
        } catch (_) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          buffer: rawBuffer,
          json,
        });
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('\n======================================================');
  console.log('  EVIDENCE RETRIEVAL FIX VERIFICATION SUITE');
  console.log('======================================================\n');

  await connectDB();

  server = app.listen(TEST_PORT);
  await new Promise((r) => server.once('listening', r));
  console.log(`Test server listening on port ${TEST_PORT}.`);

  // Step 1: Login as Admin to obtain session cookie / JWT
  console.log('\n[1/7] Authenticating as ADMIN...');
  const loginRes = await makeRequest('POST', '/api/v1/auth/login', {
    email: 'admin@vssp.local',
    password: process.env.INITIAL_ADMIN_PASSWORD || 'AdminSecurePass@2026!',
  });

  if (loginRes.statusCode !== 200 || !loginRes.json?.success) {
    throw new Error(`Login failed with status ${loginRes.statusCode}: ${JSON.stringify(loginRes.json)}`);
  }

  const rawCookies = loginRes.headers['set-cookie'] || [];
  const cookieHeader = rawCookies.map((c) => c.split(';')[0]).join('; ');
  const token = loginRes.json.data.token;
  const authHeaders = {
    Cookie: cookieHeader,
    Authorization: `Bearer ${token}`,
  };
  console.log('  -> Authentication successful. Admin token and session cookie acquired.');

  // Step 2: Verify Unauthorized Access is Rejected
  console.log('\n[2/7] Verifying Unauthorized Access Enforcement...');
  const unauthRes = await makeRequest('GET', `/api/v1/evidence/${TARGET_IDS[0]}/file`);
  console.log(`  -> Unauthenticated request HTTP status: ${unauthRes.statusCode} (Expected: 401)`);
  if (unauthRes.statusCode !== 401) {
    throw new Error(`Expected 401 Unauthorized but got ${unauthRes.statusCode}`);
  }

  // Step 3: Verify Retrieval of All Target Production IDs
  console.log('\n[3/7] Verifying Evidence Retrieval for All Target Production Records...');
  let targetSuccessCount = 0;

  for (const id of TARGET_IDS) {
    const doc = await Evidence.findById(id);
    if (!doc) {
      console.log(`  - ID ${id}: Not in DB (skipping)`);
      continue;
    }

    const fileRes = await makeRequest('GET', `/api/v1/evidence/${id}/file`, null, authHeaders);
    console.log(`  - [${doc.evidenceCode}] ID: ${id} | HTTP ${fileRes.statusCode} | Content-Type: ${fileRes.headers['content-type']} | Bytes: ${fileRes.buffer.length}`);

    if (fileRes.statusCode !== 200) {
      throw new Error(`Failed to retrieve target evidence ${doc.evidenceCode} (${id}): HTTP ${fileRes.statusCode} ${JSON.stringify(fileRes.json)}`);
    }

    // Verify magic bytes
    const isJpeg = fileRes.buffer[0] === 0xff && fileRes.buffer[1] === 0xd8;
    const isPng = fileRes.buffer[0] === 0x89 && fileRes.buffer[1] === 0x50 && fileRes.buffer[2] === 0x4e && fileRes.buffer[3] === 0x47;
    if (!isJpeg && !isPng) {
      throw new Error(`Corrupted response bytes for ${doc.evidenceCode}`);
    }

    targetSuccessCount++;
  }
  console.log(`  -> All ${targetSuccessCount} target evidence records retrieved successfully with HTTP 200 OK.`);

  // Step 4: Verify Fallback Retrieval when Local Uploads Directory Lacks the File (Render container simulation)
  console.log('\n[4/7] Testing Render Ephemeral Simulation (Tier 3 Bundled Fixtures Fallback)...');
  // Create a temporary test fixture ONLY in BUNDLED_ASSETS_DIR (guaranteeing it is missing from LOCAL_UPLOADS_DIR)
  const fixtureName = 'test-bundled-render-sim.png';
  const fixturePath = path.join(storageService.BUNDLED_ASSETS_DIR, fixtureName);
  const validPngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );
  fs.writeFileSync(fixturePath, validPngBuffer);

  const mockRenderDoc = {
    _id: 'mock_render_id',
    evidenceCode: 'EVD-RENDER-SIM',
    fileName: fixtureName,
    filePath: `uploads/evidence/${fixtureName}`,
    fileType: 'image/png',
    storageDriver: 'local',
  };

  const assetResult = await storageService.getEvidenceAsset(mockRenderDoc);
  console.log('  -> Retrieved asset via storageService:');
  console.log(`     - storageDriver: ${assetResult.storageDriver}`);
  console.log(`     - filePath: ${assetResult.filePath}`);
  console.log(`     - fileSize: ${assetResult.fileSize} bytes`);
  console.log(`     - isBuffer: ${assetResult.isBuffer}`);

  // Clean up fixture file
  if (fs.existsSync(fixturePath)) {
    fs.unlinkSync(fixturePath);
  }

  if (!assetResult.filePath.includes('src\\assets\\evidence') && !assetResult.filePath.includes('src/assets/evidence')) {
    throw new Error(`Asset was expected from bundled fixtures but got: ${assetResult.filePath}`);
  }
  console.log('  -> Bundled fixtures fallback verified successfully!');

  // Step 5: Verify Cloudinary Retrieval (Tier 1)
  console.log('\n[5/7] Verifying Cloudinary Storage Driver Retrieval (Tier 1)...');
  const cloudDoc = await Evidence.findById(CLOUDINARY_SAMPLE_ID).select('+cloudinaryUrl');
  if (cloudDoc) {
    const cloudRes = await makeRequest('GET', `/api/v1/evidence/${CLOUDINARY_SAMPLE_ID}/file`, null, authHeaders);
    console.log(`  - [${cloudDoc.evidenceCode}] Cloudinary ID: ${CLOUDINARY_SAMPLE_ID} | HTTP ${cloudRes.statusCode} | Content-Type: ${cloudRes.headers['content-type']} | Bytes: ${cloudRes.buffer.length}`);
    if (cloudRes.statusCode !== 200) {
      throw new Error(`Failed Cloudinary asset retrieval: HTTP ${cloudRes.statusCode}`);
    }
    console.log('  -> Cloudinary server-to-server proxy verified successfully!');
  } else {
    console.log('  - Sample Cloudinary record not found in DB, skipping direct test.');
  }

  // Step 6: Verify Audit Logging
  console.log('\n[6/7] Verifying Audit Trail for Evidence Access...');
  const latestAudit = await AuditLog.findOne({
    action: 'EVIDENCE_VIEWED',
    entityId: TARGET_IDS[0],
  }).sort({ timestamp: -1 });

  if (latestAudit) {
    console.log(`  -> Audit log verified: action=${latestAudit.action}, entityId=${latestAudit.entityId}, storageDriver=${latestAudit.details?.storageDriver}`);
  } else {
    throw new Error('EVIDENCE_VIEWED audit log not found');
  }

  // Step 7: Verify demo event ingestion preserves image and metadata
  console.log('\n[7/7] Verifying Save Evidence Snapshot Flow...');
  const testBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );
  const saveResult = await storageService.saveEvidenceSnapshot({
    buffer: testBuffer,
    fileName: 'test-snapshot.png',
    evidenceCode: 'EVD-TEST-VERIFY',
    driver: 'local',
  });
  console.log(`  -> Saved snapshot driver: ${saveResult.storageDriver}, file: ${saveResult.fileName}, size: ${saveResult.fileSize} bytes`);
  if (saveResult.storageDriver !== 'local' || saveResult.fileSize !== testBuffer.length) {
    throw new Error('saveEvidenceSnapshot local driver failed');
  }

  console.log('\n======================================================');
  console.log('  ALL VERIFICATION CHECKS PASSED SUCCESSFULLY (7/7)');
  console.log('======================================================\n');

  server.close();
  await disconnectDB();
}

runTests().catch(async (err) => {
  console.error('\nVerification failed:', err);
  if (server) server.close();
  await disconnectDB().catch(() => {});
  process.exit(1);
});
