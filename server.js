/**
 * Express Application Entry Point
 *
 * Bootstraps the Express server by loading environment variables, importing the
 * configured Express application, binding to the configured host and port, and
 * registering process-level signal handlers for graceful shutdown and unhandled
 * error safety nets.
 *
 * Startup sequence:
 *   1. Load .env into process.env via dotenv (MUST be first — all subsequent
 *      module imports may read process.env during their initialization)
 *   2. Import the Express app, centralized config, and Winston logger
 *   3. Bind the app to config.host:config.port via app.listen()
 *   4. Register SIGTERM/SIGINT handlers for graceful shutdown (PM2 compatible)
 *   5. Register unhandledRejection/uncaughtException safety nets
 *
 * This file is the entry point defined in package.json "main" and referenced
 * by the PM2 ecosystem.config.js "script" property. It does NOT export anything
 * because it is not intended to be imported by other modules.
 *
 * @module server
 */

// ---------------------------------------------------------------------------
// Phase 1: Environment Loading
// ---------------------------------------------------------------------------
// dotenv MUST be loaded before ANY other require() call so that environment
// variables from the .env file are available in process.env when subsequent
// modules (config, logger, app) read them during their initialization.
// ---------------------------------------------------------------------------
require('dotenv').config();

// ---------------------------------------------------------------------------
// Phase 2: Module Imports
// ---------------------------------------------------------------------------
// All imports occur AFTER dotenv has loaded environment variables into
// process.env. Import order: app (Express instance), config (environment
// settings), logger (structured logging).
// ---------------------------------------------------------------------------
const app = require('./src/app');
const config = require('./src/config');
const logger = require('./src/utils/logger');

// ---------------------------------------------------------------------------
// Phase 3: Server Creation and Startup
// ---------------------------------------------------------------------------
// app.listen() creates an HTTP server, binds it to the configured host and
// port, and begins accepting connections. The host and port are read from the
// centralized config module (environment-driven, never hardcoded).
//
// Default values (from config module when no .env overrides):
//   host: '0.0.0.0' (all interfaces — changed from the original '127.0.0.1'
//         to support Docker and production environments)
//   port: 3000 (same default as the original server.js)
// ---------------------------------------------------------------------------
const server = app.listen(config.port, config.host, () => {
  logger.info(`Server running on http://${config.host}:${config.port} in ${config.env} mode`);
});

// ---------------------------------------------------------------------------
// Phase 4: Graceful Shutdown Handlers
// ---------------------------------------------------------------------------
// SIGTERM is sent by PM2 during `pm2 reload` / `pm2 stop` and by container
// orchestrators (Docker, Kubernetes) during shutdown. SIGINT is sent when
// Ctrl+C is pressed in the terminal during development.
//
// Both handlers close the HTTP server gracefully — the server stops accepting
// new connections and waits for in-flight requests to complete before the
// process exits with code 0 (success).
// ---------------------------------------------------------------------------

process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    logger.info('Process terminated.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  server.close(() => {
    logger.info('Process terminated.');
    process.exit(0);
  });
});

// ---------------------------------------------------------------------------
// Phase 5: Unhandled Error Safety Nets
// ---------------------------------------------------------------------------
// These handlers act as last-resort safety nets for errors that escape all
// Express middleware and try/catch blocks. They prevent the process from
// crashing silently without logging.
//
// unhandledRejection: Catches rejected Promises with no .catch() handler.
//   The process continues running — the rejection is logged for investigation.
//
// uncaughtException: Catches synchronous throws with no try/catch. The process
//   MUST exit after logging because the runtime state may be corrupted. Exit
//   code 1 signals abnormal termination to PM2, which triggers an automatic
//   restart per the configured restart policy.
// ---------------------------------------------------------------------------

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});
