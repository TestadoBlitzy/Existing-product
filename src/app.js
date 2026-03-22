/**
 * Express Application Factory
 *
 * Creates and configures the Express application instance with the complete
 * middleware pipeline and mounted routes. This module is the central assembly
 * point for all HTTP request processing.
 *
 * Middleware Pipeline Order (CRITICAL — must not be reordered):
 *   1. Helmet        — Security headers (13 protective HTTP headers)
 *   2. CORS          — Cross-Origin Resource Sharing policy enforcement
 *   3. Compression   — Gzip/deflate response body compression
 *   4. Body Parsers  — JSON and URL-encoded request body parsing
 *   5. Morgan        — HTTP request access logging via Winston stream
 *   6. Rate Limiter  — Request throttling per time window
 *   7. Routes        — Application route handlers (/, /health, /api)
 *   8. 404 Handler   — Catch-all for unmatched routes
 *   9. Error Handler — Centralized error processing (must be LAST)
 *
 * Architecture Notes:
 * - The app is created here but NOT started (no app.listen() call).
 *   Server binding is handled by server.js, enabling testability and
 *   separation of concerns between app configuration and server lifecycle.
 * - All configurable values (CORS origin, rate limit settings) are read
 *   from the centralized config module — never hardcoded.
 * - CommonJS module syntax is used throughout for consistency with the
 *   existing codebase.
 *
 * @module src/app
 */

'use strict';

// ---------------------------------------------------------------------------
// External Package Imports
// ---------------------------------------------------------------------------

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

// ---------------------------------------------------------------------------
// Internal Module Imports
// ---------------------------------------------------------------------------

const config = require('./config');
const logger = require('./utils/logger');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');

// ---------------------------------------------------------------------------
// Express Application Instance
// ---------------------------------------------------------------------------

const app = express();

// ---------------------------------------------------------------------------
// Middleware Pipeline
// ---------------------------------------------------------------------------
// Middleware is registered in a specific order that ensures correct processing.
// Security headers are set first (before any response can leak without them),
// followed by CORS (to handle preflight OPTIONS requests early), then
// compression, parsing, logging, and rate limiting before routes execute.
// Error-handling middleware is always registered LAST.
// ---------------------------------------------------------------------------

// 1. Security Headers — Helmet sets 13 HTTP security response headers by
//    default including Content-Security-Policy, Strict-Transport-Security,
//    X-Content-Type-Options, X-Frame-Options, and others to harden the
//    application against common web vulnerabilities such as XSS, clickjacking,
//    and MIME-type sniffing.
app.use(helmet());

// 2. CORS — Cross-Origin Resource Sharing middleware enables controlled API
//    access from different origins. The allowed origin is read from the
//    centralized config module (defaults to '*' in development) to support
//    environment-specific CORS policies without code changes.
app.use(cors({
  origin: config.corsOrigin
}));

// 3. Response Compression — Applies gzip/deflate encoding to HTTP responses,
//    reducing payload size for improved transfer speed and bandwidth efficiency.
//    The middleware automatically negotiates the best encoding with the client
//    via the Accept-Encoding request header.
app.use(compression());

// 4. Body Parsers — Enable Express to parse incoming request bodies.
//    express.json() handles application/json content type.
//    express.urlencoded() handles application/x-www-form-urlencoded content
//    type with the 'extended: true' option enabling rich object and array
//    encoding via the qs library.
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 5. HTTP Request Logging — Morgan middleware generates Apache-style combined
//    access logs for every HTTP request. The 'combined' format includes:
//    remote addr, remote user, date, method, URL, HTTP version, status code,
//    content length, referrer, and user agent.
//    Logs are piped through the Winston logger's stream adapter at the 'http'
//    level for unified structured logging across the application.
app.use(morgan('combined', {
  stream: logger.stream
}));

// 6. Rate Limiting — Prevents API abuse by throttling requests from a single
//    IP address within a configurable time window. Configuration values are
//    read from the centralized config module (environment-driven).
//    - standardHeaders: true  — Returns rate limit info in RateLimit-* headers
//                                (IETF draft-6 standard)
//    - legacyHeaders: false   — Disables deprecated X-RateLimit-* headers
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  limit: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

// ---------------------------------------------------------------------------
// Route Mounting
// ---------------------------------------------------------------------------
// The routes module (src/routes/index.js) is an Express Router that internally
// mounts all sub-routers:
//   GET  /         — Root welcome route (JSON greeting)
//   GET  /health   — Health check endpoint (status, uptime, memory, node version)
//   GET  /api      — API welcome message
//   GET  /api/info — Server metadata (version, environment, node version)
// ---------------------------------------------------------------------------

app.use('/', routes);

// ---------------------------------------------------------------------------
// 404 Catch-All Handler
// ---------------------------------------------------------------------------
// Must come AFTER all route handlers so it only catches requests that truly
// do not match any defined route. Returns a structured JSON 404 response
// with the unmatched path for debugging.
// ---------------------------------------------------------------------------

app.use(notFound);

// ---------------------------------------------------------------------------
// Centralized Error Handler
// ---------------------------------------------------------------------------
// Must be the LAST app.use() call in the pipeline. Express identifies error
// handlers by their 4-argument function signature (err, req, res, next).
// This middleware logs errors via Winston and returns standardized JSON error
// responses with appropriate HTTP status codes. In non-production environments,
// the error stack trace is included for debugging.
// ---------------------------------------------------------------------------

app.use(errorHandler);

// ---------------------------------------------------------------------------
// Module Export
// ---------------------------------------------------------------------------
// Export the fully configured Express app instance for use by server.js.
// The app is NOT started here — server.js handles binding to host:port,
// enabling this module to be imported independently for testing.
// ---------------------------------------------------------------------------

module.exports = app;
