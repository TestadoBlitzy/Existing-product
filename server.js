/**
 * server.js — Minimal Node.js HTTP server for the hao-backprop-test project.
 *
 * Uses ONLY the Node.js built-in `http` module (zero runtime dependencies — no
 * Express, Koa, Hapi, Fastify, etc.). This is the Node.js counterpart to the
 * Python Flask server in app.py + main.py; both servers enforce the identical
 * response contract (authoritative source: README.md + tech spec Section 2.1):
 *
 *   GET|HEAD /        → 200, Content-Type: text/plain, body "Hello, World!\n"
 *   GET|HEAD /evening → 200, Content-Type: text/plain, body "Good evening"
 *   <any other>       → 404, body "Not Found"
 *
 * res.writeHead() is used over res.setHeader() to emit the status line and
 * Content-Type header explicitly, preventing Node's "implicit header mode"
 * (triggered by a bare res.end()) from omitting or guessing the header. HEAD
 * requests are served by matching both GET and HEAD on the read routes; Node
 * automatically strips the body on the wire for HEAD, mirroring Flask's
 * automatic HEAD handling (app.py lines 133–134) and satisfying AAP Sections
 * 0.3.3, 0.6.1, and 0.6.3 (`curl -sI` verification commands).
 *
 * Usage:
 *   node server.js                        # start at http://127.0.0.1:3000/
 *   HOST=0.0.0.0 PORT=8080 node server.js # override via env vars
 *   const app = require('./server');      # import without auto-start (tests)
 */

const http = require('http'); // built-in — zero runtime dependencies.

// Env configuration mirrors main.py lines 35 and 38 so both servers bind to
// the same default interface:port (127.0.0.1:3000) with the same override
// mechanism. Default HOST is '127.0.0.1' (loopback IPv4), NOT 'localhost'.
const hostname = process.env.HOST || '127.0.0.1';
const port = parseInt(process.env.PORT, 10) || 3000;

const server = http.createServer((req, res) => {
  // Strip query string so '/?foo=bar' still matches '/' (AAP 0.3.3 edge case).
  const pathname = req.url.split('?')[0];
  // Accept GET and HEAD on the read routes — HEAD returns the same status
  // and headers as GET with an empty body (Node.js auto-strips the body).
  // Matches Flask/Express 5.x behavior documented at app.py lines 133–134.
  const isRead = req.method === 'GET' || req.method === 'HEAD';

  if (isRead && pathname === '/') {
    // Mirrors app.py line 150. Body is exactly 14 bytes incl. trailing '\n'.
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Hello, World!\n');
  } else if (isRead && pathname === '/evening') {
    // Mirrors app.py line 165. Body is exactly 12 bytes, NO trailing newline.
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Good evening');
  } else {
    // Undefined paths or unsupported methods — unified 404 response matching
    // the 405→404 conversion in app.py lines 119–127 (Express 5.x parity).
    res.writeHead(404);
    res.end('Not Found');
  }
});

// `require.main === module` is Node's equivalent of Python's
// `if __name__ == '__main__':` guard (main.py line 47) — prevents auto-start
// when this file is imported by a test harness via require('./server').
if (require.main === module) {
  // Register the 'error' handler BEFORE listen() — bind failures (e.g.
  // EADDRINUSE) are asynchronous and only surface via the 'error' event.
  // Mirrors main.py lines 64–73 (stderr + exit code 1).
  server.on('error', (err) => {
    console.error(`Failed to start server: ${err.message}`);
    process.exit(1);
  });

  // Success log format matches main.py line 81 exactly (trailing '/' included).
  server.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
  });
}

// Exported outside the guard so `require('./server')` receives the server
// object regardless of execution context (enables Supertest-style testing).
module.exports = server;
