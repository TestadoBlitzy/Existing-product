'use strict';

/**
 * Unit Tests for validateInput Middleware Factory
 *
 * Comprehensive tests for the Zod-based validation middleware factory
 * exported from src/middleware/validateInput.js. Tests cover:
 * - z (Zod) re-export verification
 * - Empty schemas pass-through behavior
 * - Null/undefined schema value skipping
 * - Valid input pass-through to next()
 * - Validation failure with 400 response for unexpected query parameters
 * - Validation failure with 400 response for unexpected body properties
 * - Dot-notation field path formatting in error messages
 * - Fail-fast semantics (stops at first failing schema segment)
 * - Multiple errors within a single segment joined with semicolons
 *
 * NO logger mock is needed — validateInput.js has zero logger dependency.
 * All mock objects are created fresh per-test via helpers/setup.js factories.
 *
 * Target: 100% line, branch, and function coverage for src/middleware/validateInput.js
 *
 * @module tests/middleware/validateInput.test
 */

const { validateInput, z } = require('../../src/middleware/validateInput');
const { createMockReq, createMockRes, createMockNext } = require('../helpers/setup');

describe('validateInput middleware', () => {
  // -------------------------------------------------------------------------
  // z re-export tests
  // -------------------------------------------------------------------------
  describe('z re-export', () => {
    test('exports z as a valid Zod instance', () => {
      expect(z).toBeDefined();
      expect(z).not.toBeNull();
    });

    test('z.object is a function', () => {
      expect(typeof z.object).toBe('function');
    });

    test('z.string is a function', () => {
      expect(typeof z.string).toBe('function');
    });

    test('z.number is a function', () => {
      expect(typeof z.number).toBe('function');
    });
  });

  // -------------------------------------------------------------------------
  // Empty schemas pass-through tests
  // -------------------------------------------------------------------------
  describe('empty schemas', () => {
    test('calls next() when schemas object is empty {}', () => {
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      const middleware = validateInput({});
      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    test('calls next() when schemas is undefined (default parameter)', () => {
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      const middleware = validateInput();
      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Null/undefined schema value skip tests
  // -------------------------------------------------------------------------
  describe('null schema values', () => {
    test('skips null schema value and calls next()', () => {
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      const middleware = validateInput({ body: null });
      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    test('skips undefined schema value and calls next()', () => {
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      const middleware = validateInput({ query: undefined });
      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    test('skips null schema and validates remaining valid schemas', () => {
      const req = createMockReq({ query: {} });
      const res = createMockRes();
      const next = createMockNext();

      // body is null (skipped), query has a valid strict schema
      const middleware = validateInput({
        body: null,
        query: z.object({}).strict()
      });
      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Valid input pass-through tests
  // -------------------------------------------------------------------------
  describe('valid input', () => {
    test('calls next() when body matches strict empty schema', () => {
      const req = createMockReq({ body: {} });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = validateInput({
        body: z.object({}).strict()
      });
      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    test('calls next() when query matches strict empty schema', () => {
      const req = createMockReq({ query: {} });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = validateInput({
        query: z.object({}).strict()
      });
      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    test('calls next() when params schema validates successfully', () => {
      const req = createMockReq({ params: { id: '123' } });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = validateInput({
        params: z.object({ id: z.string() })
      });
      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    test('calls next() when both body and query schemas pass', () => {
      const req = createMockReq({ body: {}, query: {} });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = validateInput({
        body: z.object({}).strict(),
        query: z.object({}).strict()
      });
      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    test('calls next() when body schema uses optional() and body is undefined', () => {
      const req = createMockReq({ body: undefined });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = validateInput({
        body: z.object({}).strict().optional()
      });
      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Validation failure — unexpected query parameter tests
  // -------------------------------------------------------------------------
  describe('validation failure - query', () => {
    test('returns 400 when unexpected query parameter is present', () => {
      const req = createMockReq({ query: { unexpected: 'param' } });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = validateInput({
        query: z.object({}).strict()
      });
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });

    test('400 response has correct error JSON structure', () => {
      const req = createMockReq({ query: { unexpected: 'param' } });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = validateInput({
        query: z.object({}).strict()
      });
      middleware(req, res, next);

      expect(res.json).toHaveBeenCalledTimes(1);
      const jsonPayload = res.json.mock.calls[0][0];
      expect(jsonPayload).toEqual(expect.objectContaining({
        status: 'error',
        statusCode: 400
      }));
      expect(jsonPayload).toHaveProperty('message');
      expect(typeof jsonPayload.message).toBe('string');
    });

    test('error message includes "Validation failed" prefix', () => {
      const req = createMockReq({ query: { unexpected: 'param' } });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = validateInput({
        query: z.object({}).strict()
      });
      middleware(req, res, next);

      const jsonPayload = res.json.mock.calls[0][0];
      expect(jsonPayload.message).toEqual(expect.stringContaining('Validation failed'));
    });

    test('error message includes "query" prefix for query schema failures', () => {
      const req = createMockReq({ query: { unexpected: 'param' } });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = validateInput({
        query: z.object({}).strict()
      });
      middleware(req, res, next);

      const jsonPayload = res.json.mock.calls[0][0];
      expect(jsonPayload.message).toEqual(expect.stringContaining('query'));
    });

    test('error message includes "Unrecognized key" for strict schema violations', () => {
      const req = createMockReq({ query: { unexpected: 'param' } });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = validateInput({
        query: z.object({}).strict()
      });
      middleware(req, res, next);

      const jsonPayload = res.json.mock.calls[0][0];
      // Zod strict() produces "Unrecognized key(s) in object: 'unexpected'"
      expect(jsonPayload.message).toEqual(expect.stringContaining('Unrecognized key'));
    });
  });

  // -------------------------------------------------------------------------
  // Validation failure — unexpected body property tests
  // -------------------------------------------------------------------------
  describe('validation failure - body', () => {
    test('returns 400 when unexpected body property is present', () => {
      const req = createMockReq({ body: { malicious: 'data' } });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = validateInput({
        body: z.object({}).strict()
      });
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledTimes(1);
      expect(next).not.toHaveBeenCalled();
    });

    test('error message includes "body" prefix for body schema failures', () => {
      const req = createMockReq({ body: { malicious: 'data' } });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = validateInput({
        body: z.object({}).strict()
      });
      middleware(req, res, next);

      const jsonPayload = res.json.mock.calls[0][0];
      expect(jsonPayload.message).toEqual(expect.stringContaining('Validation failed'));
      expect(jsonPayload.message).toEqual(expect.stringContaining('body'));
    });

    test('400 response for body failure has correct structure', () => {
      const req = createMockReq({ body: { extra: 'field' } });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = validateInput({
        body: z.object({}).strict()
      });
      middleware(req, res, next);

      const jsonPayload = res.json.mock.calls[0][0];
      expect(jsonPayload).toEqual(expect.objectContaining({
        status: 'error',
        statusCode: 400
      }));
    });
  });

  // -------------------------------------------------------------------------
  // Dot-notation field path in error message tests
  // -------------------------------------------------------------------------
  describe('dot-notation field path in error message', () => {
    test('includes field name in dot-notation path for typed schema violations', () => {
      const req = createMockReq({ query: { name: 123 } });
      const res = createMockRes();
      const next = createMockNext();

      // Schema expects name to be a string, but we pass a number
      const middleware = validateInput({
        query: z.object({ name: z.string() }).strict()
      });
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();

      const jsonPayload = res.json.mock.calls[0][0];
      // Error should include dot-notation path: "query.name"
      expect(jsonPayload.message).toEqual(expect.stringContaining('query.name'));
    });

    test('includes nested dot-notation path for nested object violations', () => {
      const req = createMockReq({
        body: { user: { age: 'not-a-number' } }
      });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = validateInput({
        body: z.object({
          user: z.object({
            age: z.number()
          })
        })
      });
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      const jsonPayload = res.json.mock.calls[0][0];
      // Error path should include nested path: "body.user.age"
      expect(jsonPayload.message).toEqual(expect.stringContaining('body.user.age'));
    });

    test('includes params prefix in dot-notation for params schema violations', () => {
      const req = createMockReq({ params: { id: 123 } });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = validateInput({
        params: z.object({ id: z.string() })
      });
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      const jsonPayload = res.json.mock.calls[0][0];
      expect(jsonPayload.message).toEqual(expect.stringContaining('params.id'));
    });
  });

  // -------------------------------------------------------------------------
  // Fail-fast behavior tests
  // -------------------------------------------------------------------------
  describe('fail-fast behavior', () => {
    test('stops at first invalid schema segment and does not check remaining', () => {
      const req = createMockReq({
        body: { extra: 'data' },
        query: { also_extra: 'data' }
      });
      const res = createMockRes();
      const next = createMockNext();

      // Both body and query schemas will fail, but fail-fast should stop at body
      const middleware = validateInput({
        body: z.object({}).strict(),
        query: z.object({}).strict()
      });
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.status).toHaveBeenCalledTimes(1);
      expect(res.json).toHaveBeenCalledTimes(1);
      expect(next).not.toHaveBeenCalled();

      // Only the first failing segment (body) should appear in the error message
      const jsonPayload = res.json.mock.calls[0][0];
      expect(jsonPayload.message).toEqual(expect.stringContaining('body'));
    });

    test('returns immediately without processing subsequent schemas', () => {
      const req = createMockReq({
        body: { unexpected: 'value' },
        query: {}
      });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = validateInput({
        body: z.object({}).strict(),
        query: z.object({}).strict()
      });
      middleware(req, res, next);

      // Should have returned after body validation failure
      expect(res.status).toHaveBeenCalledTimes(1);
      expect(res.json).toHaveBeenCalledTimes(1);
      expect(next).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Multiple errors in single segment tests
  // -------------------------------------------------------------------------
  describe('multiple errors in single segment', () => {
    test('joins multiple validation errors with semicolons', () => {
      const req = createMockReq({
        query: { foo: 123, bar: 'not-a-number' }
      });
      const res = createMockRes();
      const next = createMockNext();

      // Schema expects foo as string and bar as number — both will fail
      const middleware = validateInput({
        query: z.object({ foo: z.string(), bar: z.number() })
      });
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();

      const jsonPayload = res.json.mock.calls[0][0];
      // Multiple errors should be joined with '; '
      expect(jsonPayload.message).toEqual(expect.stringContaining('; '));
      // Both field paths should appear
      expect(jsonPayload.message).toEqual(expect.stringContaining('query.foo'));
      expect(jsonPayload.message).toEqual(expect.stringContaining('query.bar'));
    });

    test('each error in multi-error includes its own dot-notation path', () => {
      const req = createMockReq({
        body: { name: 42, email: true }
      });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = validateInput({
        body: z.object({ name: z.string(), email: z.string() })
      });
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);

      const jsonPayload = res.json.mock.calls[0][0];
      expect(jsonPayload.message).toEqual(expect.stringContaining('body.name'));
      expect(jsonPayload.message).toEqual(expect.stringContaining('body.email'));
      expect(jsonPayload.message).toEqual(expect.stringContaining('; '));
    });
  });

  // -------------------------------------------------------------------------
  // validateInput return value tests
  // -------------------------------------------------------------------------
  describe('return value', () => {
    test('validateInput returns a function (middleware)', () => {
      const middleware = validateInput({});
      expect(typeof middleware).toBe('function');
    });

    test('returned middleware has arity of 3 (req, res, next)', () => {
      const middleware = validateInput({});
      expect(middleware.length).toBe(3);
    });
  });
});
