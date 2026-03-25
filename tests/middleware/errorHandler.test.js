'use strict';

/**
 * Centralized Error Handler Middleware Unit Tests
 *
 * Comprehensive unit tests for the errorHandler middleware from
 * src/middleware/errorHandler.js. The middleware is Express's centralized
 * error handler with the 4-argument signature (err, req, res, next).
 *
 * Test coverage targets:
 * - Status code resolution: err.statusCode → err.status → 500 fallback chain
 * - Production 5xx error masking (CWE-209): masks sensitive error details
 * - Non-production stack trace inclusion for debugging
 * - Client error (4xx) message preservation across all environments
 * - Logger.error() invocation with sanitized log output
 * - Response termination: next() is never called
 * - Edge cases: falsy statusCode, empty messages, boundary status codes
 *
 * @module tests/middleware/errorHandler.test
 */

// ---------------------------------------------------------------------------
// Logger Mock — MUST be declared BEFORE importing errorHandler
// ---------------------------------------------------------------------------
// errorHandler.js line 39: const logger = require('../utils/logger');
// This executes at module load time, so the mock must be in place before
// errorHandler is required. The mock prevents Winston file I/O to
// logs/combined.log and logs/error.log during test execution.
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  http: jest.fn(),
  stream: { write: jest.fn() }
}));

// ---------------------------------------------------------------------------
// Module Imports
// ---------------------------------------------------------------------------

const errorHandler = require('../../src/middleware/errorHandler');
const logger = require('../../src/utils/logger');
const {
  createMockReq,
  createMockRes,
  createMockNext,
  backupEnv,
  restoreEnv
} = require('../helpers/setup');

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('errorHandler middleware', () => {
  let envBackup;

  // Save environment state before each test and clear mock call history
  beforeEach(() => {
    jest.clearAllMocks();
    envBackup = backupEnv();
  });

  // Restore environment state after each test to prevent pollution
  afterEach(() => {
    restoreEnv(envBackup);
  });

  // =========================================================================
  // 1. Status Code Resolution Tests
  // =========================================================================
  // Source line 56: const statusCode = err.statusCode || err.status || 500;
  // This is a logical OR chain with short-circuit evaluation.
  // =========================================================================

  describe('status code resolution', () => {
    test('uses err.statusCode when present', () => {
      const err = new Error('Forbidden');
      err.statusCode = 403;
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    test('uses err.status when err.statusCode is absent', () => {
      const err = new Error('Unprocessable');
      err.status = 422;
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(422);
    });

    test('defaults to 500 when neither statusCode nor status is present', () => {
      const err = new Error('Unknown crash');
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
    });

    test('uses err.statusCode over err.status when both are present', () => {
      const err = new Error('Test');
      err.statusCode = 403;
      err.status = 404;
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      errorHandler(err, req, res, next);

      // statusCode wins due to || short-circuit evaluation
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  // =========================================================================
  // 2. Production 5xx Error Masking Tests (CWE-209)
  // =========================================================================
  // Source lines 75-79:
  //   const isServerError = statusCode >= 500;
  //   const isProduction = process.env.NODE_ENV === 'production';
  //   const message = (isServerError && isProduction)
  //     ? 'Internal Server Error'
  //     : (err.message || 'Internal Server Error');
  //
  // Branch combinations:
  //   1. isServerError=true  AND isProduction=true  → masked
  //   2. isServerError=true  AND isProduction=false → original message
  //   3. isServerError=false AND isProduction=true  → original message
  //   4. isServerError=false AND isProduction=false → original message
  // =========================================================================

  describe('production error masking', () => {
    test('masks 500 error message in production with "Internal Server Error"', () => {
      process.env.NODE_ENV = 'production';
      const err = new Error('Secret database connection string leaked');
      // No statusCode/status → defaults to 500
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      errorHandler(err, req, res, next);

      const jsonArg = res.json.mock.calls[0][0];
      expect(jsonArg.message).toBe('Internal Server Error');
      // Original sensitive message must not leak
      expect(jsonArg.message).not.toContain('database');
    });

    test('masks 503 error message in production with "Internal Server Error"', () => {
      process.env.NODE_ENV = 'production';
      const err = new Error('Service temporarily unavailable');
      err.statusCode = 503;
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      errorHandler(err, req, res, next);

      const jsonArg = res.json.mock.calls[0][0];
      expect(jsonArg.message).toBe('Internal Server Error');
      expect(jsonArg.message).not.toContain('temporarily');
    });

    test('does NOT mask 4xx error messages in production', () => {
      process.env.NODE_ENV = 'production';
      const err = new Error('Bad Request - invalid input');
      err.statusCode = 400;
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      errorHandler(err, req, res, next);

      const jsonArg = res.json.mock.calls[0][0];
      // 4xx client errors preserve the original message even in production
      expect(jsonArg.message).toBe('Bad Request - invalid input');
    });

    test('does NOT mask 5xx error messages in non-production', () => {
      process.env.NODE_ENV = 'development';
      const err = new Error('Detailed error for debugging');
      // defaults to 500 (no statusCode, no status)
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      errorHandler(err, req, res, next);

      const jsonArg = res.json.mock.calls[0][0];
      // Non-production retains original message for debugging
      expect(jsonArg.message).toBe('Detailed error for debugging');
    });
  });

  // =========================================================================
  // 3. Error Message Fallback Tests
  // =========================================================================
  // Source line 79: (err.message || 'Internal Server Error')
  // When the masking branch is not taken (not production+5xx), empty messages
  // fall back to 'Internal Server Error'.
  // =========================================================================

  describe('error message fallback', () => {
    test('uses "Internal Server Error" when err.message is empty in non-production', () => {
      process.env.NODE_ENV = 'development';
      const err = new Error('');
      err.statusCode = 400;
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      errorHandler(err, req, res, next);

      const jsonArg = res.json.mock.calls[0][0];
      // Empty string is falsy → falls back to 'Internal Server Error'
      expect(jsonArg.message).toBe('Internal Server Error');
    });
  });

  // =========================================================================
  // 4. Stack Trace Inclusion Tests
  // =========================================================================
  // Source lines 92-94:
  //   if (process.env.NODE_ENV !== 'production') {
  //     response.stack = err.stack;
  //   }
  // Stack is included for ALL non-production environments.
  // Stack is ONLY excluded when NODE_ENV === 'production' exactly.
  // =========================================================================

  describe('stack trace', () => {
    test('includes stack trace in non-production environment (development)', () => {
      process.env.NODE_ENV = 'development';
      const err = new Error('Test error');
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      errorHandler(err, req, res, next);

      const jsonArg = res.json.mock.calls[0][0];
      expect(jsonArg).toHaveProperty('stack');
      expect(jsonArg.stack).toBeDefined();
      expect(jsonArg.stack).toContain('Error: Test error');
    });

    test('does NOT include stack trace in production environment', () => {
      process.env.NODE_ENV = 'production';
      const err = new Error('Hidden error');
      err.statusCode = 400; // Use 4xx to avoid message masking conflation
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      errorHandler(err, req, res, next);

      const jsonArg = res.json.mock.calls[0][0];
      expect(jsonArg).not.toHaveProperty('stack');
    });

    test('includes stack trace when NODE_ENV is "test"', () => {
      process.env.NODE_ENV = 'test';
      const err = new Error('Test env error');
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      errorHandler(err, req, res, next);

      const jsonArg = res.json.mock.calls[0][0];
      expect(jsonArg).toHaveProperty('stack');
      expect(jsonArg.stack).toContain('Error: Test env error');
    });

    test('includes stack trace when NODE_ENV is undefined', () => {
      delete process.env.NODE_ENV;
      const err = new Error('No env error');
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      errorHandler(err, req, res, next);

      const jsonArg = res.json.mock.calls[0][0];
      expect(jsonArg).toHaveProperty('stack');
      expect(jsonArg.stack).toContain('Error: No env error');
    });
  });

  // =========================================================================
  // 5. Response Structure Tests
  // =========================================================================
  // Source lines 81-85:
  //   const response = {
  //     status: 'error',
  //     statusCode: statusCode,
  //     message: message,
  //   };
  // Non-production: { status, statusCode, message, stack } (4 keys)
  // Production: { status, statusCode, message } (3 keys)
  // =========================================================================

  describe('response structure', () => {
    test('returns JSON with status "error"', () => {
      const err = new Error('Test');
      err.statusCode = 400;
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      errorHandler(err, req, res, next);

      const jsonArg = res.json.mock.calls[0][0];
      expect(jsonArg.status).toBe('error');
    });

    test('returns JSON with correct statusCode number', () => {
      const err = new Error('Test');
      err.statusCode = 422;
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      errorHandler(err, req, res, next);

      const jsonArg = res.json.mock.calls[0][0];
      expect(jsonArg.statusCode).toBe(422);
      expect(typeof jsonArg.statusCode).toBe('number');
    });

    test('returns JSON with message string', () => {
      const err = new Error('A specific message');
      err.statusCode = 400;
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      errorHandler(err, req, res, next);

      const jsonArg = res.json.mock.calls[0][0];
      expect(jsonArg.message).toBe('A specific message');
      expect(typeof jsonArg.message).toBe('string');
    });

    test('response object has exactly expected keys in non-production (4 keys)', () => {
      process.env.NODE_ENV = 'development';
      const err = new Error('Dev error');
      err.statusCode = 500;
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      errorHandler(err, req, res, next);

      const jsonArg = res.json.mock.calls[0][0];
      const keys = Object.keys(jsonArg).sort();
      expect(keys).toEqual(['message', 'stack', 'status', 'statusCode']);
    });

    test('response object has exactly expected keys in production (3 keys)', () => {
      process.env.NODE_ENV = 'production';
      const err = new Error('Prod error');
      err.statusCode = 400; // Use 4xx so message is preserved
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      errorHandler(err, req, res, next);

      const jsonArg = res.json.mock.calls[0][0];
      const keys = Object.keys(jsonArg).sort();
      expect(keys).toEqual(['message', 'status', 'statusCode']);
    });
  });

  // =========================================================================
  // 6. Logger Error Invocation Tests
  // =========================================================================
  // Source line 65:
  //   logger.error(`${statusCode} - ${err.message} - ${sanitizeLogInput(req.originalUrl)} - ${sanitizeLogInput(req.method)}`);
  // sanitizeLogInput strips ANSI escape sequences and control characters
  // but does NOT HTML-encode.
  // =========================================================================

  describe('logger.error()', () => {
    test('calls logger.error with status code, message, URL, and method', () => {
      const err = new Error('Something failed');
      err.statusCode = 500;
      const req = createMockReq({ originalUrl: '/api/data', method: 'POST' });
      const res = createMockRes();
      const next = createMockNext();

      errorHandler(err, req, res, next);

      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        '500 - Something failed - /api/data - POST'
      );
    });

    test('sanitizes req.originalUrl in log output (strips ANSI)', () => {
      const err = new Error('Error');
      err.statusCode = 500;
      const req = createMockReq({
        originalUrl: '/path\x1b[31mred\x1b[0m',
        method: 'GET'
      });
      const res = createMockRes();
      const next = createMockNext();

      errorHandler(err, req, res, next);

      const logArg = logger.error.mock.calls[0][0];
      // ANSI escape sequences must be stripped
      expect(logArg).not.toContain('\x1b');
      expect(logArg).toContain('/path');
      expect(logArg).toContain('red');
    });

    test('sanitizes req.method in log output (strips control chars)', () => {
      const err = new Error('Error');
      err.statusCode = 500;
      const req = createMockReq({
        originalUrl: '/test',
        method: 'GET\nnewline'
      });
      const res = createMockRes();
      const next = createMockNext();

      errorHandler(err, req, res, next);

      const logArg = logger.error.mock.calls[0][0];
      // Control characters (newline) must be stripped from method
      expect(logArg).not.toContain('\n');
      expect(logArg).toContain('GET');
      expect(logArg).toContain('newline');
    });

    test('log format is: "<statusCode> - <message> - <sanitizedUrl> - <sanitizedMethod>"', () => {
      const err = new Error('Access denied');
      err.statusCode = 403;
      const req = createMockReq({ originalUrl: '/admin', method: 'DELETE' });
      const res = createMockRes();
      const next = createMockNext();

      errorHandler(err, req, res, next);

      expect(logger.error).toHaveBeenCalledWith(
        '403 - Access denied - /admin - DELETE'
      );
    });
  });

  // =========================================================================
  // 7. Response Termination Tests
  // =========================================================================
  // Source line 99: res.status(statusCode).json(response);
  // The error handler terminates the request — next() is never called.
  // The eslint-disable-next-line no-unused-vars comment at line 50 confirms
  // next is declared for Express arity (4 args) but intentionally unused.
  // =========================================================================

  describe('response termination', () => {
    test('does NOT call next()', () => {
      const err = new Error('Test');
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      errorHandler(err, req, res, next);

      expect(next).not.toHaveBeenCalled();
    });

    test('calls res.status() exactly once', () => {
      const err = new Error('Test');
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledTimes(1);
    });

    test('calls res.json() exactly once', () => {
      const err = new Error('Test');
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      errorHandler(err, req, res, next);

      expect(res.json).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // 8. Client Error (4xx) Message Preservation Tests
  // =========================================================================
  // Source lines 75-79: isServerError = statusCode >= 500
  // 4xx errors (< 500) are NOT server errors — messages are preserved
  // in all environments including production.
  // =========================================================================

  describe('client errors (4xx)', () => {
    test('preserves 400 error message in production', () => {
      process.env.NODE_ENV = 'production';
      const err = new Error('Invalid email format');
      err.statusCode = 400;
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      errorHandler(err, req, res, next);

      const jsonArg = res.json.mock.calls[0][0];
      expect(jsonArg.message).toBe('Invalid email format');
    });

    test('preserves 401 error message in production', () => {
      process.env.NODE_ENV = 'production';
      const err = new Error('Authentication required');
      err.statusCode = 401;
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      errorHandler(err, req, res, next);

      const jsonArg = res.json.mock.calls[0][0];
      expect(jsonArg.message).toBe('Authentication required');
    });

    test('preserves 404 error message in production', () => {
      process.env.NODE_ENV = 'production';
      const err = new Error('Resource not found');
      err.statusCode = 404;
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      errorHandler(err, req, res, next);

      const jsonArg = res.json.mock.calls[0][0];
      expect(jsonArg.message).toBe('Resource not found');
    });

    test('preserves 422 error message in production', () => {
      process.env.NODE_ENV = 'production';
      const err = new Error('Unprocessable entity');
      err.statusCode = 422;
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      errorHandler(err, req, res, next);

      const jsonArg = res.json.mock.calls[0][0];
      expect(jsonArg.message).toBe('Unprocessable entity');
    });

    test('preserves 499 error message in production (boundary)', () => {
      process.env.NODE_ENV = 'production';
      const err = new Error('Client timeout');
      err.statusCode = 499;
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      errorHandler(err, req, res, next);

      const jsonArg = res.json.mock.calls[0][0];
      // 499 < 500 → isServerError is false → message NOT masked
      expect(jsonArg.message).toBe('Client timeout');
      expect(res.status).toHaveBeenCalledWith(499);
    });
  });

  // =========================================================================
  // 9. Edge Case Tests
  // =========================================================================

  describe('edge cases', () => {
    test('handles error with statusCode 0 (falsy → falls through to status → 500)', () => {
      const err = new Error('Zero status');
      err.statusCode = 0; // falsy in JavaScript
      // 0 || err.status || 500 → falls to err.status or 500
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      errorHandler(err, req, res, next);

      // 0 is falsy → falls through to default 500
      expect(res.status).toHaveBeenCalledWith(500);
    });

    test('handles error with statusCode 0 and status set (falls to status)', () => {
      const err = new Error('Zero with fallback');
      err.statusCode = 0; // falsy
      err.status = 418; // I'm a teapot
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      errorHandler(err, req, res, next);

      // 0 || 418 || 500 → 418
      expect(res.status).toHaveBeenCalledWith(418);
    });

    test('handles error with no message property', () => {
      process.env.NODE_ENV = 'development';
      const err = new Error(); // err.message is empty string
      err.statusCode = 400;
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      errorHandler(err, req, res, next);

      const jsonArg = res.json.mock.calls[0][0];
      // Empty string is falsy → fallback to 'Internal Server Error'
      expect(jsonArg.message).toBe('Internal Server Error');
    });

    test('masks 500 boundary error in production (500 is server error)', () => {
      process.env.NODE_ENV = 'production';
      const err = new Error('Exact boundary error');
      err.statusCode = 500;
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      errorHandler(err, req, res, next);

      const jsonArg = res.json.mock.calls[0][0];
      // 500 >= 500 → isServerError is true → masked
      expect(jsonArg.message).toBe('Internal Server Error');
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
