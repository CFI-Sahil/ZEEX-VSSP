const mongoose = require('mongoose');

/**
 * Visual Safety Surveillance Platform (VSSP)
 * Operational Database Protection Guard
 *
 * Enforces strict protection over 'vssp_db' and production environments.
 * Prevents accidental or programmatic deletion, truncation, drops, or destructive cleanups.
 */

const PROTECTED_DATABASES = ['vssp_db', 'production', 'prod'];

/**
 * Asserts that the currently connected database is safe for destructive test cleanup.
 * Throws a fatal error if invoked while connected to an operational or protected database.
 *
 * @param {string} operationDescription Description of the attempted cleanup operation
 * @throws {Error} If connected to a protected database
 */
function assertSafeForCleanup(operationDescription = 'Test cleanup') {
  const currentDbName = (mongoose.connection && mongoose.connection.name) ? mongoose.connection.name.toLowerCase() : '';
  
  if (PROTECTED_DATABASES.includes(currentDbName) || process.env.NODE_ENV === 'production') {
    const errorMsg = `[DATABASE_PROTECTION_GUARD] BLOCKED: Destructive operation '${operationDescription}' was attempted against protected database '${currentDbName}'. Destructive test cleanups, drops, and deletions are strictly forbidden on operational databases.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
}

/**
 * Checks whether the current database is protected.
 * @returns {boolean} True if the active database is protected
 */
function isProtectedDatabase() {
  const currentDbName = (mongoose.connection && mongoose.connection.name) ? mongoose.connection.name.toLowerCase() : '';
  return PROTECTED_DATABASES.includes(currentDbName) || process.env.NODE_ENV === 'production';
}

module.exports = {
  assertSafeForCleanup,
  isProtectedDatabase,
  PROTECTED_DATABASES,
};

