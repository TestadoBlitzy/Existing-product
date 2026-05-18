/**
 * HTTP integration tests for server.js
 *
 * Drives the Express app via Supertest against an ephemeral, in-process
 * listener (bound by Supertest, never on 127.0.0.1:3000). Asserts on the
 * exact body, status, and length of each route, plus the Express default
 * 404 handler for unmatched routes.
 *
 * Maps to AAP features: F-002 (GET /), F-003 (GET /evening), F-005 (default 404).
 */

const request = require('supertest');
const app = require('../server');

describe('server.js HTTP contracts', () => {
  describe('GET /', () => {
    it('returns HTTP 200 with the exact body "Hello, World!\\n" (14 bytes including trailing newline)', async () => {
      const response = await request(app).get('/');
      expect(response.status).toBe(200);
      expect(response.text).toBe('Hello, World!\n');
      expect(response.text.length).toBe(14);
    });
  });

  describe('GET /evening', () => {
    it('returns HTTP 200 with the exact body "Good evening" (12 bytes, no trailing newline)', async () => {
      const response = await request(app).get('/evening');
      expect(response.status).toBe(200);
      expect(response.text).toBe('Good evening');
      expect(response.text.length).toBe(12);
    });
  });

  describe('unknown routes', () => {
    it('returns HTTP 404 from the Express default 404 handler for an unregistered path', async () => {
      const response = await request(app).get('/missing');
      expect(response.status).toBe(404);
      // Second non-brittle assertion: SuperAgent (Supertest's underlying
      // library) sets response.notFound to true for any 404 response.
      // This corroborates the status assertion through a different signal
      // without over-constraining headers (e.g., Content-Type/Length) that
      // are Express framework defaults rather than F-005 contract values.
      expect(response.notFound).toBe(true);
    });
  });
});
