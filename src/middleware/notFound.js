/**
 * 404 Not Found handler middleware.
 *
 * Catches any request that does not match a defined route and returns
 * a structured JSON response. This middleware is registered in the
 * Express middleware chain AFTER all route definitions but BEFORE
 * the centralized error handler.
 *
 * Response schema:
 *   { status: 404, message: 'Not Found', path: '<requested URL>' }
 *
 * @param {import('express').Request} req  - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 */
const notFound = (req, res, next) => {
  res.status(404).json({
    status: 404,
    message: 'Not Found',
    path: req.originalUrl,
  });
};

module.exports = notFound;
