'use strict';

/**
 * API Routes Module
 *
 * Provides RESTful API endpoints for the application.
 * This router is mounted at /api by the route aggregator (src/routes/index.js).
 *
 * Endpoints:
 *   GET /api       - API welcome message
 *   GET /api/info  - Server metadata (version, environment, Node.js version)
 */

const express = require('express');
const config = require('../config');

// Create a modular, mountable route handler
const router = express.Router();

/**
 * GET /api
 * Returns a JSON welcome message for the API root.
 *
 * Response:
 *   {
 *     "status": "success",
 *     "message": "Welcome to the API"
 *   }
 */
router.get('/', (req, res) => {
  res.json({
    status: 'success',
    message: 'Welcome to the API'
  });
});

/**
 * GET /api/info
 * Returns server metadata including application version, current environment,
 * and Node.js runtime version. The version is read dynamically from package.json
 * to avoid hardcoded values.
 *
 * Response:
 *   {
 *     "status": "success",
 *     "data": {
 *       "version": "1.0.0",
 *       "environment": "development",
 *       "nodeVersion": "v20.x.x"
 *     }
 *   }
 */
router.get('/info', (req, res) => {
  res.json({
    status: 'success',
    data: {
      version: require('../../package.json').version,
      environment: config.env,
      nodeVersion: process.version
    }
  });
});

module.exports = router;
