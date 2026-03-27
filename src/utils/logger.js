/**
 * Winston Structured Logging Module
 *
 * Provides a production-grade, multi-transport logger that replaces all
 * console.log usage throughout the application.  Configures three transports:
 *   1. Console  — colorized, human-readable output (always active)
 *   2. File     — logs/combined.log  (http level and above, JSON format)
 *   3. File     — logs/error.log     (error level only, JSON format)
 *
 * Also exposes a Morgan-compatible write stream at logger.stream for HTTP
 * request logging integration in src/app.js.
 *
 * @module src/utils/logger
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');
const config = require('../config');

// ---------------------------------------------------------------------------
// Programmatic logs/ directory creation
// ---------------------------------------------------------------------------
// Winston file transports require the target directory to exist.  We create it
// synchronously at module load time because logging is a foundational concern
// that must be available before the first log call.
const logDir = path.join(__dirname, '../../logs');

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// ---------------------------------------------------------------------------
// Log format definition
// ---------------------------------------------------------------------------
// Base format used by all transports — adds a timestamp, captures error stack
// traces, enables printf-style string interpolation, and serialises to JSON.
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// ---------------------------------------------------------------------------
// Winston logger instance
// ---------------------------------------------------------------------------
const logger = winston.createLogger({
  // Log verbosity is driven by the centralised config module which reads
  // the LOG_LEVEL environment variable (default: 'debug' in development).
  level: config.logLevel,

  // Structured JSON format applied to every transport by default.
  format: logFormat,

  // Tag every log entry with the current runtime environment so that log
  // aggregators can filter and group entries by environment.
  defaultMeta: { environment: config.nodeEnv },

  // Transports ---------------------------------------------------------------
  transports: [
    // 1. Console transport — colorized, human-readable for terminal output
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, stack }) => {
          return `${timestamp} ${level}: ${stack || message}`;
        })
      ),
    }),

    // 2. Combined file transport — captures http level and above
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      level: 'http',
      maxsize: 5242880, // 5 MB per file
      maxFiles: 5,      // keep up to 5 rotated files
    }),

    // 3. Error-only file transport — captures error level exclusively
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5 MB per file
      maxFiles: 5,      // keep up to 5 rotated files
    }),
  ],
});

// ---------------------------------------------------------------------------
// Morgan write-stream integration
// ---------------------------------------------------------------------------
// Morgan middleware calls stream.write(message) for every HTTP request.
// We pipe those messages through Winston's 'http' log level (priority 3,
// between 'info' and 'verbose') and trim the trailing newline Morgan appends.
//
// Morgan's 'dev' format embeds ANSI colour escape codes (e.g. \u001b[32m for
// green status codes).  These are desirable in the terminal but corrupt the
// JSON entries in file transports (combined.log, error.log).  We strip all
// ANSI sequences here so that every transport receives a clean plain-text
// message.  Winston's own Console transport re-applies colourisation through
// its format pipeline, so terminal output remains colourful.
// eslint-disable-next-line no-control-regex
const ANSI_REGEX = /\u001b\[[0-9;]*m/g;

logger.stream = {
  write: (message) => {
    logger.http(message.replace(ANSI_REGEX, '').trim());
  },
};

// ---------------------------------------------------------------------------
// Module export (CommonJS)
// ---------------------------------------------------------------------------
module.exports = logger;
