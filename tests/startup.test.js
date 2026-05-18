/**
 * Startup-configuration tests for server.js
 *
 * Verifies that server.js's production `app.listen(port, hostname, callback)`
 * invocation uses port=3000, hostname='127.0.0.1', and emits the EXACT log
 * message 'Server running at http://127.0.0.1:3000/' via console.log when
 * the listen callback fires.
 *
 * Maps to AAP feature: F-001 (server startup binding + log message).
 *
 * Strategy and rationale
 * ----------------------
 * server.js guards the listen call with `if (require.main === module)`, so a
 * plain `require('../server')` from a test never reaches lines 15-19. To
 * exercise the guarded block AND produce Istanbul coverage AND let
 * `jest.spyOn(console, 'log')` intercept the listen-callback log, this file
 * combines three mechanisms:
 *
 *   1. Boilerplate (per the checkpoint review's prescription):
 *        - Read server.js source via fs.readFileSync.
 *        - Construct a fresh Module instance: `new Module(serverPath, null)`
 *          with explicit `.filename` and `.paths`.
 *        - Save `originalMain = process.mainModule`, set
 *          `process.mainModule = serverModule` before evaluating server.js,
 *          and restore `process.mainModule = originalMain` in a `finally`
 *          block. This guarantees the test never leaks process-level state
 *          even if evaluation throws.
 *
 *   2. Istanbul instrumentation (resolves the coverage gap left by removing
 *      the `/* istanbul ignore next *\/` pragma from server.js):
 *        - `istanbul-lib-instrument` (a transitive dependency of jest@^29.7.0
 *          shipped in `node_modules/istanbul-lib-instrument`) is the same
 *          library jest's `babel-plugin-istanbul` uses internally.
 *        - The instrumenter rewrites server.js into a self-initializing
 *          coverage-tracker that writes into `global.__coverage__[serverPath]`
 *          on each statement, branch, and function execution.
 *        - Because `tests/server.test.js` ALSO populates the same
 *          `global.__coverage__[serverPath]` (via Jest's own babel-istanbul
 *          transform on the same source content), the counters merge into a
 *          single coverage report when the suite finishes.
 *
 *   3. Jest-context wrapper (resolves the spy-context mismatch that would
 *      occur with `Module.prototype._compile`):
 *        - `Module._compile` and `vm.compileFunction` (which `_compile` calls
 *          internally) both evaluate the code in Node's PRIMARY V8 context,
 *          NOT in Jest's sandbox context. Inside that primary context,
 *          `console` is Node's built-in console (a DIFFERENT object than
 *          Jest's `CustomConsole`). Empirically verified: spying on Jest's
 *          `console.log` does NOT intercept a `console.log(...)` call inside
 *          `Module._compile`'d code.
 *        - `new Function(...)` constructs a function whose body is evaluated
 *          in the CURRENT V8 context (Jest's sandbox). Inside that function,
 *          `console` is Jest's CustomConsole, so `jest.spyOn(console, 'log')`
 *          intercepts calls as expected.
 *        - The wrapper signature `(exports, require, module, __filename,
 *          __dirname)` mirrors Node's CommonJS module wrapper, so the
 *          instrumented server.js source executes with the same lexical
 *          contract it would in a normal require.
 *        - A custom `require` whose `.main` property is `serverModule` is
 *          passed into the wrapper. Inside server.js, `require.main` resolves
 *          to that property, and `module` is `serverModule`, so
 *          `require.main === module` evaluates true and the listen block
 *          executes.
 *
 * No real TCP listener is opened at any point: the prototype-level spy on
 * `express.application.listen` returns a stub server object, capturing the
 * (port, hostname, callback) arguments for assertion.
 */

const path = require('path');
const fs = require('fs');
const Module = require('module');
const { createInstrumenter } = require('istanbul-lib-instrument');

const serverPath = path.resolve(__dirname, '..', 'server.js');

// Defensive sanity check: the testability guard and the listen call must both
// be present in server.js, otherwise the test premise is invalid and we should
// fail fast rather than silently produce a false pass.
const SERVER_SOURCE = fs.readFileSync(serverPath, 'utf8');
if (!SERVER_SOURCE.includes('require.main === module') || !SERVER_SOURCE.includes('app.listen')) {
  throw new Error(`server.js at ${serverPath} lacks the expected guard/listen structure`);
}

describe('server.js startup', () => {
  let listenSpy;
  let consoleLogSpy;
  let capturedArgs;

  beforeEach(() => {
    capturedArgs = null;

    // Install the prototype-level Express listen spy BEFORE evaluating
    // server.js so the new Express app (created by `express()` inside the
    // evaluated code) inherits the spy via Express's merge-descriptors mixin.
    // The stub returns a minimal object with the methods Express's chained
    // call pattern can invoke after listen returns.
    const express = require('express');
    listenSpy = jest
      .spyOn(express.application, 'listen')
      .mockImplementation(function listenStub(port, hostname, cb) {
        capturedArgs = { port, hostname, cb };
        return { close: jest.fn(), on: jest.fn() };
      });

    // Install the console.log spy in the SAME execution context where the
    // wrapper will run (Jest's sandbox). Because the wrapper is built with
    // `new Function`, its `console.log` reference resolves to this spied
    // console at call time.
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    // Construct the Module instance per the checkpoint review's prescription.
    const serverModule = new Module(serverPath, null);
    serverModule.filename = serverPath;
    serverModule.paths = Module._nodeModulePaths(path.dirname(serverPath));

    // Save process.mainModule so it can be restored in `finally`, even though
    // the actual `require.main === module` evaluation inside the wrapper is
    // driven by the custom `require.main` property (not process.mainModule).
    // Keeping this save/set/restore makes test state management explicit and
    // matches the review-mandated boilerplate.
    const originalMain = process.mainModule;
    process.mainModule = serverModule;

    try {
      // Instrument the server.js source so coverage counters fire as the
      // wrapper runs. The instrumenter's default options match jest's
      // babel-plugin-istanbul: same coverage variable (__coverage__), same
      // statement/branch/function identification scheme, so the counters
      // merge cleanly with the coverage data collected for the same file
      // path by tests/server.test.js.
      const instrumenter = createInstrumenter({
        esModules: false,
        produceSourceMap: false,
      });
      const instrumentedSource = instrumenter.instrumentSync(SERVER_SOURCE, serverPath);

      // Build a CommonJS-style wrapper using `new Function` so the body
      // evaluates inside Jest's V8 sandbox. This is the critical departure
      // from `Module._compile`: it preserves the spy-interception semantics
      // while still running the exact instrumented server.js source.
      const wrapper = new Function(
        'exports',
        'require',
        'module',
        '__filename',
        '__dirname',
        instrumentedSource
      );

      // Custom require: delegate name resolution to Jest's require, but
      // override `.main` so `require.main === module` evaluates true inside
      // server.js (because `module` inside the wrapper IS `serverModule`).
      const wrapperRequire = function wrapperRequire(name) {
        return require(name);
      };
      wrapperRequire.main = serverModule;
      wrapperRequire.resolve = require.resolve;
      wrapperRequire.cache = require.cache;
      wrapperRequire.extensions = require.extensions;

      wrapper(
        serverModule.exports,
        wrapperRequire,
        serverModule,
        serverPath,
        path.dirname(serverPath)
      );
    } finally {
      process.mainModule = originalMain;
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('invokes app.listen exactly once with port 3000, hostname 127.0.0.1, and a function callback', () => {
    expect(listenSpy).toHaveBeenCalledTimes(1);
    expect(capturedArgs).not.toBeNull();
    expect(capturedArgs.port).toBe(3000);
    expect(capturedArgs.hostname).toBe('127.0.0.1');
    expect(typeof capturedArgs.cb).toBe('function');
  });

  it('listen callback emits the exact startup log via console.log', () => {
    consoleLogSpy.mockClear();
    capturedArgs.cb();
    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    expect(consoleLogSpy).toHaveBeenCalledWith('Server running at http://127.0.0.1:3000/');
  });
});
