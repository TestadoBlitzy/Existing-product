const app = require('../server');
const fs = require('fs');
const path = require('path');
const http = require('http');

const serverSource = fs.readFileSync(
  path.join(__dirname, '..', 'server.js'),
  'utf8'
);

describe('Express app', () => {
  it('should export a valid Express app', () => {
    expect(typeof app).toBe('function');
  });
});

describe('Server configuration', () => {
  it('should configure hostname as 127.0.0.1', () => {
    expect(serverSource).toContain("const hostname = '127.0.0.1'");
  });

  it('should configure port as 3000', () => {
    expect(serverSource).toContain('const port = 3000');
  });
});

describe('Server startup', () => {
  it('should wrap app.listen in require.main guard', () => {
    expect(serverSource).toContain('if (require.main === module)');
    expect(serverSource).toContain('app.listen(');
  });

  it('should call app.listen and log the startup message when run as main module', () => {
    const originalHttpListen = http.Server.prototype.listen;

    // Spy on process.stdout.write to capture console.log output at the
    // lowest level — this works regardless of which console object is used
    const stdoutSpy = jest.spyOn(process.stdout, 'write');

    // Mock http.Server.prototype.listen to prevent actual port binding
    // while still invoking the listen callback synchronously
    http.Server.prototype.listen = function (...args) {
      const callback = args[args.length - 1];
      if (typeof callback === 'function') {
        callback();
      }
      return this;
    };

    try {
      const vm = require('vm');
      const Module = require('module');
      const serverPath = require.resolve('../server');

      // Create a Module instance that represents server.js
      const serverModule = new Module(serverPath);
      serverModule.filename = serverPath;
      serverModule.paths = Module._nodeModulePaths(path.dirname(serverPath));

      // Build a custom require where require.main === serverModule,
      // so the require.main === module guard in server.js evaluates to true
      const customRequire = (id) => require(id);
      customRequire.main = serverModule;
      customRequire.cache = require.cache;
      customRequire.resolve = require.resolve;

      // Read server.js source and wrap it in the standard Node.js module wrapper
      const source = fs.readFileSync(serverPath, 'utf8');
      const wrapped = Module.wrap(source);

      // Compile with the real filename so V8 attributes coverage to server.js
      const compiled = vm.runInThisContext(wrapped, { filename: serverPath });

      // Execute: require.main (customRequire.main) === module (serverModule)
      compiled(
        serverModule.exports,
        customRequire,
        serverModule,
        serverPath,
        path.dirname(serverPath)
      );

      // Verify the listen callback produced the startup message on stdout
      const output = stdoutSpy.mock.calls.map(
        (call) => call[0].toString()
      ).join('');
      expect(output).toContain('Server running at http://127.0.0.1:3000/');
    } finally {
      // Restore http.Server.prototype.listen and stdout spy
      http.Server.prototype.listen = originalHttpListen;
      stdoutSpy.mockRestore();
    }
  });
});
