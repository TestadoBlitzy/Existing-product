/**
 * Health Check Route Module
 *
 * Provides a GET /health endpoint for PM2 process monitoring and load balancer
 * health probes. Returns JSON containing server status, uptime, timestamp,
 * memory usage, and Node.js version information.
 *
 * This endpoint requires no authentication and must remain freely accessible
 * for automated monitoring systems.
 *
 * @module src/routes/health
 */

'use strict';

const express = require('express');
const { validateInput, z } = require('../middleware/validateInput');

const router = express.Router();

// SECURITY: Input validation — reject unexpected request body and query parameters to prevent injection attacks

/**
 * GET / — Health check endpoint
 *
 * When mounted at /health by the route aggregator (src/routes/index.js),
 * this handler responds to GET /health requests with a JSON payload
 * containing real-time server health metrics.
 *
 * Response fields:
 *   - status      {string}  "ok" — indicates the server is running and healthy
 *   - uptime      {number}  Server uptime in seconds (floating-point)
 *   - timestamp   {string}  Current time in ISO 8601 format
 *   - memory      {Object}  Memory usage metrics in bytes (rss, heapTotal,
 *                            heapUsed, external, arrayBuffers)
 *   - nodeVersion {string}  Node.js runtime version (e.g., "v20.20.1")
 *
 * @param {import('express').Request}  req - Express request object
 * @param {import('express').Response} res - Express response object
 */
router.get('/', validateInput({ body: z.object({}).strict().optional(), query: z.object({}).strict() }), (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    memory: process.memoryUsage(),
    nodeVersion: process.version
  });
});

module.exports = router;
