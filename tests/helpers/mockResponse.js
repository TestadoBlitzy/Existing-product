/**
 * Test helper — synthetic Express request/response factories for unit testing
 * middleware in isolation.
 *
 * This module is consumed by:
 *   - tests/middleware/notFound.test.js
 *   - tests/middleware/errorHandler.test.js
 *
 * Why these factories exist:
 *   Unit-testing Express middleware in isolation (without spinning up the full
 *   Supertest pipeline) requires synthetic `req`, `res`, and `next` objects.
 *   Express middleware uses fluent chaining like `res.status(404).json({...})`,
 *   so the response spies must return `this` (the receiver) on every call.
 *
 *   createMockResponse returns an object whose status() / json() / send() / end()
 *   functions are jest.fn().mockReturnThis() spies, enabling fluent
 *   res.status(404).json(...) calls in middleware code under test.
 *
 * Design notes:
 *   - Zero runtime dependencies — no require() calls of any package or built-in.
 *   - `jest` is implicitly available as a global inside createMockResponse; Jest
 *     injects jest.fn / jest.spyOn / etc. into the global namespace for every
 *     module loaded by a test file.
 *   - No module-level state — every call returns a FRESH object so spies do
 *     not bleed across tests.
 *   - `next` is intentionally NOT exported — per AAP §0.4.4, consumer test
 *     files create `const next = jest.fn();` inline.
 *
 * @see Agent Action Plan §0.4.4 Test Data and Fixtures Design
 * @see Agent Action Plan §0.5.5 Cross-File Test Dependencies
 */

/**
 * Create a synthetic Express request object for middleware unit tests.
 *
 * Default shape mirrors the minimal fields read by the middleware under test:
 *   - `originalUrl` — read by src/middleware/notFound.js to build the 404 body
 *   - `method`      — read by src/middleware/errorHandler.js logger metadata
 *   - `path`        — read by src/middleware/errorHandler.js logger metadata
 *
 * Callers may pass an `overrides` object to replace any default field or
 * extend the request with additional fields. The spread `...overrides` is
 * applied AFTER the defaults so overrides win.
 *
 * Examples:
 *   createMockRequest()
 *     -> { originalUrl: '/nope', method: 'GET', path: '/nope' }
 *
 *   createMockRequest({ originalUrl: '/api/info' })
 *     -> { originalUrl: '/api/info', method: 'GET', path: '/nope' }
 *
 *   createMockRequest({ method: 'POST', body: { foo: 1 } })
 *     -> { originalUrl: '/nope', method: 'POST', path: '/nope', body: { foo: 1 } }
 *
 * @param {Object} [overrides={}] - Fields to override on the default request shape.
 * @returns {Object} A request-like object suitable for passing to middleware under test.
 */
function createMockRequest(overrides = {}) {
  return {
    originalUrl: '/nope',
    method: 'GET',
    path: '/nope',
    ...overrides,
  };
}

/**
 * Create a synthetic Express response object for middleware unit tests.
 *
 * Supports the fluent `res.status(...).json(...)` pattern via
 * `jest.fn().mockReturnThis()` on every method spy. mockReturnThis()
 * configures the spy to return the receiver (`this`), which is the `res`
 * object — enabling the chain.
 *
 * The returned object has a mutable `headersSent` field (default: false) so
 * tests can simulate the case where a prior middleware has already started
 * sending the response. This is required to exercise the `headersSent`
 * delegation branch in src/middleware/errorHandler.js:
 *
 *   if (res.headersSent) { return next(err); }
 *
 * Spies returned (all using mockReturnThis() for chain support):
 *   - status(code)      — assert via res.status.mock.calls[0][0]
 *   - json(payload)     — assert via res.json.mock.calls[0][0]
 *   - send(body)        — included for robustness against minor refactors
 *   - end()             — included for robustness against minor refactors
 *
 * Each call to createMockResponse() returns a fresh object, so spies never
 * bleed across tests. This factory is therefore parallel-safe across Jest
 * worker processes.
 *
 * @returns {Object} A response-like object with jest.fn() spies for status/json/send/end.
 */
function createMockResponse() {
  const res = {
    headersSent: false,
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    end: jest.fn().mockReturnThis(),
  };
  return res;
}

module.exports = { createMockRequest, createMockResponse };
