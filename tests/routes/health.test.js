'use strict';

/**
 * Health Endpoint Integration Tests
 *
 * Integration tests for the health check endpoint (GET /health) and its 405
 * Method Not Allowed enforcement, exercised through the complete Express
 * middleware pipeline using Supertest against the src/app.js factory export.
 *
 * Covers:
 *   - GET /health happy path with dynamic runtime value assertions
 *   - HEAD /health automatic handling by Express router.get()
 *   - 405 Method Not Allowed for POST, PUT, PATCH, DELETE with Allow header
 *   - 400 Validation rejection for unexpected query parameters
 *
 * The health endpoint returns runtime telemetry that changes between calls:
 *   - process.uptime()        → asserted with expect.any(Number)
 *   - new Date().toISOString() → asserted with ISO 8601 regex pattern
 *   - process.memoryUsage()   → asserted with expect.objectContaining()
 *   - process.version         → asserted against actual process.version
 *
 * @module tests/routes/health.test
 */

// ---------------------------------------------------------------------------
// CRITICAL: Logger mock MUST be declared BEFORE any require() of modules that
// depend on the logger. src/app.js imports src/utils/logger at module load
// time, so the mock must be in place before the app factory is imported.
// This prevents Winston file transports from writing to logs/combined.log
// and logs/error.log during test execution.
// ---------------------------------------------------------------------------
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  http: jest.fn(),
  stream: { write: jest.fn() }
}));

const request = require('supertest');
const app = require('../../src/app');

// ---------------------------------------------------------------------------
// ISO 8601 timestamp pattern for assertion — matches YYYY-MM-DDTHH:mm:ss.sssZ
// ---------------------------------------------------------------------------
const ISO_8601_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

describe('Health Route', () => {
  // =========================================================================
  // GET /health — Happy Path Tests
  // =========================================================================
  describe('GET /health', () => {
    test('returns 200 status code', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
    });

    test('returns JSON content type', async () => {
      const res = await request(app).get('/health');
      expect(res.headers['content-type']).toEqual(
        expect.stringContaining('application/json')
      );
    });

    test('response has status field set to "ok"', async () => {
      const res = await request(app).get('/health');
      expect(res.body.status).toBe('ok');
    });

    test('response has uptime as a number', async () => {
      const res = await request(app).get('/health');
      expect(res.body.uptime).toEqual(expect.any(Number));
      // Uptime should be a positive number representing seconds since process start
      expect(res.body.uptime).toBeGreaterThan(0);
    });

    test('response has timestamp as an ISO 8601 string', async () => {
      const res = await request(app).get('/health');
      expect(typeof res.body.timestamp).toBe('string');
      expect(res.body.timestamp).toMatch(ISO_8601_PATTERN);
      // Verify the timestamp is parseable as a valid Date
      const parsed = new Date(res.body.timestamp);
      expect(parsed.toISOString()).toBe(res.body.timestamp);
    });

    test('response has memory as an object with expected properties', async () => {
      const res = await request(app).get('/health');
      expect(res.body.memory).toEqual(
        expect.objectContaining({
          rss: expect.any(Number),
          heapTotal: expect.any(Number),
          heapUsed: expect.any(Number),
          external: expect.any(Number),
          arrayBuffers: expect.any(Number)
        })
      );
      // All memory values should be positive
      expect(res.body.memory.rss).toBeGreaterThan(0);
      expect(res.body.memory.heapTotal).toBeGreaterThan(0);
      expect(res.body.memory.heapUsed).toBeGreaterThan(0);
    });

    test('response has nodeVersion as a string matching process.version', async () => {
      const res = await request(app).get('/health');
      expect(res.body.nodeVersion).toBe(process.version);
      // Verify it starts with "v" followed by a digit (standard Node version format)
      expect(res.body.nodeVersion).toMatch(/^v\d+/);
    });

    test('response body has exactly the 5 expected top-level fields', async () => {
      const res = await request(app).get('/health');
      const keys = Object.keys(res.body);
      expect(keys).toHaveLength(5);
      expect(keys.sort()).toEqual(
        ['memory', 'nodeVersion', 'status', 'timestamp', 'uptime']
      );
    });

    test('response body matches the complete expected structure', async () => {
      const res = await request(app).get('/health');
      expect(res.body).toMatchObject({
        status: 'ok',
        uptime: expect.any(Number),
        timestamp: expect.any(String),
        memory: expect.objectContaining({
          rss: expect.any(Number),
          heapTotal: expect.any(Number),
          heapUsed: expect.any(Number),
          external: expect.any(Number),
          arrayBuffers: expect.any(Number)
        }),
        nodeVersion: expect.stringMatching(/^v\d+/)
      });
    });
  });

  // =========================================================================
  // HEAD /health — Automatic Express handling
  // =========================================================================
  describe('HEAD /health', () => {
    test('returns 200 status code', async () => {
      const res = await request(app).head('/health');
      expect(res.status).toBe(200);
    });

    test('returns no body content', async () => {
      const res = await request(app).head('/health');
      // HEAD responses have empty body per HTTP spec
      expect(res.text).toBeFalsy();
    });
  });

  // =========================================================================
  // 405 Method Not Allowed Tests
  // =========================================================================
  describe('Method Not Allowed', () => {
    test.each(['post', 'put', 'patch', 'delete'])(
      '%s /health returns 405 status',
      async (method) => {
        const res = await request(app)[method]('/health');
        expect(res.status).toBe(405);
      }
    );

    test.each(['post', 'put', 'patch', 'delete'])(
      '%s /health includes Allow header with "GET, HEAD"',
      async (method) => {
        const res = await request(app)[method]('/health');
        expect(res.headers['allow']).toBe('GET, HEAD');
      }
    );

    test.each(['post', 'put', 'patch', 'delete'])(
      '%s /health returns correct JSON error structure',
      async (method) => {
        const res = await request(app)[method]('/health');
        expect(res.body).toEqual({
          status: 'error',
          statusCode: 405,
          message: 'Method Not Allowed'
        });
      }
    );

    test('405 response returns JSON content type', async () => {
      const res = await request(app).post('/health');
      expect(res.headers['content-type']).toEqual(
        expect.stringContaining('application/json')
      );
    });
  });

  // =========================================================================
  // Input Validation Rejection Tests (400)
  // =========================================================================
  describe('Input Validation', () => {
    test('rejects unexpected query parameters with 400 status', async () => {
      const res = await request(app)
        .get('/health')
        .query({ unexpected: 'param' });
      expect(res.status).toBe(400);
    });

    test('400 response has correct error structure with "Validation failed" message', async () => {
      const res = await request(app)
        .get('/health')
        .query({ unexpected: 'param' });
      expect(res.body).toMatchObject({
        status: 'error',
        statusCode: 400,
        message: expect.stringContaining('Validation failed')
      });
    });

    test('400 response message references the query segment', async () => {
      const res = await request(app)
        .get('/health')
        .query({ unexpected: 'param' });
      // The validateInput middleware formats errors with the request property name
      expect(res.body.message).toEqual(
        expect.stringContaining('query')
      );
    });

    test('400 response returns JSON content type', async () => {
      const res = await request(app)
        .get('/health')
        .query({ badparam: 'value' });
      expect(res.headers['content-type']).toEqual(
        expect.stringContaining('application/json')
      );
    });

    test('rejects multiple unexpected query parameters', async () => {
      const res = await request(app)
        .get('/health')
        .query({ foo: 'bar', baz: 'qux' });
      expect(res.status).toBe(400);
      expect(res.body.message).toEqual(
        expect.stringContaining('Validation failed')
      );
    });
  });
});
