/**
 * Unit tests for src/middleware/errorHandler.js — the centralized Express
 * error-handling middleware.
 *
 * Covers the seven documented branches:
 *   1. Default 500 fallback when err has no status fields
 *   2. err.statusCode honoured when present
 *   3. err.status honoured when present (statusCode absent)
 *   4. res.headersSent delegation to next(err)
 *   5. dev-mode response includes stack trace
 *   6. prod-mode response omits stack trace
 *   7. logger.error invoked with structured metadata
 *
 * Tests use synthetic req/res from tests/helpers/mockResponse.js and env
 * snapshot/restore from tests/helpers/env.js. The errorHandler module is
 * loaded fresh per test (via jest.resetModules()) so the cached config
 * module re-evaluates under the test's NODE_ENV.
 *
 * Test isolation strategy:
 *   - Every test starts with a freshly snapshotted process.env via
 *     `snapshotEnv()` from tests/helpers/env.js.
 *   - `jest.resetModules()` is invoked in beforeEach so that the require()
 *     inside loadErrorHandler() reloads src/utils/logger.js and
 *     src/middleware/errorHandler.js (and the cached src/config/index.js
 *     they transitively depend on) under the test's NODE_ENV. This is
 *     required because src/config/index.js reads process.env at module
 *     load and caches the frozen result in Node's require cache.
 *   - `restoreEnv(envSnap)` runs in afterEach to undo any env mutations.
 *   - `jest.restoreAllMocks()` runs in afterEach to remove any spies the
 *     test installed via loadErrorHandler(); jest.config.js sets
 *     restoreMocks: true which already does this implicitly between tests,
 *     but the explicit call documents intent per AAP § 0.10.5.
 *
 * Mocking discipline:
 *   - Only individual Winston logger methods are spied on (info, http,
 *     error, warn) via jest.spyOn. No `jest.mock('module-name')` factory
 *     stubs are used, per AAP § 0.10.5. The middleware, config, logger,
 *     and helper modules all run as their real implementations.
 *
 * Mirrors the house style established by tests/routes/api.test.js (PATTERN
 * SEED) per AAP § 0.10.4: CommonJS require, 2-space indentation, single
 * quotes, semicolons, top-level describe(<source-path>), nested describe
 * per behaviour family.
 *
 * Authoritative blueprint: AAP §§ 0.1.1, 0.4.2, 0.4.5, 0.5.2, 0.7.1, 0.10.4,
 * 0.10.5, 0.10.9.
 */

const { createMockRequest, createMockResponse } = require('../helpers/mockResponse');
const { snapshotEnv, restoreEnv } = require('../helpers/env');

describe('src/middleware/errorHandler.js', () => {
  // Snapshot holder reset by beforeEach and consumed by afterEach. Declared at
  // the describe scope so every nested describe block inherits the same
  // setup/teardown lifecycle without re-declaring helpers.
  let envSnap;

  // ---------------------------------------------------------------------------
  // Test isolation lifecycle
  // ---------------------------------------------------------------------------
  // The errorHandler module requires src/config and src/utils/logger at module
  // load. src/config reads process.env exactly once and caches the frozen
  // result in Node's require cache. To exercise the dev-vs-prod stack-trace
  // branch (config.nodeEnv === 'development') we MUST:
  //   1. Snapshot the pre-test process.env so it can be restored after the
  //      test (per AAP § 0.4.5 isolation rules).
  //   2. Call jest.resetModules() so the next require('../../src/middleware/
  //      errorHandler') in loadErrorHandler() re-evaluates the module body
  //      (and its transitive require of '../config') under the test's
  //      process.env.
  // ---------------------------------------------------------------------------
  beforeEach(() => {
    envSnap = snapshotEnv();
    jest.resetModules();
  });

  afterEach(() => {
    // Restore the pre-test process.env (deletes any keys the test added,
    // re-adds any keys the test deleted, overwrites any keys the test
    // mutated). This guarantees env-mutation tests do not leak NODE_ENV
    // changes into subsequent tests within the same Jest worker.
    restoreEnv(envSnap);
    // jest.config.js sets restoreMocks: true which restores spies between
    // tests automatically; the explicit call here documents intent and
    // protects against config drift per AAP § 0.10.5.
    jest.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Loader helper — reloads logger + errorHandler fresh under the current env
  // ---------------------------------------------------------------------------
  // Called inside each it() body AFTER any NODE_ENV mutation so the fresh
  // require()s pick up the current environment. Returns the errorHandler
  // function, the logger instance, and the spy on logger.error for call-
  // argument assertions.
  //
  // Spy installation order matters: jest.spyOn(logger, 'error') MUST run
  // BEFORE require('../../src/middleware/errorHandler') so that the captured
  // logger reference inside errorHandler.js is the spied instance. This works
  // because Node's module cache (which jest.resetModules() just emptied) is
  // populated by the first require('../../src/utils/logger') in this helper;
  // the subsequent require inside errorHandler.js then resolves to that same
  // cached instance and inherits the spies.
  //
  // The info/http/warn spies silence module-load and Morgan-stream output
  // so the test console stays clean even though the production code paths
  // under test do not directly invoke those methods.
  const loadErrorHandler = () => {
    const logger = require('../../src/utils/logger');
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    jest.spyOn(logger, 'info').mockImplementation(() => {});
    jest.spyOn(logger, 'http').mockImplementation(() => {});
    jest.spyOn(logger, 'warn').mockImplementation(() => {});
    const errorHandler = require('../../src/middleware/errorHandler');
    return { errorHandler, logger, errorSpy };
  };

  // ===========================================================================
  // Status code resolution
  // ===========================================================================
  // Exercises the `err.statusCode || err.status || 500` precedence chain on
  // line 27 of src/middleware/errorHandler.js. Each test pre-sets NODE_ENV
  // to 'production' so the response body excludes the stack trace and the
  // toHaveBeenCalledWith deep-equality assertion can pin the exact body
  // shape without accommodating a stack property.
  // ===========================================================================
  describe('status code resolution', () => {
    it('defaults to 500 when err has no statusCode or status fields', () => {
      process.env.NODE_ENV = 'production';
      const { errorHandler } = loadErrorHandler();
      const err = new Error('boom');
      const req = createMockRequest();
      const res = createMockResponse();
      const next = jest.fn();
      errorHandler(err, req, res, next);
      // The `|| 500` fallback on line 27 of errorHandler.js fires when both
      // err.statusCode and err.status are undefined. Asserting res.status was
      // called exactly with 500 (not 200, not 0, not '500') pins this branch.
      expect(res.status).toHaveBeenCalledWith(500);
      // toHaveBeenCalledWith uses deep equality on the argument so this also
      // verifies no extra keys (e.g. accidental `stack`) leaked into the
      // production-mode response body.
      expect(res.json).toHaveBeenCalledWith({ status: 500, message: 'boom' });
    });

    it('honours err.statusCode when present (418 teapot)', () => {
      process.env.NODE_ENV = 'production';
      const { errorHandler } = loadErrorHandler();
      const err = new Error('I am a teapot');
      err.statusCode = 418;
      const req = createMockRequest();
      const res = createMockResponse();
      const next = jest.fn();
      errorHandler(err, req, res, next);
      // The first operand of the `|| || 500` chain wins when present. 418
      // is chosen because it is a real but uncommon HTTP status, making
      // accidental hardcoded fallbacks (e.g. always returning 500) easy to
      // spot in failure diffs.
      expect(res.status).toHaveBeenCalledWith(418);
      expect(res.json).toHaveBeenCalledWith({ status: 418, message: 'I am a teapot' });
    });

    it('honours err.status when statusCode is absent (429 too many requests)', () => {
      process.env.NODE_ENV = 'production';
      const { errorHandler } = loadErrorHandler();
      const err = new Error('Too many');
      err.status = 429;
      const req = createMockRequest();
      const res = createMockResponse();
      const next = jest.fn();
      errorHandler(err, req, res, next);
      // The second operand of the precedence chain wins when err.statusCode
      // is undefined. This mirrors the Boom / http-errors convention where
      // some libraries set `.status` and others set `.statusCode` — both
      // must be honoured to remain compatible.
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({ status: 429, message: 'Too many' });
    });

    it('prefers err.statusCode over err.status when both are present', () => {
      process.env.NODE_ENV = 'production';
      const { errorHandler } = loadErrorHandler();
      const err = new Error('Boom');
      err.statusCode = 418;
      err.status = 429;
      const req = createMockRequest();
      const res = createMockResponse();
      const next = jest.fn();
      errorHandler(err, req, res, next);
      // JavaScript's `||` short-circuits at the first truthy operand, so
      // err.statusCode wins. Without this test a regression that swapped
      // the operands (`err.status || err.statusCode || 500`) would still
      // pass tests 1–3 above but would silently break this precedence
      // contract that real-world error libraries rely on.
      expect(res.status).toHaveBeenCalledWith(418);
    });
  });

  // ===========================================================================
  // Response body shape
  // ===========================================================================
  // Exercises the `err.message || 'Internal Server Error'` fallback on line 47
  // of src/middleware/errorHandler.js. The two tests cover both branches:
  // empty err.message (falsy) -> default literal; populated err.message ->
  // verbatim pass-through.
  // ===========================================================================
  describe('response body shape', () => {
    it('uses "Internal Server Error" as the default message when err.message is empty', () => {
      process.env.NODE_ENV = 'production';
      const { errorHandler } = loadErrorHandler();
      // `new Error()` with no arguments produces an Error whose .message is
      // the empty string (''). Empty string is falsy, so the `||` fallback
      // on line 47 of errorHandler.js fires and the response message becomes
      // the documented 'Internal Server Error' literal.
      const err = new Error();
      const req = createMockRequest();
      const res = createMockResponse();
      const next = jest.fn();
      errorHandler(err, req, res, next);
      // toHaveBeenCalledWith deep-equality pins the exact body — { status:
      // 500, message: 'Internal Server Error' } — guarding against typos
      // and accidental extra keys.
      expect(res.json).toHaveBeenCalledWith({ status: 500, message: 'Internal Server Error' });
    });

    it('uses err.message verbatim when present', () => {
      process.env.NODE_ENV = 'production';
      const { errorHandler } = loadErrorHandler();
      const err = new Error('Custom failure');
      const req = createMockRequest();
      const res = createMockResponse();
      const next = jest.fn();
      errorHandler(err, req, res, next);
      // Extract the body argument from res.json.mock.calls[0][0] so we can
      // assert on a single field without re-stating the full shape — keeps
      // the assertion focused on the message-passthrough behaviour.
      const jsonArg = res.json.mock.calls[0][0];
      expect(jsonArg.message).toBe('Custom failure');
    });
  });

  // ===========================================================================
  // headersSent delegation
  // ===========================================================================
  // Exercises the `if (res.headersSent) { return next(err); }` guard on lines
  // 40-42 of src/middleware/errorHandler.js. When a prior middleware has
  // already started streaming the response, attempting res.status(...) /
  // res.json(...) would throw a "Cannot set headers after they are sent"
  // error in Node, so the middleware must short-circuit to Express's default
  // error handler via next(err).
  // ===========================================================================
  describe('headersSent delegation', () => {
    it('delegates to next(err) when res.headersSent is true and does not call res.status/json', () => {
      process.env.NODE_ENV = 'production';
      const { errorHandler } = loadErrorHandler();
      const err = new Error('post-response failure');
      const req = createMockRequest();
      const res = createMockResponse();
      // The createMockResponse() default headersSent is false; flipping it
      // to true here simulates a response that has already started streaming
      // headers (e.g. via res.write or a streaming JSON payload).
      res.headersSent = true;
      const next = jest.fn();
      errorHandler(err, req, res, next);
      // The middleware must:
      //   1. Invoke next exactly once with the err object (toHaveBeenCalledTimes
      //      + toHaveBeenCalledWith pin both arity and argument).
      //   2. NOT call res.status or res.json (calling them would throw at
      //      runtime against a real response with headers already sent).
      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(err);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('does not call next when res.headersSent is false', () => {
      process.env.NODE_ENV = 'production';
      const { errorHandler } = loadErrorHandler();
      const err = new Error('normal failure');
      const req = createMockRequest();
      // createMockResponse defaults headersSent to false — the normal,
      // happy-path branch of the if guard.
      const res = createMockResponse();
      const next = jest.fn();
      errorHandler(err, req, res, next);
      // Required for 95% branch coverage on the `if (res.headersSent)` line:
      // without this test the false branch of the conditional would be
      // unmeasured and the per-file coverage threshold would fail.
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // development-mode stack trace inclusion
  // ===========================================================================
  // Exercises the `if (config.nodeEnv === 'development') { response.stack =
  // err.stack; }` branch on lines 51-53 of src/middleware/errorHandler.js.
  // NODE_ENV=development is set BEFORE loadErrorHandler() so the cached
  // config module re-evaluates with the dev value and the captured config
  // reference inside errorHandler.js sees nodeEnv === 'development'.
  // ===========================================================================
  describe('development-mode stack trace', () => {
    it('includes the stack property in the response body when NODE_ENV is development', () => {
      process.env.NODE_ENV = 'development';
      const { errorHandler } = loadErrorHandler();
      const err = new Error('dev failure');
      const req = createMockRequest();
      const res = createMockResponse();
      const next = jest.fn();
      errorHandler(err, req, res, next);
      const jsonArg = res.json.mock.calls[0][0];
      // toHaveProperty asserts presence without requiring an exact value —
      // important because err.stack content varies by Node version (V8 vs
      // SpiderMonkey vs JavaScriptCore would all produce different traces).
      expect(jsonArg).toHaveProperty('stack');
      // Reference equality (toBe) confirms the response stack is the exact
      // same string reference attached to the Error object, not a copy or
      // a stringified form. This is the strongest assertion that doesn't
      // depend on Node version.
      expect(jsonArg.stack).toBe(err.stack);
      // Type check guards against future regressions that might JSON.stringify
      // the stack into an object or array.
      expect(typeof jsonArg.stack).toBe('string');
    });
  });

  // ===========================================================================
  // production-mode stack trace omission
  // ===========================================================================
  // Exercises the same `if (config.nodeEnv === 'development')` conditional
  // but from the opposite direction: when NODE_ENV is anything other than
  // 'development' (production, test, staging, etc.) the response body must
  // NOT include a stack property. Two values are tested: 'production' (the
  // documented prod env) and 'test' (defensive coverage for arbitrary non-
  // development envs).
  // ===========================================================================
  describe('production-mode stack trace omission', () => {
    it('omits the stack property from the response body when NODE_ENV is production', () => {
      process.env.NODE_ENV = 'production';
      const { errorHandler } = loadErrorHandler();
      const err = new Error('prod failure');
      const req = createMockRequest();
      const res = createMockResponse();
      const next = jest.fn();
      errorHandler(err, req, res, next);
      const jsonArg = res.json.mock.calls[0][0];
      // not.toHaveProperty asserts explicit absence — a regression that
      // accidentally always included the stack would set jsonArg.stack and
      // be caught here.
      expect(jsonArg).not.toHaveProperty('stack');
      // toEqual deep-equality on the full body confirms the response is
      // EXACTLY { status: 500, message: 'prod failure' } — no extra keys,
      // no stack, no debug metadata. This is the strongest possible body
      // assertion for the prod path.
      expect(jsonArg).toEqual({ status: 500, message: 'prod failure' });
    });

    it('omits the stack property when NODE_ENV is "test"', () => {
      process.env.NODE_ENV = 'test';
      const { errorHandler } = loadErrorHandler();
      const err = new Error('test failure');
      const req = createMockRequest();
      const res = createMockResponse();
      const next = jest.fn();
      errorHandler(err, req, res, next);
      const jsonArg = res.json.mock.calls[0][0];
      // Defensive coverage: confirms only the literal string 'development'
      // triggers stack inclusion. Any other env value (here 'test' but it
      // could be 'staging', 'qa', etc.) must omit the stack.
      expect(jsonArg).not.toHaveProperty('stack');
    });
  });

  // ===========================================================================
  // logger.error invocation contract
  // ===========================================================================
  // Exercises the `logger.error(err.message, { statusCode, stack, path,
  // method })` call on lines 30-35 of src/middleware/errorHandler.js. Three
  // tests pin the contract:
  //   1. Happy path with explicit statusCode and request metadata.
  //   2. Default statusCode=500 when err has no status fields.
  //   3. Logging still happens even when the headersSent path is taken
  //      (verifies logging is BEFORE the headersSent guard).
  // ===========================================================================
  describe('logger.error invocation', () => {
    it('invokes logger.error exactly once with the message and {statusCode, stack, path, method} metadata', () => {
      process.env.NODE_ENV = 'production';
      const { errorHandler, errorSpy } = loadErrorHandler();
      const err = new Error('logged failure');
      err.statusCode = 418;
      // Custom originalUrl and method override the helper defaults so we
      // can assert the logger captured the actual request context (not the
      // default '/nope' GET) — proves the middleware reads from req, not
      // from a hardcoded constant.
      const req = createMockRequest({ originalUrl: '/some/path', method: 'POST' });
      const res = createMockResponse();
      const next = jest.fn();
      errorHandler(err, req, res, next);
      // Exactly-once arity assertion catches any future regression that
      // might accidentally double-log (e.g. via a misplaced retry).
      expect(errorSpy).toHaveBeenCalledTimes(1);
      // toHaveBeenCalledWith uses deep equality; expect.objectContaining
      // allows additional metadata keys to be added by future enhancements
      // without breaking the test, while still pinning the four documented
      // keys (statusCode, stack, path, method) and their exact values.
      expect(errorSpy).toHaveBeenCalledWith(
        'logged failure',
        expect.objectContaining({
          statusCode: 418,
          stack: err.stack,
          path: '/some/path',
          method: 'POST',
        })
      );
    });

    it('logs with statusCode=500 when err has no statusCode or status', () => {
      process.env.NODE_ENV = 'production';
      const { errorHandler, errorSpy } = loadErrorHandler();
      const err = new Error('plain failure');
      const req = createMockRequest({ originalUrl: '/x', method: 'GET' });
      const res = createMockResponse();
      const next = jest.fn();
      errorHandler(err, req, res, next);
      // The resolved statusCode (500 via the || 500 fallback) is what gets
      // logged — confirms the logger metadata uses the resolved value, not
      // the raw err.statusCode (which is undefined here). This is critical
      // for log aggregation tooling that filters by statusCode.
      expect(errorSpy).toHaveBeenCalledWith(
        'plain failure',
        expect.objectContaining({ statusCode: 500, path: '/x', method: 'GET' })
      );
    });

    it('still logs the error when delegating to next(err) on headersSent', () => {
      process.env.NODE_ENV = 'production';
      const { errorHandler, errorSpy } = loadErrorHandler();
      const err = new Error('mid-response failure');
      const req = createMockRequest();
      const res = createMockResponse();
      res.headersSent = true;
      const next = jest.fn();
      errorHandler(err, req, res, next);
      // The middleware's source order places logger.error BEFORE the
      // `if (res.headersSent)` guard (lines 30-35 then 40-42 in
      // errorHandler.js), so the error is always logged even when the
      // response body cannot be sent. This is critical because the
      // mid-response failure mode is exactly when operators most need the
      // log entry for diagnosis.
      expect(errorSpy).toHaveBeenCalledTimes(1);
    });
  });
});
