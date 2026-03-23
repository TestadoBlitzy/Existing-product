/**
 * Route Aggregator Module
 *
 * Central routing module that imports and mounts all sub-routers at their
 * respective path prefixes and defines the root welcome route. This is the
 * single module mounted by src/app.js via app.use('/', routes).
 *
 * Route hierarchy:
 *   GET  /         — Root welcome route returning JSON greeting
 *   GET  /health   — Health check endpoint (delegated to health router)
 *   GET  /api      — API welcome message (delegated to API router)
 *   GET  /api/info — Server metadata (delegated to API router)
 *
 * @module src/routes/index
 */

'use strict';

const express = require('express');
const healthRouter = require('./health');
const apiRouter = require('./api');

/**
 * Express Router instance that aggregates all application sub-routers
 * and defines the root-level welcome route.
 *
 * @type {import('express').Router}
 */
const router = express.Router();

/**
 * GET / — Root welcome route
 *
 * Serves as the application landing endpoint. Returns a JSON response
 * with a success status and welcome message. This preserves the original
 * "Hello, World!" response from the bare http.createServer() implementation
 * while upgrading the format from plain text to structured JSON.
 *
 * @param {import('express').Request}  req - Express request object
 * @param {import('express').Response} res - Express response object
 */
router.get('/', (req, res) => {
  res.json({
    status: 'success',
    message: 'Hello, World! Welcome to the Express server.'
  });
});

/**
 * Mount the health check router at /health.
 * Delegates all /health/* requests to the health router module which
 * provides real-time server health metrics for PM2 and load balancer probes.
 */
router.use('/health', healthRouter);

/**
 * Mount the API router at /api.
 * Delegates all /api/* requests to the API router module which provides
 * the application's RESTful API endpoints including welcome and info routes.
 */
router.use('/api', apiRouter);

module.exports = router;
