"""
Startup Entry Point — replaces the server.js conditional startup block (lines 23–34).

This module is the sole entry point for running the Flask development server.
It reads HOST and PORT from environment variables (with safe defaults), creates
the Flask application via the create_app() factory, verifies port availability,
prints a startup confirmation message to stdout, and starts the blocking Flask
development server.

Error handling mirrors the Express 5.x error-first callback pattern:
  - Success: logs 'Server running at http://{host}:{port}/' to stdout
  - Failure (e.g. EADDRINUSE port conflict): logs to stderr, exits with code 1

Import safety: importing this module does NOT start the server — the startup
logic is guarded by `if __name__ == '__main__':`, replacing the CommonJS
`require.main === module` guard from server.js line 23.

Source reference: server.js lines 3–6 (env config) and lines 23–34 (startup block)
"""

import os  # For os.environ.get() — replaces process.env (server.js lines 4, 6)
import socket  # For port availability pre-check before Flask startup
import sys  # For sys.exit(1) and sys.stderr — replaces process.exit(1) and console.error()

from app import create_app  # Flask app factory — replaces require('../server') pattern

# ---------------------------------------------------------------------------
# Environment Configuration
# ---------------------------------------------------------------------------
# Read HOST and PORT from environment variables with defaults matching server.js.
# These are module-level constants so they can be inspected by tests without
# triggering server startup.

# Replaces: const hostname = process.env.HOST || '127.0.0.1' (server.js line 4)
host = os.environ.get('HOST', '127.0.0.1')

# Replaces: const port = parseInt(process.env.PORT, 10) || 3000 (server.js line 6)
port = int(os.environ.get('PORT', 3000))

# ---------------------------------------------------------------------------
# Main Guard — Startup Entry Point
# ---------------------------------------------------------------------------
# Replaces: if (require.main === module) { ... } (server.js line 23)
# This guard ensures that importing main.py (e.g. in tests) does NOT start
# the server. Only direct execution (python main.py) triggers startup.

if __name__ == '__main__':
    # Create the Flask application using the factory from app.py.
    # This replaces the implicit app reference inside the require.main guard
    # in server.js, where `app` was already module-scoped.
    app = create_app()

    # Pre-check port availability before starting Flask.
    # Werkzeug's BaseWSGIServer catches OSError internally during server_bind()
    # and calls sys.exit(1) with its own error format. By pre-checking here,
    # we ensure our 'Failed to start server: {error}' format is used instead,
    # matching the Express 5.x error callback pattern (server.js lines 26–30).
    # The test socket uses default settings (no SO_REUSEADDR) so that binding
    # fails if and only if the port is genuinely occupied.
    try:
        _sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        _sock.bind((host, port))
        _sock.close()
    except OSError as e:
        # OSError covers socket-level errors including errno.EADDRINUSE (port
        # already in use). This replaces the Express 5.x error-first callback:
        #   if (err) {
        #       console.error(`Failed to start server: ${err.message}`);
        #       process.exit(1);
        #   }
        # (server.js lines 26–30)
        print(f'Failed to start server: {e}', file=sys.stderr)
        sys.exit(1)

    # Print startup success message to stdout AFTER port availability is confirmed.
    # In Express, this message is printed inside the listen callback after
    # successful binding (server.js line 32). The pre-check above verifies port
    # availability, closely matching the Express behavior where the success
    # callback only fires after the server binds successfully.
    # Format matches server.js exactly: 'Server running at http://{host}:{port}/'
    print(f'Server running at http://{host}:{port}/')

    # Replaces: app.listen(port, hostname, callback) (server.js line 25)
    # Start the Flask development server. This call blocks until the server
    # is stopped. No debug mode or auto-reload — matches the Express default
    # of a simple, non-reloading server.
    try:
        app.run(host=host, port=port)
    except OSError as e:
        # Secondary catch for any socket errors that occur after the pre-check
        # passes but before Flask successfully binds (race condition, extremely
        # unlikely but handled for robustness).
        print(f'Failed to start server: {e}', file=sys.stderr)
        sys.exit(1)
