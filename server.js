/**
 * Server Entry Point
 *
 * Thin entry point that loads environment configuration, imports the configured
 * Express application from src/app.js, starts the HTTP server on the
 * environment-driven host and port, and registers process-level handlers for
 * graceful shutdown and unhandled errors.
 *
 * This file does NOT contain route definitions, middleware configuration, or
 * business logic — those responsibilities belong to src/app.js and its
 * sub-modules. The separation allows the app to be imported independently
 * (e.g., for testing with supertest) without starting a listening server.
 *
 * Startup flow:
 *   1. Load .env into process.env (dotenv — MUST be first require)
 *   2. Import Express app, config, and logger modules
 *   3. Call app.listen() with config-driven host and port
 *   4. Register SIGTERM / SIGINT handlers for PM2 zero-downtime reloads
 *   5. Register process-level error handlers for safety net logging
 *
 * @module server
 */

'use strict';

// ---------------------------------------------------------------------------
// 1. ENVIRONMENT SETUP — must be the very first require() call
// ---------------------------------------------------------------------------
// Load .env file into process.env before any other module reads environment
// variables. dotenv is idempotent — calling config() multiple times is safe
// and will not overwrite values already set in the environment.
require('dotenv').config();

// ---------------------------------------------------------------------------
// 2. IMPORTS
// ---------------------------------------------------------------------------
// Import the configured Express application (middleware + routes already wired)
const app = require('./src/app');
// Import centralized configuration (port, host, nodeEnv sourced from .env)
const config = require('./src/config');
// Import Winston logger for structured, level-aware logging
const logger = require('./src/config/logger');

// ---------------------------------------------------------------------------
// 3. SERVER STARTUP
// ---------------------------------------------------------------------------
// Start the HTTP server using Express's listen() method with config-driven
// host and port values. The returned server instance is captured for graceful
// shutdown support. Winston replaces console.log per project conventions.
const server = app.listen(config.port, config.host, () => {
  logger.info(`Server running at http://${config.host}:${config.port}/ in ${config.nodeEnv} mode`);
});

// ---------------------------------------------------------------------------
// 4. GRACEFUL SHUTDOWN HANDLER
// ---------------------------------------------------------------------------
// Handles SIGTERM (sent by PM2, Docker, Kubernetes) and SIGINT (Ctrl+C) to
// shut down the HTTP server gracefully, allowing in-flight requests to
// complete before the process exits. A 10-second timeout forces shutdown if
// connections fail to close in time, preventing the process from hanging
// indefinitely during PM2 zero-downtime reloads.
const gracefulShutdown = (signal) => {
  logger.info(`${signal} received. Shutting down gracefully...`);
  server.close(() => {
    logger.info('HTTP server closed.');
    process.exit(0);
  });

  // Force shutdown after 10 seconds to prevent hanging. The .unref() call
  // allows the process to exit naturally once the server closes and all work
  // completes, without waiting for this timeout to fire. If connections hang
  // beyond 10 seconds, the timeout still triggers a forced exit.
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ---------------------------------------------------------------------------
// 5. PROCESS-LEVEL ERROR HANDLERS
// ---------------------------------------------------------------------------
// Safety net for unhandled promise rejections and uncaught exceptions. These
// handlers ensure that unexpected errors are logged via Winston before the
// process terminates, providing diagnostic information for post-mortem
// analysis in production environments.

// Unhandled promise rejections — log and initiate graceful shutdown. While
// the rejection may not always be fatal, unhandled rejections indicate
// unpredictable application state. Aligning with the uncaughtException handler
// ensures consistent shutdown behavior. PM2 will automatically restart the
// worker after the process exits.
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Uncaught exceptions — log and exit immediately. The process is in an
// undefined state after an uncaught exception and cannot safely continue
// serving requests. PM2 will automatically restart the worker.
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});
