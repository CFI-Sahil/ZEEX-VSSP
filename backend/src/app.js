const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const env = require('./config/env');
const corsMiddleware = require('./config/cors');
const apiRoutes = require('./routes');
const { notFoundHandler, centralErrorHandler } = require('./middleware/errorHandler');

const app = express();

// Trust reverse proxy if in production behind nginx/alb
if (env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// 1. Security Headers via Helmet
// HSTS strictly enabled only in production with HTTPS; disabled in local HTTP development
app.use(
  helmet({
    contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
    crossOriginEmbedderPolicy: false,
    hsts: env.NODE_ENV === 'production' ? { maxAge: 31536000, includeSubDomains: true } : false,
  })
);

// 2. Explicit CORS with credentials
app.use(corsMiddleware);

// 3. HTTP Request Logging (Development only)
if (env.NODE_ENV !== 'test') {
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// 4. Rate Limiting (Baseline protection against abuse)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 500 requests per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes',
  },
});
app.use('/api', globalLimiter);

// 5. Body Parsing with strict size limits (Prevents memory exhaustion)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 6. Cookie Parser with Secret
app.use(cookieParser(env.COOKIE_SECRET));

// 7. API Routes Mount
app.use('/api/v1', apiRoutes);

// 8. 404 Handler
app.use(notFoundHandler);

// 9. Central Error Handler
app.use(centralErrorHandler);

module.exports = app;

