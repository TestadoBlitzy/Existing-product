# Technical Specification

# Technical Specification

# Technical Specification

# Technical Specification

# Technical Specification

# Technical Specification

# Technical Specification

# Technical Specification

# Technical Specification

# Technical Specification

# 0. Agent Action Plan

## 0.1 Intent Clarification


### 0.1.1 Core Testing Objective

Based on the provided requirements, the Blitzy platform understands that the testing objective is to **extend and strengthen the existing pytest-based test suite** for a Python/Flask HTTP server that serves as a behavioral parity implementation of an original Node.js/Express application. This is categorized as **Improve Coverage** — the task operates on a mature, already-passing test suite rather than introducing testing from scratch.

The codebase already has an established automated test suite with **43 tests total** (33 HTTP contract tests + 10 lifecycle tests), all passing at 100%. The task is to identify and close remaining coverage gaps while preserving the existing high-confidence test posture.

**Clarified Testing Requirements:**

- Strengthen coverage for `app.py` application factory behavior, specifically the `create_app()` function and the Express-parity middleware it registers (URL normalization via `before_request`, 405→404 error handler conversion, `strict_slashes` configuration)
- Extend HTTP contract tests to cover untested normalization code paths: the double-slash collapsing `while` loop body (`app.py` line 89) and the exception-handling fallback in `normalize_path` when a case-normalized path still does not match any route (`app.py` lines 103–107)
- Verify `main.py` module-level constants (`host`, `port`) for environment-driven configuration defaults
- Ensure behavioral parity coverage includes edge-case combinations not yet exercised: case-insensitive access to undefined routes, HEAD requests on normalized paths, X-Powered-By suppression on middleware-handled responses, and unsupported HTTP methods on case-insensitive paths
- Maintain or improve the existing 100% pass rate across all tests
- Achieve near-complete coverage for all active runtime behaviors in `app.py` and `main.py` without adding speculative tests for nonexistent features

**Implicit Testing Needs Surfaced:**

- The `normalize_path` exception path (lines 103–107 of `app.py`) is currently unreached — a case-insensitive request to an undefined route (e.g., `GET /NONEXISTENT`) triggers normalization but then fails adapter matching, falling through to Flask's default 404 handling
- The double-slash normalization `while` loop body (`app.py` line 89) is unreachable through Werkzeug's test client for leading `//` paths (Werkzeug interprets these as protocol-relative URLs), but IS reachable for paths with internal double-slashes like `GET /evening//`
- Application factory isolation (each `create_app()` call should produce an independent Flask instance) is not explicitly verified
- HEAD request behavior on case-insensitive paths and undefined routes is not yet tested
- The 405→404 error handler's interaction with the normalization middleware for case-insensitive method mismatches (e.g., `POST /Evening`) is untested

### 0.1.2 Special Instructions and Constraints

**Critical Directives Captured:**

- **Minimal change clause:** Make only the changes absolutely necessary to implement comprehensive testing coverage. Do not modify existing production code (`app.py`, `main.py`) unless required for testability.
- **Preserve existing patterns:** Follow the established pytest/Flask test client patterns already used in the repository. Do not introduce new test runners or unnecessary third-party test tooling.
- **No mocking unless necessary:** Prefer the project's current style of testing real behavior using the Flask test client and subprocess-based lifecycle checks. Mock only when absolutely necessary to isolate a narrow behavior.
- **Keep test infrastructure lightweight:** Reuse existing `app` and `client` fixtures from `tests/conftest.py`. Use inline expectations for static responses.
- **Exclude dormant artifacts:** Do not expand into Node.js placeholder files (`server.js`, `package.json`, `jest.config.js`, `__tests__/`), Blitzy documentation, or CI/CD pipeline creation.
- **Implementation rule:** Do not make any updates or changes in GitHub App to create or update a workflow.

**Testing Discipline Requirements:**

- Isolate all test code in dedicated test files under `tests/`
- When multiple testing approaches exist, choose the one requiring the least modification to existing code
- If code quality issues are identified during testing, note them but do not fix unless required for test implementation

### 0.1.3 Technical Interpretation

These testing requirements translate to the following technical test implementation strategy:

- To **close the normalize_path exception-handling gap**, we will add test cases in `tests/test_http_contract.py` that send case-insensitive requests to undefined routes (e.g., `GET /NONEXISTENT`) and verify the 404 response — this exercises the `except Exception: return None` path at `app.py` lines 103–107
- To **cover the double-slash normalization loop body**, we will add test cases targeting paths with internal double-slashes (e.g., `GET /evening//`) that Werkzeug does not pre-normalize — this exercises `app.py` line 89
- To **validate application factory behavior**, we will add tests verifying `create_app()` returns properly configured Flask instances with correct route registrations and middleware
- To **extend edge case coverage**, we will add tests for HEAD on case-insensitive paths, unsupported methods on case-insensitive paths, X-Powered-By suppression on normalized responses, and query parameter tolerance on case-insensitive paths
- To **strengthen lifecycle coverage**, we will add tests verifying `main.py` module-level default values for `host` and `port` environment configuration
- To **preserve existing test integrity**, all 43 existing tests will continue to pass without modification

### 0.1.4 Coverage Requirements Interpretation

**Explicit Coverage Targets:**

- Maintain 100% test pass rate (currently 43/43, target: all existing + new tests passing)
- Achieve near-complete coverage for all active runtime behaviors in `app.py` and `main.py`

**Implicit Coverage Expectations Based on Repository Analysis:**

- `app.py` statement coverage: currently 90% (29 statements, 3 missed) — target: 97%+ by covering the normalization exception path and double-slash loop body
- `app.py` branch coverage: currently 88% (4 branches, 1 partial) — target: 95%+ by exercising both sides of the `if normalized != path` condition with non-matching routes
- `main.py` in-process coverage: currently 0% (all lines inside `if __name__ == '__main__':` guard) — module-level constants (`host`, `port`) can be tested in-process; the guarded startup block remains subprocess-tested only
- `tests/test_lifecycle.py` defensive cleanup paths (lines 133–135, 170–172, etc.): these are fallback `proc.kill()` paths that only execute on terminate timeout — accepted as non-critical coverage gaps that do not warrant artificial test failure injection

**To achieve comprehensive testing, coverage should include:**

- All code paths in the `normalize_path` before_request hook (happy path, normalization-needed-and-matched, normalization-needed-and-unmatched)
- All code paths in the `method_not_allowed_to_not_found` error handler (direct 405 and normalization-triggered 405)
- Application factory configuration (strict_slashes, route registration, middleware registration)
- Module-level environment configuration defaults in `main.py`
- HEAD request behavior across normal, normalized, and error responses
- X-Powered-By suppression across all response categories including middleware-handled responses


## 0.2 Test Discovery and Analysis


### 0.2.1 Existing Test Infrastructure Assessment

Repository analysis reveals a **pytest-based testing setup** with a mature, zero-mocking test architecture covering 43 test cases across two test modules. The testing infrastructure follows a behavioral contract parity model — each test was migrated 1:1 from an original Jest/Supertest suite to validate that the Python/Flask server matches the original Node.js/Express behavior exactly.

**Testing Framework:** pytest 9.0.2

**Test Runner Configuration:**
- Location: `pyproject.toml` — configures `testpaths = ["tests"]`, `pythonpath = ["."]`
- No separate `pytest.ini`, `setup.cfg`, or `conftest.py` at the project root
- Test configuration is minimal and convention-based

**Coverage Tools in Use:**
- `pytest-cov` 7.1.0 (installed during analysis; not in `requirements.txt` but compatible)
- No `.coveragerc` or `[tool:coverage]` configuration present — uses defaults

**Mock/Stub Libraries:**
- None. The repository enforces a zero-mocking discipline. All HTTP contract tests use the Flask test client (`app.test_client()`), and all lifecycle tests use `subprocess.Popen` to spawn real server processes.

**Test Data Fixtures/Factories:**
- `tests/conftest.py` provides two function-scoped fixtures:
  - `app()` — creates a fresh Flask application instance via `create_app()` with `TESTING=True`
  - `client(app)` — returns `app.test_client()` for in-memory HTTP testing
- No external test data files, database fixtures, or factory libraries

**Existing Test File Map:**

| Test File | Test Count | Classes | Coverage Focus |
|-----------|-----------|---------|----------------|
| `tests/test_http_contract.py` | 33 | 7 | HTTP behavioral contracts: route responses, status codes, content types, edge cases, X-Powered-By suppression |
| `tests/test_lifecycle.py` | 10 | 4 | Server startup, shutdown, port conflict handling, import safety |
| `tests/conftest.py` | — | — | Shared fixtures (app, client) |
| `tests/__init__.py` | — | — | Empty package marker |

**Existing Test Class Inventory:**

| File | Class | Tests | Behaviors Covered |
|------|-------|-------|-------------------|
| `test_http_contract.py` | `TestGetRoot` | 4 | `GET /` response body, status, content-type, charset |
| `test_http_contract.py` | `TestGetEvening` | 4 | `GET /evening` response body, status, content-type, charset |
| `test_http_contract.py` | `TestNotFoundResponses` | 4 | Undefined routes, `/favicon.ico`, deep paths, root-adjacent paths |
| `test_http_contract.py` | `TestUnsupportedMethodsOnRoot` | 4 | POST/PUT/DELETE/PATCH on `/` → 404 |
| `test_http_contract.py` | `TestUnsupportedMethodsOnEvening` | 4 | POST/PUT/DELETE/PATCH on `/evening` → 404 |
| `test_http_contract.py` | `TestEdgeCases` | 8 | Case-insensitive routing, trailing slashes, HEAD requests, empty body on HEAD |
| `test_http_contract.py` | `TestXPoweredBySuppression` | 5 | Absence of X-Powered-By on GET, HEAD, and 404 responses |
| `test_lifecycle.py` | `TestServerStartup` | 4 | Default startup, custom port, custom host, startup message format |
| `test_lifecycle.py` | `TestServerShutdown` | 2 | Clean SIGTERM handling, process exit code |
| `test_lifecycle.py` | `TestPortConflict` | 2 | Port-in-use detection, stderr error message |
| `test_lifecycle.py` | `TestAppExport` | 2 | `create_app` importability, no auto-start on import |

**Coverage Analysis Results (Statement and Branch):**

| File | Statements | Missed | Statement Coverage | Branches | Branch Partial | Branch Coverage |
|------|-----------|--------|-------------------|----------|----------------|-----------------|
| `app.py` | 29 | 3 | 90% | 4 | 1 | 88% |
| `main.py` | 24 | 24 | 0% | 4 | 0 | 0% |
| `tests/conftest.py` | 8 | 0 | 100% | 0 | 0 | 100% |
| `tests/test_http_contract.py` | 94 | 0 | 100% | 0 | 0 | 100% |
| `tests/test_lifecycle.py` | 101 | 10 | 90% | 14 | 2 | 86% |
| **TOTAL** | **256** | **37** | **86%** | **22** | **3** | **86%** |

**Specific Uncovered Lines Identified:**

- `app.py` line 89 — `normalized = normalized.replace('//', '/')` inside the `while '//' in normalized:` loop. Unreachable for leading `//` due to Werkzeug's WSGI normalization, but reachable for paths with internal `//` (e.g., `GET /evening//`).
- `app.py` lines 103–107 — The `except Exception: return None` block in `normalize_path`. Triggered when a case-lowered or slash-normalized path still fails `url_adapter.match()`. Exercised by `GET /NONEXISTENT` (case-lowered to `/nonexistent`, still not found) or `POST /Evening` (case-lowered to `/evening`, raises `MethodNotAllowed`).
- `main.py` lines 1–94 — All module-level code is guarded by `if __name__ == '__main__':`. Module-level constants (`host`, `port`) are set from `os.environ.get()` before the guard but their coverage requires direct import.
- `test_lifecycle.py` lines 133–135, 170–172 — Fallback `proc.kill()` + `proc.wait()` in `finally` blocks; only triggered when `proc.terminate()` times out. These are defensive cleanup paths with negligible risk.

### 0.2.2 Web Search Research Conducted

**pytest 9.0.2 Compatibility:**
- pytest 9.0.2 is confirmed compatible with Python 3.11. Per the pytest changelog, pytest 9.0 dropped support for Python 3.9 and introduced terminal progress features. The version is stable and suitable for the current project stack.

**Flask 3.1.x Testing Patterns:**
- Flask 3.1.3 supports Python 3.9+ and requires Werkzeug ≥ 3.1. The project's existing pattern of using `app.test_client()` with function-scoped fixtures is the recommended Flask testing approach. No pytest-flask plugin is needed — the project's custom fixtures are sufficient.

**pytest-cov 7.1.0 Compatibility:**
- pytest-cov 7.1.0 is compatible with pytest ≥ 7 and Python ≥ 3.9. It requires coverage ≥ 7.10.6. The version installed during analysis (7.1.0) is compatible with the project's pytest 9.0.2. Note that pytest-cov 7.x removed built-in subprocess support — subprocess coverage requires configuring coverage.py's `patch` option directly.

**Key Insight — Werkzeug Double-Slash Behavior:**
- Werkzeug's WSGI layer normalizes leading double-slashes in URLs by interpreting them as protocol-relative paths (RFC 3986). This means `GET //evening` results in `PATH_INFO=''` (empty), not `/evening`. Internal double-slashes (e.g., `/evening//extra`) are partially normalized by Werkzeug but `request.path` retains the raw path, allowing the application's `normalize_path` hook to exercise the `while '//' in normalized:` loop.


## 0.3 Testing Scope Analysis


### 0.3.1 Test Target Identification

**Primary Code to Be Tested:**

- **Module: `app.py`** at `app.py` — requires additional HTTP contract tests
  - `create_app()` factory function: application configuration, route registration, middleware attachment
  - `normalize_path` before_request hook: case-insensitive path lowering, double-slash collapsing loop, URL adapter re-matching, exception fallback
  - `method_not_allowed_to_not_found` error handler: 405-to-404 conversion
  - `after_request` hook: X-Powered-By header removal
  - Route handlers: `GET /` → `Hello, World!\n`, `GET /evening` → `Good evening`

- **Module: `main.py`** at `main.py` — requires supplemental lifecycle and constant-validation tests
  - Module-level constants: `host = os.environ.get('HOST', '127.0.0.1')`, `port = int(os.environ.get('PORT', 3000))`
  - Socket pre-check: `sock.bind((host, port))` before starting the server
  - Startup logging: formatted output messages
  - Port conflict failure: socket bind error → stderr message → `sys.exit(1)`
  - Import safety: `if __name__ == '__main__':` guard prevents auto-start on import

**Existing Test File Mapping:**

| Source File | Existing Test File | Test Categories Present |
|-------------|-------------------|------------------------|
| `app.py` | `tests/test_http_contract.py` | Route responses (body, status, content-type), unsupported methods → 404, case-insensitive routing (basic), trailing slashes, HEAD requests, X-Powered-By suppression |
| `app.py` | — | **MISSING:** application factory isolation, double-slash normalization loop body, normalize_path exception fallback, case-insensitive undefined routes, HEAD on normalized paths, X-Powered-By on normalized responses |
| `main.py` | `tests/test_lifecycle.py` | Startup with default/custom port/host, shutdown SIGTERM, port conflict detection, import safety, create_app importability |
| `main.py` | — | **MISSING:** module-level default constant verification (in-process), environment variable override for HOST/PORT (in-process) |

**Dependencies Requiring Mocking:**

None. The project uses a zero-mocking strategy:
- HTTP behavioral tests use the Flask test client (in-memory, no actual network)
- Lifecycle tests use `subprocess.Popen` to spawn real processes
- No external services, databases, file system operations, or third-party integrations to mock

### 0.3.2 Version Compatibility Research

Based on the project's `requirements.txt` and `pyproject.toml`, with verification through web search:

**Current Stack (Confirmed Compatible):**

| Component | Version | Compatibility Basis |
|-----------|---------|---------------------|
| Python | 3.11.15 | `pyproject.toml`: `requires-python = ">= 3.11"` |
| Flask | 3.1.3 | `requirements.txt`: `flask==3.1.3` — supports Python 3.9+ |
| Werkzeug | 3.1.7 | Auto-installed with Flask 3.1.3; required ≥ 3.1 |
| pytest | 9.0.2 | `requirements.txt`: `pytest==9.0.2` — supports Python 3.10+ |

**Recommended Testing Stack Additions:**

| Tool | Recommended Version | Rationale |
|------|-------------------|-----------|
| pytest-cov | 7.1.0 | Latest stable; requires pytest ≥ 7, Python ≥ 3.9, coverage ≥ 7.10.6. Fully compatible with pytest 9.0.2 and Python 3.11 |

**Version Conflict Assessment:**
- No conflicts detected between Flask 3.1.3, pytest 9.0.2, and pytest-cov 7.1.0
- Werkzeug 3.1.7 is compatible with all test tooling
- Python 3.11.15 satisfies all dependency requirements
- The project does not use `pytest-flask` — its custom fixtures are sufficient, and adding `pytest-flask` is unnecessary


## 0.4 Test Implementation Design


### 0.4.1 Test Strategy Selection

**Test Types to Implement:**

- **Unit-style tests** for narrowly scoped logic: application factory behavior (`create_app()` return value, route registration, middleware attachment), and `main.py` module-level constant validation
- **In-memory integration tests** using the Flask test client for HTTP behavior: extending the existing contract test suite with additional normalization edge cases, case-insensitive undefined route handling, and double-slash normalization loop body coverage
- **Lifecycle/process tests** for startup, shutdown, and port conflict behavior: no new subprocess tests needed; existing 10 lifecycle tests already cover the critical subprocess paths
- **Edge case tests** for boundary conditions: mixed-case undefined routes, internal double-slash paths, HEAD requests on normalized/error paths, query parameter tolerance on case-insensitive routes

### 0.4.2 Test Case Blueprint

**Component: `create_app()` Application Factory**
```
Test Categories:
- Happy path: Factory returns a Flask instance; TESTING config is respected
- Edge cases: Multiple calls produce independent instances; strict_slashes is disabled
- Error cases: N/A (factory has no failure modes to test)
```

**Component: `normalize_path` Before-Request Hook**
```
Test Categories:
- Happy path: Lowercase path matches route → redirect/re-serve (already covered for /Evening → /evening)
- Edge cases: Path with internal double-slash exercising while loop body (GET /evening// → 200)
- Error cases: Case-normalized path still unmatched → except block → return None → Flask 404 (GET /NONEXISTENT → 404)
- Combined: Case-insensitive + unsupported method → MethodNotAllowed caught → return None → 405 → error handler → 404 (POST /Evening → 404)
```

**Component: `method_not_allowed_to_not_found` Error Handler**
```
Test Categories:
- Happy path: POST/PUT/DELETE/PATCH on defined routes → 404 (already covered)
- Edge cases: Unsupported method on case-insensitive path → triggers both normalization exception AND error handler
- Error cases: N/A (handler is deterministic)
```

**Component: X-Powered-By Suppression (after_request)**
```
Test Categories:
- Happy path: Absent on GET, HEAD, 404 (already covered)
- Edge cases: Absent on responses served through normalize_path re-routing (e.g., /evening// → 200 with no X-Powered-By)
```

**Component: `main.py` Module Constants and Lifecycle**
```
Test Categories:
- Happy path: Default host=127.0.0.1, port=3000 when no env vars set
- Edge cases: Custom HOST/PORT from environment (already subprocess-tested)
- Error cases: Port conflict (already subprocess-tested)
```

### 0.4.3 Existing Test Extension Strategy

**Tests to extend:**

- `tests/test_http_contract.py` — Enhance `TestEdgeCases` by adding cases for internal double-slash normalization (`GET /evening//`), case-insensitive undefined routes (`GET /NONEXISTENT`), HEAD requests on normalized paths, and query parameter tolerance on case-insensitive routes
- `tests/test_http_contract.py` — Enhance `TestNotFoundResponses` by adding a case-insensitive undefined route test
- `tests/test_http_contract.py` — Enhance `TestUnsupportedMethodsOnRoot` and `TestUnsupportedMethodsOnEvening` by adding case-insensitive method rejection tests (e.g., `POST /Evening`)
- `tests/test_http_contract.py` — Enhance `TestXPoweredBySuppression` by adding suppression verification for middleware-rerouted responses

**Tests to add as new classes:**

- `tests/test_http_contract.py` — Add `TestApplicationFactory` class validating `create_app()` behavior: return type, configuration, route registration, instance isolation
- `tests/test_http_contract.py` — Add `TestNormalizationMiddleware` class (or extend `TestEdgeCases`) for focused normalization code path coverage

**Tests to fix:** None. All 43 existing tests pass without modification.

### 0.4.4 Test Data and Fixtures Design

**Required Test Data Structures:**
- No external test data files needed. All responses are static strings (`Hello, World!\n`, `Good evening`) with fixed content types and status codes.
- Test expectations are inline constants matching the deterministic API contracts.

**Fixture Organization Strategy:**
- Reuse existing `app` and `client` fixtures from `tests/conftest.py` for all HTTP contract tests
- No new fixtures required for the planned test additions — the existing function-scoped `app()` and `client(app)` provide sufficient isolation
- For application factory tests, call `create_app()` directly within test methods rather than relying on fixtures, to test factory behavior explicitly

**Mock Object Specifications:**
- None. Consistent with the project's zero-mocking discipline.

**Test Database/State Management:**
- N/A. The application has no database, file system state, or persistent storage.


## 0.5 Test File Transformation Mapping


### 0.5.1 File-by-File Test Plan

| Target Test File | Transformation | Source File/Test | Purpose/Changes |
|-----------------|----------------|------------------|-----------------|
| `tests/test_http_contract.py` | UPDATE | `app.py` | Add `TestApplicationFactory` class (4 tests) validating `create_app()` return type, instance independence, route registration, and strict_slashes configuration |
| `tests/test_http_contract.py` | UPDATE | `app.py` lines 85–107 | Add `TestNormalizationMiddleware` class (5 tests) covering the double-slash `while` loop body, normalize_path exception fallback, combined case+slash normalization, and unsupported method on case-insensitive path |
| `tests/test_http_contract.py` | UPDATE | `tests/test_http_contract.py` | Extend `TestEdgeCases` with 3 additional tests: HEAD on case-insensitive path, HEAD on undefined route, query parameters on case-insensitive path |
| `tests/test_http_contract.py` | UPDATE | `tests/test_http_contract.py` | Extend `TestXPoweredBySuppression` with 2 additional tests: suppression on double-slash-normalized response and on case-insensitive error response |
| `tests/test_http_contract.py` | UPDATE | `tests/test_http_contract.py` | Extend `TestNotFoundResponses` with 1 additional test: case-insensitive undefined route returns 404 |
| `tests/test_http_contract.py` | UPDATE | `tests/test_http_contract.py` | Extend `TestUnsupportedMethodsOnEvening` with 1 additional test: POST on case-insensitive `/Evening` returns 404 |
| `tests/test_lifecycle.py` | UPDATE | `main.py` lines 8–9 | Extend `TestAppExport` with 3 additional tests: module-level default host value, default port value, and port type validation |
| `tests/conftest.py` | REFERENCE | — | Use as fixture pattern source. No modifications needed — existing `app()` and `client()` fixtures support all planned additions |
| `tests/__init__.py` | REFERENCE | — | Package marker. No changes |

### 0.5.2 New Test Classes Detail

**`tests/test_http_contract.py` — New Class: `TestApplicationFactory` (4 tests)**

- Test categories: application factory behavior, configuration validation
- Mock dependencies: None
- Assertions focus: return type (`Flask` instance), `TESTING` configuration, route registration completeness, `strict_slashes=False` on URL map

Test methods:
- `test_create_app_returns_flask_instance` — Call `create_app()`, assert the return value is an instance of `Flask`
- `test_create_app_produces_independent_instances` — Call `create_app()` twice, assert the two instances are different objects (`is not`)
- `test_create_app_registers_expected_routes` — Create app, inspect `app.url_map` rules, verify `/` and `/evening` are registered
- `test_create_app_disables_strict_slashes` — Create app, verify that route rules have `strict_slashes=False` or that trailing-slash variants are accepted

**`tests/test_http_contract.py` — New Class: `TestNormalizationMiddleware` (5 tests)**

- Test categories: normalize_path code path coverage (line 89, lines 103–107), combined normalization behaviors
- Mock dependencies: None
- Assertions focus: status codes, response bodies, behavioral correctness for paths that exercise uncovered normalization code

Test methods:
- `test_internal_double_slash_path_normalized_to_route` — `GET /evening//` → status 200, body contains `Good evening`. Exercises the `while '//' in normalized:` loop body at `app.py` line 89 because the path `/evening//` contains an internal double-slash
- `test_case_insensitive_undefined_route_returns_404` — `GET /NONEXISTENT` → status 404. Exercises the `except Exception: return None` fallback at `app.py` lines 103–107 because the lowercased path `/nonexistent` still does not match any route
- `test_unsupported_method_on_case_insensitive_path_returns_404` — `POST /Evening` → status 404. Exercises the exception fallback when `url_adapter.match('/evening', method='POST')` raises `MethodNotAllowed`, which is caught by the `except Exception` block, combined with the 405→404 error handler
- `test_combined_case_and_double_slash_normalization` — `GET /EVENING//` → status 200, body contains `Good evening`. Tests both case-insensitive lowering AND double-slash collapsing in a single path
- `test_triple_leading_slash_normalization` — `GET ///evening` → status 200, body contains `Good evening`. Verifies Werkzeug-level slash normalization resolves to the correct route

### 0.5.3 Test Files to Modify Detail

**`tests/test_http_contract.py` — Extend `TestEdgeCases` (+3 test cases)**

New test methods:
- `test_head_request_on_case_insensitive_path` — `HEAD /Evening` → status 200, empty body, correct `Content-Type`. Verifies HEAD behavior works through the case-insensitive normalization path
- `test_head_request_on_undefined_route_returns_404` — `HEAD /nonexistent` → status 404, empty body. Verifies HEAD semantics on error responses
- `test_query_params_on_case_insensitive_path` — `GET /EVENING?foo=bar` → status 200, body `Good evening`. Verifies query parameters do not interfere with case-insensitive path resolution

**`tests/test_http_contract.py` — Extend `TestXPoweredBySuppression` (+2 test cases)**

New test methods:
- `test_absent_on_double_slash_normalized_response` — `GET /evening//` → verify `X-Powered-By` not in response headers. Ensures suppression applies when the response is served through the normalization re-routing path
- `test_absent_on_case_insensitive_error_response` — `GET /NONEXISTENT` → verify `X-Powered-By` not in response headers. Ensures suppression applies on 404 responses triggered via the normalization fallback path

**`tests/test_http_contract.py` — Extend `TestNotFoundResponses` (+1 test case)**

New test method:
- `test_case_insensitive_undefined_route_returns_404` — `GET /UNKNOWNPATH` → status 404. Specifically validates that the normalize_path hook's case-lowering + failed match → `return None` → Flask default 404 chain works correctly for uppercase undefined routes

**`tests/test_http_contract.py` — Extend `TestUnsupportedMethodsOnEvening` (+1 test case)**

New test method:
- `test_post_on_case_insensitive_evening_returns_404` — `POST /Evening` → status 404. Validates the full chain: normalize_path lowercases to `/evening` → `url_adapter.match()` raises `MethodNotAllowed` → `except` returns `None` → Flask 405 handler → `method_not_allowed_to_not_found` converts to 404

**`tests/test_lifecycle.py` — Extend `TestAppExport` (+3 test cases)**

New test methods:
- `test_main_module_default_host` — Subprocess: `import main; print(main.host)` with HOST removed from environment → assert stdout is `127.0.0.1`. Verifies the default host constant
- `test_main_module_default_port` — Subprocess: `import main; print(main.port)` with PORT removed from environment → assert stdout is `3000`. Verifies the default port constant
- `test_main_module_port_is_integer` — Subprocess: `import main; print(type(main.port).__name__)` → assert stdout is `int`. Verifies the `int()` conversion on the PORT environment variable

### 0.5.4 Test Configuration Updates

- **`pyproject.toml`**: No updates needed. The existing `[tool.pytest.ini_options]` configuration with `testpaths = ["tests"]` and `pythonpath = ["."]` already supports all planned test additions.
- **Coverage config**: No `.coveragerc` exists and none needs to be created. The default `pytest-cov` configuration is sufficient. If coverage reporting is formalized in the future, a `[tool.coverage.run]` section in `pyproject.toml` could exclude `tests/` from coverage measurement, but this is out of scope.
- **Test runner config**: No changes needed to the test discovery or runner configuration.

### 0.5.5 Cross-File Test Dependencies

**Shared fixtures (no changes):**
- `tests/conftest.py` — `app()` and `client()` fixtures used by all HTTP contract tests. The `TestApplicationFactory` class will call `create_app()` directly rather than using fixtures, to test factory behavior independently.

**Mock objects:** None across the entire test suite.

**Test utilities:**
- `tests/test_lifecycle.py` already contains `_find_free_port()` helper function. No additional helpers need to be created.
- No shared assertion helpers are needed — the test expectations are simple enough for inline assertions following the existing pattern of `assert response.status_code == 200` and `assert response.data == b'Hello, World!\n'`.

**Import updates required:**
- `tests/test_http_contract.py` — Add `from app import create_app` at the top of the file (or within the `TestApplicationFactory` class) for direct factory testing. The existing file already imports indirectly through the fixture.
- `tests/test_lifecycle.py` — No new imports needed. The existing `subprocess`, `sys`, `os`, `signal`, `time`, `socket` imports cover all planned additions.

**Estimated test count after changes:**
- Current: 43 tests (33 HTTP contract + 10 lifecycle)
- HTTP contract additions: +16 tests (4 factory + 5 normalization + 3 edge cases + 2 X-Powered-By + 1 not-found + 1 unsupported methods)
- Lifecycle additions: +3 tests (3 module constants)
- **New total: 62 tests**


## 0.6 Dependency Inventory


### 0.6.1 Testing Dependencies

All key testing packages relevant to this testing exercise, with exact names and versions from the dependency manifest (`requirements.txt`) and verified compatibility:

| Registry | Package Name | Version | Purpose |
|----------|-------------|---------|---------|
| pip | flask | 3.1.3 | Web framework under test; provides the Flask test client used for in-memory HTTP testing |
| pip | werkzeug | 3.1.7 | WSGI toolkit (auto-installed with Flask); provides EnvironBuilder and test client internals |
| pip | pytest | 9.0.2 | Testing framework and test runner; provides test discovery, fixture system, assertions |
| pip | pytest-cov | 7.1.0 | Coverage reporting plugin for pytest; provides `--cov` and `--cov-report` options for measuring statement and branch coverage |

**Notes:**
- `flask` and `werkzeug` are production dependencies from `requirements.txt` that also serve as test infrastructure (Flask test client)
- `pytest` is the only explicit test dependency in `requirements.txt`
- `pytest-cov` is recommended for coverage measurement but is not currently listed in `requirements.txt` — it should be added if coverage reporting is to be formalized
- No additional testing libraries are needed. The project's zero-mocking discipline eliminates the need for `pytest-mock`, `unittest.mock` wrappers, or HTTP recording tools
- Python standard library `subprocess`, `socket`, `os`, `sys`, `signal`, and `time` modules are used in lifecycle tests — no external packages required

### 0.6.2 Import Updates

**Test files requiring import updates:**

- `tests/test_http_contract.py` — Add direct import for application factory testing:
  - Add: `from app import create_app` (needed by the new `TestApplicationFactory` class to call `create_app()` directly rather than through the `app` fixture)

- `tests/test_lifecycle.py` — No new imports needed. Existing imports already cover all planned additions:
  - `subprocess` — for spawning Python processes to test module-level constants
  - `sys` — for `sys.executable` path
  - `os` — for environment variable manipulation

**Import transformation rules:**
- No import paths are changing. The project structure is flat with `app.py` and `main.py` at the root, and `pythonpath = ["."]` in `pyproject.toml` ensures all imports resolve correctly.
- The `from app import create_app` pattern is already established in `tests/conftest.py` and can be reused directly in test files.


## 0.7 Coverage and Quality Targets


### 0.7.1 Coverage Metrics

**Current Coverage (measured with `pytest-cov 7.1.0`, `--cov-branch`):**

| File | Statement Coverage | Branch Coverage |
|------|--------------------|-----------------|
| `app.py` | 90% (3 statements missed) | 88% (1 partial branch) |
| `main.py` | 0% (all in `__main__` guard) | 0% |
| `tests/conftest.py` | 100% | 100% |
| `tests/test_http_contract.py` | 100% | 100% |
| `tests/test_lifecycle.py` | 90% (10 statements missed) | 86% (2 partial branches) |
| **TOTAL** | **86%** | **86%** |

**Target Coverage After Implementation:**

| File | Target Statement Coverage | Target Branch Coverage | Improvement Path |
|------|---------------------------|------------------------|------------------|
| `app.py` | 97%+ | 95%+ | Cover line 89 (double-slash loop body) and lines 103–107 (exception fallback). Only the `from flask import Flask` import line and potentially unreachable defensive code remains uncovered. |
| `main.py` | 0% (in-process) | 0% (in-process) | Module-level constants are tested via subprocess. In-process coverage remains 0% because all executable code is inside `if __name__ == '__main__':`. This is expected and acceptable — subprocess tests validate the behavior. |
| `tests/test_lifecycle.py` | 90% (unchanged) | 86% (unchanged) | The missed lines are defensive `proc.kill()` fallbacks in `finally` blocks that only trigger on terminate timeout. These are accepted as non-critical. |
| **TOTAL** | **88%+** | **88%+** | Primary gains come from closing `app.py` coverage gaps. |

**Coverage Gaps to Address (Prioritized):**

- **`app.py` line 89** (HIGH priority) — The `while` loop body `normalized = normalized.replace('//', '/')` is covered by adding a test for `GET /evening//`, which has an internal double-slash that Werkzeug does not pre-normalize. Expected impact: +1 statement covered.
- **`app.py` lines 103–107** (HIGH priority) — The `except Exception: return None` block in `normalize_path` is covered by adding tests for `GET /NONEXISTENT` (case-normalized but unmatched route) and `POST /Evening` (case-normalized but method-mismatched route). Expected impact: +2 statements covered.
- **`main.py` lines 1–94** (ACCEPTED gap) — All code inside the `if __name__ == '__main__':` guard shows 0% in-process coverage. This is structurally expected for entry-point modules. The subprocess-based lifecycle tests in `test_lifecycle.py` exercise these paths through real process execution. Module-level constants (`host`, `port`) are validated via subprocess import tests.
- **`test_lifecycle.py` defensive cleanup lines** (ACCEPTED gap) — Lines like `proc.kill(); proc.wait()` in finally blocks execute only when `proc.terminate()` fails to stop the process within the timeout. Artificially triggering this would require injecting process unkillability, which is fragile and not worth the test complexity.

### 0.7.2 Test Quality Criteria

**Assertion Density Expectations:**
- Each test method should contain at least 1 meaningful assertion, with most containing 2–3 (status code + body or status code + header check)
- Follow the existing pattern: `assert response.status_code == <expected>` followed by `assert response.data == b'<expected>'` or header assertions
- Do not combine unrelated assertions in a single test method

**Test Isolation Requirements:**
- Each test must be independently runnable and not depend on execution order
- The function-scoped `app` and `client` fixtures ensure fresh Flask instances per test
- Lifecycle tests using subprocess are inherently isolated (separate OS processes)
- No shared mutable state between test classes or methods

**Performance Constraints:**
- In-memory Flask test client tests should complete in < 50ms each
- Subprocess lifecycle tests should complete in < 10s each (consistent with existing lifecycle test timing)
- The total test suite should complete within 30 seconds (currently ~11 seconds for 43 tests)

**Maintainability Standards:**
- Test methods use descriptive names following the `test_should_*` or `test_<behavior>_<condition>` pattern established in the repository
- Docstrings on test methods referencing the behavior being validated (following the pattern of existing tests that reference original Jest test descriptions)
- Inline assertions with clear expected values — no assertion helper abstractions needed for this project's simplicity

**Following Repository Test Patterns and Conventions:**
- Class-based test organization grouped by feature/behavior area
- `client.get()`, `client.post()`, `client.head()` for HTTP testing
- Direct `assert` statements (no `assertEqual` or third-party assertion library)
- Minimal setup — test logic is self-contained within each method
- No parameterized tests (existing suite uses explicit individual test methods)


## 0.8 Scope Boundaries


### 0.8.1 Exhaustively In Scope

**Test file updates (the primary deliverables):**
- `tests/test_http_contract.py` — All HTTP behavioral contract test additions: new `TestApplicationFactory` class, new `TestNormalizationMiddleware` class, extensions to `TestEdgeCases`, `TestXPoweredBySuppression`, `TestNotFoundResponses`, and `TestUnsupportedMethodsOnEvening`
- `tests/test_lifecycle.py` — Module-level constant validation additions to `TestAppExport`

**Source files under test (read-only, no modifications):**
- `app.py` — Application factory, route handlers, middleware hooks, error handlers
- `main.py` — Entry-point lifecycle, environment configuration, port check, startup logging

**Test infrastructure (no modifications needed):**
- `tests/conftest.py` — Shared fixtures (read-only reference for fixture patterns)
- `tests/__init__.py` — Package marker (no changes)
- `pyproject.toml` — Test runner configuration (no changes needed; existing `testpaths` and `pythonpath` already support all additions)

**Test configuration files (no changes needed):**
- `pyproject.toml` — `[tool.pytest.ini_options]` section remains unchanged
- No `.coveragerc`, `pytest.ini`, `setup.cfg`, or `tox.ini` needs to be created or modified

**Test execution validation:**
- Full pytest suite execution confirming all existing 43 tests + all new tests pass
- Coverage measurement to verify gap closure in `app.py`

### 0.8.2 Explicitly Out of Scope

**Source code modifications:**
- No changes to `app.py` — all Flask routes, middleware, error handlers, and the `create_app()` factory remain untouched
- No changes to `main.py` — the entry-point lifecycle, environment configuration, and socket pre-check remain untouched
- No changes to `requirements.txt` — dependency versions are fixed by the project; `pytest-cov` is not added to the manifest unless explicitly requested

**Legacy Node.js placeholder files (excluded per user directive):**
- `server.js` — Empty file, no tests
- `package.json` — Empty/minimal, no tests
- `package-lock.json` — Lock file, no tests
- `jest.config.js` — Empty Jest config, no tests
- `__tests__/server.test.js` — Empty JS test placeholder, no tests
- `__tests__/lifecycle.test.js` — Empty JS test placeholder, no tests

**Blitzy documentation files:**
- `blitzy/Technical Specifications.md` — Documentation only, no tests
- `blitzy/Project Guide.md` — Documentation only, no tests
- `README.md` — Documentation only; no testing section updates unless explicitly requested

**Features and capabilities NOT to be tested:**
- Browser tests, frontend tests, end-to-end tests — not applicable to this headless HTTP server
- Database tests — no database exists in this project
- External service integration tests — no external services are used
- Authentication or authorization tests — no auth layer exists
- Performance or load testing — out of scope for this functional test improvement
- Cross-version Python testing (e.g., Python 3.12, 3.13 matrix) — not requested
- CI/CD pipeline creation or modification — not requested; per implementation rules, do not create or update GitHub workflows
- `.gitignore` modifications — not requested
- Deployment documentation — not requested

**Architectural changes excluded:**
- No refactoring of production code for testability
- No introduction of dependency injection patterns
- No conversion from class-based to function-based test organization (or vice versa)
- No introduction of test parameterization for existing explicit test methods
- No addition of new testing frameworks or assertion libraries beyond what exists


## 0.9 Execution Parameters


### 0.9.1 Testing-Specific Instructions

**Test execution command:**
```
python -m pytest -v --tb=short
```

**Coverage measurement command:**
```
python -m pytest -v --cov=. --cov-report=term-missing --cov-branch
```

**Single test execution pattern:**
```
python -m pytest tests/test_http_contract.py::TestNormalizationMiddleware::test_internal_double_slash_path_normalized_to_route -v
```

**Run a specific test class:**
```
python -m pytest tests/test_http_contract.py::TestApplicationFactory -v
```

**Debug mode execution:**
```
python -m pytest -v --tb=long -s
```

**Specific test patterns to follow in the repository:**
- Test classes are organized by behavioral area (e.g., `TestGetRoot`, `TestEdgeCases`, `TestServerStartup`)
- Test method names use the pattern `test_<behavior_description>` (e.g., `test_should_return_200_with_hello_world`, `test_head_request_on_case_insensitive_path`)
- Each test method contains a docstring referencing the behavioral contract being validated
- HTTP tests use `client.get()`, `client.post()`, `client.head()` etc. and assert on `response.status_code`, `response.data`, and `response.headers`
- Lifecycle tests use `subprocess.Popen` with explicit environment dictionaries and stdout/stderr capture
- All tests are deterministic with no timing-sensitive assertions

**Excluded test categories per user instruction:**
- Browser/frontend tests
- Database tests
- External service integration tests
- Performance/load tests
- CI/CD pipeline tests

**Environment setup requirements for tests:**
- Python 3.11+ virtual environment with `flask==3.1.3` and `pytest==9.0.2` installed
- Working directory set to the project root (where `app.py` and `main.py` reside)
- No environment variables required for test execution (tests manage their own env vars via subprocess)
- Ports used by lifecycle tests are dynamically allocated via `_find_free_port()` — no port pre-configuration needed


## 0.10 Special Instructions for Testing


### 0.10.1 Testing-Specific Requirements

The following testing-specific requirements are explicitly emphasized by the user and must be strictly observed throughout implementation:

**Minimal Change Principle:**
- ONLY modify test files (`tests/test_http_contract.py`, `tests/test_lifecycle.py`) and test-related configurations
- DO NOT modify source code (`app.py`, `main.py`) under any circumstances — all existing runtime behavior must remain exactly as-is
- DO NOT modify `tests/conftest.py` unless absolutely necessary — the existing fixtures are sufficient for all planned additions
- DO NOT modify `requirements.txt` or `pyproject.toml` — the dependency manifest and test configuration are complete

**Follow Existing Test Patterns:**
- Match the class-based test organization used throughout the existing suite
- Use the same assertion style: direct `assert` statements with explicit expected values
- Include docstrings on test methods following the existing pattern of describing the behavioral contract being validated
- Use function-scoped fixtures (`client`) for HTTP tests and subprocess-based execution for lifecycle tests

**Maintain Test Isolation:**
- Each test must run independently and produce identical results regardless of execution order
- HTTP contract tests use the `client` fixture which creates a fresh Flask app per test
- Lifecycle tests spawning subprocesses must ensure clean process termination in `finally` blocks
- No shared mutable state between test classes

**Zero-Mocking Discipline:**
- Do not introduce `unittest.mock`, `pytest-mock`, or any mocking library
- Test real behavior using the Flask test client for HTTP contracts
- Use subprocess execution for lifecycle behavior that genuinely requires it
- The only acceptable isolation mechanism is the Flask test client's in-memory WSGI environment

**Preserve Test Parity:**
- All 43 existing tests must continue to pass without modification
- New tests must be additive — they extend coverage without altering existing test expectations
- The existing 1:1 mapping between original Jest/Supertest tests and Python pytest tests must remain intact

**Implementation Rule (Project-Specific):**
- Do not make any updates or changes in GitHub App to create or update a workflow

**Deterministic Testing:**
- Avoid timing-sensitive assertions in lifecycle tests
- Assert on observable outcomes (exit codes, stdout content, stderr content) rather than process timing
- Use ephemeral port allocation (`_find_free_port()` pattern) for any tests requiring network operations
- Cleanly terminate all spawned processes with appropriate timeout handling

**Code Quality Observations (Note Only, Do Not Fix):**
- `app.py` line 89 (double-slash normalization) is partially unreachable via Werkzeug's test client for leading `//` paths due to protocol-relative URL interpretation — this is a Werkzeug behavior, not a bug in the application
- `test_lifecycle.py` defensive cleanup paths (`proc.kill()` in `finally`) have low coverage — this is acceptable for defensive programming and does not indicate a test gap worth artificially exercising
- The `main.py` module-level constants are evaluated at import time, making in-process testing of environment variable overrides require module reloading — subprocess-based testing is the cleaner approach, consistent with the existing test strategy


