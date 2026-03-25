'use strict';

/**
 * Integration Tests — API Routes (src/routes/api.js)
 *
 * Exercises the /api and /api/info endpoints through the complete Express
 * middleware pipeline (Helmet, CORS, compression, body parsers, Morgan,
 * rate limiter, validateInput, route handler) using Supertest against the
 * src/app.js factory export.
 *
 * Test Categories:
 *   1. GET /api        — Happy-path response validation (200, JSON shape)
 *   2. GET /api/info   — Metadata response with dynamic version, env, nodeVersion
 *   3. /api 405        — Method Not Allowed enforcement (POST, PUT, PATCH, DELETE)
 *   4. /api/info 405   — Method Not Allowed enforcement (POST, PUT, PATCH, DELETE)
 *   5. Validation      — 400 rejection for unexpected query parameters on both endpoints
 */

// ---------------------------------------------------------------------------
// CRITICAL: Logger mock MUST be declared BEFORE any require() of modules
// that depend on the logger. src/app.js imports logger at module load time,
// so the mock must be in place before we require the app.
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

// Read the package version dynamically to make the test resilient to future
// version bumps without hardcoding the expected value.
const { version } = require('../../package.json');

// ---------------------------------------------------------------------------
// 1. GET /api — Happy Path Tests
// ---------------------------------------------------------------------------
describe('API Route - GET /api', () => {
  test('returns 200 status code', async () => {
    const res = await request(app).get('/api');

    expect(res.status).toBe(200);
  });

  test('returns JSON content type', async () => {
    const res = await request(app).get('/api');

    expect(res.headers['content-type']).toEqual(
      expect.stringContaining('application/json')
    );
  });

  test('returns response with status "success"', async () => {
    const res = await request(app).get('/api');

    expect(res.body.status).toBe('success');
  });

  test('returns response with correct welcome message', async () => {
    const res = await request(app).get('/api');

    expect(res.body.message).toBe('Welcome to the API');
  });

  test('response body has exact shape { status, message }', async () => {
    const res = await request(app).get('/api');

    expect(res.body).toEqual({
      status: 'success',
      message: 'Welcome to the API'
    });
    // Verify no extra keys beyond status and message
    expect(Object.keys(res.body).sort()).toEqual(['message', 'status']);
  });
});

// ---------------------------------------------------------------------------
// 2. GET /api/info — Happy Path Tests
// ---------------------------------------------------------------------------
describe('API Route - GET /api/info', () => {
  test('returns 200 status code', async () => {
    const res = await request(app).get('/api/info');

    expect(res.status).toBe(200);
  });

  test('returns JSON content type', async () => {
    const res = await request(app).get('/api/info');

    expect(res.headers['content-type']).toEqual(
      expect.stringContaining('application/json')
    );
  });

  test('returns response with status "success"', async () => {
    const res = await request(app).get('/api/info');

    expect(res.body.status).toBe('success');
  });

  test('returns response with data object containing version', async () => {
    const res = await request(app).get('/api/info');

    expect(res.body.data).toHaveProperty('version');
    expect(typeof res.body.data.version).toBe('string');
  });

  test('returns response with data object containing environment', async () => {
    const res = await request(app).get('/api/info');

    expect(res.body.data).toHaveProperty('environment');
    expect(typeof res.body.data.environment).toBe('string');
  });

  test('returns response with data object containing nodeVersion', async () => {
    const res = await request(app).get('/api/info');

    expect(res.body.data).toHaveProperty('nodeVersion');
    expect(typeof res.body.data.nodeVersion).toBe('string');
  });

  test('version matches package.json version', async () => {
    const res = await request(app).get('/api/info');

    // The version is read dynamically from package.json at the top of this file,
    // making this assertion resilient to version bumps.
    expect(res.body.data.version).toBe(version);
  });

  test('environment is "test" since Jest sets NODE_ENV=test', async () => {
    const res = await request(app).get('/api/info');

    // src/config/index.js line 25: env: process.env.NODE_ENV || 'development'
    // Jest automatically sets NODE_ENV=test when not already set, so config.env
    // resolves to 'test' during test execution.
    expect(res.body.data.environment).toBe('test');
  });

  test('nodeVersion matches process.version', async () => {
    const res = await request(app).get('/api/info');

    // src/routes/api.js line 77: nodeVersion: process.version
    // Must match the current Node.js runtime version exactly.
    expect(res.body.data.nodeVersion).toBe(process.version);
  });

  test('response body has exact shape { status, data: { version, environment, nodeVersion } }', async () => {
    const res = await request(app).get('/api/info');

    expect(res.body).toEqual({
      status: 'success',
      data: {
        version: version,
        environment: 'test',
        nodeVersion: process.version
      }
    });
    // Verify top-level keys
    expect(Object.keys(res.body).sort()).toEqual(['data', 'status']);
    // Verify nested data keys
    expect(Object.keys(res.body.data).sort()).toEqual([
      'environment',
      'nodeVersion',
      'version'
    ]);
  });
});

// ---------------------------------------------------------------------------
// 3. /api — 405 Method Not Allowed Tests
// ---------------------------------------------------------------------------
describe('API Route - /api Method Not Allowed', () => {
  // DRY enforcement: test all disallowed HTTP methods via test.each
  const disallowedMethods = ['post', 'put', 'patch', 'delete'];

  test.each(disallowedMethods)(
    '%s /api returns 405 status',
    async (method) => {
      const res = await request(app)[method]('/api');

      expect(res.status).toBe(405);
    }
  );

  test.each(disallowedMethods)(
    '%s /api 405 response includes Allow header with "GET, HEAD"',
    async (method) => {
      const res = await request(app)[method]('/api');

      // Source: src/routes/api.js line 48: res.status(405).set('Allow', 'GET, HEAD')
      expect(res.headers['allow']).toBe('GET, HEAD');
    }
  );

  test.each(disallowedMethods)(
    '%s /api 405 response has correct JSON error structure',
    async (method) => {
      const res = await request(app)[method]('/api');

      expect(res.body).toEqual({
        status: 'error',
        statusCode: 405,
        message: 'Method Not Allowed'
      });
    }
  );

  test.each(disallowedMethods)(
    '%s /api 405 response returns JSON content type',
    async (method) => {
      const res = await request(app)[method]('/api');

      expect(res.headers['content-type']).toEqual(
        expect.stringContaining('application/json')
      );
    }
  );
});

// ---------------------------------------------------------------------------
// 4. /api/info — 405 Method Not Allowed Tests
// ---------------------------------------------------------------------------
describe('API Route - /api/info Method Not Allowed', () => {
  const disallowedMethods = ['post', 'put', 'patch', 'delete'];

  test.each(disallowedMethods)(
    '%s /api/info returns 405 status',
    async (method) => {
      const res = await request(app)[method]('/api/info');

      expect(res.status).toBe(405);
    }
  );

  test.each(disallowedMethods)(
    '%s /api/info 405 response includes Allow header with "GET, HEAD"',
    async (method) => {
      const res = await request(app)[method]('/api/info');

      // Source: src/routes/api.js line 86: res.status(405).set('Allow', 'GET, HEAD')
      expect(res.headers['allow']).toBe('GET, HEAD');
    }
  );

  test.each(disallowedMethods)(
    '%s /api/info 405 response has correct JSON error structure',
    async (method) => {
      const res = await request(app)[method]('/api/info');

      expect(res.body).toEqual({
        status: 'error',
        statusCode: 405,
        message: 'Method Not Allowed'
      });
    }
  );

  test.each(disallowedMethods)(
    '%s /api/info 405 response returns JSON content type',
    async (method) => {
      const res = await request(app)[method]('/api/info');

      expect(res.headers['content-type']).toEqual(
        expect.stringContaining('application/json')
      );
    }
  );
});

// ---------------------------------------------------------------------------
// 5. Input Validation — 400 Rejection Tests
// ---------------------------------------------------------------------------
describe('API Route - Input Validation', () => {
  test('GET /api rejects unexpected query parameters with 400', async () => {
    const res = await request(app)
      .get('/api')
      .query({ unexpected: 'param' });

    expect(res.status).toBe(400);
  });

  test('GET /api/info rejects unexpected query parameters with 400', async () => {
    const res = await request(app)
      .get('/api/info')
      .query({ extra: 'data' });

    expect(res.status).toBe(400);
  });

  test('400 response has correct error structure for /api', async () => {
    const res = await request(app)
      .get('/api')
      .query({ unexpected: 'param' });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      status: 'error',
      statusCode: 400,
      message: expect.stringContaining('Validation failed')
    });
    // The error message should reference the 'query' segment since the
    // unexpected parameter is in the query string
    expect(res.body.message).toEqual(
      expect.stringContaining('query')
    );
  });

  test('400 response has correct error structure for /api/info', async () => {
    const res = await request(app)
      .get('/api/info')
      .query({ extra: 'data' });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      status: 'error',
      statusCode: 400,
      message: expect.stringContaining('Validation failed')
    });
    // The error message should reference the 'query' segment
    expect(res.body.message).toEqual(
      expect.stringContaining('query')
    );
  });

  test('400 response returns JSON content type for /api', async () => {
    const res = await request(app)
      .get('/api')
      .query({ unexpected: 'param' });

    expect(res.headers['content-type']).toEqual(
      expect.stringContaining('application/json')
    );
  });

  test('400 response returns JSON content type for /api/info', async () => {
    const res = await request(app)
      .get('/api/info')
      .query({ extra: 'data' });

    expect(res.headers['content-type']).toEqual(
      expect.stringContaining('application/json')
    );
  });
});
