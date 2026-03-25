"""Flask application replacing the original Node.js HTTP server (server.js).

This module implements a minimal Flask web application that exactly reproduces
the runtime behavior of the original Node.js server: every HTTP request,
regardless of method or path, returns a plain-text 'Hello, World!\n' response
with HTTP status 200 and Content-Type text/plain.

The server binds to 127.0.0.1:3000, matching the original Node.js binding.
"""

from flask import Flask, Response

# ---------------------------------------------------------------------------
# Application instance
# ---------------------------------------------------------------------------
# Create the Flask WSGI application. This is the module-level object that
# serves as the central registry for routes and configuration.
app = Flask(__name__)


# ---------------------------------------------------------------------------
# Catch-all route handler
# ---------------------------------------------------------------------------
# Two decorators are required to cover every possible URL:
#   1. The root path '/' with defaults={'path': ''} handles requests to '/'.
#   2. The '<path:path>' converter catches every other URL path segment,
#      including nested paths like '/foo/bar/baz'.
#
# The 'methods' list explicitly enumerates all standard HTTP methods so that
# the handler responds identically to GET, POST, PUT, DELETE, PATCH, OPTIONS,
# and HEAD — reproducing the universal request handling of the Node.js server.
@app.route(
    '/',
    defaults={'path': ''},
    methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
)
@app.route(
    '/<path:path>',
    methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
)
def hello_world(path):
    """Return a static plain-text response for every request.

    This handler is intentionally stateless — it does not inspect, log, or
    transform any request data.  The response body is exactly 14 bytes:
    ``Hello, World!\\n`` (including the trailing newline character).

    Args:
        path: Captured URL path segment (unused). Required by the
              ``<path:path>`` route converter but not referenced in the
              handler body.

    Returns:
        A ``flask.Response`` with status 200, mimetype ``text/plain``,
        and body ``Hello, World!\\n``.
    """
    return Response('Hello, World!\n', status=200, mimetype='text/plain')


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == '__main__':
    # Print the startup message to stdout *before* starting the server,
    # exactly matching the original Node.js console.log output.
    print('Server running at http://127.0.0.1:3000/')
    # Bind to the same host and port as the original Node.js server.
    app.run(host='127.0.0.1', port=3000)
