const http = require('http');

const PORT = 3000;
const HOST = 'localhost';

/**
 * Creates a new HTTP server instance that responds to all incoming requests
 * with "Hello, World!", status 200, and Content-Type: text/plain.
 *
 * The request handler is method-agnostic and path-agnostic — every request
 * receives the identical response regardless of HTTP method, URL path,
 * headers, or body content.
 *
 * @returns {http.Server} A configured but not-yet-listening HTTP server instance.
 */
function createServer() {
  return http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Hello, World!');
  });
}

/**
 * Starts a server instance on the specified port and host, logging a startup
 * message once the server is listening. If port or host are omitted, defaults
 * to the module-level PORT (3000) and HOST ('localhost') constants.
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
  // allowing an unhandled 'error' event to crash the process.
  serverInstance.on('error', (err) => {
    console.error(`Failed to start server on ${effectiveHost}:${effectivePort} - ${err.message}`);
    process.exit(1);
  });
  serverInstance.listen(effectivePort, effectiveHost, () => {
    console.log(`Server running at http://${effectiveHost}:${effectivePort}/`);
  });
}

const server = createServer();

// Auto-start the server only when this file is executed directly (node server.js).
// When imported by tests or other modules, the server is NOT auto-started,
// allowing the consumer to control the lifecycle programmatically.
if (require.main === module) {
  startServer(server, PORT, HOST);
}

module.exports = { server, createServer, startServer, PORT, HOST };
