'use strict';

/**
 * Logger Module Shape Verification Tests
 *
 * Lightweight unit tests for src/utils/logger.js that verify the exported
 * module shape — the logger object has the expected methods, the stream
 * adapter exists and functions correctly, and the Morgan-compatible
 * stream.write() method correctly trims trailing newlines before delegating
 * to logger.http().
 *
 * This is NOT a comprehensive Winston internals test. It verifies:
 * 1. The exported logger has standard logging methods (info, warn, error, http)
 * 2. The logger.stream property exists with a write() method
 * 3. stream.write() delegates to logger.http() with trimmed messages
 *
 * Winston is mocked via jest.mock() to prevent real file I/O from file
 * transports (logs/combined.log, logs/error.log) during test execution.
 *
 * @module tests/utils/logger.test
 */

// ---------------------------------------------------------------------------
// Winston Mock — Prevents file transport I/O during testing
// ---------------------------------------------------------------------------
// The logger module has SIDE EFFECTS on import: it requires winston, calls
// winston.createLogger() with file transports that write to logs/combined.log
// and logs/error.log. By mocking winston, we intercept createLogger() to
// return a controllable mock logger object, preventing all file I/O while
// still allowing the module's own logic (stream adapter attachment, export)
// to execute normally.
// ---------------------------------------------------------------------------

jest.mock('winston', () => {
  // Mock logger instance returned by createLogger — all methods are jest.fn()
  // so we can assert on calls (especially logger.http via stream.write)
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    http: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
    silly: jest.fn(),
  };

  // Mock format methods called during logger creation (lines 45-48, 86-88)
  const mockFormat = {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    json: jest.fn(),
    colorize: jest.fn(),
    simple: jest.fn(),
  };

  return {
    format: mockFormat,
    transports: {
      File: jest.fn(),    // Constructor called with `new` at lines 63, 74
      Console: jest.fn(), // Constructor called with `new` at line 85
    },
    createLogger: jest.fn(() => mockLogger),
  };
});

// Import the logger module AFTER jest.mock() is in place — Jest hoists
// jest.mock() calls above imports, so winston is already mocked when
// the logger module executes its initialization code.
const logger = require('../../src/utils/logger');
const winston = require('winston');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('logger', () => {

  // -------------------------------------------------------------------------
  // Module Initialization Verification
  // -------------------------------------------------------------------------

  describe('module initialization', () => {
    test('calls winston.createLogger during module initialization', () => {
      expect(winston.createLogger).toHaveBeenCalled();
    });

    test('passes configuration object to createLogger', () => {
      expect(winston.createLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          level: expect.any(String),
          defaultMeta: expect.objectContaining({ service: 'hello-world' }),
        })
      );
    });
  });

  // -------------------------------------------------------------------------
  // Exported Logger Instance Shape
  // -------------------------------------------------------------------------

  describe('exported logger instance', () => {
    test('exports an object (not null or undefined)', () => {
      expect(logger).toBeDefined();
      expect(logger).not.toBeNull();
      expect(typeof logger).toBe('object');
    });

    test('has info method', () => {
      expect(typeof logger.info).toBe('function');
    });

    test('has warn method', () => {
      expect(typeof logger.warn).toBe('function');
    });

    test('has error method', () => {
      expect(typeof logger.error).toBe('function');
    });

    test('has http method', () => {
      expect(typeof logger.http).toBe('function');
    });

    test('has debug method', () => {
      expect(typeof logger.debug).toBe('function');
    });

    test('info method is callable without throwing', () => {
      expect(() => logger.info('test message')).not.toThrow();
    });

    test('warn method is callable without throwing', () => {
      expect(() => logger.warn('test warning')).not.toThrow();
    });

    test('error method is callable without throwing', () => {
      expect(() => logger.error('test error')).not.toThrow();
    });

    test('http method is callable without throwing', () => {
      expect(() => logger.http('test http')).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // Stream Adapter — Morgan Integration
  // -------------------------------------------------------------------------

  describe('logger.stream', () => {
    // Clear logger.http mock before each stream test to ensure accurate
    // call count and argument assertions per test case.
    beforeEach(() => {
      logger.http.mockClear();
    });

    test('has a stream property', () => {
      expect(logger).toHaveProperty('stream');
    });

    test('stream is an object', () => {
      expect(typeof logger.stream).toBe('object');
      expect(logger.stream).not.toBeNull();
    });

    test('stream has a write method', () => {
      expect(logger.stream).toHaveProperty('write');
    });

    test('stream.write is a function', () => {
      expect(typeof logger.stream.write).toBe('function');
    });

    test('stream.write calls logger.http with trimmed message', () => {
      logger.stream.write('GET / 200 5ms\n');
      expect(logger.http).toHaveBeenCalledTimes(1);
      expect(logger.http).toHaveBeenCalledWith('GET / 200 5ms');
    });

    test('stream.write trims trailing newline from message', () => {
      logger.stream.write('GET /api 200 3.456ms\n');
      expect(logger.http).toHaveBeenCalledWith('GET /api 200 3.456ms');
    });

    test('stream.write trims trailing \\r\\n (CRLF) from message', () => {
      logger.stream.write('POST /data 201 12ms\r\n');
      expect(logger.http).toHaveBeenCalledWith('POST /data 201 12ms');
    });

    test('stream.write handles message without trailing newline', () => {
      logger.stream.write('no trailing newline');
      expect(logger.http).toHaveBeenCalledWith('no trailing newline');
    });

    test('stream.write trims leading and trailing whitespace', () => {
      // JavaScript String.trim() removes all leading and trailing whitespace,
      // not just newlines — this is the actual behavior of the stream adapter
      logger.stream.write('  padded message  ');
      expect(logger.http).toHaveBeenCalledWith('padded message');
    });

    test('stream.write handles empty string', () => {
      logger.stream.write('');
      expect(logger.http).toHaveBeenCalledWith('');
    });

    test('stream.write handles string with only whitespace', () => {
      logger.stream.write('   \n\r\n  ');
      expect(logger.http).toHaveBeenCalledWith('');
    });

    test('stream.write delegates exactly one call to logger.http per write', () => {
      logger.stream.write('first message\n');
      logger.stream.write('second message\n');
      expect(logger.http).toHaveBeenCalledTimes(2);
      expect(logger.http).toHaveBeenNthCalledWith(1, 'first message');
      expect(logger.http).toHaveBeenNthCalledWith(2, 'second message');
    });

    test('stream.write handles typical Morgan combined format output', () => {
      const morganOutput = '::1 - - [25/Mar/2026:12:00:00 +0000] "GET / HTTP/1.1" 200 45\n';
      logger.stream.write(morganOutput);
      expect(logger.http).toHaveBeenCalledWith(
        '::1 - - [25/Mar/2026:12:00:00 +0000] "GET / HTTP/1.1" 200 45'
      );
    });
  });

  // -------------------------------------------------------------------------
  // Destructured Import Compatibility
  // -------------------------------------------------------------------------

  describe('destructured import compatibility', () => {
    test('logger.stream is accessible via destructuring', () => {
      // Verify the pattern documented at line 126 of src/utils/logger.js:
      //   const { stream } = require('./utils/logger');
      const { stream } = logger;
      expect(stream).toBeDefined();
      expect(typeof stream.write).toBe('function');
    });
  });
});
