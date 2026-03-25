'use strict';

/**
 * Shared Test Utilities and Mock Factories
 *
 * Foundational test infrastructure module for the entire test suite.
 * Provides factory functions for creating mock Express request, response,
 * and next objects, as well as environment variable management utilities
 * for safe process.env manipulation in tests.
 *
 * CRITICAL DESIGN DECISIONS:
 * - All mock factories return FRESH objects on every call (no shared state)
 * - Environment utilities are non-destructive (always restore original state)
 * - Zero external dependencies — relies only on Jest's built-in jest.fn() global
 * - CommonJS module.exports matching project conventions
 *
 * @module tests/helpers/setup
 */

// ---------------------------------------------------------------------------
// Mock Express Request Factory
// ---------------------------------------------------------------------------

/**
 * Creates a minimal Express request object for middleware unit testing.
 *
 * Default properties are derived from source code analysis of the middleware
 * modules that consume request objects:
 * - `originalUrl` — Used by notFound.js and errorHandler.js for logging and response messages
 * - `method` — Used by errorHandler.js for contextual error logging
 * - `body` — Used by validateInput.js via `req[key]` where key is 'body'
 * - `query` — Used by validateInput.js via `req[key]` where key is 'query'
 * - `params` — Used by validateInput.js via `req[key]` where key is 'params'
 *
 * Returns a plain object (not a Jest mock) because middleware accesses
 * req properties directly via property reads, not method calls.
 *
 * @param {Object} [overrides={}] - Properties to override or add to the default request object
 * @returns {Object} A mock Express request object with sensible defaults
 *
 * @example
 *   // Default request
 *   const req = createMockReq();
 *   // req.originalUrl === '/test'
 *
 * @example
 *   // Custom request for notFound testing
 *   const req = createMockReq({ originalUrl: '/nonexistent', method: 'POST' });
 *
 * @example
 *   // Custom request for validateInput testing
 *   const req = createMockReq({ body: { unexpected: true }, query: { bad: 'param' } });
 */
function createMockReq(overrides = {}) {
  return {
    originalUrl: '/test',
    method: 'GET',
    body: {},
    query: {},
    params: {},
    ...overrides
  };
}

// ---------------------------------------------------------------------------
// Mock Express Response Factory
// ---------------------------------------------------------------------------

/**
 * Creates a chainable Express response object for middleware unit testing.
 *
 * All mock methods use `jest.fn().mockReturnThis()` to enable method chaining,
 * which is critical because middleware source code chains calls such as:
 *   `res.status(404).json({ status: 'error', ... })`
 *
 * Each call to createMockRes() returns a brand new object with fresh jest.fn()
 * mocks, ensuring no shared state between tests.
 *
 * Mock methods provided (derived from source code analysis):
 * - `status(code)` — Used by validateInput.js, notFound.js, and errorHandler.js
 * - `json(body)` — Used by all three middleware files to send JSON responses
 * - `set(header, value)` — Used by route handlers for setting response headers
 *
 * @returns {Object} A chainable mock Express response object with jest.fn() methods
 *
 * @example
 *   const res = createMockRes();
 *   someMiddleware(req, res, next);
 *   expect(res.status).toHaveBeenCalledWith(404);
 *   expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'error' }));
 *
 * @example
 *   // Chainability verification
 *   const res = createMockRes();
 *   res.status(200).json({ ok: true }); // Works because status() returns `this`
 */
function createMockRes() {
  const res = {};
  res.status = jest.fn().mockReturnThis();
  res.json = jest.fn().mockReturnThis();
  res.set = jest.fn().mockReturnThis();
  return res;
}

// ---------------------------------------------------------------------------
// Mock Next Function Factory
// ---------------------------------------------------------------------------

/**
 * Creates a Jest mock function to verify middleware pass-through behavior.
 *
 * Returns a fresh jest.fn() on each call, enabling callers to assert
 * whether middleware called next() (pass-through) or terminated the
 * request/response cycle without calling next().
 *
 * @returns {jest.Mock} A fresh Jest mock function
 *
 * @example
 *   const next = createMockNext();
 *   validationMiddleware(req, res, next);
 *   expect(next).toHaveBeenCalled(); // Validation passed
 *
 * @example
 *   const next = createMockNext();
 *   notFoundMiddleware(req, res, next);
 *   expect(next).not.toHaveBeenCalled(); // notFound terminates the cycle
 */
function createMockNext() {
  return jest.fn();
}

// ---------------------------------------------------------------------------
// Environment Variable Backup/Restore Utilities
// ---------------------------------------------------------------------------

/**
 * Creates a shallow copy snapshot of the current process.env state.
 *
 * Use this in beforeEach hooks to capture the environment state before
 * any test manipulates process.env. The returned snapshot should be
 * passed to restoreEnv() in afterEach hooks to guarantee clean state.
 *
 * @returns {Object} A plain object shallow copy of process.env
 *
 * @example
 *   let envBackup;
 *   beforeEach(() => { envBackup = backupEnv(); });
 *   afterEach(() => { restoreEnv(envBackup); });
 */
function backupEnv() {
  return { ...process.env };
}

/**
 * Restores process.env to a previously captured snapshot state.
 *
 * Performs a two-pass restoration to handle all possible mutations:
 * 1. Removes any keys that were ADDED during the test (present in
 *    current process.env but absent from the backup snapshot)
 * 2. Restores original values for all keys that existed in the backup
 *    (handles both modified and deleted keys)
 *
 * Uses the `in` operator for key existence checks because process.env
 * is a special Node.js object where hasOwnProperty may not behave
 * identically to standard objects.
 *
 * @param {Object} backup - The snapshot object returned by backupEnv()
 *
 * @example
 *   const backup = backupEnv();
 *   process.env.PORT = '8080';
 *   process.env.NEW_VAR = 'added';
 *   delete process.env.HOME;
 *   restoreEnv(backup);
 *   // process.env.PORT is restored to original value
 *   // process.env.NEW_VAR is removed
 *   // process.env.HOME is restored
 */
function restoreEnv(backup) {
  // Pass 1: Remove any keys that were added during the test
  for (const key of Object.keys(process.env)) {
    if (!(key in backup)) {
      delete process.env[key];
    }
  }
  // Pass 2: Restore original values (including any that were deleted during the test)
  for (const [key, value] of Object.entries(backup)) {
    process.env[key] = value;
  }
}

// ---------------------------------------------------------------------------
// Temporary Environment Utility
// ---------------------------------------------------------------------------

/**
 * Temporarily sets environment variables, executes a function, and restores
 * the original environment state regardless of success or failure.
 *
 * This higher-order utility eliminates boilerplate for tests that need
 * controlled environment variable state. It handles backup, assignment,
 * execution, and restoration in a single call with try/finally safety.
 *
 * Returns the return value of the provided function, enabling inline
 * assertions and value capture.
 *
 * @param {Object} vars - Plain object of environment variables to set (e.g., { NODE_ENV: 'production' })
 * @param {Function} fn - Function to execute with the temporary environment variables active
 * @returns {*} The return value of fn
 *
 * @example
 *   withEnv({ NODE_ENV: 'production', PORT: '8080' }, () => {
 *     jest.resetModules();
 *     const config = require('../../src/config');
 *     expect(config.env).toBe('production');
 *     expect(config.port).toBe(8080);
 *   });
 *
 * @example
 *   // Capture return value
 *   const result = withEnv({ NODE_ENV: 'test' }, () => {
 *     return process.env.NODE_ENV;
 *   });
 *   expect(result).toBe('test');
 *
 * @example
 *   // Environment is restored even if fn throws
 *   expect(() => {
 *     withEnv({ NODE_ENV: 'production' }, () => { throw new Error('boom'); });
 *   }).toThrow('boom');
 *   // process.env.NODE_ENV is restored to its original value
 */
function withEnv(vars, fn) {
  const backup = backupEnv();
  try {
    Object.assign(process.env, vars);
    return fn();
  } finally {
    restoreEnv(backup);
  }
}

// ---------------------------------------------------------------------------
// Module Exports
// ---------------------------------------------------------------------------

module.exports = {
  createMockReq,
  createMockRes,
  createMockNext,
  backupEnv,
  restoreEnv,
  withEnv
};
