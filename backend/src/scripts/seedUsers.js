/**
 * Safe, Idempotent User Seeding Script
 * Creates or updates initial Admin and Safety Operator accounts
 * Strictly reads credentials from environment variables and never prints passwords
 */
const User = require('../models/User');
const env = require('../config/env');
const { connectDB, disconnectDB } = require('../config/db');

const seedUsers = async () => {
  console.log('\n========================================================');
  console.log('  INITIAL USER PROVISIONING & SEEDING SCRIPT');
  console.log('========================================================\n');

  try {
    await connectDB();

    const adminEmail = process.env.INITIAL_ADMIN_EMAIL;
    const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;

    const operatorEmail = process.env.INITIAL_OPERATOR_EMAIL;
    const operatorPassword = process.env.INITIAL_OPERATOR_PASSWORD;

    if (!adminEmail || !adminPassword || !operatorEmail || !operatorPassword) {
      console.error(
        'CRITICAL: Seed credentials must be supplied via environment variables in backend/.env:\n' +
        '  - INITIAL_ADMIN_EMAIL\n' +
        '  - INITIAL_ADMIN_PASSWORD\n' +
        '  - INITIAL_OPERATOR_EMAIL\n' +
        '  - INITIAL_OPERATOR_PASSWORD\n' +
        'Seeding aborted to prevent unauthenticated default accounts.'
      );
      process.exit(1);
    }

    console.log('[1/2] Provisioning Initial System Administrator...');
    const adminHash = await User.hashPassword(adminPassword);

    const adminUser = await User.findOneAndUpdate(
      { email: adminEmail.toLowerCase().trim() },
      {
        $set: {
          name: 'System Administrator',
          email: adminEmail.toLowerCase().trim(),
          passwordHash: adminHash,
          role: 'ADMIN',
          isActive: true,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log(`  - Admin user ready: ${adminUser.email} (Role: ${adminUser.role}, ID: ${adminUser._id})`);

    console.log('\n[2/2] Provisioning Initial Safety Operator...');
    const operatorHash = await User.hashPassword(operatorPassword);

    const operatorUser = await User.findOneAndUpdate(
      { email: operatorEmail.toLowerCase().trim() },
      {
        $set: {
          name: 'Primary Safety Operator',
          email: operatorEmail.toLowerCase().trim(),
          passwordHash: operatorHash,
          role: 'SAFETY_OPERATOR',
          isActive: true,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log(`  - Operator user ready: ${operatorUser.email} (Role: ${operatorUser.role}, ID: ${operatorUser._id})`);

    console.log('\n========================================================');
    console.log('  USER PROVISIONING COMPLETE: Both Accounts Active');
    console.log('========================================================\n');
  } catch (error) {
    console.error('User seeding failed:', error.message);
    process.exit(1);
  } finally {
    await disconnectDB();
  }
};

seedUsers();

