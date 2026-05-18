/**
 * Supertest integration tests for src/routes/health.js — the health endpoint
 * used by PM2 monitoring and load balancer probes.
 *
 * Verifies the operational contract mounted at /health by src/routes/index.js:
 *   - GET /health → 200, Content-Type JSON, body { status, uptime, timestamp, environment }
 *   - status === 'ok' (constant)
 *   - uptime is a non-negative number
 *   - timestamp is an ISO-8601 string (Date.parse round-trips)
 *   - environment echoes config.nodeEnv from src/config/index.js
 *
 * Tests run against the in-process Express app via Supertest — no real socket
 * binds and the Winston logger is silenced via jest.spyOn so Morgan's stream
 * adapter does not flood the test console with HTTP access lines.
 *
 * Mirrors the house style established by tests/routes/api.test.js (PATTERN SEED):
 * CommonJS require, 2-space indentation, single quotes, semicolons, top-level
 * describe(<source-path>), nested describe per behaviour family, async/await
 * for Supertest, beforeEach/afterEach for Winston logger silencing — the
 * per-test lifecycle is required because jest.config.js sets restoreMocks:
 * true and would otherwise restore beforeAll-installed spies before every
 * test, defeating the silencing.
 *
 * Authoritative blueprint: AAP §§ 0.1.1, 0.4.2, 0.5.2, 0.7.1, 0.10.4, 0.10.5.
 */

const request = require('supertest');
// Load the assembled Express app first so its transitive dependency graph
// (which includes src/config/index.js) is resolved before we reference the
// cached config object in subsequent imports.
const app = require('../../src/app');
const config = require('../../src/config');
const logger = require('../../src/utils/logger');

describe('src/routes/health.js', () => {
  // Install Winston spies in beforeEach (NOT beforeAll). jest.config.js sets
  // restoreMocks: true, which calls jest.restoreAllMocks() before EVERY test;
  // installing the spies in beforeAll would therefore see them restored before
  // the first it() runs, defeating the silencing and letting Morgan's stream
  // adapter flood the test console with HTTP access lines on every request.
  // Re-installing the spies in beforeEach guarantees each test starts with
  // active silencing. Spy targets cover the four Winston levels Morgan and the
  // rest of the application can route messages to during a Supertest request
  // lifecycle (info, http, error, warn); logger.debug is not spied because the
  // production code under test never invokes it.
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
  // GET /health — status and Content-Type
  // ---------------------------------------------------------------------------
  // Exercises the HTTP-level invariants of the health endpoint: 200 status
  // and JSON content type. These are the externally observable contract that
  // PM2 health probes and load balancers depend on.
  // ---------------------------------------------------------------------------
  describe('GET /health — status and Content-Type', () => {
    it('returns HTTP 200 on GET /health', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
    });

    it('returns Content-Type: application/json; charset=utf-8 on GET /health', async () => {
      const response = await request(app).get('/health');
      expect(response.headers['content-type']).toEqual(
        expect.stringContaining('application/json')
      );
    });
  });

  // ---------------------------------------------------------------------------
  // GET /health — body shape and field types
  // ---------------------------------------------------------------------------
  // Exercises the response-body invariants documented in AAP § 0.4.2:
  // the four required keys, each with the correct primitive type and a
  // safe range/format assertion that does not couple to wall-clock state.
  // ---------------------------------------------------------------------------
  describe('GET /health — body shape and field types', () => {
    it('returns body.status === "ok"', async () => {
      const response = await request(app).get('/health');
      expect(response.body.status).toBe('ok');
    });

    it('returns body.uptime as a non-negative number', async () => {
      const response = await request(app).get('/health');
      // process.uptime() is documented to return a non-negative float.
      // We assert both the primitive type and the lower bound so the test
      // catches accidental serialisation of uptime as a string.
      expect(typeof response.body.uptime).toBe('number');
      expect(response.body.uptime).toBeGreaterThanOrEqual(0);
    });

    it('returns body.timestamp as a parseable ISO-8601 string', async () => {
      const response = await request(app).get('/health');
      // new Date().toISOString() always emits a YYYY-MM-DDTHH:mm:ss.sssZ
      // string. Date.parse round-trips that representation to a finite
      // epoch millisecond value; an invalid input would return NaN, which
      // Number.isFinite catches definitively.
      expect(typeof response.body.timestamp).toBe('string');
      const parsed = Date.parse(response.body.timestamp);
      expect(Number.isFinite(parsed)).toBe(true);
      expect(parsed).toBeGreaterThan(0);
    });

    it('returns body.environment matching config.nodeEnv', async () => {
      const response = await request(app).get('/health');
      // The health handler reads config.nodeEnv at request time and the
      // config module caches its value at module-load time. Asserting
      // equality against the same cached object (rather than a hard-coded
      // 'development') keeps the test correct under any NODE_ENV the Jest
      // worker happens to be running with.
      expect(response.body.environment).toBe(config.nodeEnv);
    });

    it('returns a body with exactly four keys: status, uptime, timestamp, environment', async () => {
      const response = await request(app).get('/health');
      // Sorted-keys equality is the strictest shape check that does not
      // require ordering assumptions on the JSON output. It rejects both
      // missing keys and accidental extra fields, which a looser
      // toMatchObject assertion would silently allow.
      expect(Object.keys(response.body).sort()).toEqual([
        'environment',
        'status',
        'timestamp',
        'uptime',
      ]);
    });
  });

  // ---------------------------------------------------------------------------
  // GET /health — uptime monotonicity sanity
  // ---------------------------------------------------------------------------
  // Process uptime is monotonically non-decreasing by Node.js contract.
  // Two sequential requests must therefore observe a non-decreasing value.
  // A brief setTimeout between calls guarantees a measurable delta on
  // fast machines without coupling the assertion to a strict-greater-than
  // comparison (>=, not >, keeps the test robust against zero-cost ticks).
  // ---------------------------------------------------------------------------
  describe('GET /health — uptime monotonicity sanity', () => {
    it('returns monotonically non-decreasing uptime across two successive calls', async () => {
      const first = await request(app).get('/health');
      // Brief delay so the second uptime reading reflects measurable progress.
      // Sufficient on every supported platform (Node.js 18+) without making
      // the suite noticeably slower (single-digit milliseconds).
      await new Promise((resolve) => setTimeout(resolve, 5));
      const second = await request(app).get('/health');
      expect(second.body.uptime).toBeGreaterThanOrEqual(first.body.uptime);
    });
  });
});
