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
 * describe per behaviour family, async/await Supertest calls, beforeEach/
 * afterEach for Winston logger silencing — the per-test lifecycle is required
 * because jest.config.js sets restoreMocks: true and would otherwise restore
 * beforeAll-installed spies before every test).
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
// Load package.json so the /api/info shape tests can cross-verify the
// `name` and `version` fields against the canonical npm manifest (the
// route returns them as hardcoded literals in src/routes/api.js, and
// those literals MUST track package.json — package metadata mirroring
// is the documented intent per AAP § 0.3.1). The `description` field
// is intentionally NOT mirrored from package.json: the route exposes a
// short-form summary distinct from package.json's longer description,
// and this asymmetry is pinned in a dedicated test below so any future
// drift on either side fails loudly.
const pkg = require('../../package.json');

describe('src/routes/api.js', () => {
  // Install Winston spies in beforeEach (NOT beforeAll). jest.config.js sets
  // restoreMocks: true, which calls jest.restoreAllMocks() before EVERY test;
  // installing the spies in beforeAll would therefore see them restored before
  // the first it() runs, defeating the silencing and letting Morgan's stream
  // adapter flood the test console with HTTP access lines on every request.
  // Re-installing the spies in beforeEach guarantees each test starts with
  // active silencing while leaving restoreMocks: true intact for the rest of
  // the Jest worker's isolation guarantees. Spy targets cover the four Winston
  // levels Morgan's stream adapter and the application can route messages to
  // during a Supertest request lifecycle (info, http, error, warn);
  // logger.debug is not spied because the production code under test never
  // invokes it.
  beforeEach(() => {
    jest.spyOn(logger, 'info').mockImplementation(() => {});
    jest.spyOn(logger, 'http').mockImplementation(() => {});
    jest.spyOn(logger, 'error').mockImplementation(() => {});
    jest.spyOn(logger, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    // restoreMocks: true in jest.config.js already restores spies before the
    // next test, but the explicit call documents intent and protects against
    // config drift, per AAP § 0.10.5 mocking discipline.
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

    it('returns name and version that mirror package.json', async () => {
      const response = await request(app).get('/api/info');
      // The route returns name and version as hardcoded literals in
      // src/routes/api.js lines 27-28, but per AAP § 0.3.1 those values
      // MUST mirror package.json. Asserting against the loaded pkg object
      // (rather than hardcoded literals in the test) makes the test the
      // single source of truth for the mirror invariant: any future drift
      // between the route literals and package.json will fail this test
      // even if both the test literal and the route literal are updated
      // in lockstep but package.json is not.
      expect(response.body.name).toBe(pkg.name);
      expect(response.body.version).toBe(pkg.version);
    });

    it('returns the short-form description hardcoded in the /api/info route (NOT package.json.description)', async () => {
      const response = await request(app).get('/api/info');
      // Documented asymmetry: package.json.description is the long-form
      //   'Production-ready Express.js web server with structured logging,
      //    security hardening, and PM2 deployment'
      // while /api/info returns the short-form
      //   'Production-ready Express.js web server'
      // This test pins the route's hardcoded short-form value so any drift
      // in src/routes/api.js fails loudly, while ALSO documenting (via the
      // not-equal assertion against pkg.description) that the route is
      // intentionally divergent from package.json.description. If a future
      // change deliberately aligns the two, BOTH assertions must be updated
      // together — preventing accidental silent reconvergence or divergence.
      expect(response.body.description).toBe('Production-ready Express.js web server');
      expect(response.body.description).not.toBe(pkg.description);
    });

    it('returns exactly three keys (name, version, description) on GET /api/info', async () => {
      const response = await request(app).get('/api/info');
      // Sorted-keys equality is the strictest body-shape assertion that does
      // not depend on JSON key ordering. It rejects both missing keys and
      // accidental extra fields — a looser toMatchObject would silently allow
      // a superset and let regressions through. Combined with the per-field
      // tests above, this gives layered regression protection on the public
      // /api/info contract: shape is locked, mirror-from-package.json is
      // verified for name/version, and the divergent description literal is
      // pinned.
      expect(Object.keys(response.body).sort()).toEqual([
        'description',
        'name',
        'version',
      ]);
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
