/**
 * Supertest integration tests for src/routes/api.js — the public API router.
 *
 * Verifies the immutable Backprop integration contracts mounted at /api by
 * src/routes/index.js:
 *   - GET /api      → 200, Content-Type JSON, body { message: 'Hello, World!' }
 *   - GET /api/info → 200, Content-Type JSON, body { name, version, description }
 *
 * Also verifies fall-through 404 behaviour for unsupported methods and unknown
 * sub-routes. Tests run against the in-process Express app via Supertest —
 * no real socket binds and the Winston logger is silenced via jest.spyOn so
 * Morgan's stream adapter does not flood the test console with HTTP access
 * lines during the integration run.
 *
 * This file is the PATTERN SEED for the test suite per AAP § 0.10.4 — other
 * test files mirror its conventions (CommonJS, 2-space indent, single quotes,
 * semicolons, file-level JSDoc, top-level describe(<source-path>), nested
 * describe per behaviour family, async/await Supertest calls, beforeAll/
 * afterAll for Winston logger silencing).
 *
 * Authoritative blueprint: AAP §§ 0.1.1, 0.4.2, 0.5.2, 0.7.1, 0.10.4, 0.10.5,
 * 0.10.9.
 */

const request = require('supertest');
// Load the assembled Express app first so its transitive dependency graph
// (which includes src/utils/logger.js) is resolved before we reference the
// cached logger singleton in the next import.
const app = require('../../src/app');
const logger = require('../../src/utils/logger');

describe('src/routes/api.js', () => {
  // Install Winston spies once for the entire suite. jest.config.js sets
  // restoreMocks: true so spies are auto-restored between tests, but the
  // explicit afterAll documents intent and protects against config drift.
  // Spy targets cover the four Winston levels that Morgan's stream adapter
  // and the rest of the application can route messages to during a Supertest
  // request lifecycle (info, http, error, warn). logger.debug is not spied
  // because the production code under test never invokes it.
  beforeAll(() => {
    jest.spyOn(logger, 'info').mockImplementation(() => {});
    jest.spyOn(logger, 'http').mockImplementation(() => {});
    jest.spyOn(logger, 'error').mockImplementation(() => {});
    jest.spyOn(logger, 'warn').mockImplementation(() => {});
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // GET /api — Backprop Hello World contract
  // ---------------------------------------------------------------------------
  // Exercises the immutable Backprop integration contract per AAP § 0.10.9.
  // The body must be EXACTLY { message: 'Hello, World!' } — deep equality
  // (toEqual) is used rather than toMatchObject so future regressions that
  // accidentally add extra fields are caught.
  // ---------------------------------------------------------------------------
  describe('GET /api (Backprop Hello World contract)', () => {
    it('returns HTTP 200 with the immutable Backprop message body on GET /api', async () => {
      const response = await request(app).get('/api');
      expect(response.status).toBe(200);
      // toEqual performs deep equality — fails on missing OR extra keys.
      // toMatchObject would silently accept supersets and is deliberately
      // avoided here per AAP § 0.10.9 (Preservation Checklist final gate).
      expect(response.body).toEqual({ message: 'Hello, World!' });
    });

    it('returns Content-Type: application/json; charset=utf-8 on GET /api', async () => {
      const response = await request(app).get('/api');
      // stringContaining is used in preference to a strict-equal assertion
      // so the test tolerates trivial Express patch-version variations in
      // casing or whitespace around the charset parameter.
      expect(response.headers['content-type']).toEqual(
        expect.stringContaining('application/json')
      );
    });

    it('returns a body with exactly one key (message) on GET /api', async () => {
      const response = await request(app).get('/api');
      // Exact-keys assertion guards against silent body-shape drift. Combined
      // with the toEqual assertion above this gives layered regression
      // protection on the public Backprop contract.
      expect(Object.keys(response.body)).toEqual(['message']);
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/info — server information
  // ---------------------------------------------------------------------------
  // Exercises the server-information endpoint: status, Content-Type, shape,
  // field types, and exact hardcoded values per src/routes/api.js lines 25–31.
  // ---------------------------------------------------------------------------
  describe('GET /api/info (server information)', () => {
    it('returns HTTP 200 with JSON Content-Type on GET /api/info', async () => {
      const response = await request(app).get('/api/info');
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toEqual(
        expect.stringContaining('application/json')
      );
    });

    it('returns a body with name, version, description as strings on GET /api/info', async () => {
      const response = await request(app).get('/api/info');
      // toHaveProperty proves each key is present; typeof string asserts the
      // primitive type so accidental serialisation as a number or null is
      // detected without coupling the test to a specific value.
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('description');
      expect(typeof response.body.name).toBe('string');
      expect(typeof response.body.version).toBe('string');
      expect(typeof response.body.description).toBe('string');
    });

    it('returns the exact hardcoded metadata values on GET /api/info', async () => {
      const response = await request(app).get('/api/info');
      // Values mirror the literals in src/routes/api.js lines 27-29 byte-for-
      // byte. Deep equality is used so any drift in either the keys or the
      // values fails the test.
      expect(response.body).toEqual({
        name: 'hello_world',
        version: '1.0.0',
        description: 'Production-ready Express.js web server',
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Fall-through 404 behaviour for the /api router
  // ---------------------------------------------------------------------------
  // Express 5 does not auto-emit 405 Method Not Allowed; unmatched method-
  // path combinations fall through to the next middleware. src/app.js mounts
  // notFound after all routes, so unknown method/path combos on the /api
  // surface produce a 404. These tests assert the status code only — body
  // shape verification for the 404 response is owned by
  // tests/middleware/notFound.test.js to maintain single responsibility.
  // ---------------------------------------------------------------------------
  describe('Fall-through 404 behaviour for the /api router', () => {
    it('returns 404 for an unknown sub-route under /api/info', async () => {
      const response = await request(app).get('/api/info/extra');
      expect(response.status).toBe(404);
    });

    it('returns 404 for POST /api (only GET is defined)', async () => {
      const response = await request(app).post('/api');
      expect(response.status).toBe(404);
    });

    it('returns 404 for PUT /api/info (only GET is defined)', async () => {
      const response = await request(app).put('/api/info');
      expect(response.status).toBe(404);
    });
  });
});
