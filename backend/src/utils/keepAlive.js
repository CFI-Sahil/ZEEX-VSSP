/**
 * Render & Cloud Keep-Alive Utility
 * Prevents free-tier hosting services (e.g., Render) from spinning down after 15 minutes of inactivity.
 * Periodically issues lightweight HTTP GET requests to the public health check endpoint.
 */
const env = require('../config/env');

let keepAliveTimer = null;

/**
 * Resolves the public URL of the application
 * Automatically checks:
 * 1. KEEP_ALIVE_URL in .env
 * 2. RENDER_EXTERNAL_URL (automatically injected by Render on cloud deployments)
 * 3. APP_URL / BACKEND_URL
 */
const getTargetUrl = () => {
  const rawUrl =
    env.KEEP_ALIVE_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    process.env.APP_URL ||
    process.env.BACKEND_URL;

  if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
    return null;
  }

  return rawUrl.trim().replace(/\/$/, '');
};

/**
 * Sends a single ping request to the public endpoint
 * @param {string} targetUrl
 */
const sendPing = async (targetUrl) => {
  const pingEndpoint = `${targetUrl}/api/v1/health/ping`;
  const startTime = Date.now();

  try {
    const response = await fetch(pingEndpoint, {
      method: 'GET',
      headers: {
        'User-Agent': 'VSSP-Render-KeepAlive/1.0',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15000), // 15-second timeout
    });

    const latency = Date.now() - startTime;
    if (response.ok) {
      console.log(
        `[Keep-Alive] Ping sent successfully to ${pingEndpoint} (HTTP ${response.status}) in ${latency}ms`
      );
    } else {
      console.warn(
        `[Keep-Alive] Ping returned non-OK status: HTTP ${response.status} from ${pingEndpoint}`
      );
    }
  } catch (error) {
    console.warn(`[Keep-Alive] Ping attempt to ${pingEndpoint} failed: ${error.message}`);
  }
};

/**
 * Initializes the periodic self-ping mechanism
 * Default interval: 14 minutes (Render sleeps after 15 minutes of inactivity)
 */
const initKeepAlive = () => {
  // Never run self-ping during automated testing
  if (env.NODE_ENV === 'test') {
    return;
  }

  const targetUrl = getTargetUrl();
  if (!targetUrl) {
    console.log(
      '[Keep-Alive] Inactive (No external URL detected). Set KEEP_ALIVE_URL or deploy on Render to activate.'
    );
    return;
  }

  const intervalMinutes = env.KEEP_ALIVE_INTERVAL_MINUTES || 14;
  const intervalMs = intervalMinutes * 60 * 1000;

  console.log(
    `[Keep-Alive] Active: Pinging ${targetUrl}/api/v1/health/ping every ${intervalMinutes} minutes to prevent idle shutdown.`
  );

  // Send an initial ping 45 seconds after startup to verify connectivity
  const initialTimer = setTimeout(() => {
    sendPing(targetUrl);
  }, 45 * 1000);
  initialTimer.unref();

  // Schedule recurring keep-alive interval
  keepAliveTimer = setInterval(() => {
    sendPing(targetUrl);
  }, intervalMs);

  // Ensure timer does not prevent graceful process termination
  keepAliveTimer.unref();
};

/**
 * Stops the keep-alive timer cleanly on process shutdown
 */
const stopKeepAlive = () => {
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
    console.log('[Keep-Alive] Timer stopped.');
  }
};

module.exports = {
  initKeepAlive,
  stopKeepAlive,
  getTargetUrl,
};
