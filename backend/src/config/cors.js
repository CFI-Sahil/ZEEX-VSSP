const cors = require('cors');
const env = require('./env');

/**
 * CORS Configuration
 * - Enforces explicit client origin
 * - Requires credentials (cookies) support
 * - Restricts methods and headers
 * - Strictly avoids exposing Set-Cookie or unnecessary internal headers
 */
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl, server-to-server tests)
    if (!origin) return callback(null, true);

    const allowedOrigins = [env.CLIENT_ORIGIN];
    if (env.NODE_ENV !== 'production') {
      allowedOrigins.push('http://localhost:5173', 'http://127.0.0.1:5173');
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked: origin ${origin} not permitted`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  // Expose safe tokens (never expose Set-Cookie or sensitive auth credentials)
  exposedHeaders: ['X-CSRF-Token'],
  optionsSuccessStatus: 200,
};

module.exports = cors(corsOptions);

