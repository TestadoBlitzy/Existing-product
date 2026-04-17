"""Tests verifying the universal HTTP contract of the Flask application.

Every HTTP request, regardless of method or path, must return:
- Status: 200 OK
- Content-Type: text/plain; charset=utf-8
- Body: Hello, World!\\n (14 bytes)

The ``@app.before_request`` hook in ``app.py`` short-circuits Flask's URL
dispatcher and method validator, making 404 and 405 responses structurally
impossible.  These tests exercise the full WSGI pipeline in-process via
Flask's built-in ``test_client()`` with zero mocking.
"""


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def assert_hello_response(response):
    """Assert that a response matches the universal Hello World contract.

    Validates status code, content type, body bytes, and content length
    for any body-bearing HTTP response.  NOT suitable for HEAD responses,
    which carry correct headers but an empty body per HTTP specification.
    """
    assert response.status_code == 200
    assert response.content_type == 'text/plain; charset=utf-8'
    assert response.data == b'Hello, World!\n'
    assert response.content_length == 14


# ---------------------------------------------------------------------------
# Happy path — standard HTTP methods on root path
# ---------------------------------------------------------------------------

def test_get_root_returns_hello(client):
    """GET / returns 200 with Hello, World! body."""
    response = client.get('/')
    assert_hello_response(response)


def test_post_root_returns_hello(client):
    """POST / returns 200 with Hello, World! body."""
    response = client.post('/')
    assert_hello_response(response)


def test_put_root_returns_hello(client):
    """PUT / returns 200 with Hello, World! body."""
    response = client.put('/')
    assert_hello_response(response)


def test_delete_root_returns_hello(client):
    """DELETE / returns 200 with Hello, World! body."""
    response = client.delete('/')
    assert_hello_response(response)


def test_patch_root_returns_hello(client):
    """PATCH / returns 200 with Hello, World! body."""
    response = client.patch('/')
    assert_hello_response(response)


def test_options_root_returns_hello(client):
    """OPTIONS / returns 200 with Hello, World! body."""
    response = client.options('/')
    assert_hello_response(response)


# ---------------------------------------------------------------------------
# HEAD request semantics
# ---------------------------------------------------------------------------

def test_head_root_returns_empty_body(client):
    """HEAD / returns 200 with Content-Length 14 but empty body.

    Per HTTP specification, HEAD responses carry the same headers as GET
    (including Content-Length matching what GET would return) but MUST NOT
    include a message body.  Werkzeug enforces this automatically.
    """
    response = client.head('/')
    assert response.status_code == 200
    assert response.content_length == 14
    assert response.data == b''
    assert response.content_type == 'text/plain; charset=utf-8'


# ---------------------------------------------------------------------------
# Edge cases — path variations
# ---------------------------------------------------------------------------

def test_get_random_path_returns_hello(client):
    """GET /random-path returns the same Hello, World! response."""
    response = client.get('/random-path')
    assert_hello_response(response)


def test_get_nested_path_returns_hello(client):
    """GET /a/b/c/d/e returns Hello, World! — deeply nested paths intercepted."""
    response = client.get('/a/b/c/d/e')
    assert_hello_response(response)


def test_get_path_with_query_string_returns_hello(client):
    """GET /?key=value returns Hello, World! — query strings have no effect."""
    response = client.get('/?key=value')
    assert_hello_response(response)


def test_get_path_with_trailing_slash_returns_hello(client):
    """GET /trailing/ returns Hello, World! — trailing slashes intercepted."""
    response = client.get('/trailing/')
    assert_hello_response(response)


def test_post_arbitrary_path_returns_hello(client):
    """POST /test returns Hello, World! — matches curl validation test #3."""
    response = client.post('/test')
    assert_hello_response(response)


def test_put_data_path_returns_hello(client):
    """PUT /data returns Hello, World! — matches curl validation test #4."""
    response = client.put('/data')
    assert_hello_response(response)


def test_delete_resource_path_returns_hello(client):
    """DELETE /resource returns Hello, World! — matches curl validation test #5."""
    response = client.delete('/resource')
    assert_hello_response(response)


def test_patch_item_path_returns_hello(client):
    """PATCH /item returns Hello, World! — matches curl validation test #6."""
    response = client.patch('/item')
    assert_hello_response(response)


# ---------------------------------------------------------------------------
# Structural impossibility / negative tests
# ---------------------------------------------------------------------------

def test_unknown_path_does_not_return_404(client):
    """An unknown, deeply nested path does NOT produce 404.

    The before_request hook intercepts all requests before Flask's URL
    dispatcher runs, making 404 structurally impossible.
    """
    response = client.get('/this/path/does/not/exist')
    assert response.status_code == 200
    assert response.status_code != 404


def test_no_method_returns_405(client):
    """No HTTP method on any path produces 405 Method Not Allowed.

    The before_request hook intercepts before Flask's method validation,
    making 405 structurally impossible.  This test exhaustively checks
    all seven standard client methods against multiple path patterns.
    """
    methods_and_names = [
        (client.get, 'GET'),
        (client.post, 'POST'),
        (client.put, 'PUT'),
        (client.delete, 'DELETE'),
        (client.patch, 'PATCH'),
        (client.options, 'OPTIONS'),
        (client.head, 'HEAD'),
    ]
    paths = ['/', '/test', '/a/b/c']
    for method_fn, method_name in methods_and_names:
        for path in paths:
            response = method_fn(path)
            assert response.status_code == 200, (
                f"{method_name} {path} returned {response.status_code}"
            )
            assert response.status_code != 405, (
                f"{method_name} {path} returned 405"
            )


# ---------------------------------------------------------------------------
# Content-Length accuracy
# ---------------------------------------------------------------------------

def test_response_content_length_is_14(client):
    """Content-Length header is exactly 14 and matches actual body length."""
    response = client.get('/')
    assert response.content_length == 14
    assert len(response.data) == 14


def test_response_body_is_exactly_14_bytes(client):
    """Response body is exactly the 14-byte sequence 'Hello, World!\\n'.

    Byte-level verification confirms the exact octets:
    48 65 6c 6c 6f 2c 20 57 6f 72 6c 64 21 0a
    """
    response = client.get('/')
    assert response.data == b'Hello, World!\n'
    assert len(response.data) == 14
    # Explicit byte-level verification of every octet
    expected_bytes = bytes([
        0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x2c, 0x20,
        0x57, 0x6f, 0x72, 0x6c, 0x64, 0x21, 0x0a,
    ])
    assert response.data == expected_bytes


# ---------------------------------------------------------------------------
# Statelessness verification
# ---------------------------------------------------------------------------

def test_sequential_requests_return_identical_responses(client):
    """Three sequential GET / requests produce identical responses.

    Confirms the handler is fully stateless with no state accumulation
    or drift between consecutive requests.
    """
    responses = [client.get('/') for _ in range(3)]
    for response in responses:
        assert response.status_code == 200
        assert response.content_type == 'text/plain; charset=utf-8'
        assert response.data == b'Hello, World!\n'
