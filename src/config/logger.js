/**
 * Winston Logger Factory Module
 *
 * Creates and exports a configured Winston logger instance with environment-aware
 * transports, replacing bare console output used in the original server.js with
 * structured, level-aware logging. Also exports a Morgan-compatible write stream
 * for unified HTTP access log routing through Winston.
 *
 * Transport strategy:
 *  - Console transport (colorized, timestamped) — active in ALL environments
 *  - File transports (JSON-formatted) — active in production ONLY
 *      • logs/error.log  — error-level entries only
 *      • logs/combined.log — all log levels
 *
 * Consumed by:
 *  - src/app.js              → logger and logger.stream for Morgan integration
 *  - server.js               → logger for startup message and process-level errors
 *  - src/middleware/errorHandler.js → logger for error logging
 *
 * @module src/config/logger
 */

'use strict';

const { createLogger, format, transports } = require('winston');
const path = require('path');
const fs = require('fs');
const config = require('./index');

// ---------------------------------------------------------------------------
// Log directory auto-creation
// ---------------------------------------------------------------------------
// The logs/ directory for Winston file transports is created automatically on
// first run if it does not exist, preventing ENOENT errors when file transports
// attempt to open their target paths. Uses `recursive: true` so nested paths
// are handled gracefully.
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// ---------------------------------------------------------------------------
// Winston logger creation
// ---------------------------------------------------------------------------
// The base logger is created with the log level sourced from the centralized
// config module (config.logLevel). The base format pipeline produces JSON
// output enriched with ISO timestamps, full error stack traces, and string
// interpolation via splat. A defaultMeta field tags every entry with the
// service name for identification in aggregated log environments.
const logger = createLogger({
  level: config.logLevel,
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  defaultMeta: { service: 'hello-world' },
  transports: []
});

// ---------------------------------------------------------------------------
// Console transport — active in ALL environments
// ---------------------------------------------------------------------------
// Provides colorized, human-readable output to stdout. The format pipeline
// overrides the base JSON format with a readable printf layout while retaining
// colorization and timestamps for developer convenience.
logger.add(
  new transports.Console({
    format: format.combine(
      format.colorize(),
      format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      format.printf(({ timestamp, level, message, service, ...meta }) => {
        // Build a clean console line. Omit the defaultMeta 'service' key from
        // the trailing metadata dump to avoid noise. Only append extra metadata
        // when meaningful key-value pairs remain after filtering.
        const metaKeys = Object.keys(meta);
        const extraMeta = metaKeys.length > 0 ? ` ${JSON.stringify(meta)}` : '';
        return `${timestamp} [${level}]: ${message}${extraMeta}`;
      })
    )
  })
);

// ---------------------------------------------------------------------------
// File transports — active in production ONLY
// ---------------------------------------------------------------------------
// In production, logs are persisted to disk as JSON for post-mortem analysis,
// monitoring ingestion, and audit trails. Two separate files are maintained:
//   • error.log   — captures only error-level entries for quick triage
//   • combined.log — captures ALL log levels for full request lifecycle tracing
// Both inherit the base JSON format defined on the logger instance.
if (config.nodeEnv === 'production') {
  logger.add(
    new transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error'
    })
  );
  logger.add(
    new transports.File({
      filename: path.join(logDir, 'combined.log')
    })
  );
}

// ---------------------------------------------------------------------------
// Morgan write stream — for HTTP access log integration
// ---------------------------------------------------------------------------
// Morgan calls stream.write(logLine) for each HTTP request. This stream pipes
// each line into Winston's info level, unifying HTTP access logs with the
// application's structured logging output. The trailing newline appended by
// Morgan is trimmed to prevent double line breaks in the log output.
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  }
};

module.exports = logger;
