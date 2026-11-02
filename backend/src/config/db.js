const mongoose = require('mongoose');
const env = require('./env');

const connectionStateMap = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

let isShuttingDown = false;

const connectDB = async () => {
  if (!env.MONGODB_URI) {
    console.warn('[MongoDB] MONGODB_URI is not set. Database features will remain offline until configured.');
    return null;
  }

  try {
    console.log('[MongoDB] Initializing connection via MONGODB_URI...');

    mongoose.connection.on('connected', () => {
      console.log('[MongoDB] Connection successfully established with MongoDB Atlas.');
    });

    mongoose.connection.on('error', (err) => {
      console.error('[MongoDB] Connection error encountered:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      if (!isShuttingDown) {
        console.warn('[MongoDB] Connection lost. Attempting reconnection...');
      }
    });

    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      autoIndex: env.NODE_ENV !== 'production',
    });

    return mongoose.connection;
  } catch (err) {
    console.error('[MongoDB] Failed to connect on startup:', err.message);
    return null;
  }
};

const checkDatabaseHealth = async () => {
  const stateCode = mongoose.connection.readyState;
  const state = connectionStateMap[stateCode] || 'unknown';

  if (stateCode !== 1) {
    return {
      status: 'down',
      state,
      pingMs: null,
    };
  }

  try {
    const start = Date.now();
    await mongoose.connection.db.admin().ping();
    const pingMs = Date.now() - start;

    return {
      status: 'healthy',
      state,
      pingMs,
    };
  } catch (err) {
    return {
      status: 'unhealthy',
      state,
      error: err.message,
      pingMs: null,
    };
  }
};

const disconnectDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    isShuttingDown = true;
    await mongoose.disconnect();
    isShuttingDown = false;
    console.log('[MongoDB] Connection cleanly closed.');
  }
};

module.exports = {
  connectDB,
  checkDatabaseHealth,
  disconnectDB,
};

