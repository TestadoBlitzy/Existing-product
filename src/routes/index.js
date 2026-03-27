/**
 * Route Aggregator Module
 *
 * Central entry point for all application routes. Creates a parent Express
 * Router and mounts every sub-router at its designated path prefix. This
 * module is the sole route import required by src/app.js, keeping the
 * application bootstrap clean and the routing layer modular.
 *
 * Mounting table:
 *   /health  → healthRouter  (src/routes/health.js)  → GET /health
 *   /api     → apiRouter     (src/routes/api.js)      → GET /api, GET /api/info
 */

const { Router } = require('express');
const healthRouter = require('./health');
const apiRouter = require('./api');

// Create the parent router that aggregates all sub-routers.
const router = Router();

// Mount the health-check sub-router — used by PM2 health monitoring
// and load balancers to verify the server is responsive.
router.use('/health', healthRouter);

// Mount the API sub-router — contains the migrated Hello World endpoint
// and server information endpoint.
router.use('/api', apiRouter);

module.exports = router;
