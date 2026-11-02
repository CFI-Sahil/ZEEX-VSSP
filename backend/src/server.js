const app = require('./app');
const env = require('./config/env');
const { connectDB, disconnectDB } = require('./config/db');
const { initKeepAlive, stopKeepAlive } = require('./utils/keepAlive');

let server;

const startServer = async () => {
  console.log('====================================================');
  console.log('  Visual Safety Surveillance Platform (VSSP) Backend');
  console.log(`  Environment: ${env.NODE_ENV}`);
  console.log('====================================================');

  // Attempt database connection
  await connectDB();

  server = app.listen(env.PORT, () => {
    console.log(`[HTTP] Server listening on http://localhost:${env.PORT}`);
    console.log(`[HTTP] Health check: http://localhost:${env.PORT}/api/v1/health`);
    console.log(`[CORS] Allowed Client Origin: ${env.CLIENT_ORIGIN}`);

    // Initialize Render Keep-Alive service
    initKeepAlive();
  });
};

// Graceful Shutdown Handlers
const handleShutdown = async (signal) => {
  console.log(`\n[Server] Received ${signal}. Starting graceful shutdown...`);
  stopKeepAlive();

  if (server) {
    server.close(async () => {
      console.log('[Server] HTTP server closed.');
      await disconnectDB();
      console.log('[Server] Clean exit completed.');
      process.exit(0);
    });

    // Force close after 10 seconds if hanging
    setTimeout(() => {
      console.error('[Server] Shutdown timed out. Forcing process exit.');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL] Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[CRITICAL] Uncaught Exception:', err);
  process.exit(1);
});

startServer();

