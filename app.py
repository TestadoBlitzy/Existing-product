"""Flask application entry point — replaces the original Node.js server.js.

This module implements a minimal HTTP server using the Flask framework that
produces identical behavior to the original Node.js http.createServer() server:
  - Binds to 127.0.0.1:3000 (localhost only)
  - Responds to every HTTP request (any method, any path) with:
      Status: 200 OK
      Content-Type: text/plain
      Body: Hello, World!\n
"""

from flask import Flask, Response

# ---------------------------------------------------------------------------
# Application instance
# ---------------------------------------------------------------------------
app = Flask(__name__)

# ---------------------------------------------------------------------------
# Configuration constants — match the original Node.js server.js values exactly
# ---------------------------------------------------------------------------
HOST = '127.0.0.1'
PORT = 3000
METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']


# ---------------------------------------------------------------------------
# Catch-all route — replicates the Node.js universal request handler
#
# The original server.js responds identically to ALL HTTP requests regardless
# of method or URL path. This dual-decorator pattern achieves the same behavior
# in Flask: the first decorator handles the root path '/', and the second
# handles every other path via Flask's path: converter.
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
    return Response('Hello, World!\n', status=200, mimetype='text/plain')


# ---------------------------------------------------------------------------
# Entry point guard — equivalent to Node.js server.listen()
#
# Flask's built-in development server handles startup logging automatically,
# printing the host and port to stdout when the server starts.
# ---------------------------------------------------------------------------
if __name__ == '__main__':
    app.run(host=HOST, port=PORT)
