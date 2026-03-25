"""Flask application entry point — replaces the original Node.js server.js.

This module implements a minimal HTTP server using the Flask framework that
produces identical behavior to the original Node.js http.createServer() server:
  - Binds to 127.0.0.1:3000 (localhost only)
  - Responds to every HTTP request (any method, any path) with:
      Status: 200 OK
      Content-Type: text/plain
      Body: Hello, World!\n

Originally implemented as a Node.js http.createServer() server in server.js;
migrated to Python/Flask to align with the Backprop testing infrastructure.
"""

# Flask: web framework core; Response: custom HTTP reply builder; jsonify: JSON response helper
from flask import Flask, Response, jsonify

# ---------------------------------------------------------------------------
# Application instance
# ---------------------------------------------------------------------------
# __name__ resolves to '__main__' when run directly, enabling Flask to locate
# resources relative to the application module.
app = Flask(__name__)

# ---------------------------------------------------------------------------
# Configuration constants — match the original Node.js server.js values exactly
# ---------------------------------------------------------------------------
HOST = '127.0.0.1'   # Localhost-only; prevents external network exposure
PORT = 3000           # Matches the original Node.js server.js port
METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']  # All standard HTTP methods


# ---------------------------------------------------------------------------
# Health check endpoint — programmatic service availability verification
# Registered before the catch-all route so Flask matches GET /health here
# rather than falling through to the generic handler.
# ---------------------------------------------------------------------------
@app.route('/health', methods=['GET'])
def health():
    """Return a JSON health status response for monitoring and pipeline checks.

    Returns:
        A JSON response with status 200 and body {"status": "ok"}.
    """
    return jsonify(status='ok')


# ---------------------------------------------------------------------------
# Catch-all route — replicates the Node.js universal request handler
#
# The original server.js responds identically to ALL HTTP requests regardless
# of method or URL path. This dual-decorator pattern achieves the same behavior
# in Flask: the first decorator handles the root path '/', and the second
# handles every other path via Flask's path: converter.
#
# Why two decorators? Flask's <path:path> converter does not match the empty
# string, so the root URL '/' must be handled separately. The first decorator
# uses defaults={'path': ''} to supply a compatible function signature for both
# URL rules. This is one function with two URL rules — not two separate routes.
# ---------------------------------------------------------------------------
@app.route('/', defaults={'path': ''}, methods=METHODS)
@app.route('/<path:path>', methods=METHODS)
def catch_all(path):
    """Return a plain-text 'Hello, World!' response for every request.

    Args:
        path: The URL path captured by Flask's routing. Ignored — the response
              is always the same regardless of path or HTTP method.

    Returns:
        A Flask Response with status 200, mimetype text/plain, and body
        'Hello, World!\\n' (including trailing newline for exact behavioral
        match with the original Node.js server).
    """
    # Trailing '\n' in the body preserves exact Node.js behavioral parity.
    return Response('Hello, World!\n', status=200, mimetype='text/plain')


# ---------------------------------------------------------------------------
# Entry point guard — equivalent to Node.js server.listen()
#
# The __main__ guard ensures the server only starts when app.py is executed
# directly (e.g., `python app.py`), not when imported as a module by tests
# or other application code.
#
# Flask's built-in development server handles startup logging automatically,
# printing the host and port to stdout when the server starts.
# ---------------------------------------------------------------------------
if __name__ == '__main__':
    app.run(host=HOST, port=PORT)  # Starts Werkzeug development server (not production-grade)
