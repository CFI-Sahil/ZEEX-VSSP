const jwt = require('jsonwebtoken');
const User = require('../models/User');
const env = require('../config/env');
const { generateCsrfToken } = require('../middleware/csrf');
const { sendSuccess, sendError } = require('../utils/response');
const { loginSchema } = require('../validators/authValidator');

const COOKIE_MAX_AGE = 8 * 60 * 60 * 1000; // 8 hours in milliseconds

/**
 * Cookie option helper adhering to deployment environment
 * In production (cross-site Vercel -> Render): strictly requires sameSite: 'none' and secure: true
 * In development: uses sameSite: 'lax' to support local HTTP testing
 */
const getCookieOptions = (httpOnly = true) => {
  const isProduction = env.NODE_ENV === 'production';
  return {
    httpOnly,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  };
};

/**
 * @route   POST /api/v1/auth/login
 * @desc    Authenticate user, set HttpOnly session cookie & signed CSRF cookie
 * @access  Public (Rate-limited)
 */
const login = async (req, res, next) => {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      return sendError(
        res,
        'Validation failed',
        parseResult.error.issues.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        })),
        400
      );
    }

    const { email, password } = parseResult.data;

    // Retrieve user including passwordHash for comparison
    const user = await User.findOne({ email }).select('+passwordHash');

    // Generic error message prevents account enumeration
    if (!user || !(await user.comparePassword(password))) {
      return sendError(res, 'Invalid email or password', null, 401);
    }

    if (!user.isActive) {
      return sendError(res, 'Account access suspended: Please contact an administrator', null, 403);
    }

    // Update login timestamp
    user.lastLoginAt = new Date();
    await user.save();

    // Generate JWT session payload
    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
      },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN }
    );

    // Generate signed CSRF token bound to authenticated user ID
    const csrfToken = generateCsrfToken(user._id.toString());

    // 1. Set HttpOnly JWT session cookie
    res.cookie('vssp_jwt', token, getCookieOptions(true));

    // 2. Set Readable CSRF cookie for client-side double-submit header
    res.cookie('vssp_csrf', csrfToken, getCookieOptions(false));

    // Expose CSRF token in header for cross-origin clients
    res.setHeader('X-CSRF-Token', csrfToken);

    return sendSuccess(res, 'Authentication successful', {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        lastLoginAt: user.lastLoginAt,
      },
      csrfToken,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Clear session and CSRF cookies
 * @access  Authenticated
 */
const logout = async (req, res) => {
  const isProduction = env.NODE_ENV === 'production';
  const sameSite = isProduction ? 'none' : 'lax';

  res.clearCookie('vssp_jwt', {
    httpOnly: true,
    secure: isProduction,
    sameSite,
    path: '/',
  });

  res.clearCookie('vssp_csrf', {
    httpOnly: false,
    secure: isProduction,
    sameSite,
    path: '/',
  });

  return sendSuccess(res, 'Session terminated successfully');
};

/**
 * @route   GET /api/v1/auth/me
 * @desc    Return currently authenticated user profile
 * @access  Authenticated
 */
const getCurrentUser = async (req, res) => {
  return sendSuccess(res, 'Current session active', {
    user: {
      _id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      isActive: req.user.isActive,
      lastLoginAt: req.user.lastLoginAt,
    },
  });
};

module.exports = {
  login,
  logout,
  getCurrentUser,
};

