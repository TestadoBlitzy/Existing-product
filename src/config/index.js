/**
 * Centralized Environment-Based Configuration Module
 *
 * Reads all runtime configuration from process.env with sensible defaults.
 * Environment variables must be loaded before this module is imported.
 * The exported object is deeply frozen to prevent runtime mutation.
 */

/**
 * Safely parses an integer from an environment variable string value.
 * Unlike the `parseInt(val, 10) || fallback` pattern, this function
 * correctly handles a valid value of `0` by using an explicit NaN check
 * instead of relying on the falsy nature of zero.
 *
 * @param {string|undefined} value - The raw environment variable string
 * @param {number} fallback - The default value if parsing yields NaN
 * @returns {number} The parsed integer or the fallback value
 */
const parseIntSafe = (value, fallback) => {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseIntSafe(process.env.PORT, 3000),
  host: process.env.HOST || '0.0.0.0',
  logLevel: process.env.LOG_LEVEL || 'debug',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  rateLimit: Object.freeze({
    windowMs: parseIntSafe(process.env.RATE_LIMIT_WINDOW_MS, 900000),
    max: parseIntSafe(process.env.RATE_LIMIT_MAX, 100),
  }),
};

module.exports = Object.freeze(config);
