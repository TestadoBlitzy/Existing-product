'use strict';

const express = require('express');

const router = express.Router();

/**
 * GET /
 * Health check endpoint — returns application health status as JSON.
 *
 * When mounted at /health by the route aggregator (src/routes/index.js),
 * this handler responds to GET /health requests.
 *
 * Response body:
 *   - status    {String} Always 'ok' when the server is able to handle requests
 *   - uptime    {Number} Seconds the Node.js process has been running (process.uptime())
 *   - timestamp {String} Current UTC time in ISO 8601 format (new Date().toISOString())
 *
 * HTTP Status: 200
 * Content-Type: application/json
 */
router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
