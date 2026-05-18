/**
 * Startup-configuration tests for server.js
 *
 * Verifies that server.js's production `app.listen(port, hostname, callback)`
 * call uses port=3000, hostname='127.0.0.1', a function callback, and that
 * the callback emits the exact startup log
 * 'Server running at http://127.0.0.1:3000/'.
 *
 * Strategy:
 *   - Pre-load express via a Node-native Module so server.js (loaded via
 *     Module._load) resolves the same cached express instance.
 *   - Spy on `express.application.listen` at the prototype level — Express's
 *     merge-descriptors mixin copies the spy onto the new app at construction.
 *   - Spy on `process.stdout.write` (the shared OS-level sink; spying on
 *     console.log does not propagate across Jest's sandbox boundary into
 *     Module._load'd code).
 *   - Clear both `require.cache` and `Module._cache` (they are distinct
 *     objects inside Jest's sandbox) for server.js.
 *   - Invoke Module._load with isMain=true so Node's loader sets
 *     process.mainModule = serverModule and the `require.main === module`
 *     guard inside server.js evaluates true.
 *
 * No real TCP listener is opened; the spy returns a stub server object.
 *
 * Maps to AAP feature: F-001.
 */

const path = require('path');
const fs = require('fs');
const Module = require('module');

const serverPath = path.resolve(__dirname, '..', 'server.js');

// Defensive sanity check: ensure server.js still has the structure these
// tests rely on (the require.main === module guard and the app.listen call).
const SERVER_SOURCE = fs.readFileSync(serverPath, 'utf8');
if (!SERVER_SOURCE.includes('require.main === module') || !SERVER_SOURCE.includes('app.listen')) {
  throw new Error(`server.js at ${serverPath} lacks the expected guard/listen structure`);
}

describe('server.js startup', () => {
  let listenSpy;
  let stdoutWriteSpy;
  let capturedArgs;

  beforeEach(() => {
    capturedArgs = null;

    // Pre-load express via Node's native require so it lands in Module._cache;
    // server.js (loaded via Module._load below) resolves the same instance.
    const tempModule = new Module(serverPath, null);
    tempModule.paths = Module._nodeModulePaths(path.dirname(serverPath));
    const express = tempModule.require('express');

    // Prototype-level spy: every app from express() inherits this listen via
    // Express's merge-descriptors mixin, intercepting the server.js call.
    listenSpy = jest
      .spyOn(express.application, 'listen')
      .mockImplementation(function (port, hostname, cb) {
        capturedArgs = { port, hostname, cb };
        return { close: jest.fn(), on: jest.fn() };
      });

    // Shared stdout sink: console.log -> Console.prototype.log -> stdout.write.
    stdoutWriteSpy = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    // Both caches must be cleared (require.cache and Module._cache are
    // distinct objects inside Jest's sandbox).
    delete require.cache[serverPath];
    delete Module._cache[serverPath];

    // isMain=true makes Node set process.mainModule = the loaded module
    // inside the load frame; require.main === module evaluates true and the
    // guarded app.listen call executes.
    Module._load(serverPath, null, true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete require.cache[serverPath];
    delete Module._cache[serverPath];
  });

  it('invokes app.listen exactly once with port 3000, hostname 127.0.0.1, and a function callback', () => {
    expect(listenSpy).toHaveBeenCalledTimes(1);
    expect(capturedArgs).not.toBeNull();
    expect(capturedArgs.port).toBe(3000);
    expect(capturedArgs.hostname).toBe('127.0.0.1');
    expect(typeof capturedArgs.cb).toBe('function');
  });

  it('listen callback emits the exact startup log via console.log', () => {
    stdoutWriteSpy.mockClear();
    capturedArgs.cb();
    expect(stdoutWriteSpy).toHaveBeenCalledTimes(1);
    expect(stdoutWriteSpy.mock.calls[0][0]).toBe('Server running at http://127.0.0.1:3000/\n');
  });
});
