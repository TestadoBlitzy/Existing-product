'use strict';

/**
 * Unit Tests — src/middleware/notFound.js (404 Catch-All Handler)
 *
 * Comprehensive tests for the notFound Express middleware that catches
 * unmatched routes, logs a warning via sanitizeLogInput, and returns a
 * 404 JSON response with the URL sanitized via sanitizeUrl.
 *
 * The middleware terminates the request/response cycle — it does NOT
 * call next(). Tests verify:
 *   - Correct 404 JSON response structure
 *   - URL sanitization in response body (HTML entity encoding via sanitizeUrl)
 *   - logger.warn() invocation with sanitizeLogInput-processed URL
 *   - Response termination (next() is never called)
 *   - Edge cases: empty URL, root URL, very long URL, malicious HTML URLs
 *
 * Coverage target: 100% line, branch, and function coverage for
 * src/middleware/notFound.js
 *
 * @module tests/middleware/notFound.test
 */

// ---------------------------------------------------------------------------
// CRITICAL: Logger mock MUST be declared BEFORE requiring any module that
// imports the logger. notFound.js line 27 executes
//   const logger = require('../utils/logger');
// at module load time. If we require notFound before mocking logger, the
// real Winston logger initializes and creates file transports to
// logs/combined.log and logs/error.log, causing unwanted filesystem I/O.
//
// jest.mock() is hoisted by Jest to the top of the file automatically,
// but we place it explicitly before our require() calls for clarity.
// ---------------------------------------------------------------------------
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
const notFound = require('../../src/middleware/notFound');
const logger = require('../../src/utils/logger');
const { createMockReq, createMockRes, createMockNext } = require('../helpers/setup');

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------
describe('notFound middleware', () => {
  // Reset all mock call history between tests to prevent assertion pollution.
  // Each test gets a clean slate for logger.warn() call counts and arguments.
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // 1. Standard 404 Response Tests
  // =========================================================================
  describe('404 response', () => {
    test('sets HTTP status code to 404', () => {
      const req = createMockReq({ originalUrl: '/nonexistent' });
      const res = createMockRes();
      const next = createMockNext();

      notFound(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('returns JSON with status "error"', () => {
      const req = createMockReq({ originalUrl: '/nonexistent' });
      const res = createMockRes();
      const next = createMockNext();

      notFound(req, res, next);

      const jsonArg = res.json.mock.calls[0][0];
      expect(jsonArg.status).toBe('error');
    });

    test('returns JSON with statusCode 404', () => {
      const req = createMockReq({ originalUrl: '/nonexistent' });
      const res = createMockRes();
      const next = createMockNext();

      notFound(req, res, next);

      const jsonArg = res.json.mock.calls[0][0];
      expect(jsonArg.statusCode).toBe(404);
    });

    test('returns JSON with message containing "Not Found"', () => {
      const req = createMockReq({ originalUrl: '/nonexistent' });
      const res = createMockRes();
      const next = createMockNext();

      notFound(req, res, next);

      const jsonArg = res.json.mock.calls[0][0];
      expect(jsonArg.message).toContain('Not Found');
    });

    test('response message includes the sanitized request URL', () => {
      const req = createMockReq({ originalUrl: '/nonexistent' });
      const res = createMockRes();
      const next = createMockNext();

      notFound(req, res, next);

      // For a simple URL like /nonexistent, sanitizeUrl returns it unchanged
      const jsonArg = res.json.mock.calls[0][0];
      expect(jsonArg.message).toBe('Not Found - /nonexistent');
    });

    test('returns complete JSON response structure matching API contract', () => {
      const req = createMockReq({ originalUrl: '/some/path' });
      const res = createMockRes();
      const next = createMockNext();

      notFound(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        statusCode: 404,
        message: 'Not Found - /some/path'
      });
    });

    test('chains res.status().json() correctly', () => {
      const req = createMockReq({ originalUrl: '/test' });
      const res = createMockRes();
      const next = createMockNext();

      notFound(req, res, next);

      // status() is called first, then json() is chained on the return value
      expect(res.status).toHaveBeenCalledTimes(1);
      expect(res.json).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // 2. URL Sanitization in Response Body Tests
  // =========================================================================
  describe('URL sanitization in response', () => {
    test('sanitizes HTML entities in URL for response body (XSS prevention)', () => {
      // sanitizeUrl encodes: < → &lt;  > → &gt;  " → &quot;  ' → &#x27;
      const req = createMockReq({ originalUrl: '/<script>alert("xss")</script>' });
      const res = createMockRes();
      const next = createMockNext();

      notFound(req, res, next);

      const jsonArg = res.json.mock.calls[0][0];
      // Raw HTML must NOT appear in the response message
      expect(jsonArg.message).not.toContain('<script>');
      expect(jsonArg.message).not.toContain('</script>');
      // Encoded HTML entities MUST appear
      expect(jsonArg.message).toContain('&lt;script&gt;');
      expect(jsonArg.message).toContain('&lt;/script&gt;');
    });

    test('encodes ampersand characters in URL', () => {
      const req = createMockReq({ originalUrl: '/search?a=1&b=2' });
      const res = createMockRes();
      const next = createMockNext();

      notFound(req, res, next);

      const jsonArg = res.json.mock.calls[0][0];
      // sanitizeUrl encodes & → &amp;
      expect(jsonArg.message).toContain('&amp;');
      expect(jsonArg.message).toBe('Not Found - /search?a=1&amp;b=2');
    });

    test('encodes single and double quotes in URL', () => {
      const req = createMockReq({ originalUrl: '/path?val="test"&other=\'ok\'' });
      const res = createMockRes();
      const next = createMockNext();

      notFound(req, res, next);

      const jsonArg = res.json.mock.calls[0][0];
      // " → &quot; and ' → &#x27;
      expect(jsonArg.message).toContain('&quot;');
      expect(jsonArg.message).toContain('&#x27;');
      expect(jsonArg.message).not.toMatch(/[^&]"/); // no raw double quotes (excluding &quot;)
    });

    test('sanitizes ANSI escape sequences from URL in response', () => {
      // ANSI escape: ESC[31m (red), ESC[0m (reset)
      const req = createMockReq({ originalUrl: '/path\x1b[31mred\x1b[0m' });
      const res = createMockRes();
      const next = createMockNext();

      notFound(req, res, next);

      const jsonArg = res.json.mock.calls[0][0];
      // ANSI escape sequences must be stripped
      expect(jsonArg.message).not.toContain('\x1b');
      expect(jsonArg.message).toContain('Not Found - /pathred');
    });

    test('strips control characters from URL in response', () => {
      const req = createMockReq({ originalUrl: '/path\nwith\rnewlines\ttabs' });
      const res = createMockRes();
      const next = createMockNext();

      notFound(req, res, next);

      const jsonArg = res.json.mock.calls[0][0];
      // Control characters (\n, \r, \t) must be stripped
      expect(jsonArg.message).not.toContain('\n');
      expect(jsonArg.message).not.toContain('\r');
      expect(jsonArg.message).not.toContain('\t');
      expect(jsonArg.message).toBe('Not Found - /pathwithnewlinestabs');
    });

    test('handles URL with mixed ANSI, control characters, and HTML entities', () => {
      const req = createMockReq({
        originalUrl: '/path\x1b[31m<script>\nalert("xss")\r</script>\x1b[0m'
      });
      const res = createMockRes();
      const next = createMockNext();

      notFound(req, res, next);

      const jsonArg = res.json.mock.calls[0][0];
      // ANSI sequences and control characters stripped, HTML entities encoded
      expect(jsonArg.message).not.toContain('\x1b');
      expect(jsonArg.message).not.toContain('\n');
      expect(jsonArg.message).not.toContain('\r');
      expect(jsonArg.message).not.toContain('<script>');
      expect(jsonArg.message).toContain('&lt;script&gt;');
    });
  });

  // =========================================================================
  // 3. Logger Warning Invocation Tests
  // =========================================================================
  describe('logger.warn() invocation', () => {
    test('calls logger.warn exactly once', () => {
      const req = createMockReq({ originalUrl: '/missing-page' });
      const res = createMockRes();
      const next = createMockNext();

      notFound(req, res, next);

      expect(logger.warn).toHaveBeenCalledTimes(1);
    });

    test('log message includes "404 - Not Found" prefix', () => {
      const req = createMockReq({ originalUrl: '/missing-page' });
      const res = createMockRes();
      const next = createMockNext();

      notFound(req, res, next);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('404 - Not Found')
      );
    });

    test('log message contains the request URL path', () => {
      const req = createMockReq({ originalUrl: '/api/v2/unknown' });
      const res = createMockRes();
      const next = createMockNext();

      notFound(req, res, next);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('/api/v2/unknown')
      );
    });

    test('log message uses sanitizeLogInput which does NOT HTML-encode', () => {
      // CRITICAL DISTINCTION: The log message uses sanitizeLogInput (strips
      // control chars and ANSI, but does NOT encode HTML entities).
      // The response message uses sanitizeUrl (strips + HTML-encodes).
      const req = createMockReq({ originalUrl: '/<b>bold</b>' });
      const res = createMockRes();
      const next = createMockNext();

      notFound(req, res, next);

      const logArg = logger.warn.mock.calls[0][0];
      // Log message should contain raw HTML tags (sanitizeLogInput does not encode)
      expect(logArg).toContain('<b>bold</b>');
      expect(logArg).toBe('404 - Not Found - /<b>bold</b>');

      // Response message should contain HTML-encoded tags (sanitizeUrl encodes)
      const jsonArg = res.json.mock.calls[0][0];
      expect(jsonArg.message).toContain('&lt;b&gt;bold&lt;/b&gt;');
      expect(jsonArg.message).not.toContain('<b>');
    });

    test('log message strips ANSI escape sequences via sanitizeLogInput', () => {
      const req = createMockReq({ originalUrl: '/path\x1b[31mred\x1b[0m' });
      const res = createMockRes();
      const next = createMockNext();

      notFound(req, res, next);

      const logArg = logger.warn.mock.calls[0][0];
      expect(logArg).not.toContain('\x1b');
      expect(logArg).toBe('404 - Not Found - /pathred');
    });

    test('log message strips control characters via sanitizeLogInput', () => {
      const req = createMockReq({ originalUrl: '/inject\nfake-log-line\rmore' });
      const res = createMockRes();
      const next = createMockNext();

      notFound(req, res, next);

      const logArg = logger.warn.mock.calls[0][0];
      expect(logArg).not.toContain('\n');
      expect(logArg).not.toContain('\r');
      expect(logArg).toBe('404 - Not Found - /injectfake-log-linemore');
    });

    test('log message format is "404 - Not Found - <sanitized-url>"', () => {
      const req = createMockReq({ originalUrl: '/exact/format/check' });
      const res = createMockRes();
      const next = createMockNext();

      notFound(req, res, next);

      expect(logger.warn).toHaveBeenCalledWith(
        '404 - Not Found - /exact/format/check'
      );
    });
  });

  // =========================================================================
  // 4. Response Termination Tests (next() NOT called)
  // =========================================================================
  describe('response termination', () => {
    test('does NOT call next() — terminates the request/response cycle', () => {
      const req = createMockReq({ originalUrl: '/nonexistent' });
      const res = createMockRes();
      const next = createMockNext();

      notFound(req, res, next);

      expect(next).not.toHaveBeenCalled();
    });

    test('calls res.status() exactly once', () => {
      const req = createMockReq({ originalUrl: '/nonexistent' });
      const res = createMockRes();
      const next = createMockNext();

      notFound(req, res, next);

      expect(res.status).toHaveBeenCalledTimes(1);
    });

    test('calls res.json() exactly once', () => {
      const req = createMockReq({ originalUrl: '/nonexistent' });
      const res = createMockRes();
      const next = createMockNext();

      notFound(req, res, next);

      expect(res.json).toHaveBeenCalledTimes(1);
    });

    test('does not call any other response methods (e.g., res.set)', () => {
      const req = createMockReq({ originalUrl: '/nonexistent' });
      const res = createMockRes();
      const next = createMockNext();

      notFound(req, res, next);

      // res.set should never be called by the notFound handler
      expect(res.set).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 5. Edge Case Tests
  // =========================================================================
  describe('edge cases', () => {
    test('handles empty originalUrl', () => {
      const req = createMockReq({ originalUrl: '' });
      const res = createMockRes();
      const next = createMockNext();

      notFound(req, res, next);

      const jsonArg = res.json.mock.calls[0][0];
      expect(jsonArg).toEqual({
        status: 'error',
        statusCode: 404,
        message: 'Not Found - '
      });
      expect(logger.warn).toHaveBeenCalledWith('404 - Not Found - ');
    });

    test('handles root URL "/"', () => {
      const req = createMockReq({ originalUrl: '/' });
      const res = createMockRes();
      const next = createMockNext();

      notFound(req, res, next);

      const jsonArg = res.json.mock.calls[0][0];
      expect(jsonArg).toEqual({
        status: 'error',
        statusCode: 404,
        message: 'Not Found - /'
      });
      expect(logger.warn).toHaveBeenCalledWith('404 - Not Found - /');
    });

    test('handles very long URL — truncated at MAX_URL_LENGTH (2048) in response', () => {
      // Create a URL longer than MAX_URL_LENGTH (2048)
      const longUrl = '/' + 'x'.repeat(3000);
      const req = createMockReq({ originalUrl: longUrl });
      const res = createMockRes();
      const next = createMockNext();

      notFound(req, res, next);

      const jsonArg = res.json.mock.calls[0][0];
      // sanitizeUrl truncates at 2048 chars and appends '...[truncated]'
      expect(jsonArg.message).toContain('...[truncated]');
      // The message prefix is 'Not Found - ' (12 chars) + truncated URL
      // The URL portion itself should be 2048 chars + '...[truncated]'
      const urlPortion = jsonArg.message.replace('Not Found - ', '');
      expect(urlPortion).toBe('/' + 'x'.repeat(2047) + '...[truncated]');
    });

    test('handles very long URL — truncated at MAX_LOG_LENGTH (1000) in log', () => {
      // Create a URL longer than MAX_LOG_LENGTH (1000)
      const longUrl = '/' + 'x'.repeat(2000);
      const req = createMockReq({ originalUrl: longUrl });
      const res = createMockRes();
      const next = createMockNext();

      notFound(req, res, next);

      const logArg = logger.warn.mock.calls[0][0];
      // The log prefix is '404 - Not Found - ' (18 chars) + sanitizeLogInput(url)
      // sanitizeLogInput truncates the URL at 1000 chars + '...[truncated]'
      expect(logArg).toContain('...[truncated]');
      // Extract just the URL portion from the log message
      const urlInLog = logArg.replace('404 - Not Found - ', '');
      expect(urlInLog).toBe('/' + 'x'.repeat(999) + '...[truncated]');
    });

    test('handles URL at exactly MAX_URL_LENGTH (2048) — no truncation in response', () => {
      // Create URL of exactly MAX_URL_LENGTH
      const exactUrl = '/' + 'x'.repeat(2047); // 2048 chars total
      const req = createMockReq({ originalUrl: exactUrl });
      const res = createMockRes();
      const next = createMockNext();

      notFound(req, res, next);

      const jsonArg = res.json.mock.calls[0][0];
      // Should NOT be truncated — exactly at the boundary
      expect(jsonArg.message).not.toContain('...[truncated]');
      expect(jsonArg.message).toBe('Not Found - ' + exactUrl);
    });

    test('handles URL at exactly MAX_LOG_LENGTH (1000) — no truncation in log', () => {
      // Create URL of exactly MAX_LOG_LENGTH
      const exactUrl = '/' + 'x'.repeat(999); // 1000 chars total
      const req = createMockReq({ originalUrl: exactUrl });
      const res = createMockRes();
      const next = createMockNext();

      notFound(req, res, next);

      const logArg = logger.warn.mock.calls[0][0];
      // URL portion should NOT be truncated
      expect(logArg).not.toContain('...[truncated]');
      expect(logArg).toBe('404 - Not Found - ' + exactUrl);
    });

    test('handles URL with query string parameters', () => {
      const req = createMockReq({ originalUrl: '/api/users?page=1&limit=10' });
      const res = createMockRes();
      const next = createMockNext();

      notFound(req, res, next);

      const jsonArg = res.json.mock.calls[0][0];
      expect(res.status).toHaveBeenCalledWith(404);
      // sanitizeUrl encodes & → &amp;
      expect(jsonArg.message).toBe('Not Found - /api/users?page=1&amp;limit=10');
    });

    test('handles URL with special characters preserved correctly', () => {
      const req = createMockReq({ originalUrl: '/api/items/123/details' });
      const res = createMockRes();
      const next = createMockNext();

      notFound(req, res, next);

      const jsonArg = res.json.mock.calls[0][0];
      expect(jsonArg.message).toBe('Not Found - /api/items/123/details');
    });

    test('handles URL with null byte injection attempt', () => {
      const req = createMockReq({ originalUrl: '/path\x00with\x00nulls' });
      const res = createMockRes();
      const next = createMockNext();

      notFound(req, res, next);

      const jsonArg = res.json.mock.calls[0][0];
      // Null bytes are control characters and get stripped
      expect(jsonArg.message).not.toContain('\x00');
      expect(jsonArg.message).toBe('Not Found - /pathwithnulls');
    });
  });
});
