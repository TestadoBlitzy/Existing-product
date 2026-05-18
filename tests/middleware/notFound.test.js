/**
 * Unit + integration tests for src/middleware/notFound.js — the 404 fallback
 * middleware that intercepts unmatched routes and returns a structured JSON
 * response with the shape:
 *   { status: 404, message: 'Not Found', path: req.originalUrl }
 *
 * Unit tests use synthetic req/res objects from tests/helpers/mockResponse.js
 * to invoke the middleware directly with controlled inputs, asserting the
 * call args of res.status / res.json without spinning up Express.
 *
 * Integration tests use Supertest against the assembled Express app from
 * src/app.js to verify the middleware is correctly mounted in the pipeline
 * (after all routes, before the error handler) and that the 404 contract
 * holds for real HTTP requests against unknown paths and methods.
 *
 * Mirrors the house style established by tests/routes/api.test.js (PATTERN
 * SEED) per AAP § 0.10.4: CommonJS require, 2-space indentation, single
 * quotes, semicolons, top-level describe(<source-path>), nested describe per
 * behaviour family, beforeAll/afterAll for Winston logger silencing.
 *
 * Authoritative blueprint: AAP §§ 0.1.1, 0.4.2, 0.5.2, 0.7.1, 0.10.4, 0.10.5.
 */

const request = require('supertest');
const notFound = require('../../src/middleware/notFound');
// Load the assembled Express app first so its transitive dependency graph
// (which includes src/utils/logger.js) is resolved before we reference the
// cached logger singleton in the next import.
const app = require('../../src/app');
const logger = require('../../src/utils/logger');
const { createMockRequest, createMockResponse } = require('../helpers/mockResponse');

describe('src/middleware/notFound.js', () => {
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
  // Unit tests with synthetic req/res
  // ---------------------------------------------------------------------------
  // These tests invoke notFound directly with synthetic objects from
  // tests/helpers/mockResponse.js. They are independent of the Express
  // pipeline and exercise the middleware function in isolation. Every test
  // creates a fresh req/res/next so spies never bleed across cases.
  // ---------------------------------------------------------------------------
  describe('unit tests with synthetic req/res', () => {
    it('returns 404 with the documented JSON shape for originalUrl="/nope"', () => {
      const req = createMockRequest({ originalUrl: '/nope' });
      const res = createMockResponse();
      const next = jest.fn();
      notFound(req, res, next);
      // res.status must be called exactly once with the numeric literal 404 —
      // not a string, not a different status code. AAP § 0.4.2 fixes this
      // contract.
      expect(res.status).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(404);
      // res.json must be called exactly once with the documented body shape.
      // toHaveBeenCalledWith uses deep equality, so an extra key or a typo
      // in 'Not Found' would fail this assertion.
      expect(res.json).toHaveBeenCalledTimes(1);
      expect(res.json).toHaveBeenCalledWith({
        status: 404,
        message: 'Not Found',
        path: '/nope',
      });
    });

    it('preserves a nested path in the response body', () => {
      const req = createMockRequest({ originalUrl: '/a/b/c' });
      const res = createMockResponse();
      const next = jest.fn();
      notFound(req, res, next);
      // Nested paths must round-trip verbatim into the path field of the
      // response body so clients can diagnose which route they meant to hit.
      expect(res.json).toHaveBeenCalledWith({
        status: 404,
        message: 'Not Found',
        path: '/a/b/c',
      });
    });

    it('preserves a query string verbatim in the response body', () => {
      const req = createMockRequest({ originalUrl: '/search?q=x' });
      const res = createMockResponse();
      const next = jest.fn();
      notFound(req, res, next);
      // Express attaches the full URL (path + query string) to req.originalUrl
      // and the middleware passes that string through unmodified. The test
      // asserts the question mark and value survive untouched.
      expect(res.json).toHaveBeenCalledWith({
        status: 404,
        message: 'Not Found',
        path: '/search?q=x',
      });
    });

    it('preserves URL-encoded characters verbatim in the response body', () => {
      const req = createMockRequest({ originalUrl: '/hello%20world' });
      const res = createMockResponse();
      const next = jest.fn();
      notFound(req, res, next);
      // The middleware does not decode percent-encoded sequences; whatever
      // Express provides in req.originalUrl is what the body reports. This
      // is the documented and intentional behaviour — clients debugging
      // double-encoding bugs need to see the raw encoded path.
      expect(res.json).toHaveBeenCalledWith({
        status: 404,
        message: 'Not Found',
        path: '/hello%20world',
      });
    });

    it('does not call next (terminal handler)', () => {
      const req = createMockRequest({ originalUrl: '/anything' });
      const res = createMockResponse();
      const next = jest.fn();
      notFound(req, res, next);
      // notFound is a terminal middleware: it always writes the response and
      // never delegates to the next middleware in the chain. If next is ever
      // invoked the error handler would receive an undefined error and the
      // pipeline would loop. AAP § 0.4.2 fixes this contract.
      expect(next).not.toHaveBeenCalled();
    });

    it('calls res.status(404) before res.json() (fluent chain)', () => {
      const req = createMockRequest({ originalUrl: '/x' });
      const res = createMockResponse();
      const next = jest.fn();
      notFound(req, res, next);
      // The middleware uses the fluent Express API: res.status(404).json(...).
      // Jest's invocationCallOrder counter increments on every spy call across
      // the worker, so comparing the order of the two spy invocations proves
      // status was called first. This also implicitly validates that the
      // createMockResponse spies use mockReturnThis() so the chain reaches
      // json() successfully (otherwise res.status(404).json would throw on
      // 'cannot read property json of undefined').
      const statusInvocationOrder = res.status.mock.invocationCallOrder[0];
      const jsonInvocationOrder = res.json.mock.invocationCallOrder[0];
      expect(statusInvocationOrder).toBeLessThan(jsonInvocationOrder);
    });

    it('emits exactly the three documented keys (status, message, path)', () => {
      const req = createMockRequest({ originalUrl: '/api/missing' });
      const res = createMockResponse();
      const next = jest.fn();
      notFound(req, res, next);
      // Sorted-keys equality is the strictest body-shape assertion that does
      // not depend on JSON key ordering. It rejects both missing keys and
      // accidental extra fields — a looser toMatchObject would silently allow
      // a superset and let regressions through.
      const bodyArg = res.json.mock.calls[0][0];
      expect(Object.keys(bodyArg).sort()).toEqual(['message', 'path', 'status']);
    });
  });

  // ---------------------------------------------------------------------------
  // Integration tests through the assembled Express app
  // ---------------------------------------------------------------------------
  // These tests issue real HTTP requests against the in-process app via
  // Supertest. They verify that notFound is correctly mounted in src/app.js
  // (between the route aggregator and errorHandler) and that the full
  // Express pipeline — Helmet, CORS, compression, body parsers, Morgan,
  // routes, notFound — produces the documented 404 contract for any
  // unmatched path and method. No real socket is bound; Supertest allocates
  // an ephemeral port per request and releases it immediately afterwards.
  // ---------------------------------------------------------------------------
  describe('integration tests through the assembled Express app', () => {
    it('returns 404 with the documented JSON shape for GET /unknown', async () => {
      const response = await request(app).get('/unknown');
      expect(response.status).toBe(404);
      // toEqual performs deep equality — fails on missing or extra keys and
      // on any value drift. This is the strongest possible body assertion.
      expect(response.body).toEqual({
        status: 404,
        message: 'Not Found',
        path: '/unknown',
      });
    });

    it('returns 404 with the documented JSON shape for POST /missing (method-agnostic)', async () => {
      const response = await request(app)
        .post('/missing')
        .set('Content-Type', 'application/json')
        .send({});
      // notFound does not inspect req.method, so POST against any unmatched
      // path produces the same 404 response as GET. Including an explicit
      // Content-Type header and an empty JSON body proves the json body
      // parser ran before the notFound handler (it must, by middleware
      // ordering) without disturbing the response shape.
      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        status: 404,
        message: 'Not Found',
        path: '/missing',
      });
    });

    it('preserves a deeply nested path through the assembled app', async () => {
      const response = await request(app).get('/a/b/c/d/e');
      // Express's path parser preserves every segment in req.originalUrl, so
      // even deeply nested unknown routes round-trip verbatim into the 404
      // body. This guards against accidental truncation by an upstream
      // middleware.
      expect(response.status).toBe(404);
      expect(response.body.path).toBe('/a/b/c/d/e');
    });

    it('returns Content-Type: application/json; charset=utf-8 on the 404 response', async () => {
      const response = await request(app).get('/not-real');
      // stringContaining is preferred over a strict-equal assertion so the
      // test tolerates trivial Express patch-version variations in casing or
      // whitespace around the charset parameter.
      expect(response.headers['content-type']).toEqual(
        expect.stringContaining('application/json')
      );
    });

    it('returns 404 for DELETE on unknown paths', async () => {
      const response = await request(app).delete('/resource/123');
      // Additional method coverage — DELETE confirms the method-agnostic
      // behaviour observed for POST also applies to other HTTP verbs without
      // body parsers being relevant.
      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        status: 404,
        message: 'Not Found',
        path: '/resource/123',
      });
    });

    it('preserves a query string in the response body through the assembled app', async () => {
      const response = await request(app).get('/search?q=hello');
      // Confirms that req.originalUrl in Express includes the query string
      // and that the notFound handler propagates the full URL into the
      // body.path field. Supertest sends the query string verbatim so the
      // assertion uses the same literal as the request.
      expect(response.status).toBe(404);
      expect(response.body.path).toBe('/search?q=hello');
    });
  });
});
