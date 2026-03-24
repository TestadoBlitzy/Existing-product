"""
Shared pytest Fixtures — replaces Supertest/Jest import patterns.

This module centralizes Flask test client creation, replacing the Supertest
HTTP assertion setup from the original Node.js test files:
  - const request = require('supertest') → not needed (Flask built-in test client)
  - const app = require('../server') → from app import create_app
  - request(app).get('/') → client.get('/')

Both fixtures use function scope (default) to ensure each test gets a
completely fresh app and client instance, mirroring Jest's per-test isolation.

Source references:
  - __tests__/server.test.js lines 3-4 (Supertest + app import)
  - __tests__/server.lifecycle.test.js line 3 (app import)
"""

import pytest  # For @pytest.fixture decorator

# Replaces: const app = require('../server') (server.test.js line 4)
# Replaces: const request = require('supertest') (server.test.js line 3)
# Flask's built-in test client eliminates the need for a Supertest equivalent.
from app import create_app


@pytest.fixture
def app():
    """Create a fresh Flask application instance for each test.

    Replaces const app = require('../server') from server.test.js line 4.
    Each test gets its own app to ensure isolation. TESTING config enables
    Flask's test mode for better error reporting.
    """
    app = create_app()
    app.config['TESTING'] = True
    return app


@pytest.fixture
def client(app):
    """Create a Flask test client for HTTP assertions.

    Replaces const request = require('supertest') + request(app) from
    server.test.js line 3. The test client provides .get(), .post(),
    .put(), .delete(), .patch(), .head() methods equivalent to
    Supertest's request(app).get(), .post(), etc.
    """
    return app.test_client()
