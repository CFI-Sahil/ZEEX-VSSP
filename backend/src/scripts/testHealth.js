/**
 * Milestone 0 Verification Script: Health Check & Database Connectivity Test
 */
const http = require('http');
const app = require('../app');
const env = require('../config/env');
const { connectDB, checkDatabaseHealth, disconnectDB } = require('../config/db');

const runHealthCheckTest = async () => {
  console.log('\n========================================================');
  console.log('  MILESTONE 0: SYSTEM HEALTH & DB CONNECTIVITY TEST');
  console.log('========================================================\n');

  console.log('[1/4] Checking Environment Configuration...');
  console.log(`  - NODE_ENV: ${env.NODE_ENV}`);
  console.log(`  - PORT: ${env.PORT}`);
  console.log(`  - CLIENT_ORIGIN: ${env.CLIENT_ORIGIN}`);
  console.log(`  - MONGODB_URI configured: ${env.MONGODB_URI ? 'YES (Masked)' : 'NO'}`);

  console.log('\n[2/4] Testing Database Connection...');
  await connectDB();
  const dbHealth = await checkDatabaseHealth();
  console.log(`  - Database Status: ${dbHealth.status}`);
  console.log(`  - Connection State: ${dbHealth.state}`);
  if (dbHealth.pingMs !== null) {
    console.log(`  - Ping Latency: ${dbHealth.pingMs} ms`);
  }
  if (dbHealth.error) {
    console.log(`  - Error: ${dbHealth.error}`);
  }

  console.log('\n[3/4] Testing HTTP Server and /api/v1/health Endpoint...');
  const testServer = http.createServer(app);

  await new Promise((resolve) => {
    testServer.listen(0, '127.0.0.1', async () => {
      const port = testServer.address().port;
      console.log(`  - Ephemeral test server active on port ${port}`);

      const req = http.get(`http://127.0.0.1:${port}/api/v1/health`, (res) => {
        let rawData = '';
        res.on('data', (chunk) => {
          rawData += chunk;
        });

        res.on('end', async () => {
          try {
            const parsed = JSON.parse(rawData);
            console.log(`  - Health Endpoint Status Code: ${res.statusCode}`);
            console.log('  - Health Endpoint Response Body:');
            console.log(JSON.stringify(parsed, null, 2));

            console.log('\n[4/4] Verifying Security Headers on Health Response...');
            console.log(`  - X-DNS-Prefetch-Control: ${res.headers['x-dns-prefetch-control'] || 'Not set'}`);
            console.log(`  - X-Frame-Options: ${res.headers['x-frame-options'] || 'Not set'}`);
            console.log(`  - Strict-Transport-Security: ${res.headers['strict-transport-security'] || 'Not set (dev)'}`);
            console.log(`  - Set-Cookie in CORS exposed: ${res.headers['access-control-expose-headers'] || 'None (Safe)'}`);

            testServer.close(async () => {
              await disconnectDB();
              console.log('\n========================================================');
              console.log('  MILESTONE 0 VERIFICATION TEST FINISHED');
              console.log('========================================================\n');
              resolve();
            });
          } catch (e) {
            console.error('Failed to parse health check response:', e);
            testServer.close(async () => {
              await disconnectDB();
              resolve();
            });
          }
        });
      });

      req.on('error', (e) => {
        console.error('Health check HTTP request failed:', e.code, e.message);
        testServer.close(async () => {
          await disconnectDB();
          resolve();
        });
      });
    });
  });
};

runHealthCheckTest();

