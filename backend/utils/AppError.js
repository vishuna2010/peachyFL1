class AppError extends Error {
  constructor(message, statusCode, errorCode = null, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error'; // 'fail' for 4xx, 'error' for 5xx
    this.isOperational = true; // Mark as an operational error (vs. programming error)
    this.errorCode = errorCode; // Optional: application-specific error code
    this.details = details;     // Optional: additional details object

    Error.captureStackTrace(this, this.constructor);
  }
}

class BadRequestError extends AppError {
  constructor(message = 'Bad Request', errorCode = 'BAD_REQUEST', details = null) {
    super(message, 400, errorCode, details);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', errorCode = 'UNAUTHORIZED', details = null) {
    super(message, 401, errorCode, details);
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', errorCode = 'FORBIDDEN', details = null) {
    super(message, 403, errorCode, details);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Not Found', errorCode = 'NOT_FOUND', details = null) {
    super(message, 404, errorCode, details);
  }
}

class ConflictError extends AppError {
  constructor(message = 'Conflict', errorCode = 'CONFLICT', details = null) {
    super(message, 409, errorCode, details);
  }
}

// You can add more specific error classes here if needed, e.g.:
// class ConflictError extends AppError {
//   constructor(message = 'Conflict') {
//     super(message, 409);
//   }
// }

module.exports = {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError
};
