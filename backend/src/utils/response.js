/**
 * Standardized API response helpers
 * Ensures consistent response envelopes across the application
 */

const sendSuccess = (res, message = 'Success', data = null, meta = null, statusCode = 200) => {
  const payload = {
    success: true,
    message,
    data,
  };

  if (meta !== null && meta !== undefined) {
    payload.meta = meta;
  }

  return res.status(statusCode).json(payload);
};

const sendError = (res, message = 'An error occurred', errors = null, statusCode = 500) => {
  const payload = {
    success: false,
    message,
  };

  if (errors !== null && errors !== undefined) {
    payload.errors = Array.isArray(errors) ? errors : [errors];
  }

  return res.status(statusCode).json(payload);
};

module.exports = {
  sendSuccess,
  sendError,
};

