/**
 * server.js — Node.js HTTP Server for the hao-backprop-test project.
 *
 * Purpose
 * -------
 * This file provides a minimal Node.js HTTP server that enforces an explicit
 * response contract for two GET endpoints. It uses ONLY the Node.js built-in
 * `http` module — there are zero runtime dependencies (no Express, Koa, Hapi,
 * Fastify, or any other framework).
 *
 * Response Contract (authoritative source: README.md + tech spec Section 2.1)
 * --------------------------------------------------------------------------
 *   | Endpoint          | Method | Status | Content-Type | Body              |
 *   |-------------------|--------|--------|--------------|-------------------|
 *   | /                 | GET    | 200    | text/plain   | "Hello, World!\n" |
 *   | /evening          | GET    | 200    | text/plain   | "Good evening"    |
 *   | <any other>       | <any>  | 404    | (default)    | "Not Found"       |
 *
 * Every 200 response uses `res.writeHead(statusCode, headers)` to EXPLICITLY
 * write the status line and headers to the network channel. This prevents
 * Node.js's "implicit header mode" (triggered by calling res.end() without a
 * prior writeHead()) from omitting or guessing the Content-Type header.
 *
 * Relationship to the Python Flask implementation
 * -----------------------------------------------
 * The active/primary server for this project is the Python Flask application
 * defined in `app.py` (factory) and `main.py` (entry point). That implementation
 * enforces the same response contract and is exercised by the 62-test pytest
 * suite under `tests/`. This Node.js file is the counterpart server that
 * satisfies the contract when invoked via `node server.js`, and it mirrors the
 * same environment configuration, startup logging, and error-handling patterns
 * used in `main.py` so both servers behave identically from a client's
 * perspective.
 *
 * Usage
 * -----
 *   node server.js                       # Starts server at http://127.0.0.1:3000/
 *   HOST=0.0.0.0 PORT=8080 node server.js # Overrides via environment variables
 *   const app = require('./server');     # Import without auto-starting (for tests)
 */

// Built-in Node.js HTTP module — no framework dependencies. This is the only
// `require()` in the entire file, satisfying the "zero runtime dependencies"
// constraint specified in AAP Section 0.5.3.
const http = require('http');

// ---------------------------------------------------------------------------
// Environment Configuration
// ---------------------------------------------------------------------------
// Read HOST and PORT from environment variables with the same defaults used
// by the Flask counterpart in `main.py`. Both servers therefore bind to the
// same interface+port by default (127.0.0.1:3000), and both support the same
// override mechanism. This enables clients, documentation, and tests to treat
// the two servers as interchangeable for the purposes of the response contract.

// Mirrors `main.py` line 35: `host = os.environ.get('HOST', '127.0.0.1')`.
// Note: default is '127.0.0.1' (loopback IPv4), NOT 'localhost' — this avoids
// IPv6/IPv4 ambiguity on systems where 'localhost' resolves to `::1` first.
const hostname = process.env.HOST || '127.0.0.1';

// Mirrors `main.py` line 38: `port = int(os.environ.get('PORT', 3000))`.
// `parseInt(undefined, 10)` returns `NaN`, and `parseInt('', 10)` returns `NaN`,
// so the `|| 3000` fallback correctly handles missing, empty, and non-numeric
// PORT values by reverting to the documented default of 3000.
const port = parseInt(process.env.PORT, 10) || 3000;

// ---------------------------------------------------------------------------
// HTTP Server and Request Handler
// ---------------------------------------------------------------------------
// `http.createServer()` accepts a request listener of the form (req, res) and
// returns a `http.Server` instance. The listener is invoked once per incoming
// request; it is responsible for writing a complete response (status + headers
// + body) before returning or calling `res.end()`.

const server = http.createServer((req, res) => {
  // Strip the query string from `req.url` before route matching. `req.url`
  // contains both path and query (e.g. '/evening?x=1'), so strict equality
  // against '/' or '/evening' would fail for requests with query parameters.
  // The AAP explicitly requires that `GET /?foo=bar` returns 200 — see the
  // "Boundary conditions and edge cases covered" bullet in AAP Section 0.3.3.
  const pathname = req.url.split('?')[0];

  if (req.method === 'GET' && pathname === '/') {
    // GET / → 200 text/plain "Hello, World!\n"
    //
    // Mirrors `app.py` line 150:
    //   return Response('Hello, World!\n', content_type='text/plain')
    //
    // `res.writeHead(statusCode, headers)` is used INSTEAD of
    // `res.setHeader()` + implicit `res.end()` because writeHead()
    // directly emits the status line and header block to the network
    // channel, guaranteeing that Content-Type is set exactly as specified.
    // Without a prior writeHead() call, Node.js enters "implicit header
    // mode" where Content-Type may be missing, auto-generated, or browser-
    // guessed — which would violate the response contract.
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    // Body is EXACTLY 'Hello, World!\n' — 14 bytes including the trailing
    // newline. The newline is mandatory (see README.md line 9 and tech spec
    // Section 2.1 F-001).
    res.end('Hello, World!\n');
  } else if (req.method === 'GET' && pathname === '/evening') {
    // GET /evening → 200 text/plain "Good evening"
    //
    // Mirrors `app.py` line 165:
    //   return Response('Good evening', content_type='text/plain')
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    // Body is EXACTLY 'Good evening' — 12 bytes with NO trailing newline.
    // The absence of a trailing newline is a deliberate contrast with the
    // '/' route; it is part of the documented response contract.
    res.end('Good evening');
  } else {
    // Fallback 404 handler for every other method+path combination,
    // including:
    //   - Undefined paths (e.g. GET /nonexistent)
    //   - Unsupported methods on defined paths (e.g. POST /, PUT /evening)
    //   - HEAD/OPTIONS requests (not part of the response contract)
    //
    // This matches the Express 5.x parity behavior implemented in `app.py`
    // lines 119–127, where the `@app.errorhandler(405)` handler converts
    // 405 Method Not Allowed responses to 404 Not Found so that every
    // undefined request is treated uniformly as "not found" rather than
    // "method not allowed".
    //
    // `res.writeHead(404)` writes the status line without explicit headers;
    // Node.js supplies the default reason phrase "Not Found" and default
    // headers (Date, Connection). No Content-Type is set because the AAP
    // does not require one for 404 responses (see the response contract
    // table in Section 0.4.1: "Content-Type (none required)").
    res.writeHead(404);
    res.end('Not Found');
  }
});

// ---------------------------------------------------------------------------
// Conditional Server Startup (Main-Module Guard)
// ---------------------------------------------------------------------------
// The `require.main === module` check is Node.js's equivalent of Python's
// `if __name__ == '__main__':` guard (see `main.py` line 47). It evaluates
// to true only when this file is executed directly via `node server.js`,
// and false when it is imported via `require('./server')` (e.g. by a test
// harness such as Jest + Supertest). This prevents the server from eagerly
// binding to a port during test runs, which would otherwise cause port
// conflicts and test isolation issues.

if (require.main === module) {
  // Attach the error handler BEFORE calling `server.listen()` so that bind
  // failures (most commonly EADDRINUSE when another process already owns
  // the port) are observed by this listener. `server.listen()` is
  // asynchronous, so a synchronous try/catch around it would not catch
  // bind errors — the `'error'` event is the canonical mechanism.
  //
  // Mirrors `main.py` lines 64–73:
  //   except OSError as e:
  //       print(f'Failed to start server: {e}', file=sys.stderr)
  //       sys.exit(1)
  server.on('error', (err) => {
    // Write to stderr (not stdout) so that monitoring/CI pipelines can
    // distinguish normal startup logs from error conditions. The message
    // format matches `main.py` line 72 exactly so that both servers produce
    // identical error output for the same failure mode (e.g. port conflict).
    console.error(`Failed to start server: ${err.message}`);
    // Exit with code 1 to signal failure to shell scripts and supervisors,
    // matching `main.py` line 73 (`sys.exit(1)`).
    process.exit(1);
  });

  // Bind the server to the configured port and hostname. The callback runs
  // only after the listening socket has been successfully created, so the
  // startup log message is a reliable indicator of readiness.
  //
  // Signature: server.listen(port, hostname, backlog?, callback)
  //   - port FIRST (integer)
  //   - hostname SECOND (string)
  //   - success callback LAST
  //
  // Success log format mirrors `main.py` line 81 exactly:
  //   print(f'Server running at http://{host}:{port}/')
  // Including the trailing '/' ensures the message is a valid clickable URL
  // in terminals that auto-linkify output.
  server.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
  });
}

// ---------------------------------------------------------------------------
// Module Export
// ---------------------------------------------------------------------------
// Export the server object so that test harnesses (e.g. Jest + Supertest)
// can import it via `const app = require('./server')` and pass it to
// `request(app)` without launching a separate listening process. This export
// is INTENTIONALLY placed outside the `require.main === module` block so
// that the server object is available to importers regardless of whether
// this file is executed directly or required as a module.
//
// This mirrors the Flask factory pattern used in `app.py` where the
// `create_app()` function returns a Flask application for test consumption
// by `tests/conftest.py` — both patterns provide a wired-up server object
// to tests without triggering a network bind.
module.exports = server;
