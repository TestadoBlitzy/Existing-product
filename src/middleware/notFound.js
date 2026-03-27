/**
 * 404 Not Found Middleware
 *
 * Catch-all handler for requests that do not match any defined route.
 * Returns a JSON response with HTTP status 404. This middleware is
 * mounted in the Express pipeline AFTER all application routes and
 * BEFORE the centralized error handler.
 *
 * Design notes:
 * - Uses standard 3-arity Express middleware signature (req, res, next).
 * - Terminates the request-response cycle by sending a response; does
 *   NOT forward to the error handler via next().
 * - HTTP 404 responses are already captured by Morgan (configured in
 *   src/app.js), so no additional logging is performed here.
 * - Compatible with Express 5.x.
 */

const notFound = (req, res, next) => {
  res.status(404).json({ error: 'Not Found' });
};

module.exports = notFound;
