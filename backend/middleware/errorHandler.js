const { AppError } = require('../utils/AppError');
const config = require('../config'); // Import config to use nodeEnv
const logger = require('../utils/logger'); // Import the structured logger

const handleOperationalError = (err, res) => {
  // Operational, trusted error: send message to client
  const response = {
    status: err.status,
    message: err.message,
  };
  if (err.errorCode) {
    response.code = err.errorCode;
  }
  if (err.details) {
    response.details = err.details;
  }
  // Optionally include stack in development
  // if (config.nodeEnv === 'development') {
  //   response.stack = err.stack;
  // }
  return res.status(err.statusCode).json(response);
};

const handleProgrammingOrUnknownError = (err, res) => {
  // 1) Log error using the structured logger
  logger.error({
    err: {
      message: err.message,
      stack: err.stack,
      name: err.name,
      // Include any other relevant properties from the error object
      ...(err.code && { code: err.code }),
      ...(err.errno && { errno: err.errno }),
      ...(err.syscall && { syscall: err.syscall }),
    }
  }, 'PROGRAMMING_OR_UNKNOWN_ERROR 💥');


  // 2) Send generic message or detailed error in development
  if (config.nodeEnv === 'development') {
    return res.status(500).json({
      status: 'error',
      message: err.message || 'Something went very wrong!',
      code: err.code || 'INTERNAL_SERVER_ERROR_DEV', // Generic code for dev
      error: { name: err.name, message: err.message }, // Send limited error info
      stack: err.stack // Full stack for dev
    });
  }
  // In production, send a generic message
  return res.status(500).json({
    status: 'error',
    message: 'Internal Server Error. Please try again later.',
    code: 'INTERNAL_SERVER_ERROR'
  });
};

// Specific error handlers
const handleJWTError = (err, res) => res.status(401).json({
  status: 'fail',
  message: 'Invalid token. Please log in again.',
  code: 'INVALID_TOKEN'
});

const handleJWTExpiredError = (err, res) => res.status(401).json({
  status: 'fail',
  message: 'Your token has expired. Please log in again.',
  code: 'TOKEN_EXPIRED'
});

const handleDuplicateFieldsDB = (err, res) => {
    const valueMatch = err.detail && err.detail.match(/\((.*?)\)=\((.*?)\)/);
    const value = valueMatch ? valueMatch[2] : 'provided value';
    const fieldMatch = err.detail && err.detail.match(/\((.*?)\)=/);
    const field = fieldMatch ? fieldMatch[1] : err.constraint ? err.constraint.replace(/_key$/, '').replace(/^[a-zA-Z0-9]+_([a-zA-Z0-9_]+)_key$/, '$1') : 'field';
    const message = `Duplicate value: ${value} for field: ${field}. Please use another value.`;
    return res.status(409).json({ // 409 Conflict
        status: 'fail',
        message: message,
        code: 'DUPLICATE_FIELD',
        details: { field: field, value: value }
    });
};


module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Log all errors in development, or only non-operational in production.
  // This logging can be enhanced with a structured logger later.
  // The actual logging of the error details for non-operational errors is now handled
  // inside handleProgrammingOrUnknownError or if it's an operational error that somehow
  // wasn't caught by err.isOperational but still needs logging.
  // For operational errors (AppError), we typically don't log the full error object in production
  // unless it's for specific debugging, as the error is known/expected.
  // However, logging all errors in dev is useful.
  if (config.nodeEnv === 'development') {
    logger.debug({ err: err, type: err.isOperational ? 'OPERATIONAL_DEV' : 'NON_OPERATIONAL_DEV' }, 'Full error object (dev)');
  } else if (!err.isOperational) {
    // Non-operational errors are already logged with stack by handleProgrammingOrUnknownError.
    // If we reach here and it's !err.isOperational, it means it wasn't caught by the specific
    // programming error handler, which is unlikely but possible if the structure of module.exports changes.
    // For safety, ensure it's logged if it somehow bypassed the more detailed logging.
    logger.error({
        err: {
            message: err.message,
            name: err.name,
            stack: err.stack,
            code: err.code,
        }
    }, 'FALLBACK_NON_OPERATIONAL_ERROR');
  }
  // For operational errors in production, we generally don't log them unless they represent
  // a pattern of failure or have specific details that need tracking.
  // If specific operational errors need logging in prod, that can be added here or in their handlers.


  // Specific error handling for common issues
  if (err.name === 'JsonWebTokenError') return handleJWTError(err, res);
  if (err.name === 'TokenExpiredError') return handleJWTExpiredError(err, res);
  if (err.code === '23505') return handleDuplicateFieldsDB(err, res); // PostgreSQL unique violation

  // Handle AppError instances (operational errors)
  if (err.isOperational) {
    return handleOperationalError(err, res);
  }

  // Handle other errors (likely programming or unknown errors)
  // These might include built-in errors like TypeError, ReferenceError, etc.
  // or errors from dependencies that are not AppError instances.
  return handleProgrammingOrUnknownError(err, res);
};
