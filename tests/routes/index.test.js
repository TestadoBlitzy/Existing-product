'use strict';

/**
 * Root Route Integration Tests
 *
 * Integration tests for the root route (GET /) and its 405 Method Not Allowed
 * enforcement, exercised through the complete Express middleware pipeline using
 * Supertest against the src/app.js factory export. Also covers validation
 * rejection for unexpected query parameters and HEAD method support.
 *
 * Covers:
 *   - GET / happy path with exact plain-text response body verification
 *   - HEAD / automatic handling by Express router.get()
 *   - 405 Method Not Allowed for POST, PUT, PATCH, DELETE with Allow header
 *   - 400 Validation rejection for unexpected query parameters via Zod strict()
 *
 * Source references:
 *   - src/routes/index.js lines 44-48:  GET / handler with validateInput
 *   - src/routes/index.js lines 56-62:  405 catch-all with Allow header
 *   - src/middleware/validateInput.js:   Zod-based validation returning 400
 *
 * @module tests/routes/index.test
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

describe('Root Route', () => {
  // =========================================================================
  // GET / — Happy Path Tests
  // =========================================================================
  describe('GET /', () => {
    test('returns 200 status code', async () => {
      const res = await request(app).get('/');
      expect(res.status).toBe(200);
    });

    test('returns text/plain content type', async () => {
      const res = await request(app).get('/');
      expect(res.headers['content-type']).toEqual(
        expect.stringContaining('text/plain')
      );
    });

    test('returns correct plain text body', async () => {
      const res = await request(app).get('/');
      expect(res.text).toBe('Hello, World!\n');
    });

    test('returns exact Hello, World! body with newline', async () => {
      const res = await request(app).get('/');
      expect(res.text).toBe('Hello, World!\n');
    });

    test('response body is exact plain text with no JSON structure', async () => {
      const res = await request(app).get('/');
      expect(res.text).toBe('Hello, World!\n');
      // Verify response is not parsed as JSON with status/message keys
      expect(res.body).not.toHaveProperty('status');
      expect(res.body).not.toHaveProperty('message');
    });
  });

  // =========================================================================
  // HEAD / — Express automatically matches HEAD for router.get() routes
  // =========================================================================
  describe('HEAD /', () => {
    test('returns 200 status code (same as GET)', async () => {
      const res = await request(app).head('/');
      expect(res.status).toBe(200);
    });

    test('returns text/plain content type header', async () => {
      const res = await request(app).head('/');
      expect(res.headers['content-type']).toEqual(
        expect.stringContaining('text/plain')
      );
    });

    test('returns empty body (HEAD semantics)', async () => {
      const res = await request(app).head('/');
      // HEAD responses must not include a message body per RFC 9110 §9.3.2
      // Supertest returns undefined for res.text on HEAD requests
      expect(res.text).toBeFalsy();
    });
  });

  // =========================================================================
  // 405 Method Not Allowed — POST, PUT, PATCH, DELETE on /
  // Source: src/routes/index.js lines 56-62
  // router.all('/', ...) catches non-GET/HEAD methods after router.get()
  // =========================================================================
  describe('Method Not Allowed', () => {
    test.each(['post', 'put', 'patch', 'delete'])(
      '%s / returns 405 status',
      async (method) => {
        const res = await request(app)[method]('/');
        expect(res.status).toBe(405);
      }
    );

    test.each(['post', 'put', 'patch', 'delete'])(
      '%s / includes Allow header with "GET, HEAD"',
      async (method) => {
        const res = await request(app)[method]('/');
        expect(res.headers['allow']).toBe('GET, HEAD');
      }
    );

    test.each(['post', 'put', 'patch', 'delete'])(
      '%s / returns correct JSON error structure',
      async (method) => {
        const res = await request(app)[method]('/');
        expect(res.body).toEqual({
          status: 'error',
          statusCode: 405,
          message: 'Method Not Allowed'
        });
      }
    );

    test('405 response has JSON content type', async () => {
      const res = await request(app).post('/');
      expect(res.headers['content-type']).toEqual(
        expect.stringContaining('application/json')
      );
    });
  });

  // =========================================================================
  // Input Validation — 400 Rejection for Unexpected Query Parameters
  // Source: src/routes/index.js line 44 uses z.object({}).strict() for query
  // z.object({}).strict() rejects any properties not in the schema
  // Validation error format from src/middleware/validateInput.js lines 67-81
  // =========================================================================
  describe('Input Validation', () => {
    test('rejects unexpected query parameters with 400 status', async () => {
      const res = await request(app).get('/').query({ unexpected: 'value' });
      expect(res.status).toBe(400);
    });

    test('400 response has correct JSON error structure', async () => {
      const res = await request(app).get('/').query({ unexpected: 'value' });
      expect(res.body).toMatchObject({
        status: 'error',
        statusCode: 400
      });
    });

    test('400 response message contains "Validation failed"', async () => {
      const res = await request(app).get('/').query({ unexpected: 'value' });
      expect(res.body.message).toEqual(
        expect.stringContaining('Validation failed')
      );
    });

    test('400 response message references the query segment', async () => {
      const res = await request(app).get('/').query({ unexpected: 'value' });
      // The error format from validateInput.js prefixes with the request
      // property name: "query" or "query.fieldname"
      expect(res.body.message).toEqual(
        expect.stringContaining('query')
      );
    });

    test('400 response message references the unrecognized key', async () => {
      const res = await request(app).get('/').query({ unexpected: 'value' });
      // Zod strict() produces "Unrecognized key(s) in object" error messages
      expect(res.body.message).toEqual(
        expect.stringContaining('Unrecognized key')
      );
    });

    test('400 response has JSON content type', async () => {
      const res = await request(app).get('/').query({ unexpected: 'value' });
      expect(res.headers['content-type']).toEqual(
        expect.stringContaining('application/json')
      );
    });

    test('rejects multiple unexpected query parameters with 400', async () => {
      const res = await request(app)
        .get('/')
        .query({ foo: 'bar', baz: 'qux' });
      expect(res.status).toBe(400);
      expect(res.body.message).toEqual(
        expect.stringContaining('Validation failed')
      );
    });

    test('accepts request with no query parameters (200)', async () => {
      const res = await request(app).get('/');
      expect(res.status).toBe(200);
    });
  });
});
