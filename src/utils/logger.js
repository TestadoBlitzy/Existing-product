/**
 * Winston Logger Setup — Centralized Structured Logging Module
 *
 * Provides a production-grade Winston logger instance with:
 * - JSON-formatted file transports for combined and error-only logs
 * - Colorized console transport for developer convenience
 * - Configurable log level via environment-based configuration
 * - Morgan stream adapter for HTTP request access logging integration
 *
 * Winston Log Levels (npm defaults):
 *   { error: 0, warn: 1, info: 2, http: 3, verbose: 4, debug: 5, silly: 6 }
 *
 * Usage:
 *   const logger = require('./utils/logger');
 *   logger.info('Server started');
 *   logger.error('Something failed', { error: err });
 *   // Morgan integration: morgan('combined', { stream: logger.stream })
 *
 * @see src/app.js — Morgan binding site: app.use(morgan('combined', { stream: logger.stream }))
 * @module src/utils/logger
 */

const winston = require('winston');
const config = require('../config');

// ---------------------------------------------------------------------------
// Logger Creation
// ---------------------------------------------------------------------------
// The logger is configured with a base format pipeline that applies to all
// transports unless overridden at the transport level. File transports inherit
// the JSON format from the base configuration, while the console transport
// overrides with colorized simple output for terminal readability.
// ---------------------------------------------------------------------------

const logger = winston.createLogger({
  // Log level is driven by environment configuration — never hardcoded.
  // In development, config.logLevel defaults to 'debug' which captures all
  // levels from error (0) through debug (5). In production, it can be set
  // to 'info' or 'warn' to reduce log volume.
  level: config.logLevel,

  // Base format pipeline applied to all transports (unless transport overrides)
  // - timestamp(): Adds ISO-8601 timestamp to every log entry
  // - errors({ stack: true }): Serializes Error objects with full stack traces
  // - json(): Produces structured JSON output for machine-parseable log files
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),

  // Default metadata attached to every log entry for service identification
  // in multi-service or log aggregation environments
  defaultMeta: { service: 'hello-world' },

  // Transport array: two file transports for persistent storage and one
  // console transport for real-time developer feedback
  transports: [
    // Combined log file — captures all log entries at 'http' level and above
    // (error, warn, info, http). Written in JSON format inherited from base
    // format. The 'http' level (3) ensures Morgan HTTP request access logs are
    // persisted alongside application logs for production log aggregation.
    // File rotation: 5MB max per file, retains up to 5 rotated files.
    new winston.transports.File({
      filename: 'logs/combined.log',
      level: 'http',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),

    // Error-only log file — captures exclusively 'error' level entries for
    // dedicated error monitoring and alerting. Separate from combined log to
    // enable focused error analysis without noise from info/warn entries.
    // File rotation: 5MB max per file, retains up to 5 rotated files.
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),

    // Console transport — provides human-readable colorized output for
    // development and debugging. Overrides the base JSON format with
    // colorize() + simple() for terminal readability. Colors are applied
    // per log level (e.g., red for error, yellow for warn, green for info).
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// ---------------------------------------------------------------------------
// Morgan Stream Adapter
// ---------------------------------------------------------------------------
// Creates a write stream interface that Morgan uses to output HTTP request
// access logs. Each incoming request logged by Morgan is forwarded to the
// Winston logger at the 'http' level (level 3 in npm log level hierarchy).
//
// The .trim() call removes the trailing newline character that Morgan appends
// to every log message, preventing double-spaced entries in log output.
//
// Integration in src/app.js:
//   const morgan = require('morgan');
//   const logger = require('./utils/logger');
//   app.use(morgan('combined', { stream: logger.stream }));
// ---------------------------------------------------------------------------

const stream = {
  write: (message) => {
    logger.http(message.trim());
  }
};

// Attach the stream adapter directly to the logger instance for convenient
// access by consumers. This allows a single import pattern:
//   const logger = require('./utils/logger');
//   logger.info('...');          // Direct logging
//   logger.stream.write('...');  // Morgan stream access
logger.stream = stream;

// Export the logger as the default module export. The stream is accessible
// via logger.stream. This pattern supports both:
//   const logger = require('./utils/logger');       // Gets logger instance
//   const { stream } = require('./utils/logger');   // Destructured stream
module.exports = logger;
