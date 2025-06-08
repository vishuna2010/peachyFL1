const { AppError } = require('../utils/AppError');

const handleOperationalError = (err, res) => {
  // Operational, trusted error: send message to client
  return res.status(err.statusCode).json({
    status: err.status,
    message: err.message,
    // Optionally include stack in development
    // stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
};

const handleProgrammingOrUnknownError = (err, res) => {
  // 1) Log error
  console.error('ERROR 💥:', err);

  // 2) Send generic message
  // In development, send more details, otherwise generic message
  if (process.env.NODE_ENV === 'development') {
    return res.status(500).json({
      status: 'error',
      message: err.message || 'Something went very wrong!',
      error: err, // Send the full error object in development
      stack: err.stack
    });
  }
  // In production, send a generic message
  return res.status(500).json({
    status: 'error',
    message: 'Internal Server Error. Please try again later.'
  });
};

// Specific error handlers if needed, e.g. for JWT errors or DB constraint errors
const handleJWTError = (err, res) => res.status(401).json({ status: 'fail', message: 'Invalid token. Please log in again.' });
const handleJWTExpiredError = (err, res) => res.status(401).json({ status: 'fail', message: 'Your token has expired. Please log in again.' });
const handleDuplicateFieldsDB = (err, res) => {
    // Example: Extract value from error message for PostgreSQL unique violation
    const valueMatch = err.detail && err.detail.match(/\((.*?)\)=\((.*?)\)/);
    const value = valueMatch ? valueMatch[2] : 'provided value';
    const fieldMatch = err.detail && err.detail.match(/\((.*?)\)=/);
    const field = fieldMatch ? fieldMatch[1] : err.constraint ? err.constraint.replace(/_key$/, '').replace(/^[a-zA-Z0-9]+_([a-zA-Z0-9_]+)_key$/, '$1') : 'field'; // Attempt to clean up constraint name
    const message = `Duplicate value: ${value} for field: ${field}. Please use another value.`;
    return res.status(409).json({ status: 'fail', message: message, field: field }); // 409 Conflict
};


module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Log all errors in development, or only non-operational in production
  if (process.env.NODE_ENV === 'development') {
    // console.error('[Dev Log] Full Error:', err);
  } else if (err.isOperational !== true) { // Only log non-operational errors in prod for cleaner logs
    console.error('PRODUCTION ERROR 💥:', err);
  }

  // Specific error handling for common issues
  if (err.name === 'JsonWebTokenError') return handleJWTError(err, res);
  if (err.name === 'TokenExpiredError') return handleJWTExpiredError(err, res);
  if (err.code === '23505') return handleDuplicateFieldsDB(err, res); // PostgreSQL unique violation

  if (err.isOperational) {
    return handleOperationalError(err, res);
  } else {
    // Programming or other unknown error: don't leak error details
    return handleProgrammingOrUnknownError(err, res);
  }
};
