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
 *
 * @module src/routes/api
 */

const express = require('express');
const config = require('../config');
const { validateInput, z } = require('../middleware/validateInput');

// Create a modular, mountable route handler
const router = express.Router();

// SECURITY: Input validation — reject unexpected request body and query parameters on GET endpoints to prevent injection attacks

/**
 * GET /api
 * Returns a JSON welcome message for the API root.
 *
 * Response:
 *   {
 *     "status": "success",
 *     "message": "Welcome to the API"
 *   }
 *
 * @param {import('express').Request}  req - Express request object
 * @param {import('express').Response} res - Express response object
 */
router.get('/', validateInput({ body: z.object({}).strict().optional(), query: z.object({}).strict() }), (req, res) => {
  res.json({
    status: 'success',
    message: 'Welcome to the API'
  });
});

// SECURITY: Reject non-GET methods on /api with 405 Method Not Allowed.
// Express router.get() only matches GET/HEAD requests; other HTTP methods
// (POST, PUT, DELETE, PATCH) bypass the route middleware chain entirely
// (including validateInput) and would otherwise fall through to the 404
// handler with a misleading status code. This catch-all ensures unsupported
// methods receive a semantically correct 405 response per RFC 9110 §15.5.6
// with the required Allow header and a consistent JSON error format.
router.all('/', (req, res) => {
  res.status(405).set('Allow', 'GET, HEAD').json({
    status: 'error',
    statusCode: 405,
    message: 'Method Not Allowed'
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
 *
 * @param {import('express').Request}  req - Express request object
 * @param {import('express').Response} res - Express response object
 */
router.get('/info', validateInput({ body: z.object({}).strict().optional(), query: z.object({}).strict() }), (req, res) => {
  res.json({
    status: 'success',
    data: {
      version: require('../../package.json').version,
      environment: config.env,
      nodeVersion: process.version
    }
  });
});

// SECURITY: Reject non-GET methods on /api/info with 405 Method Not Allowed.
// Same rationale as the /api catch-all above — prevents unsupported methods
// from falling through to the 404 handler and returns the correct HTTP status
// per RFC 9110 §15.5.6, with the required Allow header advertising the
// supported methods.
router.all('/info', (req, res) => {
  res.status(405).set('Allow', 'GET, HEAD').json({
    status: 'error',
    statusCode: 405,
    message: 'Method Not Allowed'
  });
});

module.exports = router;
