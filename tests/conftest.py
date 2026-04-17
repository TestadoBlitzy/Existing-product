"""Shared pytest fixtures for the Flask microserver test suite.

Provides a reusable Flask test client fixture that is auto-discovered by
pytest and injected into any test function requesting the ``client``
parameter.  All HTTP contract tests in ``test_http_contract.py`` depend
on this fixture for in-process endpoint verification.
"""

import pytest

from app import app as flask_app


@pytest.fixture
def client():
    """Yield a Flask test client for in-process HTTP endpoint testing.

    The client is created via Flask's built-in ``test_client()`` context
    manager, which guarantees proper resource cleanup after each test.
    Function scope (the pytest default) ensures every test receives a
    fresh, isolated client instance with no shared state.

    Yields:
        flask.testing.FlaskClient: A WSGI test client bound to the
        application defined in ``app.py``.
    """
    with flask_app.test_client() as testing_client:
        yield testing_client
