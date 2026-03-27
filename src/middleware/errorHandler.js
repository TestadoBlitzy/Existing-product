/**
 * Centralized Express Error-Handling Middleware
 *
 * Provides a production-grade, 4-arity Express error middleware that:
 *  - Captures all errors forwarded through the Express middleware pipeline
 *  - Logs structured error details via Winston (status, message, URL, method, IP)
 *  - Returns a sanitized JSON error response to the client
 *  - Includes stack traces in development for debugging convenience
 *  - Omits stack traces in production to prevent information leakage
 *
 * Express 5 compatibility: Express 5 automatically catches rejected promises
 * in async route handlers and forwards them to this middleware. No manual
 * try/catch wrappers are needed in route handlers.
 *
 * Mounting: This middleware MUST be the LAST middleware registered in src/app.js,
 * positioned after routes and after the 404 notFound handler.
 *
 * @module src/middleware/errorHandler
 */

'use strict';

const config = require('../config');
const logger = require('../config/logger');

/**
 * Express error-handling middleware.
 *
 * CRITICAL: The function MUST retain all 4 parameters (err, req, res, next).
 * Express identifies error-handling middleware by its 4-parameter arity.
 * Removing the `next` parameter would cause Express to skip this middleware
 * when routing errors through the pipeline.
 *
 * @param {Error}    err  - The error object thrown or passed via next(err)
 * @param {import('express').Request}  req  - Express request object
 * @param {import('express').Response} res  - Express response object
 * @param {import('express').NextFunction} next - Express next function (required for 4-arity)
 */
const errorHandler = (err, req, res, next) => {
  // Determine the HTTP status code from the error object.
  // Supports both err.statusCode (common in custom errors) and err.status
  // (used by some Express/http-errors libraries). Defaults to 500 when neither
  // is set, ensuring unhandled errors always produce a server error response.
  const statusCode = err.statusCode || err.status || 500;

  // Log the error with full request context via Winston's error level.
  // Format: "<status> - <message> - <url> - <method> - <clientIP>"
  // This structured format enables log aggregation tools to parse and filter
  // error entries by any of these dimensions.
  logger.error(
    `${statusCode} - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`
  );

  // Build the JSON error response payload.
  // The base response always includes a human-readable message and the numeric
  // HTTP status code. The message falls back to a generic string when the
  // original error carries no message, preventing empty-string responses.
  const response = {
    error: {
      message: err.message || 'Internal Server Error',
      status: statusCode
    }
  };

  // In non-production environments, attach the full stack trace to the response
  // for developer debugging. In production, stack traces are omitted to prevent
  // exposing internal file paths, dependency versions, or other implementation
  // details to end users — a security best practice.
  if (config.nodeEnv !== 'production') {
    response.error.stack = err.stack;
  }

  // Send the JSON error response with the determined status code.
  // Using res.status().json() ensures correct Content-Type headers and
  // proper JSON serialization of the response body.
  res.status(statusCode).json(response);
};

module.exports = errorHandler;
