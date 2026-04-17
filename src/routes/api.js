const { Router } = require('express');

const router = Router();

/**
 * GET /
 * Root API endpoint — Hello World migration.
 * Migrates the original server.js plain-text "Hello, World!\n" response
 * into a structured JSON endpoint. When mounted at /api by the route
 * aggregator, this becomes GET /api.
 */
router.get('/', (req, res) => {
  res.json({
    message: 'Hello, World!',
  });
});

/**
 * GET /info
 * Server information endpoint.
 * Returns application metadata including name, version, and description.
 * Values are hardcoded to keep this module dependency-free per AAP.
 * When mounted at /api, this becomes GET /api/info.
 */
router.get('/info', (req, res) => {
  res.json({
    name: 'hello_world',
    version: '1.0.0',
    description: 'Production-ready Express.js web server',
  });
});

module.exports = router;
