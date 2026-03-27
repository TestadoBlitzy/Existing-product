/**
 * Express Application Factory
 *
 * Central Express.js application module that creates the app instance, mounts
 * the complete middleware pipeline in the correct order, attaches all route
 * modules, and registers error-handling middleware.
 *
 * This file ONLY configures and exports the app — it does NOT call
 * app.listen(). The server entry point (server.js) is responsible for
 * starting the HTTP server via app.listen() with environment-driven
 * host and port values.
 *
 * Middleware pipeline order (per AAP §0.5.3):
 *   1. helmet()            — Security headers (MUST be first)
 *   2. cors()              — CORS headers (before routes)
 *   3. rateLimit()         — Rate limiting (before body parsing)
 *   4. compression()       — Gzip/deflate response compression
 *   5. express.json()      — JSON body parsing
 *   6. express.urlencoded()— URL-encoded body parsing
 *   7. morgan()            — HTTP request logging (piped through Winston)
 *   8. routes              — Application routes (health, API)
 *   9. notFound            — 404 catch-all (AFTER all routes)
 *  10. errorHandler        — Centralized error handler (MUST be last)
 *
 * @module src/app
 */

'use strict';

// ---------------------------------------------------------------------------
// External dependencies
// ---------------------------------------------------------------------------
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

// ---------------------------------------------------------------------------
// Internal dependencies
// ---------------------------------------------------------------------------
const config = require('./config');
const logger = require('./config/logger');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');

// ---------------------------------------------------------------------------
// Express application instance
// ---------------------------------------------------------------------------
const app = express();

// ---------------------------------------------------------------------------
// Trust proxy setting for production environments
// ---------------------------------------------------------------------------
// When running behind a reverse proxy (nginx, AWS ALB, etc.) in production,
// Express needs to trust the proxy's X-Forwarded-* headers so that req.ip,
// req.protocol, and req.hostname reflect the real client values rather than
// the proxy's internal address. This is also required by express-rate-limit
// to correctly identify client IPs behind proxies.
if (config.nodeEnv === 'production') {
  app.set('trust proxy', 1);
}

// ---------------------------------------------------------------------------
// 1. SECURITY HEADERS (must be FIRST middleware)
// ---------------------------------------------------------------------------
// Helmet sets various HTTP response headers to help protect against common
// web vulnerabilities (XSS, clickjacking, MIME sniffing, etc.).
app.use(helmet());

// ---------------------------------------------------------------------------
// 2. CORS (Cross-Origin Resource Sharing)
// ---------------------------------------------------------------------------
// Enables cross-origin requests from any origin in development. In a
// production environment, the origin whitelist should be configured via
// environment variables. Default cors() accepts all origins.
app.use(cors());

// ---------------------------------------------------------------------------
// 3. RATE LIMITING (before body parsing to reject early)
// ---------------------------------------------------------------------------
// Protects against brute-force and DDoS attacks by limiting each IP to a
// maximum of 100 requests per 15-minute sliding window. The standardHeaders
// option returns rate-limit info in the `RateLimit-*` headers per the IETF
// draft standard. Legacy `X-RateLimit-*` headers are disabled.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,                  // Limit each IP to 100 requests per window
  standardHeaders: true,     // Return rate limit info in RateLimit-* headers
  legacyHeaders: false,      // Disable X-RateLimit-* headers
  message: { error: 'Too many requests, please try again later.' }
});
app.use(limiter);

// ---------------------------------------------------------------------------
// 4. RESPONSE COMPRESSION (gzip / deflate)
// ---------------------------------------------------------------------------
// Compresses response bodies for all requests that support it, reducing
// payload size and improving network performance for clients.
app.use(compression());

// ---------------------------------------------------------------------------
// 5. JSON BODY PARSING
// ---------------------------------------------------------------------------
// Parses incoming requests with JSON payloads (Content-Type: application/json)
// and populates req.body with the parsed object.
app.use(express.json());

// ---------------------------------------------------------------------------
// 6. URL-ENCODED BODY PARSING
// ---------------------------------------------------------------------------
// Parses incoming requests with URL-encoded payloads (Content-Type:
// application/x-www-form-urlencoded). The `extended: true` option uses the
// `qs` library for rich object and array support in query strings.
app.use(express.urlencoded({ extended: true }));

// ---------------------------------------------------------------------------
// 7. HTTP REQUEST LOGGING (piped through Winston)
// ---------------------------------------------------------------------------
// Morgan logs HTTP requests (method, URL, status, response time). The log
// format is environment-aware:
//   - 'dev'      in development — concise, colorized output for terminal use
//   - 'combined' in production  — Apache-style verbose format for log analysis
// All Morgan output is piped through the Winston logger stream (logger.stream)
// for unified log management across the application.
//
// The `skip` function uses config.logLevel to suppress HTTP request logging
// for successful responses when the application is configured for error-only
// logging. This avoids the overhead of formatting log lines that Winston's
// level gate would discard, while still capturing error-level HTTP events
// (4xx/5xx) regardless of the configured log level.
const morganFormat = config.nodeEnv === 'production' ? 'combined' : 'dev';
app.use(morgan(morganFormat, {
  stream: logger.stream,
  skip: (req, res) => {
    if (config.logLevel === 'error') {
      return res.statusCode < 400;
    }
    return false;
  }
}));

// ---------------------------------------------------------------------------
// 8. APPLICATION ROUTES
// ---------------------------------------------------------------------------
// The routes module (src/routes/index.js) aggregates all sub-routers:
//   - GET /health → health check (JSON status, uptime, timestamp)
//   - GET /       → "Hello, World!\n" (backward compatible with original)
//   - GET /info   → application metadata (JSON name, version, environment)
app.use('/', routes);

// ---------------------------------------------------------------------------
// 9. 404 NOT FOUND HANDLER (after all routes, before error handler)
// ---------------------------------------------------------------------------
// Catches any request that did not match a defined route and returns a JSON
// { error: 'Not Found' } response with HTTP 404 status.
app.use(notFound);

// ---------------------------------------------------------------------------
// 10. CENTRALIZED ERROR HANDLER (MUST be last middleware)
// ---------------------------------------------------------------------------
// Express identifies error-handling middleware by its 4-parameter arity
// (err, req, res, next). This must be the very last app.use() call so that
// errors from any preceding middleware or route are properly caught, logged
// via Winston, and returned as sanitized JSON error responses.
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Export configured Express application
// ---------------------------------------------------------------------------
// The app instance is exported for server.js to consume via app.listen().
// No server startup logic belongs in this module.
module.exports = app;
