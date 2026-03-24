"""
Flask Application Factory — replaces server.js app creation, configuration, and route
definitions.

This module provides the create_app() factory function that creates and configures a
Flask application with Express 5.x behavioral parity. Imported by main.py (for server
startup) and tests/conftest.py (for test client creation).

Key Express-to-Flask parity adjustments implemented here:
  - Case-insensitive routing (Express default) via before_request PATH_INFO rewriting
  - Trailing-slash tolerance via strict_slashes=False
  - 405 → 404 conversion for unsupported methods on defined routes
  - Double-slash normalization (// → /) via before_request PATH_INFO rewriting
  - X-Powered-By header absence (Flask default — no action needed)

Source reference: server.js lines 1, 8, 10–21, 36
"""

# Replaces: const express = require('express') (server.js line 1)
# Flask provides the app class, Response for explicit content-type responses,
# and request proxy for PATH_INFO normalization in the before_request middleware.
from flask import Flask, Response, request


def create_app():
    """
    Create and configure a Flask application with Express 5.x behavioral parity.

    This factory function replaces the Express app creation pattern in server.js:
      const app = express();          → app = Flask(__name__)
      app.disable('x-powered-by');    → Not needed (Flask has no X-Powered-By)
      app.get('/', handler);          → @app.route('/', methods=['GET'])
      module.exports = app;           → return app

    The factory pattern ensures import safety — importing this module does not
    start a server, and each caller (including tests) gets a fresh app instance
    for proper isolation.

    Returns:
        Flask: A fully configured Flask application instance with two GET routes
        (/ and /evening) and Express 5.x behavioral parity middleware.
    """
    # Replaces: const app = express() (server.js line 8)
    app = Flask(__name__)

    # Express 5.x non-strict routing matches /evening/ to /evening by default.
    # Flask is strict about trailing slashes by default — disable for parity.
    # Without this, GET /evening/ would return 404 instead of matching /evening.
    app.url_map.strict_slashes = False

    # Note: Express's app.disable('x-powered-by') (server.js lines 10–11) has no
    # Flask equivalent needed because Flask does not emit an X-Powered-By header
    # by default. Tests still assert its absence for behavioral parity verification.

    # -------------------------------------------------------------------------
    # URL Normalization Middleware (before_request)
    # -------------------------------------------------------------------------
    # Express 5.x applies two transparent normalizations that Flask does not:
    #   1. Case-insensitive routing — /Evening and /EVENING match /evening
    #   2. Double-slash collapsing — // normalizes to /
    # This before_request handler modifies PATH_INFO in-place for transparent
    # rewriting (200 response), avoiding Flask's default redirect (308) behavior.

    @app.before_request
    def normalize_path():
        """Normalize request path for Express 5.x behavioral parity.

        Reads request.path to inspect the current URL path, then modifies
        request.environ['PATH_INFO'] in-place when normalization is needed.

        Because Flask performs URL matching BEFORE before_request hooks run,
        simply modifying PATH_INFO is not enough — the routing decision has
        already been made. When the path needs normalization, this hook manually
        re-matches the normalized URL against the URL map and directly invokes
        the matched view function, returning a transparent 200 response (not a
        308 redirect) to match Express 5.x behavior.
        """
        path = request.path

        # Express 5.x defaults to case-insensitive routing (caseSensitive: false).
        # Flask is case-sensitive by default — lowercase the path for parity.
        # Example: GET /Evening → internally rewritten to GET /evening
        normalized = path.lower()

        # Express 5.x normalizes consecutive slashes to a single slash transparently.
        # Flask would redirect (308) or return 404 — collapse slashes instead.
        # Example: GET // → internally rewritten to GET /
        while '//' in normalized:
            normalized = normalized.replace('//', '/')

        # Only re-route if normalization actually changed the path.
        if normalized != path:
            # Update PATH_INFO in environ so the URL adapter sees the normalized path.
            request.environ['PATH_INFO'] = normalized

            # Manually re-match the normalized URL and invoke the view function.
            # This is necessary because Flask already performed URL matching with
            # the original (non-normalized) path before this hook ran.
            try:
                adapter = app.url_map.bind_to_environ(request.environ)
                endpoint, values = adapter.match()
                return app.view_functions[endpoint](**values)
            except Exception:
                # URL did not match or method not allowed after normalization.
                # Fall through to Flask's default error handling for proper
                # 404 or 405→404 response via the errorhandler below.
                return None

        # Path already normalized — return None to continue to the matched route.
        return None

    # -------------------------------------------------------------------------
    # 405 → 404 Error Handler
    # -------------------------------------------------------------------------
    # Express 5.x returns 404 Not Found for unsupported HTTP methods on defined
    # routes (e.g., POST / returns 404). Flask returns 405 Method Not Allowed by
    # default. This error handler converts 405 responses to 404 for parity.

    @app.errorhandler(405)
    def method_not_allowed_to_not_found(e):
        """Convert 405 Method Not Allowed to 404 Not Found (Express 5.x parity).

        Express 5.x treats undefined method+path combinations as "not found"
        rather than "method not allowed". This handler ensures POST /, PUT /,
        DELETE /, PATCH /, and equivalent requests on /evening all return 404.
        """
        return Response('Not Found', status=404)

    # -------------------------------------------------------------------------
    # Route Definitions
    # -------------------------------------------------------------------------
    # Both routes explicitly specify methods=['GET'] to restrict to GET only.
    # Flask automatically handles HEAD requests for GET routes, returning the
    # same status and headers but no body — matching Express 5.x behavior.

    @app.route('/', methods=['GET'])
    def hello():
        """GET / — Returns 'Hello, World!\\n' with text/plain content type.

        Replaces Express route handler (server.js lines 13–16):
            app.get('/', (req, res) => {
                res.set('Content-Type', 'text/plain');
                res.send('Hello, World!\\n');
            });

        Response body is exactly 'Hello, World!\\n' (with trailing newline).
        Content-Type is explicitly set to text/plain via Flask Response object,
        replacing Express's res.set('Content-Type', 'text/plain') + res.send().
        """
        return Response('Hello, World!\n', content_type='text/plain')

    @app.route('/evening', methods=['GET'])
    def evening():
        """GET /evening — Returns 'Good evening' with text/plain content type.

        Replaces Express route handler (server.js lines 18–21):
            app.get('/evening', (req, res) => {
                res.set('Content-Type', 'text/plain');
                res.send('Good evening');
            });

        Response body is exactly 'Good evening' (no trailing newline).
        Content-Type is explicitly set to text/plain via Flask Response object.
        """
        return Response('Good evening', content_type='text/plain')

    return app
