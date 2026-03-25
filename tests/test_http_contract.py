"""
HTTP Contract Tests — replaces __tests__/server.test.js (219 lines, 33 tests).

This module contains 33 pytest test functions organized into 7 test classes, each
corresponding to a describe() block in the original Jest/Supertest test file. Every
assertion from the original test suite is faithfully recreated using Flask's built-in
test client instead of Supertest.

Test classes:
    TestGetRoot                     — 4 tests  (GET / happy path)
    TestGetEvening                  — 4 tests  (GET /evening happy path)
    TestNotFoundResponses           — 4 tests  (404 error handling)
    TestUnsupportedMethodsOnRoot    — 4 tests  (POST/PUT/DELETE/PATCH on /)
    TestUnsupportedMethodsOnEvening — 4 tests  (POST/PUT/DELETE/PATCH on /evening)
    TestEdgeCases                   — 8 tests  (query params, case-insensitive,
                                                HEAD, trailing slash, double slash)
    TestXPoweredBySuppression       — 5 tests  (X-Powered-By absent on all responses)
                                    --------
                              Total: 33 tests

Assertion mapping (Supertest/Jest → pytest/Flask):
    request(app).get('/')           → client.get('/')
    expect(res.status).toBe(200)    → assert response.status_code == 200
    expect(res.text).toBe(body)     → assert response.get_data(as_text=True) == body
    expect(res.headers['content-type']).toMatch(/text\\/plain/)
                                    → assert 'text/plain' in response.content_type
    expect(res.headers['x-powered-by']).toBeUndefined()
                                    → assert 'X-Powered-By' not in response.headers

The ``client`` fixture is provided by tests/conftest.py (replaces the Supertest
``request(app)`` pattern) and injects a Flask test client backed by a fresh
``create_app()`` instance per test.
"""

# No direct imports needed — the ``client`` fixture is auto-injected by pytest
# from tests/conftest.py. This mirrors the pattern of importing Supertest's
# request(app) in the original server.test.js lines 3-4:
#   const request = require('supertest');
#   const app = require('../server');


# ---------------------------------------------------------------------------
# GET / route — happy path
# Replaces describe('GET /', ...) from server.test.js lines 9-29
# ---------------------------------------------------------------------------

class TestGetRoot:
    """GET / route — happy path.

    Replaces describe('GET /', ...) from server.test.js lines 9-29.
    Verifies status 200, exact response body 'Hello, World!\\n', Content-Type
    text/plain, and absence of the X-Powered-By header.
    """

    def test_should_return_status_200(self, client):
        """Replaces: it('should return status 200') — server.test.js line 10.

        Original assertion:
            expect(res.status).toBe(200);
        """
        response = client.get('/')
        assert response.status_code == 200

    def test_should_return_hello_world_with_trailing_newline(self, client):
        """Replaces: it('should return \"Hello, World!\\n\" with trailing newline') — server.test.js line 15.

        Original assertion:
            expect(res.text).toBe('Hello, World!\\n');

        The response body must be exactly 'Hello, World!\\n' — character-for-character
        match including the trailing newline character.
        """
        response = client.get('/')
        assert response.get_data(as_text=True) == 'Hello, World!\n'

    def test_should_return_content_type_text_plain(self, client):
        """Replaces: it('should return Content-Type text/plain') — server.test.js line 20.

        Original assertion:
            expect(res.headers['content-type']).toMatch(/text\\/plain/);

        Uses 'in' check on response.content_type to match the regex-based assertion
        in the original (content_type may include charset, e.g. 'text/plain; charset=utf-8').
        """
        response = client.get('/')
        assert 'text/plain' in response.content_type

    def test_should_not_include_x_powered_by_header(self, client):
        """Replaces: it('should not include X-Powered-By header') — server.test.js line 25.

        Original assertion:
            expect(res.headers['x-powered-by']).toBeUndefined();

        Flask does not emit X-Powered-By by default (unlike Express which requires
        app.disable('x-powered-by')). The assertion verifies behavioral parity.
        """
        response = client.get('/')
        assert 'X-Powered-By' not in response.headers


# ---------------------------------------------------------------------------
# GET /evening route — happy path
# Replaces describe('GET /evening', ...) from server.test.js lines 34-54
# ---------------------------------------------------------------------------

class TestGetEvening:
    """GET /evening route — happy path.

    Replaces describe('GET /evening', ...) from server.test.js lines 34-54.
    Verifies status 200, exact response body 'Good evening' (no trailing newline),
    Content-Type text/plain, and absence of the X-Powered-By header.
    """

    def test_should_return_status_200(self, client):
        """Replaces: it('should return status 200') — server.test.js line 35.

        Original assertion:
            expect(res.status).toBe(200);
        """
        response = client.get('/evening')
        assert response.status_code == 200

    def test_should_return_good_evening_without_trailing_newline(self, client):
        """Replaces: it('should return \"Good evening\" without trailing newline') — server.test.js line 40.

        Original assertion:
            expect(res.text).toBe('Good evening');

        The response body must be exactly 'Good evening' — no trailing newline,
        unlike the root route which includes one.
        """
        response = client.get('/evening')
        assert response.get_data(as_text=True) == 'Good evening'

    def test_should_return_content_type_text_plain(self, client):
        """Replaces: it('should return Content-Type text/plain') — server.test.js line 45.

        Original assertion:
            expect(res.headers['content-type']).toMatch(/text\\/plain/);
        """
        response = client.get('/evening')
        assert 'text/plain' in response.content_type

    def test_should_not_include_x_powered_by_header(self, client):
        """Replaces: it('should not include X-Powered-By header') — server.test.js line 50.

        Original assertion:
            expect(res.headers['x-powered-by']).toBeUndefined();
        """
        response = client.get('/evening')
        assert 'X-Powered-By' not in response.headers


# ---------------------------------------------------------------------------
# 404 error handling — undefined routes
# Replaces describe('404 responses', ...) from server.test.js lines 59-79
# ---------------------------------------------------------------------------

class TestNotFoundResponses:
    """404 error handling — undefined routes.

    Replaces describe('404 responses', ...) from server.test.js lines 59-79.
    Verifies that GET requests to undefined paths return 404 and that the
    X-Powered-By header is absent on error responses.
    """

    def test_should_return_404_for_get_nonexistent(self, client):
        """Replaces: it('should return 404 for GET /nonexistent') — server.test.js line 60.

        Original assertion:
            expect(res.status).toBe(404);
        """
        response = client.get('/nonexistent')
        assert response.status_code == 404

    def test_should_return_404_for_get_foo_bar(self, client):
        """Replaces: it('should return 404 for GET /foo/bar') — server.test.js line 65.

        Original assertion:
            expect(res.status).toBe(404);

        Multi-segment undefined path — verifies 404 handling for nested routes.
        """
        response = client.get('/foo/bar')
        assert response.status_code == 404

    def test_should_return_404_for_get_evening_extra(self, client):
        """Replaces: it('should return 404 for GET /evening/extra') — server.test.js line 70.

        Original assertion:
            expect(res.status).toBe(404);

        Verifies that sub-paths of defined routes still return 404 — /evening/extra
        is not a registered route even though /evening exists.
        """
        response = client.get('/evening/extra')
        assert response.status_code == 404

    def test_should_not_include_x_powered_by_header_on_404(self, client):
        """Replaces: it('should not include X-Powered-By header on 404 responses') — server.test.js line 75.

        Original assertion:
            expect(res.headers['x-powered-by']).toBeUndefined();

        Verifies X-Powered-By absence even on error responses.
        """
        response = client.get('/nonexistent')
        assert 'X-Powered-By' not in response.headers


# ---------------------------------------------------------------------------
# Unsupported HTTP methods on defined routes
# Replaces describe('Unsupported HTTP methods', ...) from server.test.js lines 84-128
#
# CRITICAL: Express 5.x returns 404 for unsupported methods on defined routes.
# Flask returns 405 Method Not Allowed by default. The app.py module includes a
# @app.errorhandler(405) that converts 405 → 404 to achieve Express 5.x parity.
# All tests below assert status 404 (not 405) to match the original behavior.
# ---------------------------------------------------------------------------

class TestUnsupportedMethodsOnRoot:
    """Unsupported HTTP methods on / route.

    Replaces describe('on / route', ...) from server.test.js lines 85-105.
    Express 5.x returns 404 for POST/PUT/DELETE/PATCH on GET-only routes.
    Flask's 405→404 error handler in app.py achieves this parity.
    """

    def test_should_return_404_for_post(self, client):
        """Replaces: it('should return 404 for POST /') — server.test.js line 86.

        Original assertion:
            expect(res.status).toBe(404);

        Express returns 404 for POST on a GET-only route; Flask's 405→404
        error handler produces the same result.
        """
        response = client.post('/')
        assert response.status_code == 404

    def test_should_return_404_for_put(self, client):
        """Replaces: it('should return 404 for PUT /') — server.test.js line 91.

        Original assertion:
            expect(res.status).toBe(404);
        """
        response = client.put('/')
        assert response.status_code == 404

    def test_should_return_404_for_delete(self, client):
        """Replaces: it('should return 404 for DELETE /') — server.test.js line 96.

        Original assertion:
            expect(res.status).toBe(404);
        """
        response = client.delete('/')
        assert response.status_code == 404

    def test_should_return_404_for_patch(self, client):
        """Replaces: it('should return 404 for PATCH /') — server.test.js line 101.

        Original assertion:
            expect(res.status).toBe(404);
        """
        response = client.patch('/')
        assert response.status_code == 404


class TestUnsupportedMethodsOnEvening:
    """Unsupported HTTP methods on /evening route.

    Replaces describe('on /evening route', ...) from server.test.js lines 107-127.
    Same 405→404 parity as the root route tests above.
    """

    def test_should_return_404_for_post(self, client):
        """Replaces: it('should return 404 for POST /evening') — server.test.js line 108.

        Original assertion:
            expect(res.status).toBe(404);
        """
        response = client.post('/evening')
        assert response.status_code == 404

    def test_should_return_404_for_put(self, client):
        """Replaces: it('should return 404 for PUT /evening') — server.test.js line 113.

        Original assertion:
            expect(res.status).toBe(404);
        """
        response = client.put('/evening')
        assert response.status_code == 404

    def test_should_return_404_for_delete(self, client):
        """Replaces: it('should return 404 for DELETE /evening') — server.test.js line 118.

        Original assertion:
            expect(res.status).toBe(404);
        """
        response = client.delete('/evening')
        assert response.status_code == 404

    def test_should_return_404_for_patch(self, client):
        """Replaces: it('should return 404 for PATCH /evening') — server.test.js line 123.

        Original assertion:
            expect(res.status).toBe(404);
        """
        response = client.patch('/evening')
        assert response.status_code == 404


# ---------------------------------------------------------------------------
# Edge cases
# Replaces describe('Edge cases', ...) from server.test.js lines 133-189
#
# Several edge cases require Flask-specific configuration for Express parity:
#   - Query parameters: Transparent in both frameworks — no adjustment needed
#   - Case-insensitive routing: Flask is case-sensitive; app.py adds a
#     before_request hook to lowercase PATH_INFO for Express-like matching
#   - HEAD requests: Flask auto-handles HEAD for GET routes — no action needed
#   - Trailing slash: app.py sets strict_slashes=False for /evening/ parity
#   - Double slash: app.py normalizes // to / via the before_request hook
# ---------------------------------------------------------------------------

class TestEdgeCases:
    """Edge cases — query params, case-insensitive routing, HEAD, trailing slash,
    double slash.

    Replaces describe('Edge cases', ...) from server.test.js lines 133-189.
    These tests exercise Flask-specific parity adjustments documented in app.py.
    """

    def test_query_parameters_on_root(self, client):
        """Replaces: it('should return correct response with query parameters on /') — server.test.js line 134.

        Original assertions:
            expect(res.status).toBe(200);
            expect(res.text).toBe('Hello, World!\\n');

        Query parameters do not affect routing in either Express or Flask.
        """
        response = client.get('/?foo=bar')
        assert response.status_code == 200
        assert response.get_data(as_text=True) == 'Hello, World!\n'

    def test_query_parameters_on_evening(self, client):
        """Replaces: it('should return correct response with query parameters on /evening') — server.test.js line 140.

        Original assertions:
            expect(res.status).toBe(200);
            expect(res.text).toBe('Good evening');
        """
        response = client.get('/evening?time=now')
        assert response.status_code == 200
        assert response.get_data(as_text=True) == 'Good evening'

    def test_case_insensitive_evening_capitalized(self, client):
        """Replaces: it('should match /Evening case-insensitively and return 200') — server.test.js line 146.

        Original assertions:
            expect(res.status).toBe(200);
            expect(res.text).toBe('Good evening');

        Express 5.x defaults to case-insensitive routing (caseSensitive: false).
        Flask is case-sensitive by default — app.py adds a before_request hook that
        lowercases PATH_INFO before routing to achieve Express-like parity.
        """
        response = client.get('/Evening')
        assert response.status_code == 200
        assert response.get_data(as_text=True) == 'Good evening'

    def test_case_insensitive_evening_uppercase(self, client):
        """Replaces: it('should match /EVENING case-insensitively and return 200') — server.test.js line 154.

        Original assertions:
            expect(res.status).toBe(200);
            expect(res.text).toBe('Good evening');

        Express 5.x defaults to case-insensitive routing (caseSensitive: false).
        Same before_request normalization as the /Evening test above.
        """
        response = client.get('/EVENING')
        assert response.status_code == 200
        assert response.get_data(as_text=True) == 'Good evening'

    def test_head_request_to_root(self, client):
        """Replaces: it('should handle HEAD request to / with status 200 and no body') — server.test.js line 162.

        Original assertions:
            expect(res.status).toBe(200);
            expect(res.headers['content-type']).toMatch(/text\\/plain/);
            expect(res.text).toBeFalsy();

        Both Express and Flask automatically handle HEAD requests for GET routes,
        returning the same status and headers but no response body.
        """
        response = client.head('/')
        assert response.status_code == 200
        assert 'text/plain' in response.content_type
        # HEAD responses have no body — toBeFalsy() maps to empty string check
        assert response.get_data(as_text=True) == ''

    def test_head_request_to_evening(self, client):
        """Replaces: it('should handle HEAD request to /evening with status 200 and no body') — server.test.js line 169.

        Original assertions:
            expect(res.status).toBe(200);
            expect(res.headers['content-type']).toMatch(/text\\/plain/);
            expect(res.text).toBeFalsy();
        """
        response = client.head('/evening')
        assert response.status_code == 200
        assert 'text/plain' in response.content_type
        assert response.get_data(as_text=True) == ''

    def test_trailing_slash_on_evening(self, client):
        """Replaces: it('should handle trailing slash GET /evening/ and return 200') — server.test.js line 176.

        Original assertions:
            expect(res.status).toBe(200);
            expect(res.text).toBe('Good evening');

        Express 5.x non-strict routing matches /evening/ to /evening by default.
        Flask requires strict_slashes=False (set in app.py) for this parity.
        """
        response = client.get('/evening/')
        assert response.status_code == 200
        assert response.get_data(as_text=True) == 'Good evening'

    def test_double_slash_normalized_to_root(self, client):
        """Replaces: it('should handle double slash GET // normalized to /') — server.test.js line 183.

        Original assertions:
            expect(res.status).toBe(200);
            expect(res.text).toBe('Hello, World!\\n');

        Express 5.x normalizes // to / transparently and matches the root route.
        Flask would redirect (308) or return 404 — app.py adds a before_request
        hook that collapses consecutive slashes for Express-like parity.
        """
        response = client.get('//')
        assert response.status_code == 200
        assert response.get_data(as_text=True) == 'Hello, World!\n'


# ---------------------------------------------------------------------------
# X-Powered-By header suppression — comprehensive verification
# Replaces describe('X-Powered-By header suppression', ...) from server.test.js
# lines 194-219
#
# Express emits X-Powered-By: Express by default and requires
# app.disable('x-powered-by') to suppress it. Flask does not emit this header
# at all — no explicit suppression is needed. These tests verify the header's
# absence for behavioral parity across multiple response types.
# ---------------------------------------------------------------------------

class TestXPoweredBySuppression:
    """X-Powered-By header suppression — comprehensive verification.

    Replaces describe('X-Powered-By header suppression', ...) from
    server.test.js lines 194-219.

    Flask does not emit X-Powered-By by default (unlike Express which requires
    app.disable('x-powered-by')). These tests assert the header's absence
    across GET, 404, POST, and HEAD responses for behavioral parity.
    """

    def test_absent_on_get_root(self, client):
        """Replaces: it('should be absent on GET / response') — server.test.js line 195.

        Original assertion:
            expect(res.headers['x-powered-by']).toBeUndefined();
        """
        response = client.get('/')
        assert 'X-Powered-By' not in response.headers

    def test_absent_on_get_evening(self, client):
        """Replaces: it('should be absent on GET /evening response') — server.test.js line 200.

        Original assertion:
            expect(res.headers['x-powered-by']).toBeUndefined();
        """
        response = client.get('/evening')
        assert 'X-Powered-By' not in response.headers

    def test_absent_on_404(self, client):
        """Replaces: it('should be absent on 404 response') — server.test.js line 205.

        Original assertion:
            expect(res.headers['x-powered-by']).toBeUndefined();
        """
        response = client.get('/unknown-path')
        assert 'X-Powered-By' not in response.headers

    def test_absent_on_post(self, client):
        """Replaces: it('should be absent on POST / response') — server.test.js line 210.

        Original assertion:
            expect(res.headers['x-powered-by']).toBeUndefined();
        """
        response = client.post('/')
        assert 'X-Powered-By' not in response.headers

    def test_absent_on_head(self, client):
        """Replaces: it('should be absent on HEAD / response') — server.test.js line 215.

        Original assertion:
            expect(res.headers['x-powered-by']).toBeUndefined();
        """
        response = client.head('/')
        assert 'X-Powered-By' not in response.headers
