/**
 * Health Check Route Module
 *
 * Provides a GET endpoint that returns server health information including
 * current status, process uptime, timestamp, and deployment environment.
 * Essential for PM2 health monitoring and load balancer integration.
 *
 * When mounted by src/routes/index.js at '/health', this route is
 * accessible at GET /health.
 */

const { Router } = require('express');
const config = require('../config');

// Create a modular, mountable route handler instance for health checks.
const router = Router();

/**
 * GET /
 *
 * Returns a JSON object describing the current health state of the server.
 * All operations are synchronous so no async/await is required.
 *
 * Response body:
 *   status      {string} 'ok'           — server is running and responsive
 *   uptime      {number} seconds        — process uptime (floating point)
 *   timestamp   {string} ISO 8601       — current UTC time
 *   environment {string} e.g. 'development' — current NODE_ENV value
 */
router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
  });
});

module.exports = router;
