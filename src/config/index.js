/**
 * Centralized Environment-Based Configuration Module
 *
 * Reads all runtime configuration from process.env with sensible defaults.
 * Environment variables must be loaded before this module is imported.
 * The exported object is frozen to prevent runtime mutation.
 */

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  host: process.env.HOST || '0.0.0.0',
  logLevel: process.env.LOG_LEVEL || 'debug',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000,
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  },
};

module.exports = Object.freeze(config);
