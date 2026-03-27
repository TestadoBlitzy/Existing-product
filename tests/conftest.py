"""Shared pytest fixtures for the Flask application test suite.

This module provides reusable, session-scoped fixtures that are automatically
discovered by pytest and injected into test functions across all test modules.
The two fixtures — ``client`` and ``app_instance`` — cover the primary ways
tests interact with the application: via HTTP requests (test client) and via
direct inspection of the Flask application object.

Session scope is explicitly chosen because the application under test is
completely stateless: every request produces an identical response regardless
of prior requests, and no test modifies the app or its configuration.
"""

import pytest

from app import app as flask_app


@pytest.fixture(scope="session")
def client():
    """Provide a Flask test client for HTTP request testing.

    The test client dispatches requests through Flask's WSGI layer
    in-process, without starting a real HTTP server.  This exercises
    the full ``before_request`` → ``Response`` pipeline with high
    fidelity, including header generation and body encoding.

    Session-scoped because the application is completely stateless —
    no test can affect subsequent tests through shared state.

    Yields:
        flask.testing.FlaskClient: A test client instance bound to the
        Flask application, supporting ``get()``, ``post()``, ``put()``,
        ``delete()``, ``patch()``, ``options()``, and ``head()`` methods.
    """
    with flask_app.test_client() as testing_client:
        yield testing_client


@pytest.fixture(scope="session")
def app_instance():
    """Provide the Flask application instance for direct inspection.

    Used by startup behavior tests to verify the app object exists
    and has the expected configuration without making HTTP requests.

    Session-scoped because the app object is created once at module
    import time and is immutable during test execution.

    Returns:
        flask.Flask: The Flask application instance created in ``app.py``.
    """
    return flask_app
