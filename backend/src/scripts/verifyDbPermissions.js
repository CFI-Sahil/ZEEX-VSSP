/**
 * Script to verify MongoDB Atlas user permissions and privileges
 * Strict verification of custom least-privilege role
 */
const mongoose = require('mongoose');
const env = require('../config/env');
const { connectDB, disconnectDB } = require('../config/db');

const verifyPermissions = async () => {
  console.log('\n========================================================');
  console.log('  FINAL MONGODB ATLAS SECURITY & PERMISSION AUDIT');
  console.log('========================================================\n');

  try {
    // 1. Connect using existing backend configuration
    await connectDB();
    const effectiveDbName = mongoose.connection.name;

    // 2. Confirm effective database
    console.log('[1/4] Effective Database Verification:');
    const isCorrectDb = effectiveDbName === 'vssp_db';
    console.log(`  - Database Name: ${effectiveDbName} (${isCorrectDb ? 'MATCH' : 'MISMATCH'})`);

    // 3. Inspect Authenticated User Roles
    console.log('\n[2/4] Role Assignment & Boundary Audit:');
    const db = mongoose.connection.db;
    const status = await db.command({ connectionStatus: 1, showPrivileges: true });
    
    const assignedRoles = (status.authInfo?.authenticatedUserRoles || []).map((r) => r.role);
    console.log(`  - Assigned Roles:`, assignedRoles);

    const hasVsspDbReadWrite = assignedRoles.includes('vsspDbReadWrite');
    const hasAtlasAdmin = assignedRoles.includes('atlasAdmin');
    const hasReadWriteAnyDatabase = assignedRoles.includes('readWriteAnyDatabase');

    console.log(`  - 'vsspDbReadWrite' assigned: ${hasVsspDbReadWrite ? 'YES (Verified)' : 'NO'}`);
    console.log(`  - 'atlasAdmin' present: ${hasAtlasAdmin ? 'YES (UNSAFE)' : 'NO (Safe)'}`);
    console.log(`  - 'readWriteAnyDatabase' present: ${hasReadWriteAnyDatabase ? 'YES (UNSAFE)' : 'NO (Safe)'}`);

    // 4. Test CRUD Operations on vssp_db
    console.log('\n[3/4] CRUD Operations Verification on vssp_db:');
    const testColl = db.collection('__security_probe');
    const probeDoc = { probeId: 'probe_audit_001', testAt: new Date(), status: 'pending' };
    
    // Insert
    await testColl.insertOne(probeDoc);
    console.log('  - INSERT Operation: SUCCESS');

    // Read
    const found = await testColl.findOne({ probeId: 'probe_audit_001' });
    const readOk = found && found.probeId === 'probe_audit_001';
    console.log(`  - READ Operation: ${readOk ? 'SUCCESS' : 'FAILED'}`);

    // Update
    const updateResult = await testColl.updateOne(
      { probeId: 'probe_audit_001' },
      { $set: { status: 'verified', updatedAt: new Date() } }
    );
    const updateOk = updateResult.modifiedCount === 1;
    console.log(`  - UPDATE Operation: ${updateOk ? 'SUCCESS' : 'FAILED'}`);

    // Delete
    const deleteResult = await testColl.deleteOne({ probeId: 'probe_audit_001' });
    const deleteOk = deleteResult.deletedCount === 1;
    console.log(`  - DELETE Operation: ${deleteOk ? 'SUCCESS (Test Record Purged)' : 'FAILED'}`);

    // 5. Test Administrative Boundary Restriction
    console.log('\n[4/4] Administrative Boundary Test:');
    try {
      const adminDb = mongoose.connection.client.db('admin');
      await adminDb.admin().listDatabases();
      console.log('  - admin.listDatabases: Permitted (Broader than intended)');
    } catch (adminErr) {
      console.log(`  - admin.listDatabases: RESTRICTED (${adminErr.codeName || 'Forbidden'}) - Least privilege confirmed`);
    }

    console.log('\n========================================================');
    console.log('  AUDIT COMPLETE: All Checks Evaluated');
    console.log('========================================================\n');
  } catch (err) {
    console.error('Permission verification failed with error:', err.message);
  } finally {
    await disconnectDB();
  }
};

verifyPermissions();

