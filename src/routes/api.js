/**
 * API Router — Backward-Compatible "Hello, World!" and Application Metadata
 *
 * This router preserves the original server.js behavior by serving the exact
 * same "Hello, World!" plain-text response on GET / that the original
 * http.createServer handler produced. It also exposes a GET /info endpoint
 * that returns application metadata (name, version, environment) as JSON.
 *
 * Mounted at "/" by src/routes/index.js, so:
 *   router.get('/')     → GET /
 *   router.get('/info') → GET /info
 *
 * Backward compatibility contract (AAP §0.7.2):
 *   - HTTP Status: 200
 *   - Content-Type: text/plain
 *   - Body: "Hello, World!\n" (exact match, including trailing newline)
 */

const express = require('express');
const config = require('../config');

// Create a modular Express Router instance for API endpoints
const router = express.Router();

/**
 * GET / — Hello World (Backward Compatible)
 *
 * Replicates the original server.js response exactly:
 *   res.statusCode = 200;
 *   res.setHeader('Content-Type', 'text/plain');
 *   res.end('Hello, World!\n');
 *
 * Existing consumers (e.g., Backprop integration tests) depend on this
 * exact response format remaining unchanged.
 */
router.get('/', (req, res) => {
  res.status(200).type('text/plain').send('Hello, World!\n');
});

/**
 * GET /info — Application Metadata
 *
 * Returns a JSON object containing the application name and version
 * (sourced from package.json) along with the current runtime environment
 * (sourced from the centralized configuration module).
 *
 * Response shape:
 *   {
 *     "name": "hello_world",
 *     "version": "1.0.0",
 *     "environment": "development" | "production"
 *   }
 */
router.get('/info', (req, res) => {
  const { name, version } = require('../../package.json');
  res.json({
    name,
    version,
    environment: config.nodeEnv
  });
});

module.exports = router;
