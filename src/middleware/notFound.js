/**
 * 404 Not Found Catch-All Middleware
 *
 * Catches all HTTP requests that do not match any defined route and returns
 * a structured JSON 404 error response. This middleware must be mounted AFTER
 * all route handlers and BEFORE the centralized error handler in the Express
 * middleware pipeline.
 *
 * Pipeline positioning (in src/app.js):
 *   1. Security, parsing, logging, rate-limiting middleware
 *   2. Route handlers (app.use('/', routes))
 *   3. >>> notFound middleware (THIS FILE) <<<
 *   4. errorHandler middleware (central error handler)
 *
 * Response format follows the standardized API error structure:
 *   { status: "error", statusCode: 404, message: "Not Found - <path>" }
 *
 * Usage:
 *   const notFound = require('./middleware/notFound');
 *   app.use(notFound);
 *
 * @module src/middleware/notFound
 */

const logger = require('../utils/logger');

/**
 * Express middleware that handles requests to undefined routes.
 *
 * Logs the 404 event at the 'warn' level via Winston structured logger and
 * sends a JSON response with HTTP status 404. This middleware terminates the
 * request/response cycle — it does NOT call next() and does NOT forward to
 * the error handler.
 *
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function (unused — cycle terminates here)
 */
const notFound = (req, res, next) => {
  logger.warn(`404 - Not Found - ${req.originalUrl}`);

  res.status(404).json({
    status: 'error',
    statusCode: 404,
    message: `Not Found - ${req.originalUrl}`
  });
};

module.exports = notFound;
