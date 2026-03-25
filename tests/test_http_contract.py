"""
HTTP Contract Tests — replaces __tests__/server.test.js (219 lines, 49 tests).

This module contains 49 pytest test functions organized into 9 test classes. The
original 7 classes correspond to describe() blocks in the original Jest/Supertest
test file, with 2 additional classes for application factory validation and
normalization middleware code path coverage. Every assertion from the original
test suite is faithfully recreated using Flask's built-in test client instead of
Supertest, plus additional coverage tests for uncovered code paths.

Test classes:
    TestGetRoot                     — 4 tests  (GET / happy path)
    TestGetEvening                  — 4 tests  (GET /evening happy path)
    TestNotFoundResponses           — 5 tests  (404 error handling)
    TestUnsupportedMethodsOnRoot    — 4 tests  (POST/PUT/DELETE/PATCH on /)
    TestUnsupportedMethodsOnEvening — 5 tests  (POST/PUT/DELETE/PATCH on /evening)
    TestEdgeCases                   — 11 tests (query params, case-insensitive,
                                                HEAD, trailing slash, double slash)
    TestXPoweredBySuppression       — 7 tests  (X-Powered-By absent on all responses)
    TestApplicationFactory          — 4 tests  (create_app() factory behavior)
    TestNormalizationMiddleware     — 5 tests  (normalize_path code path coverage)
                                    --------
                              Total: 49 tests

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

from flask import Flask
from app import create_app


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

    def test_case_insensitive_undefined_route_returns_404(self, client):
        """Case-insensitive undefined route returns 404.

        Validates that the normalize_path hook's case-lowering + failed match →
        return None → Flask default 404 chain works correctly for uppercase
        undefined routes. GET /UNKNOWNPATH → lowered to /unknownpath → no route
        match → except block (app.py lines 103–107) returns None → 404.
        """
        response = client.get('/UNKNOWNPATH')
        assert response.status_code == 404


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

    def test_post_on_case_insensitive_evening_returns_404(self, client):
        """POST on case-insensitive /Evening returns 404.

        Validates the full normalization + error handler chain: normalize_path
        lowercases /Evening to /evening → url_adapter.match('/evening', method='POST')
        raises MethodNotAllowed → except block (app.py lines 103–107) returns None →
        Flask dispatches the original NotFound from the case-sensitive URL match → 404 response.
        """
        response = client.post('/Evening')
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

    def test_head_request_on_case_insensitive_path(self, client):
        """HEAD request on case-insensitive path returns 200 with empty body.

        Verifies HEAD behavior works through the case-insensitive normalization
        path. HEAD /Evening → normalize_path lowercases to /evening → matches
        route → status 200, correct Content-Type, empty body per HEAD semantics.
        """
        response = client.head('/Evening')
        assert response.status_code == 200
        assert 'text/plain' in response.content_type
        assert response.get_data(as_text=True) == ''

    def test_head_request_on_undefined_route_returns_404(self, client):
        """HEAD request on undefined route returns 404 with empty body.

        Verifies HEAD semantics on error responses — the status code is 404 and
        the body is empty (HEAD responses never include a body).
        """
        response = client.head('/nonexistent')
        assert response.status_code == 404
        assert response.get_data(as_text=True) == ''

    def test_query_params_on_case_insensitive_path(self, client):
        """Query parameters do not interfere with case-insensitive path resolution.

        GET /EVENING?foo=bar → normalize_path lowercases path to /evening (query
        string not affected) → route matches → status 200, body 'Good evening'.
        """
        response = client.get('/EVENING?foo=bar')
        assert response.status_code == 200
        assert response.get_data(as_text=True) == 'Good evening'


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

    def test_absent_on_double_slash_normalized_response(self, client):
        """X-Powered-By absent on response served through double-slash normalization.

        GET /evening// → normalize_path collapses double slash to /evening →
        serves 200 response. X-Powered-By must be absent even when the response
        is served through the normalization re-routing path.
        """
        response = client.get('/evening//')
        assert 'X-Powered-By' not in response.headers

    def test_absent_on_case_insensitive_error_response(self, client):
        """X-Powered-By absent on 404 response triggered via normalization fallback.

        GET /NONEXISTENT → normalize_path lowercases to /nonexistent → no route
        match → except block returns None → Flask 404. X-Powered-By must be
        absent on error responses triggered through the normalization path.
        """
        response = client.get('/NONEXISTENT')
        assert 'X-Powered-By' not in response.headers


# ---------------------------------------------------------------------------
# Application Factory — create_app() behavior validation
# ---------------------------------------------------------------------------
# These tests verify the Flask application factory function directly,
# ensuring proper configuration, route registration, and instance isolation.

class TestApplicationFactory:
    """Application factory behavior — create_app() validation.

    Verifies that the create_app() factory function in app.py returns properly
    configured Flask instances with correct route registrations, middleware
    attachment, and instance isolation. These tests call create_app() directly
    rather than using the client fixture, to test factory behavior explicitly.
    """

    def test_create_app_returns_flask_instance(self):
        """create_app() returns a Flask application instance.

        Verifies the factory returns an object that is an instance of Flask,
        confirming the basic application factory contract.
        """
        app = create_app()
        assert isinstance(app, Flask)

    def test_create_app_produces_independent_instances(self):
        """Multiple create_app() calls produce independent Flask instances.

        Each call to create_app() should return a new, distinct Flask application
        object — not a shared singleton. This ensures test isolation when each
        test gets its own app via the fixture.
        """
        app1 = create_app()
        app2 = create_app()
        assert app1 is not app2

    def test_create_app_registers_expected_routes(self):
        """create_app() registers the / and /evening routes.

        Inspects the URL map to verify both expected routes are present.
        The app should have rules for '/' and '/evening' (plus Flask's
        built-in 'static' endpoint).
        """
        app = create_app()
        rules = [rule.rule for rule in app.url_map.iter_rules()]
        assert '/' in rules
        assert '/evening' in rules

    def test_create_app_disables_strict_slashes(self):
        """create_app() disables strict_slashes on the URL map.

        Verifies that app.url_map.strict_slashes is set to False, enabling
        trailing-slash tolerance (e.g., /evening/ matches /evening) for
        Express 5.x non-strict routing parity.
        """
        app = create_app()
        assert app.url_map.strict_slashes is False


# ---------------------------------------------------------------------------
# Normalization Middleware — normalize_path code path coverage
# ---------------------------------------------------------------------------
# These tests exercise specific code paths in the normalize_path before_request
# hook in app.py that are not reached by the existing test suite, specifically:
#   - The while '//' in normalized: loop body (app.py line 89)
#   - The except Exception: return None fallback (app.py lines 103–107)
#   - Combined case + slash normalization paths

class TestNormalizationMiddleware:
    """Normalization middleware — normalize_path code path coverage.

    Exercises specific uncovered code paths in the normalize_path before_request
    hook defined in app.py (lines 64–110). These tests target the double-slash
    collapsing while loop body and the exception-handling fallback that fires
    when a case-normalized path does not match any registered route.
    """

    def test_internal_double_slash_path_normalized_to_route(self, client):
        """Internal double-slash is collapsed and route matches successfully.

        GET /evening// → normalize_path detects '//' in path → while loop body
        at app.py line 89 executes normalized.replace('//', '/') → path becomes
        /evening/ → url_adapter.match() succeeds (strict_slashes=False allows trailing slash) → status 200,
        body 'Good evening'.

        This specifically exercises the while loop BODY (line 89) which was
        previously uncovered because Werkzeug pre-normalizes leading // paths.
        """
        response = client.get('/evening//')
        assert response.status_code == 200
        assert response.get_data(as_text=True) == 'Good evening'

    def test_case_insensitive_undefined_route_returns_404(self, client):
        """Case-insensitive request to undefined route triggers exception fallback.

        GET /NONEXISTENT → normalize_path lowercases to /nonexistent → path
        differs from original → enters if-block → url_adapter.match('/nonexistent')
        raises NotFound → except Exception block (app.py lines 103–107) catches
        it → returns None → Flask default 404 handling.

        This specifically exercises the except Exception: return None path.
        """
        response = client.get('/NONEXISTENT')
        assert response.status_code == 404

    def test_unsupported_method_on_case_insensitive_path_returns_404(self, client):
        """Unsupported method on case-insensitive path triggers exception fallback then 405→404.

        POST /Evening → normalize_path lowercases to /evening → path differs →
        enters if-block → url_adapter.match('/evening', method='POST') raises
        MethodNotAllowed → except Exception block catches it → returns None →
        Flask dispatches the stored NotFound from the original case-sensitive URL match → 404 response.

        Exercises the exception fallback when the normalized path matches a route
        but the HTTP method is not allowed.
        """
        response = client.post('/Evening')
        assert response.status_code == 404

    def test_combined_case_and_double_slash_normalization(self, client):
        """Combined case-insensitive lowering AND double-slash collapsing.

        GET /EVENING// → normalize_path lowercases to /evening// → while loop
        collapses to /evening/ → then /evening → url_adapter.match() succeeds →
        status 200, body 'Good evening'.

        Tests both normalization operations in a single path traversal.
        """
        response = client.get('/EVENING//')
        assert response.status_code == 200
        assert response.get_data(as_text=True) == 'Good evening'

    def test_triple_leading_slash_normalization(self, client):
        """Triple leading slash is normalized and route resolves correctly.

        GET ///evening → Werkzeug WSGI layer pre-normalizes the path (leading //
        interpreted per RFC 3986) → resolves to /evening → status 200, body
        'Good evening'.

        Verifies that extreme slash normalization still resolves correctly.
        """
        response = client.get('///evening')
        assert response.status_code == 200
        assert response.get_data(as_text=True) == 'Good evening'
