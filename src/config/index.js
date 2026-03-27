/**
 * Centralized Environment Configuration Module
 *
 * Loads environment variables from a .env file via dotenv and exports a
 * validated configuration object consumed by the rest of the application.
 *
 * Consumers:
 *  - server.js          → config.port, config.host, config.nodeEnv
 *  - src/app.js         → config (general configuration needs)
 *  - src/config/logger.js → config.logLevel, config.nodeEnv
 *
 * This module has NO internal dependencies — it relies solely on the
 * external `dotenv` package and the Node.js runtime `process.env`.
 */

// Load .env file into process.env BEFORE any environment variable reads.
// dotenv is idempotent — calling config() multiple times is safe and will
// not overwrite values that are already set in the environment.
require('dotenv').config();

/**
 * Application configuration object.
 *
 * Every value is sourced from the corresponding environment variable with a
 * sensible default that mirrors the project's original behavior or the AAP
 * specification for development convenience.
 *
 * @property {number} port     - TCP port the HTTP server binds to.
 *                               Parsed as an integer (radix 10) to guarantee
 *                               a numeric type. Falls back to 3000 when the
 *                               env var is absent or cannot be parsed.
 * @property {string} host     - Network interface the server listens on.
 *                               Defaults to '0.0.0.0' (all interfaces) for
 *                               development flexibility, replacing the
 *                               original loopback-only '127.0.0.1'.
 * @property {string} nodeEnv  - Current runtime environment identifier.
 *                               Defaults to 'development'. Used by the logger
 *                               to decide whether file transports are active.
 * @property {string} logLevel - Winston log level threshold.
 *                               Defaults to 'debug'. Accepts any Winston
 *                               level: error, warn, info, http, verbose,
 *                               debug, silly.
 */
const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'debug'
};

module.exports = config;
