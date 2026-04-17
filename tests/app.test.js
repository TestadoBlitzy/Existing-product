'use strict';

/**
 * Full Middleware Pipeline Integration Tests
 *
 * Tests cross-cutting middleware concerns assembled in src/app.js using
 * Supertest against the exported Express app factory. Exercises the complete
 * 9-layer middleware pipeline: Helmet security headers, CORS, compression,
 * body parsing, Morgan logging, rate limiting, route handling, 404 catch-all,
 * and centralized error handling.
 *
 * Key distinction from route tests: tests/routes/*.test.js focus on individual
 * endpoint response contracts. This file tests the middleware PIPELINE behavior
 * that applies across all routes — headers, security, rate limiting, error flow.
 *
 * @module tests/app.test
 */

// ---------------------------------------------------------------------------
// Logger Mock — MUST be declared before any module imports that depend on it
// ---------------------------------------------------------------------------
// src/app.js imports src/utils/logger during module initialization, which
// creates Winston file transports (logs/combined.log, logs/error.log).
// This mock prevents all file I/O side effects during test execution.
// Jest hoists jest.mock() calls above require() statements automatically.
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  http: jest.fn(),
  stream: { write: jest.fn() }
}));

// ---------------------------------------------------------------------------
// Module Imports
// ---------------------------------------------------------------------------

const request = require('supertest');
const app = require('../src/app');
const { backupEnv, restoreEnv } = require('./helpers/setup');

// ---------------------------------------------------------------------------
// Middleware Pipeline Tests
// ---------------------------------------------------------------------------
// These tests exercise the default app instance (RATE_LIMIT_MAX=100) imported
// at module scope. Total requests against this instance are well under the
// default rate limit threshold, so no 429 interference occurs.
// ---------------------------------------------------------------------------

describe('app middleware pipeline', () => {

  // =========================================================================
  // 1. Security Headers (Helmet) — src/app.js lines 79-86
  // =========================================================================
  describe('security headers', () => {
    test('includes X-Content-Type-Options: nosniff header', async () => {
      const res = await request(app).get('/');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    test('includes Content-Security-Policy header with restrictive API directives', async () => {
      const res = await request(app).get('/');
      const csp = res.headers['content-security-policy'];
      expect(csp).toBeDefined();
      // API-specific CSP: default-src 'none' disallows all content loading
      expect(csp).toContain("default-src 'none'");
      // Anti-clickjacking: frame-ancestors 'none' prevents embedding
      expect(csp).toContain("frame-ancestors 'none'");
    });

    test('includes Strict-Transport-Security header with max-age', async () => {
      const res = await request(app).get('/');
      const hsts = res.headers['strict-transport-security'];
      expect(hsts).toBeDefined();
      expect(hsts).toMatch(/max-age=\d+/);
    });

    test('does NOT include X-Powered-By header (removed by Helmet)', async () => {
      const res = await request(app).get('/');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });
  });

  // =========================================================================
  // 2. CORS — src/app.js lines 92-94
  // =========================================================================
  describe('CORS', () => {
    test('includes Access-Control-Allow-Origin wildcard header', async () => {
      const res = await request(app).get('/');
      // Default config.corsOrigin is '*'
      expect(res.headers['access-control-allow-origin']).toBe('*');
    });

    test('responds to preflight OPTIONS request with CORS headers', async () => {
      const res = await request(app)
        .options('/')
        .set('Origin', 'http://example.com')
        .set('Access-Control-Request-Method', 'GET');
      // Preflight should succeed (200 or 204)
      expect(res.status).toBeLessThan(300);
      expect(res.headers['access-control-allow-origin']).toBeDefined();
    });
  });

  // =========================================================================
  // 3. JSON Content-Type Enforcement
  // =========================================================================
  describe('JSON responses', () => {
    test('returns Content-Type application/json for JSON GET endpoints', async () => {
      const endpoints = ['/health', '/api', '/api/info'];
      for (const endpoint of endpoints) {
        const res = await request(app).get(endpoint);
        expect(res.headers['content-type']).toMatch(/application\/json/);
      }
    });

    test('returns plain text response for GET /', async () => {
      const res = await request(app).get('/');
      expect(res.headers['content-type']).toMatch(/text\/plain/);
      expect(res.text).toBe('Hello, World!\n');
    });
  });

  // =========================================================================
  // 4. HTTP Method Handling Through Pipeline
  // =========================================================================
  // Verifies that non-GET methods are processed through the full middleware
  // pipeline (Helmet, CORS, etc.) before reaching route-level method handlers.
  // =========================================================================
  describe('HTTP method handling', () => {
    test('HEAD requests pass through middleware pipeline successfully', async () => {
      const res = await request(app).head('/');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/plain/);
      // Security headers are present even on HEAD responses
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    test('PUT requests receive 405 with security headers intact', async () => {
      const res = await request(app).put('/');
      expect(res.status).toBe(405);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      // Helmet headers apply to all responses including 405
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    test('PATCH requests receive 405 through pipeline', async () => {
      const res = await request(app).patch('/');
      expect(res.status).toBe(405);
      expect(res.headers['content-type']).toMatch(/application\/json/);
    });

    test('DELETE requests receive 405 through pipeline', async () => {
      const res = await request(app).delete('/');
      expect(res.status).toBe(405);
      expect(res.headers['content-type']).toMatch(/application\/json/);
    });

    test('POST to /health receives 405 with Allow header', async () => {
      const res = await request(app).post('/health');
      expect(res.status).toBe(405);
      expect(res.headers['allow']).toBe('GET, HEAD');
      expect(res.body.status).toBe('error');
      expect(res.body.statusCode).toBe(405);
      expect(res.body.message).toBe('Method Not Allowed');
    });

    test('POST to /api receives 405 with Allow header', async () => {
      const res = await request(app).post('/api');
      expect(res.status).toBe(405);
      expect(res.headers['allow']).toBe('GET, HEAD');
      expect(res.body.status).toBe('error');
      expect(res.body.statusCode).toBe(405);
      expect(res.body.message).toBe('Method Not Allowed');
    });

    test('DELETE to /api/info receives 405 with Allow header', async () => {
      const res = await request(app).delete('/api/info');
      expect(res.status).toBe(405);
      expect(res.headers['allow']).toBe('GET, HEAD');
      expect(res.body.status).toBe('error');
      expect(res.body.statusCode).toBe(405);
      expect(res.body.message).toBe('Method Not Allowed');
    });

    test('unexpected query parameters are rejected by validation middleware', async () => {
      const res = await request(app)
        .get('/')
        .query({ unexpected: 'param' });
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
      expect(res.body.statusCode).toBe(400);
      expect(res.body.message).toContain('Validation failed');
    });
  });

  // =========================================================================
  // 5. 404 Unknown Route Handling — src/app.js line 171 (notFound middleware)
  // =========================================================================
  describe('404 handling', () => {
    test('returns 404 JSON for unknown routes', async () => {
      await request(app)
        .get('/nonexistent-route')
        .expect(404)
        .expect('Content-Type', /application\/json/);
    });

    test('404 response includes URL path in message', async () => {
      const res = await request(app).get('/nonexistent-path');
      expect(res.body.message).toContain('/nonexistent-path');
      expect(res.body.message).toMatch(/^Not Found - /);
    });

    test('404 response has correct JSON error structure', async () => {
      const res = await request(app).get('/unknown-path');
      expect(res.body).toMatchObject({
        status: 'error',
        statusCode: 404,
      });
      expect(typeof res.body.message).toBe('string');
    });

    test('404 handler processes URLs with special characters safely', async () => {
      const res = await request(app).get('/path-with-special&chars=value');
      expect(res.status).toBe(404);
      expect(res.body.status).toBe('error');
      expect(res.body.statusCode).toBe(404);
      expect(res.body.message).toBeDefined();
    });
  });

  // =========================================================================
  // 6. Error Propagation — src/app.js line 183 (errorHandler middleware)
  // =========================================================================
  // Tests that errors flow through the middleware pipeline to the centralized
  // error handler. Malformed JSON triggers body parser SyntaxError (status=400)
  // which skips routes and notFound, reaching errorHandler directly.
  // =========================================================================
  describe('error propagation', () => {
    test('malformed JSON body triggers error handler with 400 status', async () => {
      const res = await request(app)
        .post('/')
        .set('Content-Type', 'application/json')
        .send('{"invalid json');
      // Body parser SyntaxError (err.status = 400) flows to errorHandler
      expect(res.status).toBe(400);
      expect(res.headers['content-type']).toMatch(/application\/json/);
    });

    test('error handler returns standardized JSON error structure', async () => {
      const res = await request(app)
        .post('/')
        .set('Content-Type', 'application/json')
        .send('{bad}');
      expect(res.body).toHaveProperty('status', 'error');
      expect(res.body).toHaveProperty('statusCode');
      expect(typeof res.body.statusCode).toBe('number');
      expect(res.body).toHaveProperty('message');
      expect(typeof res.body.message).toBe('string');
    });

    test('error handler includes stack trace in non-production environment', async () => {
      // In default test/development environment, errorHandler includes stack
      // for debugging (process.env.NODE_ENV !== 'production')
      const res = await request(app)
        .post('/')
        .set('Content-Type', 'application/json')
        .send('{"unclosed');
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('stack');
      expect(typeof res.body.stack).toBe('string');
    });
  });

  // =========================================================================
  // 7. Compression — src/app.js line 100
  // =========================================================================
  describe('compression', () => {
    test('compression middleware does not interfere with response delivery', async () => {
      const res = await request(app)
        .get('/')
        .set('Accept-Encoding', 'gzip, deflate');
      expect(res.status).toBe(200);
      // Response body is correct plain text despite compression middleware
      expect(res.text).toBe('Hello, World!\n');
    });
  });

  // =========================================================================
  // 8. Logging Integration — src/app.js lines 121-123 (Morgan + logger.stream)
  // =========================================================================
  describe('logging integration', () => {
    test('Morgan access logging writes to logger stream during request', async () => {
      const logger = require('../src/utils/logger');
      // Spy on the mocked stream.write to track calls specifically in this test
      const writeSpy = jest.spyOn(logger.stream, 'write');

      await request(app).get('/');

      // Morgan 'combined' format logs each request through logger.stream
      expect(writeSpy).toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// Rate Limiting Tests — src/app.js lines 135-148
// ---------------------------------------------------------------------------
// Rate limiter maintains per-process state per app instance. Each test creates
// a fresh Express app with a low RATE_LIMIT_MAX via jest.resetModules() and
// controlled process.env manipulation to test 429 behavior efficiently without
// sending 100+ requests.
//
// Strategy: Set RATE_LIMIT_MAX to a low value, create fresh app via module
// reset, and verify the (max + 1)th request receives 429.
// ---------------------------------------------------------------------------

describe('app rate limiting', () => {
  let envBackup;

  beforeAll(() => {
    // Save environment state before any rate limiting tests
    envBackup = backupEnv();
  });

  afterEach(() => {
    // Restore environment and clear module cache between rate limit tests
    // to ensure each test gets a fresh app instance with its own limiter state
    restoreEnv(envBackup);
    jest.resetModules();
  });

  afterAll(() => {
    // Final defensive cleanup after all rate limiting tests complete
    restoreEnv(envBackup);
    jest.resetModules();
  });

  test('returns 429 when rate limit is exceeded', async () => {
    process.env.RATE_LIMIT_MAX = '2';
    jest.resetModules();
    const rateLimitedApp = require('../src/app');

    // First 2 requests within limit → 200
    const first = await request(rateLimitedApp).get('/');
    expect(first.status).toBe(200);

    const second = await request(rateLimitedApp).get('/');
    expect(second.status).toBe(200);

    // 3rd request exceeds limit → 429
    const third = await request(rateLimitedApp).get('/');
    expect(third.status).toBe(429);
  });

  test('429 response has correct JSON error structure', async () => {
    process.env.RATE_LIMIT_MAX = '1';
    jest.resetModules();
    const rateLimitedApp = require('../src/app');

    // Exhaust the single-request limit
    await request(rateLimitedApp).get('/');

    // Next request exceeds limit → 429 with structured error
    const res = await request(rateLimitedApp).get('/');
    expect(res.status).toBe(429);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toMatchObject({
      status: 'error',
      statusCode: 429,
      message: 'Too many requests, please try again later.'
    });
  });

  test('includes rate limit headers in successful responses', async () => {
    process.env.RATE_LIMIT_MAX = '50';
    jest.resetModules();
    const freshApp = require('../src/app');

    const res = await request(freshApp).get('/');
    expect(res.status).toBe(200);
    // express-rate-limit v8 with standardHeaders: true sets IETF rate limit
    // headers (draft-6 or draft-7 depending on version)
    const rateLimitHeaders = Object.keys(res.headers).filter(
      (h) => h.startsWith('ratelimit')
    );
    expect(rateLimitHeaders.length).toBeGreaterThan(0);
  });
});
