'use strict';

/**
 * Centralized Error Handling Middleware
 *
 * Catches all errors thrown or forwarded by other middleware and route handlers,
 * logs them via the Winston logger with contextual information, and returns a
 * standardized JSON error response to the client.
 *
 * This middleware MUST be the LAST app.use() call in the Express middleware
 * pipeline (after routes and the 404 notFound handler) so that it can catch
 * errors from all preceding layers.
 *
 * Express identifies error-handling middleware by its 4-argument signature:
 *   (err, req, res, next)
 * All four parameters must be declared even if `next` is unused, because
 * Express checks the function's `.length` property (arity of 4) to distinguish
 * error handlers from regular middleware.
 *
 * Express 5 Compatibility:
 * Express 5 (^5.2.1) has built-in promise support for async middleware —
 * promise rejections in async route handlers are automatically caught and
 * forwarded to this error handler without needing manual try/catch wrappers.
 *
 * Response Format:
 *   { status: "error", statusCode: <number>, message: <string> }
 *   In non-production environments, an additional `stack` field is included
 *   to aid debugging.
 *
 * Security:
 *   For 5xx server errors in production, the raw error message is masked with
 *   a generic "Internal Server Error" string to prevent information disclosure
 *   of internal details such as file paths, module names, or connection strings
 *   (CWE-209: Information Exposure Through Error Message).
 *
 * @module src/middleware/errorHandler
 */

const logger = require('../utils/logger');
const { sanitizeLogInput } = require('../utils/sanitizer');

/**
 * Express error-handling middleware function.
 *
 * @param {Error} err - The error object thrown or passed via next(err)
 * @param {import('express').Request} req - The Express request object
 * @param {import('express').Response} res - The Express response object
 * @param {import('express').NextFunction} next - The Express next function (declared for arity, not called)
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  // Extract HTTP status code from the error object using a fallback chain:
  // 1. err.statusCode — common pattern used by many libraries and custom errors
  // 2. err.status — Express convention (e.g., http-errors package)
  // 3. 500 — default to Internal Server Error when no status is provided
  const statusCode = err.statusCode || err.status || 500;

  // Log the error with contextual information for debugging and monitoring.
  // Uses logger.error() (Winston error level = 0, highest severity) to ensure
  // the entry is captured by both the combined and error-only file transports.
  // Format: "<statusCode> - <message> - <originalUrl> - <httpMethod>"
  // req.originalUrl is used instead of req.url to capture the full URL path
  // including any base path prefixes from mounted sub-applications.
  // SECURITY: Log injection prevention — sanitize user-controlled input (req.originalUrl, req.method) before logging to prevent log forging via control characters (CWE-117)
  logger.error(`${statusCode} - ${err.message} - ${sanitizeLogInput(req.originalUrl)} - ${sanitizeLogInput(req.method)}`);

  // Build the standardized JSON error response object.
  // The format is consistent across the entire application:
  //   { status: "error", statusCode: <number>, message: <string> }
  // For 5xx server errors in production, the raw error message is replaced
  // with a generic string to prevent potential information disclosure of
  // internal details (file paths, module names, connection strings).
  // Client errors (4xx) retain the specific message for API consumer feedback.
  // SECURITY: CWE-209 — Error message masking for 5xx errors in production prevents information disclosure
  const isServerError = statusCode >= 500;
  const isProduction = process.env.NODE_ENV === 'production';
  const message = (isServerError && isProduction)
    ? 'Internal Server Error'
    : (err.message || 'Internal Server Error');

  const response = {
    status: 'error',
    statusCode: statusCode,
    message: message,
  };

  // Conditionally include the error stack trace for non-production environments.
  // In development and test environments, the stack trace aids debugging by
  // showing the exact call chain that led to the error. In production, the
  // stack trace is OMITTED to prevent exposing internal code paths, file
  // structures, and potentially sensitive implementation details to clients.
  if (process.env.NODE_ENV !== 'production') {
    response.stack = err.stack;
  }

  // Set the HTTP status code and send the JSON response.
  // This terminates the error handling chain — next() is intentionally NOT
  // called because this middleware is the final handler in the pipeline.
  res.status(statusCode).json(response);
};

module.exports = errorHandler;
