const logger = require('../utils/logger');
const config = require('../config');

/**
 * Centralized error-handling middleware for the Express application.
 *
 * Catches all errors thrown or forwarded via next(err) from any route handler
 * or preceding middleware.  Logs full error details through the Winston logger
 * and returns a structured JSON response to the client.
 *
 * Environment-aware behaviour:
 *   - Development: includes the stack trace in the response body for debugging.
 *   - Production:  omits the stack trace to avoid leaking internal details.
 *
 * IMPORTANT — Express requires exactly four parameters (err, req, res, next)
 * for a function to be recognised as an error-handling middleware.  The `next`
 * parameter is intentionally unused because this is the terminal handler.
 *
 * @param {Error}    err  - The error object caught by Express.
 * @param {import('express').Request}  req  - The incoming HTTP request.
 * @param {import('express').Response} res  - The outgoing HTTP response.
 * @param {import('express').NextFunction} next - Express next callback (unused).
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  // Resolve the HTTP status code from the error or default to 500.
  const statusCode = err.statusCode || err.status || 500;

  // Log error details to console and logs/error.log via Winston.
  logger.error(err.message, {
    statusCode,
    stack: err.stack,
    path: req.originalUrl,
    method: req.method,
  });

  // Build the JSON response payload.
  const response = {
    status: statusCode,
    message: err.message || 'Internal Server Error',
  };

  // Attach the stack trace only in development mode.
  if (config.nodeEnv === 'development') {
    response.stack = err.stack;
  }

  // Send the structured JSON error response.
  res.status(statusCode).json(response);
};

module.exports = errorHandler;
