/**
 * Centralized Environment Configuration Module
 *
 * Loads environment variables from the .env file via dotenv and exports
 * a frozen configuration object consumed by all other application modules.
 * This module MUST be imported before any other module that reads process.env.
 *
 * Environment variable mapping:
 *   NODE_ENV    → config.nodeEnv    (string,  default: 'development')
 *   PORT        → config.port       (number,  default: 3000)
 *   HOST        → config.host       (string,  default: '0.0.0.0')
 *   LOG_LEVEL   → config.logLevel   (string,  default: 'debug')
 *   CORS_ORIGIN → config.corsOrigin (string,  default: '*')
 */

// Load .env file into process.env — MUST execute before any process.env reads.
// If the .env file does not exist, dotenv silently continues without error.
require('dotenv').config();

/**
 * Application configuration object.
 *
 * Every property is derived from a corresponding environment variable with a
 * sensible default value suitable for local development.  Production deployments
 * should provide explicit values through the environment or a .env file.
 */
const config = {
  /** Application environment — controls logging verbosity, error detail, etc. */
  nodeEnv: process.env.NODE_ENV || 'development',

  /**
   * TCP port the HTTP server listens on.
   * Parsed as a base-10 integer; falls back to 3000 for backward compatibility
   * with the original server.js.
   */
  port: parseInt(process.env.PORT, 10) || 3000,

  /**
   * Network interface the server binds to.
   * Default '0.0.0.0' binds to all interfaces (required for Docker / PM2 cluster
   * mode).  The original server.js used '127.0.0.1' (localhost only).
   */
  host: process.env.HOST || '0.0.0.0',

  /** Winston log level — one of: error, warn, info, http, verbose, debug, silly */
  logLevel: process.env.LOG_LEVEL || 'debug',

  /**
   * Allowed CORS origin(s).
   * Default '*' permits all origins (suitable for development).
   * Production should restrict to specific trusted domains.
   */
  corsOrigin: process.env.CORS_ORIGIN || '*',
};

// Freeze the object to prevent accidental mutation at runtime.
module.exports = Object.freeze(config);
