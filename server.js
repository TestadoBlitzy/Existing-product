/**
 * Express Application Bootstrap — Server Entry Point
 *
 * Thin bootstrap layer that imports the fully configured Express application
 * from src/app.js, reads runtime configuration from src/config/index.js, and
 * starts the HTTP server using structured logging from src/utils/logger.js.
 *
 * This file replaces the original 14-line raw HTTP server that used Node.js's
 * built-in http.createServer() with hardcoded hostname ('127.0.0.1') and port
 * (3000).  Configuration is now externalised into environment variables managed
 * by the config module.
 *
 * Separation rationale:
 *   - src/app.js   — Express app definition (middleware, routes, error handling)
 *   - server.js    — Server startup, process-level error handlers, lifecycle
 *
 * This separation enables PM2 cluster mode (ecosystem.config.js references this
 * file as the script entry point) and supports future test harness integration
 * where src/app.js can be imported without starting the listener.
 *
 * Usage:
 *   Direct:  node server.js
 *   npm:     npm start
 *   PM2:     pm2 start ecosystem.config.js
 *   Dev:     npm run dev  (nodemon auto-reload)
 *
 * @module server
 */

// ---------------------------------------------------------------------------
// Module imports (CommonJS)
// ---------------------------------------------------------------------------

// Import the fully configured Express application instance.  src/app.js
// registers all middleware (Helmet, CORS, compression, body parsers, Morgan)
// and mounts all routes before exporting the app object.
const app = require('./src/app');

// Import the centralized environment configuration.  The config module loads
// dotenv and exports a frozen object with port, host, nodeEnv, logLevel, and
// corsOrigin derived from environment variables with sensible defaults.
const config = require('./src/config');

// Import the Winston structured logger.  Replaces console.log with level-based
// logging to console and file transports (logs/combined.log, logs/error.log).
const logger = require('./src/utils/logger');

// ---------------------------------------------------------------------------
// Server startup
// ---------------------------------------------------------------------------

// Extract configuration values for server binding.
const { port, host } = config;

// Start the Express HTTP server on the configured host and port.
// The callback fires once the server is ready to accept connections.
app.listen(port, host, () => {
  logger.info(`Server running at http://${host}:${port}/`);
  logger.info(`Environment: ${config.nodeEnv}`);
});

// ---------------------------------------------------------------------------
// Process-level error handlers
// ---------------------------------------------------------------------------
// These handlers catch fatal errors that escape the Express middleware chain.
// In production, logging the error and exiting with a non-zero code allows
// PM2 to detect the crash and automatically restart the process.

/**
 * Unhandled Promise Rejection Handler
 *
 * Catches promises that reject without a .catch() handler attached.
 * Logs the rejection reason via Winston and terminates the process
 * with exit code 1 so that PM2 can perform an automatic restart.
 *
 * @param {*} reason - The rejection value (usually an Error instance).
 * @param {Promise} promise - The promise that was rejected.
 */
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at Promise', {
    reason: reason instanceof Error ? reason.message : reason,
    stack: reason instanceof Error ? reason.stack : undefined,
  });
  process.exit(1);
});

/**
 * Uncaught Exception Handler
 *
 * Catches synchronous exceptions that were not wrapped in try/catch.
 * Logs the full error details including the stack trace via Winston
 * and terminates the process with exit code 1 for PM2 auto-restart.
 *
 * @param {Error} error - The uncaught exception.
 */
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', {
    message: error.message,
    stack: error.stack,
  });
  process.exit(1);
});
