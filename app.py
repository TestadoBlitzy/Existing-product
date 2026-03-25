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
# Universal request handler (before_request)
# ---------------------------------------------------------------------------
# The original Node.js http.createServer callback handles every incoming HTTP
# request regardless of method or path — including non-standard methods such
# as TRACE, CONNECT, and arbitrary custom methods.  Flask's route-decorator
# approach only supports an explicit allow-list of methods; any method not in
# the list triggers a 405 Method Not Allowed response.
#
# To achieve true behavioral fidelity with the Node.js server, a
# before_request handler is used instead of route decorators.  This handler
# runs before Flask's URL routing and method checking, so it intercepts every
# request — any method, any path — and returns the static response directly.
@app.before_request
def hello_world():
    """Return a static plain-text response for every request.

    This handler is intentionally stateless — it does not inspect, log, or
    transform any request data.  The response body is exactly 14 bytes:
    ``Hello, World!\\n`` (including the trailing newline character).

    Because this is a ``before_request`` handler that always returns a
    ``Response`` object, Flask short-circuits the normal URL dispatching
    pipeline.  This ensures that every HTTP method — standard (GET, POST,
    PUT, DELETE, PATCH, OPTIONS, HEAD) and non-standard (TRACE, CONNECT,
    and any custom method) — receives an identical 200 OK response,
    matching the behavior of the original Node.js ``http.createServer``.

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
