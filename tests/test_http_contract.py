"""Comprehensive HTTP contract integration tests for the Flask microserver.

Exercises Flask's built-in test_client() against all documented
request/response patterns for app.py, automating and extending the
7-test manual curl
verification suite into repeatable, deterministic pytest assertions.

Test categories covered:
  - Health check endpoint: GET /health -> JSON {"status":"ok"}, HTTP 200
  - Catch-all handler: All methods/paths -> "Hello, World!\\n", HTTP 200
  - Route precedence: GET /health -> health handler;
    non-GET /health -> catch-all
  - Multi-method coverage: GET, POST, PUT, DELETE, PATCH via parametrization
  - HEAD and OPTIONS special HTTP semantics
  - Edge cases: deeply nested paths, root vs subpath, exact body length

All tests use the shared ``client`` fixture from conftest.py which provides
an in-process Flask test client — no real network calls, no mocking of Flask
routing or response generation.
"""

import pytest


# ---------------------------------------------------------------------------
# Health Check Endpoint Tests
# ---------------------------------------------------------------------------


def test_get_health_returns_json_status_ok(client):
    """GET /health returns JSON {"status":"ok"} with HTTP 200.

    Automates manual curl test #1:
        curl -s http://127.0.0.1:3000/health
    """
    response = client.get('/health')

    assert response.status_code == 200
    assert response.content_type.startswith('application/json')
    assert response.get_json() == {'status': 'ok'}


def test_get_health_json_has_single_status_key(client):
    """GET /health JSON body contains exactly one key: "status"."""
    response = client.get('/health')
    data = response.get_json()

    assert list(data.keys()) == ['status']


# ---------------------------------------------------------------------------
# Catch-All Handler Tests
# ---------------------------------------------------------------------------


def test_get_root_returns_hello_world(client):
    """GET / returns 'Hello, World!\\n' with HTTP 200 and text/plain.

    Automates manual curl test #3:
        curl -s http://127.0.0.1:3000/
    """
    response = client.get('/')

    assert response.status_code == 200
    assert response.data == b'Hello, World!\n'
    assert 'text/plain' in response.content_type


def test_catch_all_arbitrary_path(client):
    """GET /any/path returns the catch-all response.

    Automates manual curl test #4:
        curl -s http://127.0.0.1:3000/any/path
    """
    response = client.get('/any/path')

    assert response.status_code == 200
    assert response.data == b'Hello, World!\n'


def test_catch_all_deeply_nested_path(client):
    """Deeply nested path /a/b/c/d/e returns the catch-all response."""
    response = client.get('/a/b/c/d/e')

    assert response.status_code == 200
    assert response.data == b'Hello, World!\n'


def test_catch_all_response_exact_body_length(client):
    """Catch-all response body is exactly 14 bytes: 'Hello, World!\\n'."""
    response = client.get('/')

    assert len(response.data) == 14


def test_catch_all_content_type_is_text_plain(client):
    """Catch-all content-type includes 'text/plain' (handles charset suffix).

    Flask returns 'text/plain; charset=utf-8'; the assertion checks for the
    base mimetype substring to accommodate the charset suffix.
    """
    response = client.get('/some/path')

    assert 'text/plain' in response.content_type


# ---------------------------------------------------------------------------
# Route Precedence Tests
# ---------------------------------------------------------------------------


def test_get_health_returns_json_not_plain_text(client):
    """GET /health resolves to the health handler, NOT the catch-all.

    Verifies Flask's routing specificity: the static '/health' GET route
    takes precedence over the dynamic catch-all '<path:path>' pattern.
    """
    response = client.get('/health')

    assert response.content_type.startswith('application/json')
    assert response.data != b'Hello, World!\n'


def test_post_health_returns_catch_all(client):
    """POST /health falls through to catch-all (route precedence).

    Automates manual curl test #2:
        curl -s -X POST http://127.0.0.1:3000/health
    The /health route only accepts GET; POST /health matches the catch-all.
    """
    response = client.post('/health')

    assert response.status_code == 200
    assert response.data == b'Hello, World!\n'
    assert 'text/plain' in response.content_type


def test_delete_health_returns_catch_all(client):
    """DELETE /health falls through to catch-all (route precedence).

    The /health route only accepts GET; DELETE /health matches the catch-all.
    """
    response = client.delete('/health')

    assert response.status_code == 200
    assert response.data == b'Hello, World!\n'


# ---------------------------------------------------------------------------
# Multi-Method Coverage with Parametrization
# ---------------------------------------------------------------------------


@pytest.mark.parametrize('method', ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
def test_catch_all_methods(client, method):
    """All standard HTTP methods on '/' return the catch-all response.

    Each method produces identical behavior: HTTP 200 with body
    'Hello, World!\\n' and content-type text/plain.
    """
    response = getattr(client, method.lower())('/')

    assert response.status_code == 200
    assert response.data == b'Hello, World!\n'


@pytest.mark.parametrize('method', ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
def test_catch_all_methods_on_arbitrary_path(client, method):
    """All standard HTTP methods on /foo/bar return the catch-all response.

    Automates manual curl tests #5 and #6:
        curl -s -X DELETE http://127.0.0.1:3000/foo/bar
        curl -s -X PUT http://127.0.0.1:3000/some/resource
    """
    response = getattr(client, method.lower())('/foo/bar')

    assert response.status_code == 200
    assert response.data == b'Hello, World!\n'


# ---------------------------------------------------------------------------
# HEAD and OPTIONS Special Behavior Tests
# ---------------------------------------------------------------------------


def test_head_returns_empty_body_with_correct_headers(client):
    """HEAD on catch-all returns empty body with correct headers per HTTP spec.

    Per RFC 9110, the HEAD method is identical to GET except the server
    MUST NOT send content in the response body. Flask's test client
    respects this: the body is empty but headers (status, content-type)
    match the equivalent GET response.
    """
    response = client.head('/some/path')

    assert response.status_code == 200
    assert response.data == b''
    assert 'text/plain' in response.content_type


def test_options_health_returns_allow_header(client):
    """OPTIONS /health triggers Flask auto-OPTIONS with Allow header.

    Automates manual curl test #7:
        curl -s -X OPTIONS http://127.0.0.1:3000/health
    Flask automatically handles OPTIONS requests by returning an Allow
    header listing the methods accepted by the endpoint.
    """
    response = client.options('/health')

    assert response.status_code == 200
    assert 'Allow' in response.headers


# ---------------------------------------------------------------------------
# Additional Edge Case Tests
# ---------------------------------------------------------------------------


def test_get_root_vs_subpath_same_response(client):
    """Root path '/' and subpaths produce identical catch-all responses.

    Validates that the dual-decorator pattern on catch_all() (one for '/'
    with defaults={'path': ''} and one for '/<path:path>') produces
    consistent behavior across both URL patterns.
    """
    root = client.get('/')
    sub = client.get('/subpath')

    assert root.data == sub.data
    assert root.status_code == sub.status_code
