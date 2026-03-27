'use strict';

const express = require('express');
const healthRouter = require('./health');
const apiRouter = require('./api');

/**
 * Route Aggregator — Central routing hub for the Express application.
 *
 * Imports all individual route modules (sub-routers) and mounts them under
 * their respective path prefixes on a single Express Router instance. The
 * aggregated router is exported and mounted on the Express app in src/app.js
 * via: app.use('/', routes)
 *
 * Mounting order is significant:
 *   1. /health → healthRouter  (health check endpoint)
 *   2. /       → apiRouter     (Hello World + /info endpoints)
 *
 * The /health router is mounted before / to ensure health check requests
 * are matched by the correct sub-router and not intercepted by the more
 * general root-level API router.
 */
const router = express.Router();

// Mount health check sub-router at /health prefix
// GET /health → healthRouter handles with JSON { status, uptime, timestamp }
router.use('/health', healthRouter);

// Mount API sub-router at root prefix
// GET /      → apiRouter handles with "Hello, World!\n" (backward compatible)
// GET /info  → apiRouter handles with JSON { name, version, environment }
router.use('/', apiRouter);

module.exports = router;
