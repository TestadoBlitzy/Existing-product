'use strict';

/**
 * Configuration Module Unit Tests
 *
 * Comprehensive tests for src/config/index.js verifying:
 * - Default value assignment when environment variables are absent
 * - Custom override parsing from environment variables
 * - parseIntSafe() edge cases (valid 0, NaN fallback, empty string, whitespace, decimals)
 * - Object.freeze() immutability enforcement on root and nested rateLimit object
 * - Exported config shape and type correctness
 *
 * CRITICAL PATTERN: The config module reads process.env at CommonJS require() time.
 * Each test case MUST:
 *   1. Back up process.env via backupEnv()
 *   2. Clear the require cache via jest.resetModules()
 *   3. Set desired env vars BEFORE calling require('../../src/config')
 *   4. Restore process.env via restoreEnv() in afterEach
 *
 * No logger mock is needed — the config module does NOT import the logger.
 *
 * Coverage Target: 100% line, branch, and function coverage for src/config/index.js.
 *
 * @module tests/config/index.test
 */

const { backupEnv, restoreEnv } = require('../helpers/setup');

let envBackup;

beforeEach(() => {
  envBackup = backupEnv();
  jest.resetModules();
});

afterEach(() => {
  restoreEnv(envBackup);
});

describe('config', () => {
  // ---------------------------------------------------------------------------
  // Default Values
  // ---------------------------------------------------------------------------
  describe('default values', () => {
    test('env defaults to "development" when NODE_ENV is not set', () => {
      delete process.env.NODE_ENV;
      const config = require('../../src/config');
      expect(config.env).toBe('development');
    });

    test('port defaults to 3000 when PORT is not set', () => {
      delete process.env.PORT;
      const config = require('../../src/config');
      expect(config.port).toBe(3000);
    });

    test('host defaults to "0.0.0.0" when HOST is not set', () => {
      delete process.env.HOST;
      const config = require('../../src/config');
      expect(config.host).toBe('0.0.0.0');
    });

    test('logLevel defaults to "debug" when LOG_LEVEL is not set', () => {
      delete process.env.LOG_LEVEL;
      const config = require('../../src/config');
      expect(config.logLevel).toBe('debug');
    });

    test('corsOrigin defaults to "*" when CORS_ORIGIN is not set', () => {
      delete process.env.CORS_ORIGIN;
      const config = require('../../src/config');
      expect(config.corsOrigin).toBe('*');
    });

    test('bodyLimit defaults to "10kb" when BODY_LIMIT is not set', () => {
      delete process.env.BODY_LIMIT;
      const config = require('../../src/config');
      expect(config.bodyLimit).toBe('10kb');
    });

    test('rateLimit.windowMs defaults to 900000 when RATE_LIMIT_WINDOW_MS is not set', () => {
      delete process.env.RATE_LIMIT_WINDOW_MS;
      const config = require('../../src/config');
      expect(config.rateLimit.windowMs).toBe(900000);
    });

    test('rateLimit.max defaults to 100 when RATE_LIMIT_MAX is not set', () => {
      delete process.env.RATE_LIMIT_MAX;
      const config = require('../../src/config');
      expect(config.rateLimit.max).toBe(100);
    });
  });

  // ---------------------------------------------------------------------------
  // Custom Overrides
  // ---------------------------------------------------------------------------
  describe('custom overrides', () => {
    test('env reads from NODE_ENV', () => {
      process.env.NODE_ENV = 'production';
      const config = require('../../src/config');
      expect(config.env).toBe('production');
    });

    test('port reads from PORT and parses as integer', () => {
      process.env.PORT = '8080';
      const config = require('../../src/config');
      expect(config.port).toBe(8080);
      expect(typeof config.port).toBe('number');
    });

    test('host reads from HOST', () => {
      process.env.HOST = '127.0.0.1';
      const config = require('../../src/config');
      expect(config.host).toBe('127.0.0.1');
    });

    test('logLevel reads from LOG_LEVEL', () => {
      process.env.LOG_LEVEL = 'info';
      const config = require('../../src/config');
      expect(config.logLevel).toBe('info');
    });

    test('corsOrigin reads from CORS_ORIGIN', () => {
      process.env.CORS_ORIGIN = 'https://example.com';
      const config = require('../../src/config');
      expect(config.corsOrigin).toBe('https://example.com');
    });

    test('bodyLimit reads from BODY_LIMIT', () => {
      process.env.BODY_LIMIT = '50kb';
      const config = require('../../src/config');
      expect(config.bodyLimit).toBe('50kb');
    });

    test('rateLimit.windowMs reads from RATE_LIMIT_WINDOW_MS and parses as integer', () => {
      process.env.RATE_LIMIT_WINDOW_MS = '60000';
      const config = require('../../src/config');
      expect(config.rateLimit.windowMs).toBe(60000);
      expect(typeof config.rateLimit.windowMs).toBe('number');
    });

    test('rateLimit.max reads from RATE_LIMIT_MAX and parses as integer', () => {
      process.env.RATE_LIMIT_MAX = '50';
      const config = require('../../src/config');
      expect(config.rateLimit.max).toBe(50);
      expect(typeof config.rateLimit.max).toBe('number');
    });
  });

  // ---------------------------------------------------------------------------
  // parseIntSafe Edge Cases
  // ---------------------------------------------------------------------------
  describe('parseIntSafe edge cases', () => {
    test('PORT=0 is preserved as 0 (not treated as falsy)', () => {
      process.env.PORT = '0';
      const config = require('../../src/config');
      // This is the CORE edge case parseIntSafe was designed to handle:
      // parseInt('0', 10) → 0, Number.isNaN(0) → false, so 0 is returned (NOT fallback 3000)
      expect(config.port).toBe(0);
    });

    test('PORT=abc falls back to default 3000', () => {
      process.env.PORT = 'abc';
      const config = require('../../src/config');
      // parseInt('abc', 10) → NaN → fallback 3000
      expect(config.port).toBe(3000);
    });

    test('PORT="" (empty string) falls back to default 3000', () => {
      process.env.PORT = '';
      const config = require('../../src/config');
      // parseInt('', 10) → NaN → fallback 3000
      expect(config.port).toBe(3000);
    });

    test('RATE_LIMIT_MAX=0 is preserved as 0', () => {
      process.env.RATE_LIMIT_MAX = '0';
      const config = require('../../src/config');
      expect(config.rateLimit.max).toBe(0);
    });

    test('RATE_LIMIT_MAX=abc falls back to default 100', () => {
      process.env.RATE_LIMIT_MAX = 'abc';
      const config = require('../../src/config');
      expect(config.rateLimit.max).toBe(100);
    });

    test('RATE_LIMIT_WINDOW_MS=0 is preserved as 0', () => {
      process.env.RATE_LIMIT_WINDOW_MS = '0';
      const config = require('../../src/config');
      expect(config.rateLimit.windowMs).toBe(0);
    });

    test('RATE_LIMIT_WINDOW_MS=abc falls back to default 900000', () => {
      process.env.RATE_LIMIT_WINDOW_MS = 'abc';
      const config = require('../../src/config');
      expect(config.rateLimit.windowMs).toBe(900000);
    });

    test('PORT with leading/trailing whitespace is parsed correctly by parseInt', () => {
      process.env.PORT = ' 8080 ';
      const config = require('../../src/config');
      // parseInt(' 8080 ', 10) → 8080 (parseInt skips leading whitespace)
      expect(config.port).toBe(8080);
    });

    test('PORT=3.14 parses as integer 3 (parseInt truncates decimal)', () => {
      process.env.PORT = '3.14';
      const config = require('../../src/config');
      // parseInt('3.14', 10) → 3 (stops at non-digit decimal point)
      expect(config.port).toBe(3);
    });
  });

  // ---------------------------------------------------------------------------
  // Object.freeze Immutability
  // ---------------------------------------------------------------------------
  describe('Object.freeze immutability', () => {
    test('root config object is frozen', () => {
      const config = require('../../src/config');
      expect(Object.isFrozen(config)).toBe(true);
    });

    test('attempting to set config.port throws in strict mode', () => {
      const config = require('../../src/config');
      // In strict mode, assigning to a frozen object property throws TypeError
      expect(() => {
        config.port = 9999;
      }).toThrow(TypeError);
    });

    test('attempting to add new property to config throws in strict mode', () => {
      const config = require('../../src/config');
      expect(() => {
        config.newProperty = 'test';
      }).toThrow(TypeError);
    });

    test('attempting to delete config.port throws in strict mode', () => {
      const config = require('../../src/config');
      expect(() => {
        delete config.port;
      }).toThrow(TypeError);
    });

    test('nested rateLimit object is frozen', () => {
      const config = require('../../src/config');
      expect(Object.isFrozen(config.rateLimit)).toBe(true);
    });

    test('attempting to set config.rateLimit.max throws in strict mode', () => {
      const config = require('../../src/config');
      expect(() => {
        config.rateLimit.max = 999;
      }).toThrow(TypeError);
    });

    test('attempting to add new property to config.rateLimit throws in strict mode', () => {
      const config = require('../../src/config');
      expect(() => {
        config.rateLimit.newProperty = 'test';
      }).toThrow(TypeError);
    });

    test('attempting to delete config.rateLimit.max throws in strict mode', () => {
      const config = require('../../src/config');
      expect(() => {
        delete config.rateLimit.max;
      }).toThrow(TypeError);
    });
  });

  // ---------------------------------------------------------------------------
  // Config Shape
  // ---------------------------------------------------------------------------
  describe('config shape', () => {
    test('exports an object with exactly 7 top-level keys', () => {
      const config = require('../../src/config');
      const keys = Object.keys(config);
      expect(keys).toHaveLength(7);
      expect(keys.sort()).toEqual(
        ['bodyLimit', 'corsOrigin', 'env', 'host', 'logLevel', 'port', 'rateLimit'].sort()
      );
    });

    test('rateLimit has exactly 2 keys: windowMs and max', () => {
      const config = require('../../src/config');
      const rateLimitKeys = Object.keys(config.rateLimit);
      expect(rateLimitKeys).toHaveLength(2);
      expect(rateLimitKeys.sort()).toEqual(['max', 'windowMs'].sort());
    });

    test('all config values have correct types', () => {
      const config = require('../../src/config');
      expect(typeof config.env).toBe('string');
      expect(typeof config.port).toBe('number');
      expect(typeof config.host).toBe('string');
      expect(typeof config.logLevel).toBe('string');
      expect(typeof config.corsOrigin).toBe('string');
      expect(typeof config.bodyLimit).toBe('string');
      expect(typeof config.rateLimit).toBe('object');
      expect(config.rateLimit).not.toBeNull();
      expect(typeof config.rateLimit.windowMs).toBe('number');
      expect(typeof config.rateLimit.max).toBe('number');
    });
  });
});
