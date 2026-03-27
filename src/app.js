/**
 * Express Application Definition Module
 *
 * Creates, configures, and exports the Express 5.x application instance with
 * a comprehensive middleware pipeline and modular route mounting.  This file
 * is the core of the application — imported by server.js for startup and
 * referenced by ecosystem.config.js via server.js.
 *
 * Original server.js (14 lines) used http.createServer() with a single handler
 * returning "Hello, World!\n".  That logic has been split:
 *   - src/app.js  (THIS FILE)  — Express app definition, middleware, routes
 *   - server.js   (root)       — Thin bootstrap calling app.listen()
 *
 * Middleware execution order (critical for correctness):
 *   Request → Helmet → CORS → Compression → Body Parsers → Morgan
 *           → Routes → NotFound → ErrorHandler → Response
 *
 * @module src/app
 */

// ---------------------------------------------------------------------------
// External dependencies
// ---------------------------------------------------------------------------

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');

// ---------------------------------------------------------------------------
// Internal modules
// ---------------------------------------------------------------------------

const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');
const logger = require('./utils/logger');
const config = require('./config');

// ---------------------------------------------------------------------------
// Express application instance
// ---------------------------------------------------------------------------

const app = express();

// ---------------------------------------------------------------------------
// Middleware registration — ORDER IS CRITICAL
// ---------------------------------------------------------------------------
// The middleware chain processes every incoming request from top to bottom.
// Reordering these registrations will change application behaviour.

// 1. Security headers — Helmet sets Content-Security-Policy, X-Frame-Options,
//    Strict-Transport-Security, X-Content-Type-Options, and other hardening
//    headers on every response.  Registered first so that security headers are
//    present even if later middleware short-circuits the pipeline.
app.use(helmet());

// 2. Cross-Origin Resource Sharing — Configures Access-Control-Allow-Origin
//    and related headers.  The allowed origin is read from the centralised
//    config module (defaults to '*' in development for convenience).
app.use(cors({ origin: config.corsOrigin }));

// 3. Response compression — Enables gzip, deflate, and Brotli encoding for
//    responses, reducing bandwidth and improving transfer speed for clients.
app.use(compression());

// 4. Body parsing — Express 5.x built-in middleware for JSON and URL-encoded
//    request bodies.  `extended: true` allows rich objects and arrays to be
//    encoded into the URL-encoded format using the qs library.
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 5. HTTP request logging — Morgan logs every incoming HTTP request using an
//    environment-aware format:
//      - Development: 'dev' format  — concise, coloured, includes status codes
//      - Production:  'combined' format — Apache-style full request log
//    Output is piped through the Winston logger.stream write interface so that
//    HTTP access logs and application logs share the same transport pipeline.
const morganFormat = config.nodeEnv === 'production' ? 'combined' : 'dev';
app.use(morgan(morganFormat, { stream: logger.stream }));

// ---------------------------------------------------------------------------
// Route mounting
// ---------------------------------------------------------------------------
// The route aggregator (src/routes/index.js) mounts all sub-routers:
//   /health  → healthRouter  (GET /health)
//   /api     → apiRouter     (GET /api, GET /api/info)
app.use('/', routes);

// ---------------------------------------------------------------------------
// Error handling middleware — MUST be registered AFTER all routes
// ---------------------------------------------------------------------------

// 404 catch-all — intercepts any request that did not match a defined route
// and returns a structured JSON response with status 404.  Placed after all
// routes but before the error handler.
app.use(notFound);

// Centralized error handler — catches all errors thrown or forwarded via
// next(err) from route handlers or preceding middleware.  Uses the 4-argument
// Express signature (err, req, res, next) which Express recognises as an
// error-handling middleware.  Must be the LAST middleware in the chain.
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Module export (CommonJS)
// ---------------------------------------------------------------------------
// Export the fully configured Express application.  server.js imports this
// module and calls app.listen() to start accepting connections.  This
// separation enables PM2 cluster mode and future test harness integration.
module.exports = app;
