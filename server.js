/**
 * @file server.js — Minimal Node.js HTTP server (zero runtime dependencies).
 *
 * Responds to every incoming HTTP request with status 200, header
 * Content-Type: text/plain, and body "Hello, World!" — regardless of
 * method, URL path, headers, or body content.
 *
 * Public API (CommonJS): { server, createServer, startServer, PORT, HOST }.
 *
 * Dual-mode execution: when run directly (`node server.js`) the module
 * auto-starts via the `require.main === module` guard; when imported via
 * `require('./server')` the exported `server` instance is returned in a
 * non-listening state and the consumer controls the lifecycle.
 */

// ─── Imports ──────────────────────────────────────────────────────────────────

const http = require('http');

// ─── Configuration ────────────────────────────────────────────────────────────

const PORT = 3000;
const HOST = 'localhost';

// ─── Request Handler ──────────────────────────────────────────────────────────

/**
 * Handles a single incoming HTTP request by responding with the static
 * "Hello, World!" body, status 200, and Content-Type: text/plain.
 *
 * Extracted from the previous inline arrow handler inside createServer()
 * to improve readability and to give the response path a single, named
 * entry point that can be referenced by name in diagnostics and reviews.
 *
 * The handler is method-agnostic, path-agnostic, header-agnostic, and
 * body-agnostic — every request receives the identical response.
 *
 * @param {http.IncomingMessage} req - The incoming HTTP request (ignored).
 * @param {http.ServerResponse}  res - The outgoing HTTP response.
 */
function handleRequest(req, res) {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Hello, World!');
}

// ─── Server Factory ───────────────────────────────────────────────────────────

/**
 * Creates a new HTTP server instance configured with the shared
 * handleRequest handler. The returned server is NOT yet listening —
 * call startServer() to bind it to a port and host.
 *
 * @returns {http.Server} A configured but not-yet-listening HTTP server instance.
 */
function createServer() {
  return http.createServer(handleRequest);
}

// ─── Startup Lifecycle ────────────────────────────────────────────────────────

/**
 * Starts a server instance on the specified port and host, logging a
 * startup message once the server is listening. If port or host are
 * omitted, defaults to the module-level PORT (3000) and HOST
 * ('localhost') constants.
 *
 * Extracted as a standalone function so that:
 *   1. The auto-start branch (`require.main === module`) is a single call.
 *   2. Server startup logic is directly testable without relying on child
 *      process execution, enabling V8 coverage tracking within Jest.
 *
 * @param {http.Server} serverInstance - A server created via createServer().
 * @param {number} [port] - Port number to bind to. Defaults to PORT (3000).
 * @param {string} [host] - Hostname to bind to. Defaults to HOST ('localhost').
 */
function startServer(serverInstance, port, host) {
  const effectivePort = typeof port === 'number' ? port : PORT;
  const effectiveHost = host ? host : HOST;

  // Handle server startup errors (e.g., EADDRINUSE) gracefully instead of
  // allowing an unhandled 'error' event to crash the process. Registration
  // MUST occur before .listen(...) so the handler is attached when the
  // underlying bind attempt fails synchronously or asynchronously.
  serverInstance.on('error', (err) => {
    console.error(`Failed to start server on ${effectiveHost}:${effectivePort} - ${err.message}`);
    process.exit(1);
  });

  serverInstance.listen(effectivePort, effectiveHost, () => {
    console.log(`Server running at http://${effectiveHost}:${effectivePort}/`);
  });
}

// ─── Shared Instance ──────────────────────────────────────────────────────────

const server = createServer();

// ─── Direct-Execution Guard ───────────────────────────────────────────────────

// Auto-start the server only when this file is executed directly
// (e.g., `node server.js`). When imported by tests or other modules,
// the server is NOT auto-started — the consumer controls the lifecycle.
if (require.main === module) {
  startServer(server, PORT, HOST);
}

// ─── Public API Exports ───────────────────────────────────────────────────────

module.exports = { server, createServer, startServer, PORT, HOST };
