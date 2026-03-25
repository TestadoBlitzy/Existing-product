'use strict';

/**
 * Server Lifecycle and Process Event Tests
 *
 * Tests the server.js entry point — application bootstrap, signal handlers,
 * and unhandled error safety nets. Since server.js has side effects on import
 * (calls dotenv.config(), app.listen(), registers process.on handlers), the
 * tests require careful module isolation with jest.resetModules() and
 * controlled require().
 *
 * Mocking Strategy:
 * - dotenv: Mocked to prevent .env file loading
 * - logger: Mocked to prevent Winston file transport I/O (logs/ directory)
 * - app: Mocked to control app.listen() behavior and return a mock server
 * - process.on: Spied to capture signal handler registration
 * - process.exit: Spied to prevent actual process termination
 *
 * @module tests/server
 */

// ---------------------------------------------------------------------------
// Dependencies
// ---------------------------------------------------------------------------

const { backupEnv, restoreEnv } = require('./helpers/setup');

// ---------------------------------------------------------------------------
// Module-Scoped Mock References
// ---------------------------------------------------------------------------
// These variables are populated when server.js calls app.listen() during
// module initialization. They enable tests to interact with the mock server
// and invoke the listen callback independently.
// ---------------------------------------------------------------------------

let mockServer;
let mockListenCallback;

// ---------------------------------------------------------------------------
// Module Mocks
// ---------------------------------------------------------------------------
// jest.mock() calls are hoisted to the top of the file by Jest. They are
// declared before any require() that might trigger the mocked modules.
// These mocks prevent side effects during server.js initialization:
// - dotenv: prevents .env file loading from disk
// - logger: prevents Winston file transport I/O (no logs/ directory writes)
// - app: controls app.listen() behavior and returns a mock server object
// ---------------------------------------------------------------------------

// Mock dotenv to prevent .env file loading during server.js require
jest.mock('dotenv', () => ({
  config: jest.fn()
}));

// Mock logger to prevent Winston file transport I/O and suppress console output
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  http: jest.fn(),
  stream: { write: jest.fn() }
}));

// Mock the Express app module — app.listen returns a controllable mock server
// The mock captures the listen callback for manual invocation in tests and
// creates a mock server with a close() method that invokes its callback
// synchronously (simulating completed connection draining).
jest.mock('../src/app', () => ({
  listen: jest.fn((port, host, cb) => {
    // Capture the listen callback for manual invocation in tests
    mockListenCallback = cb;
    // Create a mock server with close() that invokes callback synchronously
    mockServer = {
      close: jest.fn((closeCb) => {
        if (closeCb) closeCb();
      })
    };
    return mockServer;
  })
}));

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

/**
 * Extracts a registered process.on handler by event name from the spy.
 * Searches through all captured process.on calls to find the handler
 * registered for the specified event during server.js module initialization.
 *
 * @param {jest.SpyInstance} spy - The process.on spy instance
 * @param {string} eventName - The event name to find (e.g., 'SIGTERM')
 * @returns {Function} The registered handler function
 * @throws {Error} If no handler was registered for the given event name
 */
function getHandler(spy, eventName) {
  const call = spy.mock.calls.find(([event]) => event === eventName);
  if (!call) {
    throw new Error(
      `No process.on handler registered for '${eventName}'. ` +
      `Registered events: ${spy.mock.calls.map(([e]) => e).join(', ')}`
    );
  }
  return call[1];
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('server lifecycle', () => {
  let processOnSpy;
  let processExitSpy;
  let envBackup;

  beforeEach(() => {
    // Backup current environment state for safe restoration in afterEach
    envBackup = backupEnv();

    // Clear CommonJS module cache for fresh server.js require per test.
    // This ensures each test gets a clean module execution with no cached
    // state from previous test runs.
    jest.resetModules();

    // Ensure deterministic config defaults by removing environment overrides.
    // Without this, environment variables from the host system could change
    // config.port or config.host, causing assertions on default values to fail.
    delete process.env.PORT;
    delete process.env.HOST;

    // Reset mock server references from previous test
    mockServer = null;
    mockListenCallback = null;

    // Spy on process methods BEFORE requiring server.js to capture all
    // handler registrations during module initialization.
    // mockImplementation prevents actual handler registration on the process
    // while still capturing the call arguments for assertion.
    processOnSpy = jest.spyOn(process, 'on').mockImplementation(() => process);
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore all spies (process.on, process.exit) to original implementations
    jest.restoreAllMocks();
    // Restore environment variables to pre-test state
    restoreEnv(envBackup);
  });

  /**
   * Requires server.js with fresh module state. Must be called within
   * a test body (after beforeEach sets up spies and mocks). Each call
   * triggers full server.js initialization: dotenv.config(), module imports,
   * app.listen(), and process.on() registrations.
   */
  function requireServer() {
    require('../server');
  }

  // =========================================================================
  // Signal Handler Registration Tests
  // =========================================================================
  // Verifies that server.js registers all four required process event handlers
  // during module initialization: SIGTERM, SIGINT for graceful shutdown, and
  // unhandledRejection, uncaughtException as error safety nets.
  // =========================================================================

  describe('signal handlers', () => {
    test('registers SIGTERM handler via process.on', () => {
      requireServer();

      expect(processOnSpy).toHaveBeenCalledWith(
        'SIGTERM',
        expect.any(Function)
      );
    });

    test('registers SIGINT handler via process.on', () => {
      requireServer();

      expect(processOnSpy).toHaveBeenCalledWith(
        'SIGINT',
        expect.any(Function)
      );
    });

    test('registers unhandledRejection handler via process.on', () => {
      requireServer();

      expect(processOnSpy).toHaveBeenCalledWith(
        'unhandledRejection',
        expect.any(Function)
      );
    });

    test('registers uncaughtException handler via process.on', () => {
      requireServer();

      expect(processOnSpy).toHaveBeenCalledWith(
        'uncaughtException',
        expect.any(Function)
      );
    });
  });

  // =========================================================================
  // Graceful Shutdown Tests
  // =========================================================================
  // Verifies that SIGTERM and SIGINT handlers perform graceful shutdown by
  // calling server.close() to drain in-flight connections, logging appropriate
  // messages, and exiting with code 0 (success) after the server closes.
  // =========================================================================

  describe('graceful shutdown', () => {
    test('SIGTERM handler calls server.close() and exits with code 0', () => {
      requireServer();
      const handler = getHandler(processOnSpy, 'SIGTERM');

      // Invoke the SIGTERM handler (simulating OS/PM2 shutdown signal)
      handler();

      // Verify server.close() was called for graceful connection draining
      expect(mockServer.close).toHaveBeenCalled();
      // Verify process exits with success code after close completes
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    test('SIGINT handler calls server.close() and exits with code 0', () => {
      requireServer();
      const handler = getHandler(processOnSpy, 'SIGINT');

      // Invoke the SIGINT handler (simulating Ctrl+C in terminal)
      handler();

      // Verify server.close() was called for graceful connection draining
      expect(mockServer.close).toHaveBeenCalled();
      // Verify process exits with success code after close completes
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    test('SIGTERM handler logs shutdown initiation and termination messages', () => {
      requireServer();
      const logger = require('../src/utils/logger');
      const handler = getHandler(processOnSpy, 'SIGTERM');

      handler();

      // Verify shutdown initiation message logged
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('SIGTERM')
      );
      // Verify termination completion message logged (from server.close callback)
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('terminated')
      );
    });

    test('SIGINT handler logs shutdown initiation and termination messages', () => {
      requireServer();
      const logger = require('../src/utils/logger');
      const handler = getHandler(processOnSpy, 'SIGINT');

      handler();

      // Verify shutdown initiation message logged
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('SIGINT')
      );
      // Verify termination completion message logged (from server.close callback)
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('terminated')
      );
    });

    test('SIGTERM handler provides a callback to server.close()', () => {
      requireServer();
      const handler = getHandler(processOnSpy, 'SIGTERM');

      handler();

      // Verify server.close() received a function callback for post-close cleanup
      expect(mockServer.close).toHaveBeenCalledWith(expect.any(Function));
    });

    test('SIGINT handler provides a callback to server.close()', () => {
      requireServer();
      const handler = getHandler(processOnSpy, 'SIGINT');

      handler();

      // Verify server.close() received a function callback for post-close cleanup
      expect(mockServer.close).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  // =========================================================================
  // Unhandled Error Safety Net Tests
  // =========================================================================
  // Verifies the last-resort error handlers that catch errors escaping all
  // Express middleware and try/catch blocks:
  // - unhandledRejection: Logs but continues running (for investigation)
  // - uncaughtException: Logs and exits with code 1 (corrupted state)
  // =========================================================================

  describe('unhandled error safety nets', () => {
    test('unhandledRejection handler logs Error reason without exiting', () => {
      requireServer();
      const logger = require('../src/utils/logger');
      const handler = getHandler(processOnSpy, 'unhandledRejection');
      const testError = new Error('test promise rejection');

      // Invoke handler with Error reason (direct pass-through path)
      handler(testError, Promise.resolve());

      // Verify the error was logged with the original Error object
      expect(logger.error).toHaveBeenCalledWith(
        'Unhandled Rejection',
        testError
      );
      // Verify process does NOT exit — server continues running for investigation
      expect(processExitSpy).not.toHaveBeenCalled();
    });

    test('unhandledRejection handler wraps non-Error string reason in Error object', () => {
      requireServer();
      const logger = require('../src/utils/logger');
      const handler = getHandler(processOnSpy, 'unhandledRejection');

      // Invoke handler with non-Error reason (string wrapping path)
      handler('string rejection reason', Promise.resolve());

      // Verify logger.error was called with a wrapped Error instance
      expect(logger.error).toHaveBeenCalledWith(
        'Unhandled Rejection',
        expect.any(Error)
      );

      // Verify the wrapped Error contains the stringified reason
      const loggedError = logger.error.mock.calls[0][1];
      expect(loggedError.message).toBe('string rejection reason');

      // Verify process does NOT exit
      expect(processExitSpy).not.toHaveBeenCalled();
    });

    test('unhandledRejection handler wraps numeric reason in Error object', () => {
      requireServer();
      const logger = require('../src/utils/logger');
      const handler = getHandler(processOnSpy, 'unhandledRejection');

      // Invoke handler with numeric reason
      handler(42, Promise.resolve());

      // Verify the numeric value was stringified and wrapped in an Error
      const loggedError = logger.error.mock.calls[0][1];
      expect(loggedError).toBeInstanceOf(Error);
      expect(loggedError.message).toBe('42');
      expect(processExitSpy).not.toHaveBeenCalled();
    });

    test('unhandledRejection handler wraps null reason in Error object', () => {
      requireServer();
      const logger = require('../src/utils/logger');
      const handler = getHandler(processOnSpy, 'unhandledRejection');

      // Invoke handler with null reason
      handler(null, Promise.resolve());

      // Verify null was stringified to "null" and wrapped in an Error
      const loggedError = logger.error.mock.calls[0][1];
      expect(loggedError).toBeInstanceOf(Error);
      expect(loggedError.message).toBe('null');
      expect(processExitSpy).not.toHaveBeenCalled();
    });

    test('unhandledRejection handler wraps undefined reason in Error object', () => {
      requireServer();
      const logger = require('../src/utils/logger');
      const handler = getHandler(processOnSpy, 'unhandledRejection');

      // Invoke handler with undefined reason
      handler(undefined, Promise.resolve());

      // Verify undefined was stringified to "undefined" and wrapped in an Error
      const loggedError = logger.error.mock.calls[0][1];
      expect(loggedError).toBeInstanceOf(Error);
      expect(loggedError.message).toBe('undefined');
      expect(processExitSpy).not.toHaveBeenCalled();
    });

    test('uncaughtException handler logs error and exits with code 1', () => {
      requireServer();
      const logger = require('../src/utils/logger');
      const handler = getHandler(processOnSpy, 'uncaughtException');
      const testError = new Error('fatal uncaught error');

      // Invoke handler (simulating synchronous throw escaping all try/catch)
      handler(testError);

      // Verify error was logged with the original Error object
      expect(logger.error).toHaveBeenCalledWith('Uncaught Exception:', testError);
      // Verify process exits with error code 1 (abnormal termination for PM2 restart)
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    test('uncaughtException handler exits with code 1 even for non-Error values', () => {
      requireServer();
      const logger = require('../src/utils/logger');
      const handler = getHandler(processOnSpy, 'uncaughtException');

      // Node.js can throw non-Error values as uncaught exceptions
      handler('string exception');

      // Verify logging still occurs with the raw value
      expect(logger.error).toHaveBeenCalledWith('Uncaught Exception:', 'string exception');
      // Verify process still exits with code 1 regardless of error type
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  // =========================================================================
  // Server Bootstrap Tests
  // =========================================================================
  // Verifies the server initialization sequence: dotenv.config() is called
  // first, then app.listen() is called with the correct port and host from
  // the config module, and the listen callback logs the startup message.
  // =========================================================================

  describe('server bootstrap', () => {
    test('dotenv.config() is called during server initialization', () => {
      requireServer();
      const dotenv = require('dotenv');

      // Verify dotenv.config() was invoked to load .env variables
      expect(dotenv.config).toHaveBeenCalled();
      expect(dotenv.config).toHaveBeenCalledTimes(1);
    });

    test('calls app.listen with default port 3000 and host 0.0.0.0', () => {
      requireServer();
      const app = require('../src/app');

      // Verify app.listen was called with config defaults
      expect(app.listen).toHaveBeenCalledWith(
        3000,        // default port from config when PORT env var is absent
        '0.0.0.0',   // default host from config when HOST env var is absent
        expect.any(Function) // listen callback
      );
    });

    test('calls app.listen exactly once during initialization', () => {
      requireServer();
      const app = require('../src/app');

      expect(app.listen).toHaveBeenCalledTimes(1);
    });

    test('listen callback logs startup message with host and port', () => {
      requireServer();
      const logger = require('../src/utils/logger');

      // Verify the callback was captured by the app.listen mock
      expect(mockListenCallback).toBeDefined();
      expect(typeof mockListenCallback).toBe('function');

      // Invoke the listen callback (simulating successful port binding)
      mockListenCallback();

      // Verify startup message includes the bound host and port
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('0.0.0.0:3000')
      );
    });

    test('listen callback includes environment mode in startup message', () => {
      requireServer();
      const logger = require('../src/utils/logger');

      mockListenCallback();

      // The startup message format: "Server running on http://<host>:<port> in <env> mode"
      // Jest sets NODE_ENV=test by default; config reads this during module load
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringMatching(/in \w+ mode/)
      );
    });

    test('app.listen uses custom PORT when environment variable is set', () => {
      // Set custom port before requireServer() loads config module
      process.env.PORT = '8080';

      requireServer();
      const app = require('../src/app');

      // Verify app.listen received the custom port from environment
      expect(app.listen).toHaveBeenCalledWith(
        8080,        // custom port parsed from PORT env var
        '0.0.0.0',   // default host (HOST env var not set)
        expect.any(Function)
      );
    });

    test('app.listen uses custom HOST when environment variable is set', () => {
      // Set custom host before requireServer() loads config module
      process.env.HOST = '127.0.0.1';

      requireServer();
      const app = require('../src/app');

      // Verify app.listen received the custom host from environment
      expect(app.listen).toHaveBeenCalledWith(
        3000,          // default port (PORT env var not set)
        '127.0.0.1',   // custom host from HOST env var
        expect.any(Function)
      );
    });
  });
});
