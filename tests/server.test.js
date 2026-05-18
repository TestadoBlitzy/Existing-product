/**
 * Lifecycle tests for server.js — the root Express bootstrap.
 *
 * Verifies:
 *   - app.listen is invoked with the configured port, host, and callback
 *   - The startup callback logs the URL and environment via logger.info
 *   - unhandledRejection handler logs and calls process.exit(1)
 *   - uncaughtException handler logs and calls process.exit(1)
 *   - PORT / HOST environment-variable overrides propagate through to listen
 *
 * Tests run inside jest.isolateModules so the process-level handlers registered
 * by server.js are confined to the sandboxed module graph. app.listen,
 * process.on, process.exit, and the Winston logger methods are all spied to
 * prevent real socket binding, real handler registration on the live Jest
 * worker, and real worker termination.
 *
 * Authoritative blueprint: AAP §§ 0.4.2, 0.4.5, 0.5.2, 0.7.1, 0.10.5, 0.10.6.
 */

const { snapshotEnv, restoreEnv } = require('./helpers/env');

describe('server.js', () => {
  // Snapshot of process.env captured before each test so PORT / HOST / NODE_ENV
  // mutations performed by individual tests are reverted cleanly even if a
  // later test forgets to delete them. Pairs with jest.resetModules() to force
  // src/config/index.js to re-read process.env on the next require.
  let envSnap;

  beforeEach(() => {
    envSnap = snapshotEnv();
    // Belt-and-braces: jest.isolateModules creates a sandbox cache, but
    // resetModules ensures the outer cache is also clean in case any
    // pre-existing require() leaked.
    jest.resetModules();
    // Explicitly remove the three env vars that drive server / config
    // behaviour so each test starts from documented defaults.
    delete process.env.PORT;
    delete process.env.HOST;
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    // Restore the captured environment, undoing any test-level mutations.
    restoreEnv(envSnap);
    // jest.config.js sets restoreMocks: true (which auto-restores spies
    // between tests), but the explicit call documents intent and protects
    // against config drift, per AAP § 0.10.5.
    jest.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // runServerWithMocks — standard test scaffolding
  //
  // Loads server.js inside a fresh jest.isolateModules sandbox with all the
  // necessary spies (app.listen, process.on, process.exit, logger.{info,
  // error, http}) pre-installed BEFORE the require, then invokes cb with a
  // context object exposing the spies and the loaded modules. This is the
  // canonical pattern from AAP § 0.5.2 (lifecycle suite isolation).
  //
  // Why pre-install spies:
  //   - app.listen → would otherwise bind a real TCP socket on the configured
  //     port and host (3000 by default) and leak the listener across tests.
  //   - process.on → would otherwise register handlers on the live Jest worker
  //     and cause the next legitimate unhandledRejection in any other test
  //     file to trigger the synthetic logger / exit path.
  //   - process.exit → would otherwise terminate the Jest worker process when
  //     the handlers fire, masquerading as a test failure.
  //   - logger.{info, error, http} → would otherwise spam the test output and
  //     write to logs/combined.log / logs/error.log on disk during the test.
  //
  // Why call cb inside isolateModules:
  //   - jest.spyOn calls made before the require track the captured args even
  //     after isolateModules exits, BUT mockImplementation may behave subtly
  //     differently across the sandbox boundary. Calling the assertions
  //     inside the sandbox guarantees we observe the spy state exactly as the
  //     module saw it.
  // ---------------------------------------------------------------------------
  const runServerWithMocks = (cb) => {
    let context;
    jest.isolateModules(() => {
      // Resolve the real Express app, config, and logger modules INSIDE the
      // sandbox so server.js sees the same cached references when it does its
      // own require() calls (require('./src/app') from server.js resolves to
      // the identical path as require('../src/app') here).
      const app = require('../src/app');
      const config = require('../src/config');
      const logger = require('../src/utils/logger');

      // Spy on app.listen and mock it so no real socket is bound. The mock
      // synchronously invokes the startup callback (if provided) so the
      // startup logging code path in server.js executes within the test
      // turn. Returns a stub server object with a close() function so any
      // caller that stores the return value can release it without error.
      const listenSpy = jest
        .spyOn(app, 'listen')
        .mockImplementation((port, host, callback) => {
          if (typeof callback === 'function') callback();
          return { close: jest.fn() };
        });

      // Spy on process.on with a mock implementation that short-circuits the
      // real EventEmitter registration. Without this, server.js would register
      // unhandledRejection and uncaughtException handlers on the real Jest
      // worker process; even though restoreMocks: true reverts the spy, the
      // already-registered handler would persist on process and could fire
      // against unrelated rejections later in the test suite. The mock returns
      // `process` to honour Node's chainable API contract.
      const onSpy = jest.spyOn(process, 'on').mockImplementation(() => process);

      // Spy on process.exit and replace it with a no-op so the production
      // handler's process.exit(1) call cannot actually terminate the Jest
      // worker. The spy's call history still captures the exit code (1) so
      // the assertions can verify the production code's behaviour.
      const exitSpy = jest
        .spyOn(process, 'exit')
        .mockImplementation(() => undefined);

      // Silence the Winston logger methods invoked by server.js. We install
      // spies (rather than monkey-patching) so the assertions can inspect
      // mock.calls to verify the production code logged the documented fields
      // before exiting.
      const infoSpy = jest
        .spyOn(logger, 'info')
        .mockImplementation(() => {});
      const errorSpy = jest
        .spyOn(logger, 'error')
        .mockImplementation(() => {});
      const httpSpy = jest
        .spyOn(logger, 'http')
        .mockImplementation(() => {});

      // Load the bootstrap module under test. server.js executes its top-level
      // statements (extract port/host from config, call app.listen, register
      // process handlers) immediately on require — every spy installed above
      // is therefore exercised exactly once per runServerWithMocks call.
      require('../server');

      context = {
        app,
        config,
        logger,
        listenSpy,
        onSpy,
        exitSpy,
        infoSpy,
        errorSpy,
        httpSpy,
      };
      // Execute the test-specific assertions inside the sandbox so the
      // observed spy state mirrors what the production code saw at
      // module-load time.
      cb(context);
    });
    return context;
  };

  // ===========================================================================
  // app.listen invocation
  // ===========================================================================
  // Exercises the happy-path and env-override cases for the listener-binding
  // statement at server.js line 57:
  //
  //   app.listen(port, host, () => { ... });
  //
  // where { port, host } are destructured from the centralised config module.
  // ===========================================================================
  describe('app.listen invocation', () => {
    it('calls app.listen with config.port and config.host and a callback', () => {
      runServerWithMocks(({ listenSpy, config }) => {
        // Exactly one listen invocation per server.js load is expected.
        expect(listenSpy).toHaveBeenCalledTimes(1);
        // The arguments must come from the centralised config module,
        // not be hard-coded — verifying this guards against accidental
        // regressions to the pre-refactor literal-values pattern.
        expect(listenSpy).toHaveBeenCalledWith(
          config.port,
          config.host,
          expect.any(Function)
        );
      });
    });

    it('uses the default port 3000 and host 0.0.0.0 when no env vars are set', () => {
      // beforeEach already deleted PORT/HOST/NODE_ENV so config.* defaults apply.
      runServerWithMocks(({ listenSpy }) => {
        expect(listenSpy).toHaveBeenCalledWith(
          3000,
          '0.0.0.0',
          expect.any(Function)
        );
      });
    });

    it('passes PORT/HOST env overrides through to app.listen', () => {
      // Set environment-variable overrides BEFORE the server module loads.
      // beforeEach's jest.resetModules() and isolateModules guarantee config
      // is re-read here.
      process.env.PORT = '4242';
      process.env.HOST = '127.0.0.1';
      runServerWithMocks(({ listenSpy }) => {
        expect(listenSpy).toHaveBeenCalledWith(
          4242,
          '127.0.0.1',
          expect.any(Function)
        );
      });
    });

    it('falls back to port 3000 when PORT is non-numeric', () => {
      // Exercises the parseInt(PORT, 10) || 3000 fallback path in
      // src/config/index.js line 36. parseInt('not-a-number', 10) returns
      // NaN, which is falsy, so the || 3000 fallback fires.
      process.env.PORT = 'not-a-number';
      runServerWithMocks(({ listenSpy }) => {
        expect(listenSpy).toHaveBeenCalledWith(
          3000,
          '0.0.0.0',
          expect.any(Function)
        );
      });
    });
  });

  // ===========================================================================
  // Startup log content
  // ===========================================================================
  // Verifies the body of the app.listen() callback at server.js lines 57-60:
  //
  //   logger.info(`Server running at http://${host}:${port}/`);
  //   logger.info(`Environment: ${config.nodeEnv}`);
  //
  // Assertions use stringContaining (per AAP § 0.10.4 / § Phase 11
  // anti-regression notes) so trivial future format additions (e.g. a
  // timestamp prefix) do not cause spurious failures.
  // ===========================================================================
  describe('startup log content', () => {
    it('logs the server URL on startup', () => {
      runServerWithMocks(({ infoSpy }) => {
        // logger.info is called at least twice (URL + environment); verify
        // the call happened before asserting on its contents.
        expect(infoSpy).toHaveBeenCalled();
        // Concatenate every first-argument of every info call into a single
        // string so assertions can use stringContaining without needing to
        // know which call carried which fragment.
        const calls = infoSpy.mock.calls.map((c) => c[0]).join(' | ');
        expect(calls).toEqual(expect.stringContaining('http://'));
        expect(calls).toEqual(expect.stringContaining('0.0.0.0'));
        expect(calls).toEqual(expect.stringContaining('3000'));
      });
    });

    it('logs the active environment value (Environment: ${config.nodeEnv}) on startup', () => {
      runServerWithMocks(({ infoSpy, config }) => {
        const calls = infoSpy.mock.calls.map((c) => c[0]).join(' | ');
        // Production code at server.js line 59 formats this as
        //   `Environment: ${config.nodeEnv}`
        // The full fragment (label + colon + space + actual value) must
        // appear verbatim in the captured logger.info calls. Asserting on
        // only 'Environment' (the label) would let regressions such as
        //   logger.info('Environment')                 // missing value
        //   logger.info('Environment: wrong')          // wrong value
        //   logger.info('Environment: '+ otherVar)     // wrong source
        // pass silently. Using config.nodeEnv (the same value the
        // production code reads) keeps the assertion correct under any
        // NODE_ENV the Jest worker happens to be running with.
        expect(calls).toEqual(
          expect.stringContaining(`Environment: ${config.nodeEnv}`)
        );
      });
    });

    it('logs the overridden environment value when NODE_ENV is set', () => {
      // Override NODE_ENV before the server module loads so config.nodeEnv
      // reflects the override on re-import inside runServerWithMocks's
      // jest.isolateModules sandbox. This proves the environment-log
      // assertion is genuinely value-sensitive (not just label-sensitive)
      // by exercising a non-default NODE_ENV value end-to-end.
      process.env.NODE_ENV = 'production';
      runServerWithMocks(({ infoSpy, config }) => {
        // Sanity check that the config module observed the override.
        expect(config.nodeEnv).toBe('production');
        const calls = infoSpy.mock.calls.map((c) => c[0]).join(' | ');
        // The full fragment must include the override value, proving the
        // log message reflects config.nodeEnv at startup time rather than
        // a hardcoded default. A regression that hardcoded 'development'
        // (or any other literal) would fail this assertion.
        expect(calls).toEqual(
          expect.stringContaining('Environment: production')
        );
      });
    });

    it('logs custom host and port when PORT/HOST env override is set', () => {
      process.env.PORT = '8080';
      process.env.HOST = 'example.local';
      runServerWithMocks(({ infoSpy }) => {
        const calls = infoSpy.mock.calls.map((c) => c[0]).join(' | ');
        // The full URL fragment must appear verbatim — this guards against
        // regressions that drop the protocol or trailing slash from the log.
        expect(calls).toEqual(
          expect.stringContaining('http://example.local:8080/')
        );
      });
    });
  });

  // ===========================================================================
  // unhandledRejection handler
  // ===========================================================================
  // Verifies registration and behaviour of the process-level handler at
  // server.js lines 79-85:
  //
  //   process.on('unhandledRejection', (reason, promise) => {
  //     logger.error('Unhandled Rejection at Promise', {
  //       reason: reason instanceof Error ? reason.message : reason,
  //       stack: reason instanceof Error ? reason.stack : undefined,
  //     });
  //     process.exit(1);
  //   });
  //
  // Both reason types (Error instance, plain string) are exercised so the
  // ternary branches are fully covered.
  // ===========================================================================
  describe('unhandledRejection handler', () => {
    it('registers an unhandledRejection listener via process.on', () => {
      runServerWithMocks(({ onSpy }) => {
        // Extract just the event-name argument from every process.on call.
        // Order-independent membership check guards against silent drift
        // in the registration order without coupling to it.
        const events = onSpy.mock.calls.map((c) => c[0]);
        expect(events).toContain('unhandledRejection');
      });
    });

    it('logs the rejection and calls process.exit(1) when an Error instance is rejected', () => {
      runServerWithMocks(({ onSpy, errorSpy, exitSpy }) => {
        // Locate the registered handler in the spy's call history.
        const call = onSpy.mock.calls.find(
          (c) => c[0] === 'unhandledRejection'
        );
        expect(call).toBeDefined();
        const handler = call[1];
        expect(typeof handler).toBe('function');

        // Invoke the captured handler directly with a synthetic Error and a
        // resolved promise (the second argument is accepted but unused by
        // the current production implementation).
        const syntheticError = new Error('rejected!');
        handler(syntheticError, Promise.resolve());

        // The production code wraps the error in a structured metadata
        // object. We use objectContaining to remain agnostic of any future
        // additional metadata fields while still verifying the documented
        // ones are present.
        expect(errorSpy).toHaveBeenCalledWith(
          'Unhandled Rejection at Promise',
          expect.objectContaining({
            reason: 'rejected!',
            stack: expect.any(String),
          })
        );
        // PM2 / process-manager compatibility requires exit code 1 to
        // trigger an automatic restart on crash.
        expect(exitSpy).toHaveBeenCalledWith(1);
      });
    });

    it('handles non-Error rejection reasons (e.g., a string) and still exits with 1', () => {
      runServerWithMocks(({ onSpy, errorSpy, exitSpy }) => {
        const call = onSpy.mock.calls.find(
          (c) => c[0] === 'unhandledRejection'
        );
        const handler = call[1];

        // Exercise the FALSE branch of the
        //   reason instanceof Error ? ... : ...
        // ternary in server.js line 81. The reason should be forwarded
        // verbatim and stack should be undefined.
        handler('plain string reason', Promise.resolve());

        expect(errorSpy).toHaveBeenCalledWith(
          'Unhandled Rejection at Promise',
          expect.objectContaining({
            reason: 'plain string reason',
            stack: undefined,
          })
        );
        expect(exitSpy).toHaveBeenCalledWith(1);
      });
    });
  });

  // ===========================================================================
  // uncaughtException handler
  // ===========================================================================
  // Verifies registration and behaviour of the process-level handler at
  // server.js lines 96-102:
  //
  //   process.on('uncaughtException', (error) => {
  //     logger.error('Uncaught Exception', {
  //       message: error.message,
  //       stack: error.stack,
  //     });
  //     process.exit(1);
  //   });
  // ===========================================================================
  describe('uncaughtException handler', () => {
    it('registers an uncaughtException listener via process.on', () => {
      runServerWithMocks(({ onSpy }) => {
        const events = onSpy.mock.calls.map((c) => c[0]);
        expect(events).toContain('uncaughtException');
      });
    });

    it('logs the exception and calls process.exit(1) on uncaught error', () => {
      runServerWithMocks(({ onSpy, errorSpy, exitSpy }) => {
        const call = onSpy.mock.calls.find(
          (c) => c[0] === 'uncaughtException'
        );
        expect(call).toBeDefined();
        const handler = call[1];
        expect(typeof handler).toBe('function');

        // Invoke the captured handler directly with a synthetic Error.
        const syntheticError = new Error('crash!');
        handler(syntheticError);

        // Verify both documented metadata fields are forwarded to the logger.
        expect(errorSpy).toHaveBeenCalledWith(
          'Uncaught Exception',
          expect.objectContaining({
            message: 'crash!',
            stack: expect.any(String),
          })
        );
        // Exit code 1 is required for PM2 / process-manager auto-restart.
        expect(exitSpy).toHaveBeenCalledWith(1);
      });
    });
  });
});
