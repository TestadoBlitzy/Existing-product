/**
 * @file server.test.js — Comprehensive Jest Unit Test Suite for server.js
 *
 * Tests HTTP responses, status codes, headers, server startup/shutdown,
 * error handling, and edge cases for a minimal Node.js HTTP server that
 * returns "Hello, World!" with status 200 and Content-Type: text/plain
 * for every incoming request regardless of HTTP method, URL, or body.
 *
 * Framework: Jest 30.x (CommonJS)
 * HTTP Client: Node.js built-in http module
 * Port Strategy: Ephemeral ports (port 0) for all test-managed servers
 *
 * @see server.js — Source file under test
 * @see jest.config.js — Jest configuration
 */

'use strict';

const { server, createServer, startServer, PORT, HOST } = require('./server');
const http = require('http');
const net = require('net');

// ─── Helper Function ──────────────────────────────────────────────────────────

/**
 * Sends an HTTP request to a running server and collects the full response
 * including status code, headers, and body content.
 *
 * Uses the Node.js built-in http.request() as the HTTP client to avoid
 * introducing any external testing dependencies (e.g., supertest).
 *
 * @param {http.Server} targetServer - A currently listening server instance.
 *   Must have been started via server.listen() before calling this function.
 * @param {Object} [options={}] - Request configuration options.
 * @param {string} [options.method='GET'] - HTTP method (GET, POST, PUT, etc.).
 * @param {string} [options.path='/'] - URL path including any query string.
 * @param {Object} [options.headers={}] - Additional request headers to send.
 * @param {string} [options.body] - Optional request body content to send.
 * @returns {Promise<{statusCode: number, headers: Object, body: string}>}
 *   Resolves with the response status code, headers object, and full body string.
 */
function makeRequest(targetServer, options = {}) {
  return new Promise((resolve, reject) => {
    const addr = targetServer.address();
    const reqOptions = {
      hostname: 'localhost',
      port: addr.port,
      path: options.path || '/',
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    const req = http.request(reqOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk.toString();
      });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, headers: res.headers, body });
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('HTTP Server', () => {
  // Suppress console.log output from server.js during all tests
  let consoleSpy;

  beforeAll(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterAll(() => {
    consoleSpy.mockRestore();
  });

  // ─── Server Startup ───────────────────────────────────────────────────────

  describe('Server Startup', () => {
    test('should create a valid server object via createServer()', () => {
      const testServer = createServer();
      expect(testServer).toBeDefined();
      expect(testServer).toBeInstanceOf(http.Server);
    });

    test('should bind to an ephemeral port and emit listening event', (done) => {
      const testServer = createServer();
      testServer.listen(0, () => {
        expect(testServer.listening).toBe(true);
        const addr = testServer.address();
        expect(addr).toBeDefined();
        expect(typeof addr.port).toBe('number');
        expect(addr.port).toBeGreaterThan(0);
        testServer.close(done);
      });
    });

    test('should not auto-start when imported as a module', () => {
      // The exported server instance should not be listening because
      // require.main !== module when loaded by Jest
      expect(server).toBeDefined();
      expect(server).toBeInstanceOf(http.Server);
      expect(server.listening).toBe(false);
    });
  });

  // ─── startServer Function ─────────────────────────────────────────────────

  describe('startServer Function', () => {
    test('should start server on an explicit ephemeral port and host', (done) => {
      const testSrv = createServer();
      startServer(testSrv, 0, 'localhost');
      testSrv.on('listening', () => {
        expect(testSrv.listening).toBe(true);
        expect(consoleSpy).toHaveBeenCalled();
        testSrv.close(done);
      });
    });

    test('should default to PORT and HOST when parameters are omitted', () => {
      const testSrv = createServer();
      const listenSpy = jest.spyOn(testSrv, 'listen').mockImplementation(
        (port, host, cb) => { if (cb) cb(); }
      );
      startServer(testSrv);
      expect(listenSpy).toHaveBeenCalledWith(PORT, HOST, expect.any(Function));
      expect(consoleSpy).toHaveBeenCalledWith(
        `Server running at http://${HOST}:${PORT}/`
      );
      listenSpy.mockRestore();
    });
  });

  // ─── HTTP Responses ───────────────────────────────────────────────────────

  describe('HTTP Responses', () => {
    let responseServer;

    beforeAll((done) => {
      responseServer = createServer();
      responseServer.listen(0, done);
    });

    afterAll((done) => {
      if (responseServer && responseServer.listening) {
        responseServer.close(done);
      } else {
        done();
      }
    });

    test('should return 200 status code for GET request', async () => {
      const res = await makeRequest(responseServer);
      expect(res.statusCode).toBe(200);
      expect(res.body).toBe('Hello, World!');
    });

    test('should return "Hello, World!" as response body', async () => {
      const res = await makeRequest(responseServer);
      expect(res.body).toBe('Hello, World!');
      expect(typeof res.body).toBe('string');
    });

    test('should return Content-Type: text/plain header', async () => {
      const res = await makeRequest(responseServer);
      expect(res.headers['content-type']).toBe('text/plain');
      expect(res.statusCode).toBe(200);
    });

    test('should return identical responses for multiple sequential requests', async () => {
      const res1 = await makeRequest(responseServer);
      const res2 = await makeRequest(responseServer);
      const res3 = await makeRequest(responseServer);
      expect(res1.body).toBe('Hello, World!');
      expect(res1.body).toBe(res2.body);
      expect(res2.body).toBe(res3.body);
    });
  });

  // ─── HTTP Method Agnosticism ──────────────────────────────────────────────

  describe('HTTP Method Agnosticism', () => {
    let methodServer;

    beforeAll((done) => {
      methodServer = createServer();
      methodServer.listen(0, done);
    });

    afterAll((done) => {
      if (methodServer && methodServer.listening) {
        methodServer.close(done);
      } else {
        done();
      }
    });

    const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];

    test.each(methods)(
      'should return 200 and correct response for %s request',
      async (method) => {
        const res = await makeRequest(methodServer, { method });
        expect(res.statusCode).toBe(200);
        expect(res.headers['content-type']).toBe('text/plain');
        // HEAD responses have no body per HTTP specification (RFC 7231 §4.3.2)
        if (method !== 'HEAD') {
          expect(res.body).toBe('Hello, World!');
        }
      }
    );
  });

  // ─── URL Path Agnosticism ─────────────────────────────────────────────────

  describe('URL Path Agnosticism', () => {
    let pathServer;

    beforeAll((done) => {
      pathServer = createServer();
      pathServer.listen(0, done);
    });

    afterAll((done) => {
      if (pathServer && pathServer.listening) {
        pathServer.close(done);
      } else {
        done();
      }
    });

    const paths = [
      '/',
      '/foo',
      '/bar/baz',
      '/any/arbitrary/path',
      '/with?query=string',
    ];

    test.each(paths)(
      'should return Hello, World! for path %s',
      async (path) => {
        const res = await makeRequest(pathServer, { path });
        expect(res.statusCode).toBe(200);
        expect(res.body).toBe('Hello, World!');
        expect(res.headers['content-type']).toBe('text/plain');
      }
    );
  });

  // ─── Edge Cases ───────────────────────────────────────────────────────────

  describe('Edge Cases', () => {
    let edgeServer;

    beforeAll((done) => {
      edgeServer = createServer();
      edgeServer.listen(0, done);
    });

    afterAll((done) => {
      if (edgeServer && edgeServer.listening) {
        edgeServer.close(done);
      } else {
        done();
      }
    });

    test('should handle request with custom headers', async () => {
      const res = await makeRequest(edgeServer, {
        headers: {
          'X-Custom-Header': 'test-value',
          'Accept': 'application/json',
        },
      });
      expect(res.statusCode).toBe(200);
      expect(res.body).toBe('Hello, World!');
    });

    test('should handle request with body content', async () => {
      const requestBody = JSON.stringify({ key: 'value', nested: { data: true } });
      const res = await makeRequest(edgeServer, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody,
      });
      expect(res.statusCode).toBe(200);
      expect(res.body).toBe('Hello, World!');
    });

    test('should handle concurrent requests correctly', async () => {
      const concurrentCount = 5;
      const requests = Array.from({ length: concurrentCount }, () =>
        makeRequest(edgeServer)
      );
      const results = await Promise.all(requests);
      expect(results).toHaveLength(concurrentCount);
      results.forEach((res) => {
        expect(res.statusCode).toBe(200);
        expect(res.body).toBe('Hello, World!');
      });
    });
  });

  // ─── Server Shutdown ──────────────────────────────────────────────────────

  describe('Server Shutdown', () => {
    test('should invoke callback when server.close() is called', (done) => {
      const shutdownServer = createServer();
      shutdownServer.listen(0, () => {
        expect(shutdownServer.listening).toBe(true);
        shutdownServer.close(() => {
          // Reaching this callback confirms close() invoked it
          expect(shutdownServer.listening).toBe(false);
          done();
        });
      });
    });

    test('should release the port after close()', (done) => {
      const firstServer = createServer();
      firstServer.listen(0, () => {
        const port = firstServer.address().port;
        expect(port).toBeGreaterThan(0);
        firstServer.close(() => {
          // Port should now be free — bind another server to the same port
          const secondServer = createServer();
          secondServer.listen(port, () => {
            expect(secondServer.listening).toBe(true);
            expect(secondServer.address().port).toBe(port);
            secondServer.close(done);
          });
        });
      });
    });

    test('should set server.listening to false after close()', (done) => {
      const closeServer = createServer();
      closeServer.listen(0, () => {
        expect(closeServer.listening).toBe(true);
        closeServer.close(() => {
          expect(closeServer.listening).toBe(false);
          expect(closeServer.address()).toBeNull();
          done();
        });
      });
    });
  });

  // ─── Error Handling ───────────────────────────────────────────────────────

  describe('Error Handling', () => {
    test('should emit error event when port is already in use (EADDRINUSE)', (done) => {
      // Pre-occupy a port using a low-level TCP server via the net module
      const blockingServer = net.createServer();
      blockingServer.listen(0, () => {
        const occupiedPort = blockingServer.address().port;

        // Attempt to start our HTTP server on the same occupied port
        const conflictServer = createServer();
        conflictServer.on('error', (err) => {
          expect(err).toBeDefined();
          expect(err.code).toBe('EADDRINUSE');
          // Defensive cleanup: explicitly close the failed server even though
          // it never reached listening state and holds no port resource.
          conflictServer.close(() => {
            blockingServer.close(() => done());
          });
        });

        conflictServer.listen(occupiedPort);
      });
    });

    test('startServer should handle EADDRINUSE gracefully and exit', (done) => {
      // Mock process.exit to prevent actual process termination during the test
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
      // Mock console.error to capture and verify the error message
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Pre-occupy a port using a low-level TCP server on localhost
      const blockingServer = net.createServer();
      blockingServer.listen(0, 'localhost', () => {
        const occupiedPort = blockingServer.address().port;

        // Create a server and start it via the production startServer function
        const testServer = createServer();
        startServer(testServer, occupiedPort, 'localhost');

        // Register a verification listener after startServer so the production
        // error handler (registered first inside startServer) fires before this one.
        testServer.on('error', () => {
          try {
            // Verify the production error handler called console.error with a descriptive message
            expect(errorSpy).toHaveBeenCalledWith(
              expect.stringContaining('Failed to start server')
            );
            // Verify process.exit was called with code 1
            expect(exitSpy).toHaveBeenCalledWith(1);
          } finally {
            // Clean up: restore mocks and close servers on ALL code paths
            // (including assertion failures) to prevent mock leaks
            errorSpy.mockRestore();
            exitSpy.mockRestore();
            testServer.close(() => {
              blockingServer.close(() => done());
            });
          }
        });
      });
    });

    test('should be restartable after close on same port', (done) => {
      const restartServer = createServer();
      restartServer.listen(0, () => {
        const port = restartServer.address().port;
        expect(restartServer.listening).toBe(true);

        restartServer.close(() => {
          expect(restartServer.listening).toBe(false);

          // Create a new server and start it on the same port
          const newServer = createServer();
          newServer.listen(port, () => {
            expect(newServer.listening).toBe(true);
            expect(newServer.address().port).toBe(port);
            newServer.close(done);
          });
        });
      });
    });

    test('should reject new connections after server is closed', (done) => {
      const closingServer = createServer();
      closingServer.listen(0, () => {
        const port = closingServer.address().port;
        expect(port).toBeGreaterThan(0);

        closingServer.close(() => {
          // Attempt to connect to the server after it has been closed;
          // the operating system should refuse the connection immediately.
          const req = http.get({ hostname: 'localhost', port }, () => {
            done(new Error('Connection should have been refused after close'));
          });
          req.on('error', (err) => {
            expect(err).toBeDefined();
            expect(err.code).toBe('ECONNREFUSED');
            done();
          });
        });
      });
    });
  });

  // ─── Auto-Start (Direct Execution) ──────────────────────────────────────

  describe('Auto-Start (Direct Execution)', () => {
    /**
     * Verifies that `node server.js` starts the server via the
     * `if (require.main === module)` branch, binds to localhost:3000,
     * logs the startup message, and responds correctly.
     *
     * This test uses child_process.fork() to execute server.js as the
     * main module in a separate Node.js process, which is the only way
     * to make `require.main === module` evaluate to `true`.
     *
     * Note: Because the child process runs in its own V8 isolate, this
     * execution is NOT tracked by Jest's V8 coverage.  The auto-start
     * branch (lines 28-31 of server.js) is therefore verified
     * behaviorally but excluded from Jest coverage metrics.  Coverage
     * thresholds in jest.config.js are calibrated to the achievable
     * ceiling within Jest's single-process V8 context.
     */
    test('should start listening and respond when run via node server.js', (done) => {
      const { fork } = require('child_process');
      const path = require('path');

      const serverProcess = fork(path.join(__dirname, 'server.js'), [], {
        silent: true, // pipe stdout/stderr instead of inheriting
        // Force IPv4-first DNS resolution so that 'localhost' resolves to
        // 127.0.0.1 instead of ::1. In some container environments, the IPv6
        // loopback address [::1]:3000 may be occupied by an invisible process,
        // causing the server to fail with EADDRINUSE before it can start.
        execArgv: ['--dns-result-order=ipv4first'],
      });

      let completed = false;
      let stdout = '';
      let safetyTimer;

      /** Terminates the child process, clears timers, and invokes done() once. */
      const finish = (err) => {
        if (completed) return;
        completed = true;
        clearTimeout(safetyTimer);
        serverProcess.kill('SIGTERM');
        err ? done(err) : done();
      };

      serverProcess.stdout.on('data', (data) => {
        stdout += data.toString();

        // Wait for the startup message before sending a request
        if (stdout.includes('Server running at http://localhost:3000/')) {
          expect(stdout).toContain('Server running at http://localhost:3000/');

          http.get('http://127.0.0.1:3000', (res) => {
            let body = '';
            res.on('data', (chunk) => {
              body += chunk;
            });
            res.on('end', () => {
              expect(res.statusCode).toBe(200);
              expect(body).toBe('Hello, World!');
              finish();
            });
          }).on('error', (err) => {
            finish(err);
          });
        }
      });

      serverProcess.on('error', (err) => {
        finish(err);
      });

      // Safety timeout: if the server does not start within 4 seconds, fail
      safetyTimer = setTimeout(() => {
        finish(new Error('Server process did not emit startup message within 4 seconds'));
      }, 4000);
    });
  });
});
