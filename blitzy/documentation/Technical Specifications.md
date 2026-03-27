# Technical Specification

# 0. Agent Action Plan

## 0.1 Intent Clarification

### 0.1.1 Core Testing Objective

Based on the provided requirements, the Blitzy platform understands that the testing objective is to **introduce the first automated test suite** to a currently untested, minimal Flask microserver (`app.py`, 93 lines) that serves as a Backprop integration test harness. The project presently has **zero automated test coverage** — all verification is performed manually via a 7-test curl suite and static analysis tools (`py_compile`, `pycodestyle`).

**Request Category:** Add new tests (greenfield test suite creation)

The testing requirements, restated with enhanced clarity:

- **HTTP Contract Verification** — Automate the existing manual curl verification behaviors as repeatable, deterministic pytest assertions using Flask's built-in `test_client()`, covering all documented request/response contracts for both the health check and catch-all endpoints
- **Route Precedence Validation** — Verify that Flask's routing specificity correctly resolves `GET /health` to the health handler while routing non-GET methods on `/health` (e.g., `POST /health`, `DELETE /health`) to the catch-all handler
- **Multi-Method Coverage** — Confirm that all seven configured HTTP methods (`GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `HEAD`, `OPTIONS`) behave consistently with the documented contract across representative paths
- **Content-Type and Body Precision** — Assert exact response bodies (`{"status":"ok"}` for health, `Hello, World!\n` for catch-all), exact HTTP status codes (200), and correct content types (`application/json` vs `text/plain`)
- **Configuration Constant Assertions** — Validate that the hardcoded constants `HOST`, `PORT`, and `METHODS` in `app.py` match their documented values (`127.0.0.1`, `3000`, and the seven-method list)
- **Module Import Safety** — Confirm that `import app` does not trigger server startup (i.e., the `if __name__ == '__main__'` guard functions correctly)
- **Startup Lifecycle Validation** — Verify that executing `python app.py` invokes `app.run()` with the configured host and port under the `__main__` guard

**Implicit Testing Needs Surfaced:**

- Edge cases for deeply nested arbitrary paths (e.g., `/a/b/c/d/e`) through the catch-all handler
- Exact byte-length verification of the catch-all response body (14 bytes: `Hello, World!\n`)
- Boundary behavior for the root path `/` versus sub-paths via Flask's dual-decorator pattern
- Flask's automatic `OPTIONS` handling on `/health` (empty body with `Allow` header) as a distinct behavioral case
- Content-type charset suffix handling (`text/plain; charset=utf-8` as returned by Flask versus the base `text/plain` mimetype)

### 0.1.2 Special Instructions and Constraints

**Critical Directives Captured from User:**

- **Minimal change principle** — ONLY add test files and minimal test infrastructure; do NOT modify existing production code in `app.py`
- **No heavy tooling** — Use `pytest`, `pytest-cov`, and Flask's built-in `test_client()` only; avoid introducing unnecessary dependencies
- **Minimal mocking** — Prefer real in-process Flask app behavior for HTTP tests; mock only for startup/lifecycle path validation where binding a real port is impractical
- **Lightweight structure** — Keep the test directory structure minimal and aligned with the project's single-file architecture
- **No CI/CD creation** — Do not create or modify GitHub workflows or CI/CD pipelines
- **No source modification** — Do not modify `app.py`, `requirements.txt` (for production dependencies), `README.md`, or any other existing file unless absolutely necessary for testability

**Testing Convention Requirements:**

- Follow pytest idiomatic patterns (function-based tests, fixtures, parametrization where helpful)
- Use Flask's `test_client()` for all HTTP-level assertions to maintain high contract confidence
- Keep tests synchronous, deterministic, and fast
- Use `subprocess` from Python's standard library only if needed for narrow startup/import lifecycle validation

**User-Specified Implementation Rule:**

User Example: "Do not make any updates or changes in GitHub App to create or update a workflow."

### 0.1.3 Technical Interpretation

These testing requirements translate to the following technical test implementation strategy:

- To **verify all HTTP contract behaviors**, we will **create** `tests/test_http_contract.py` containing integration-style tests that exercise Flask's `test_client()` against every documented request/response pattern, including health check JSON, catch-all plain text, multi-method routing, and path variations
- To **validate route precedence around `/health`**, we will **create** dedicated test cases within `tests/test_http_contract.py` that assert `GET /health` returns JSON while `POST /health`, `DELETE /health`, and other non-GET methods return plain text through the catch-all
- To **verify import safety and startup behavior**, we will **create** `tests/test_lifecycle.py` containing tests that confirm `import app` does not start a server, validate `__main__` guard behavior, and assert `app.run()` is called with the correct host/port parameters
- To **assert configuration constants**, we will **create** targeted tests within `tests/test_lifecycle.py` that import and verify `app.HOST`, `app.PORT`, and `app.METHODS` values
- To **provide a shared Flask test client fixture**, we will **create** `tests/conftest.py` with a reusable `client` fixture that eliminates boilerplate across test files
- To **enable coverage measurement**, testing dependencies (`pytest`, `pytest-cov`) will be tracked and installed, and the test suite will support `pytest --cov=app --cov-report=term-missing`

### 0.1.4 Coverage Requirements Interpretation

**Explicit coverage target from user:** 90%+ line/function coverage of `app.py`, with 100% coverage of all externally visible HTTP behavior.

**Implicit coverage expectations based on analysis:**

- **Industry standard for a 93-line single-file Flask app:** Near-complete (95–100%) coverage is achievable and expected given the deterministic, stateless nature of the application
- **Existing coverage pattern:** 0% automated coverage currently; the 7-test manual curl suite covers all 18 documented functional requirements but produces no measurable metric
- **Critical path analysis:** The two route handlers (`health()` at lines 42–48 and `catch_all()` at lines 66–79) and the configuration constants (lines 30–33) constitute the entirety of testable application logic; only the `if __name__ == '__main__'` block (lines 92–93) requires special handling

To achieve comprehensive testing, coverage should include:

- 100% of the `health()` handler (lines 42–48)
- 100% of the `catch_all()` handler (lines 66–79)
- 100% of configuration constants (lines 30–33)
- The `if __name__ == '__main__'` entry point (lines 92–93) via mock-based lifecycle testing
- Module-level import lines (lines 1–25) which execute on import

## 0.2 Test Discovery and Analysis

### 0.2.1 Existing Test Infrastructure Assessment

Repository analysis was conducted by searching for all files matching `*test*`, `*spec*`, `test_*`, `*_test.*`, `conftest*`, `pytest*`, `.coveragerc`, and `tox.ini` patterns across the entire repository. The results confirm the complete absence of automated test infrastructure:

| Repository Artifact | Status | Testing Relevance |
|---|---|---|
| `app.py` (93 lines) | Present — sole application source | Only testable artifact |
| `requirements.txt` | Contains only `Flask==3.1.3` | No testing dependencies declared |
| `tests/` directory | **Not present** | Must be created from scratch |
| `conftest.py` | **Not present** | Must be created if shared fixtures needed |
| `pytest.ini` / `pyproject.toml` | **Not present** | No test configuration exists |
| `.coveragerc` | **Not present** | No coverage configuration exists |
| `tox.ini` | **Not present** | No multi-environment test runner |
| `server.js`, `package.json`, `package-lock.json` | Empty legacy Node.js placeholders | Inert; excluded from testing scope |
| `blitzy/documentation/` | Internal governance artifacts | Not test-related; excluded |

**Summary:** Repository analysis reveals **zero** automated testing infrastructure. No test files, no test framework dependencies, no test configuration files, and no coverage tooling exist anywhere in the repository. The only Python file is `app.py` itself.

**Current Test Infrastructure Details:**

- **Current testing framework:** None (manual curl verification only)
- **Test runner configuration location:** N/A — must be created
- **Coverage tools in use:** None — `pytest-cov` must be introduced
- **Mock/stub libraries detected:** None — standard library `unittest.mock` will be used where necessary
- **Test data fixtures or factories present:** None — static responses require no complex fixtures

### 0.2.2 Existing Manual Validation Suite

The project's de facto verification is a 7-test manual curl suite documented in the Tech Spec (Section 6.6.2.1) and `README.md`. All 7 tests are confirmed passing and cover 18 functional requirements:

| Manual Test # | curl Command | Expected Response | Validates |
|---|---|---|---|
| 1 | `curl -s http://127.0.0.1:3000/health` | `{"status":"ok"}` (JSON, 200) | Health check endpoint |
| 2 | `curl -s -X POST http://127.0.0.1:3000/health` | `Hello, World!\n` (text, 200) | Route precedence |
| 3 | `curl -s http://127.0.0.1:3000/` | `Hello, World!\n` (text, 200) | Root path catch-all |
| 4 | `curl -s http://127.0.0.1:3000/any/path` | `Hello, World!\n` (text, 200) | Arbitrary path catch-all |
| 5 | `curl -s -X DELETE http://127.0.0.1:3000/foo/bar` | `Hello, World!\n` (text, 200) | DELETE method support |
| 6 | `curl -s -X PUT http://127.0.0.1:3000/some/resource` | `Hello, World!\n` (text, 200) | PUT method support |
| 7 | `curl -s -X OPTIONS http://127.0.0.1:3000/health` | Empty body + `Allow` header (200) | Flask auto-OPTIONS |

The automated test suite will convert these manual tests into repeatable pytest assertions and extend coverage beyond the 7-test baseline.

### 0.2.3 Web Search Research Conducted

Version compatibility research was performed to validate the testing stack against the project's Python 3.13+ and Flask 3.1.3 runtime:

- **pytest 9.0.x + Python 3.13:** Confirmed compatible — pytest changelog entry `#12334` explicitly documents Python 3.13 support, and entry `#12497` includes Python 3.13-specific test fixes
- **pytest-cov 7.1.0 + Python 3.13:** Confirmed compatible — the underlying `coverage` package is listed as Python 3.13-ready on pyreadiness.org
- **Flask 3.1.3 test_client() + pytest:** Flask's test client is a stable, built-in feature that operates as an in-process WSGI client with no external dependencies; fully compatible with any test runner
- **No version conflicts detected** between the installed testing stack (pytest 9.0.2, pytest-cov 7.1.0) and the project runtime (Python 3.13.12, Flask 3.1.3, Werkzeug 3.1.7)

## 0.3 Testing Scope Analysis

### 0.3.1 Test Target Identification

**Primary code to be tested:**

- **Module:** `app` at `app.py` — requires HTTP contract tests, configuration tests, and lifecycle tests
  - **`health()` function** (lines 42–48): GET-only route handler returning JSON — requires happy path and content-type tests
  - **`catch_all(path)` function** (lines 66–79): Universal handler for all methods/paths — requires multi-method, multi-path, body, and status tests
  - **Configuration constants** `HOST`, `PORT`, `METHODS` (lines 30–33): Hardcoded values — requires value assertion tests
  - **`app` Flask instance** (line 25): Application object — requires importability and route registration tests
  - **`if __name__ == '__main__'` block** (lines 92–93): Entry point guard — requires lifecycle/startup mock tests

**Existing test file mapping:**

| Source File | Existing Test File | Test Categories Present |
|---|---|---|
| `app.py` | None | None — 0% automated coverage |

**Dependencies requiring mocking:**

- **`app.run()`** — Must be mocked when testing the `__main__` startup path to prevent binding a real TCP port during test execution
- **`subprocess` execution** — If testing `python app.py` as a subprocess, may require process management to validate startup banner output
- **No external services to mock** — The application makes zero outbound connections
- **No database interactions to stub** — The application has no persistence layer
- **No file system operations to virtualize** — The application performs no file I/O

### 0.3.2 Version Compatibility Research

Based on the project's Python 3.13.12 runtime and Flask 3.1.3 framework, the recommended and verified testing stack is:

| Tool | Package | Version | Compatibility Rationale |
|---|---|---|---|
| Testing framework | `pytest` | 9.0.2 | Python 3.13 support confirmed via changelog #12334; dropped Python 3.9 (aligns with Flask 3.1.x minimum) |
| Coverage measurement | `pytest-cov` | 7.1.0 | Wraps `coverage` 7.13.5 which has confirmed Python 3.13 support |
| Flask test client | `flask[test_client]` | 3.1.3 (built-in) | Native Flask feature; no additional dependency required |
| Mocking library | `unittest.mock` | stdlib | Python 3.13 standard library; zero-dependency |
| Subprocess testing | `subprocess` | stdlib | Python 3.13 standard library; used only for narrow lifecycle tests |

**Version conflict analysis:** No conflicts detected. The pytest 9.0.x series requires Python ≥ 3.10, which is satisfied by the project's Python 3.13.12 runtime. Flask 3.1.3 requires Werkzeug ≥ 3.1, and the installed Werkzeug 3.1.7 satisfies this constraint. All components are mutually compatible at the verified versions.

## 0.4 Test Implementation Design

### 0.4.1 Test Strategy Selection

**Test types to implement:**

- **Integration-style HTTP contract tests:** Focus on exercising the Flask application through its `test_client()` as an in-process WSGI client. These form the core of the test suite and validate all externally visible HTTP behavior with real routing, real handlers, and real response generation — no mocking of Flask internals.
- **Unit-style configuration tests:** Small, fast assertions on the hardcoded constants `HOST`, `PORT`, and `METHODS` to detect accidental value changes during future maintenance.
- **Lifecycle/import tests:** Minimal tests that verify the `__main__` guard prevents server startup on import, and that `app.run()` is invoked with correct parameters when the module is executed directly. These use `unittest.mock.patch` to isolate the startup path.

**Test types explicitly excluded per user instructions:**

- Browser/UI tests — No frontend exists
- Database tests — No persistence layer exists
- External service tests — No outbound connections exist
- Load/performance tests — No SLAs or concurrency requirements
- Deployment/infrastructure tests — No CI/CD pipeline in scope
- End-to-end tests requiring a running server — Flask test client provides in-process coverage

### 0.4.2 Test Case Blueprint

```
Component: health() handler (app.py:42-48)
Test Categories:
- Happy path: GET /health returns {"status":"ok"}, HTTP 200, application/json
- Edge cases: GET /health response JSON structure contains exactly one key "status"
- Error cases: Non-GET methods on /health route to catch-all (not health handler)
```

```
Component: catch_all(path) handler (app.py:66-79)
Test Categories:
- Happy path: GET / returns "Hello, World!\n", HTTP 200, text/plain
- Edge cases: Deeply nested paths (/a/b/c/d/e), paths with special chars, root vs sub-paths
- Error cases: N/A — handler is unconditional; all requests return identical response
- Multi-method: GET, POST, PUT, DELETE, PATCH produce identical catch-all response
- Body precision: Exact 14-byte body with trailing newline
```

```
Component: Route precedence (Flask routing specificity)
Test Categories:
- Happy path: GET /health resolves to health handler (JSON)
- Edge cases: POST /health, DELETE /health resolve to catch-all (plain text)
- Special: OPTIONS /health triggers Flask auto-OPTIONS (empty body, Allow header)
- Special: HEAD behavior on catch-all paths
```

```
Component: Configuration constants (app.py:30-33)
Test Categories:
- Happy path: HOST == '127.0.0.1', PORT == 3000, METHODS == 7-item list
- Edge cases: METHODS list contains exactly the expected method strings
```

```
Component: __main__ guard and startup (app.py:92-93)
Test Categories:
- Happy path: import app does not call app.run()
- Happy path: __main__ execution calls app.run(host='127.0.0.1', port=3000)
- Edge cases: Module can be imported multiple times safely
```

### 0.4.3 Existing Test Extension Strategy

Not applicable — no existing test files to extend, refactor, or fix. The entire test suite is created from scratch.

### 0.4.4 Test Data and Fixtures Design

**Required test data structures:** None — all responses are static and deterministic. Expected values are inline constants within test assertions.

**Fixture organization strategy:**

- A single shared `client` fixture in `tests/conftest.py` provides the Flask `test_client()` instance to all test functions
- The fixture creates the client once per test function (function scope) for clean isolation
- No complex setup/teardown, database seeding, or environment variable configuration is needed

**Mock object specifications:**

- `unittest.mock.patch('app.app.run')` — Used in lifecycle tests to intercept `app.run()` and verify it receives `host='127.0.0.1'` and `port=3000` without actually starting a server
- `unittest.mock.patch('app.app.run')` combined with `runpy.run_module` — Used to simulate `python app.py` execution within the test process

**Test database/state management approach:** Not applicable — the application is completely stateless with zero persistence.

## 0.5 Test File Transformation Mapping

### 0.5.1 File-by-File Test Plan

| Target Test File | Transformation | Source File/Test | Purpose/Changes |
|---|---|---|---|
| `tests/__init__.py` | CREATE | N/A | Empty init file to make `tests/` a proper Python package for pytest discovery |
| `tests/conftest.py` | CREATE | `app.py` | Shared pytest fixtures: Flask `test_client()` fixture providing the `client` object to all test functions |
| `tests/test_http_contract.py` | CREATE | `app.py` | Comprehensive HTTP contract tests covering health check endpoint, catch-all handler, route precedence, multi-method behavior, content-type assertions, and body-byte precision |
| `tests/test_lifecycle.py` | CREATE | `app.py` | Import safety tests, `__main__` guard verification, `app.run()` mock-based startup parameter validation, and configuration constant assertions |

All files are **CREATE** mode — no existing test files to UPDATE, DELETE, or use as REFERENCE.

### 0.5.2 New Test Files Detail

**`tests/__init__.py`** — Package marker

- Purpose: Ensures `tests/` is recognized as a Python package for pytest's default test discovery
- Content: Empty file (no code)

**`tests/conftest.py`** — Shared fixtures

- Fixture: `client` — returns `app.test_client()` for in-process HTTP testing
- Scope: Function-level (default) for clean per-test isolation
- Dependencies: Imports `app` from `app.py`
- No complex setup, teardown, or parameterization

**`tests/test_http_contract.py`** — HTTP behavior tests

- Test categories covered:
  - **Health check happy path:** `GET /health` → JSON `{"status":"ok"}`, status 200, content-type `application/json`
  - **Health check JSON structure:** Response contains exactly `{"status": "ok"}`
  - **Catch-all root path:** `GET /` → `Hello, World!\n`, status 200, content-type `text/plain`
  - **Catch-all arbitrary paths:** `GET /any/path`, `GET /a/b/c/d/e`, `GET /foo/bar`
  - **Catch-all exact body:** 14 bytes, exact byte content `b'Hello, World!\n'`
  - **Route precedence:** `GET /health` → health handler JSON; `POST /health` → catch-all plain text; `DELETE /health` → catch-all plain text
  - **Multi-method catch-all:** `POST /`, `PUT /resource`, `DELETE /foo`, `PATCH /item` all return catch-all response
  - **HEAD method behavior:** `HEAD /path` returns correct headers with empty body (HTTP HEAD semantics)
  - **OPTIONS on /health:** Flask auto-OPTIONS returns empty body with `Allow` header listing supported methods
  - **Content-type precision:** Health returns `application/json`; catch-all returns `text/plain` (with charset)
- Mock dependencies: None — all tests use real Flask routing and response generation
- Assertions focus: Status codes, response body bytes, content-type headers, JSON structure, `Allow` header presence

**`tests/test_lifecycle.py`** — Import and startup behavior tests

- Test categories covered:
  - **Import safety:** `import app` succeeds without starting a server; `app.app` is a Flask instance
  - **Configuration constants:** `app.HOST == '127.0.0.1'`, `app.PORT == 3000`, `app.METHODS` contains all 7 HTTP methods
  - **`__main__` guard:** `app.run()` is NOT called on import; IS called with correct args when executed as `__main__`
  - **Flask app identity:** `app.app.name` equals the expected module name
- Mock dependencies: `unittest.mock.patch` on `app.app.run` for startup path testing
- Assertions focus: Constant values, mock call arguments, type checks, absence of side effects on import

### 0.5.3 Test Configuration Updates

No existing test configuration files exist. The following minimal configuration approach is recommended:

- **`pytest.ini` or `pyproject.toml` `[tool.pytest]` section:** Not strictly required — pytest's default discovery will find `tests/test_*.py` files automatically. May be added if custom settings are needed (e.g., `testpaths`, `addopts`).
- **`.coveragerc`:** Not required — coverage configuration can be passed via command-line flags (`--cov=app --cov-report=term-missing`). May be added for convenience if persistent coverage settings are desired.
- **No test runner config changes** — pytest operates with zero configuration for this project structure.

### 0.5.4 Cross-File Test Dependencies

- **Shared fixtures:** `tests/conftest.py` provides the `client` fixture consumed by `tests/test_http_contract.py`
- **Direct imports from `app.py`:** Both `tests/test_http_contract.py` and `tests/test_lifecycle.py` import from `app` (the `app` Flask instance and configuration constants)
- **No shared mock objects** — Mocking is limited to `tests/test_lifecycle.py` and uses standard library `unittest.mock`
- **No test utilities or helper modules** — The test suite is small enough that a dedicated helpers module would be overengineering
- **Import path:** Tests import `app` directly since `app.py` resides at the repository root and pytest adds the root to `sys.path` by default

## 0.6 Dependency Inventory

### 0.6.1 Testing Dependencies

All testing packages are development-only dependencies. They are not required for production runtime and should not be added to `requirements.txt`.

| Registry | Package Name | Version | Purpose |
|---|---|---|---|
| PyPI | `pytest` | 9.0.2 | Testing framework — test discovery, execution, assertion introspection, fixtures |
| PyPI | `pytest-cov` | 7.1.0 | Coverage measurement plugin — wraps `coverage` library for pytest integration |
| PyPI | `coverage` | 7.13.5 | Line/branch coverage engine (transitive dependency of `pytest-cov`) |
| stdlib | `unittest.mock` | (Python 3.13 stdlib) | Mock/patch utilities for isolating `app.run()` in lifecycle tests |
| stdlib | `subprocess` | (Python 3.13 stdlib) | Process execution for optional startup banner verification |
| stdlib | `runpy` | (Python 3.13 stdlib) | Module execution simulation for `__main__` guard testing |
| stdlib | `json` | (Python 3.13 stdlib) | JSON parsing for health check response validation |

**Existing production dependencies (unchanged):**

| Registry | Package Name | Version | Purpose |
|---|---|---|---|
| PyPI | `Flask` | 3.1.3 | Web framework — application core (pinned in `requirements.txt`) |
| PyPI | `Werkzeug` | 3.1.7 | WSGI server and HTTP utilities (transitive dependency of Flask) |
| PyPI | `Jinja2` | 3.1.6 | Template engine (transitive; unused by app) |
| PyPI | `MarkupSafe` | 3.0.3 | HTML escaping (transitive; unused by app) |
| PyPI | `itsdangerous` | 2.2.0 | Data signing (transitive; unused by app) |
| PyPI | `click` | 8.3.1 | CLI framework (transitive; unused by app) |
| PyPI | `blinker` | 1.9.0 | Signal dispatching (transitive; unused by app) |

### 0.6.2 Import Updates

**Test files requiring imports from `app.py`:**

- `tests/conftest.py` — imports `app` (the Flask application instance) from the `app` module
  - `from app import app`
- `tests/test_http_contract.py` — uses the `client` fixture from `conftest.py`; no direct `app` import needed
- `tests/test_lifecycle.py` — imports module-level constants and uses `unittest.mock.patch`
  - `import app` (for constant access: `app.HOST`, `app.PORT`, `app.METHODS`)
  - `from unittest.mock import patch`
  - `import runpy` (for `__main__` simulation)

**No import transformation rules required** — The application has a single module (`app.py`) at the repository root with no internal package structure to refactor. All imports follow the simple pattern `from app import <name>` or `import app`.

## 0.7 Coverage and Quality Targets

### 0.7.1 Coverage Metrics

- **Current automated coverage:** 0% (no test suite exists)
- **Target coverage:** 90%+ line/function coverage of `app.py`, per user specification
- **Practical achievable coverage:** 95–100% given the 93-line, fully deterministic, stateless application

**Coverage gaps to address:**

| Code Region | Lines | Current Coverage | Target Coverage | Test Strategy |
|---|---|---|---|---|
| Module imports and docstring | 1–18 | 0% | 100% (automatic on import) | Covered implicitly by any test that imports `app` |
| Flask app instance creation | 25 | 0% | 100% | Covered implicitly by any test that imports `app` |
| Configuration constants `HOST`, `PORT`, `METHODS` | 30–33 | 0% | 100% | Direct assertion tests in `test_lifecycle.py` |
| `health()` handler | 42–48 | 0% | 100% | HTTP contract tests for `GET /health` |
| `catch_all(path)` handler | 66–79 | 0% | 100% | HTTP contract tests for multiple methods/paths |
| `if __name__ == '__main__'` block | 92–93 | 0% | 100% | Mock-based `__main__` guard test in `test_lifecycle.py` |

**Focus areas for coverage:** The highest-priority coverage targets are the two route handlers (`health()` and `catch_all()`), which represent 100% of the application's externally visible HTTP behavior. The `__main__` block requires special handling via `runpy.run_module` or `unittest.mock.patch` since it only executes when the module is the entry point.

### 0.7.2 Test Quality Criteria

- **Assertion density:** Each test function should contain at least one explicit assertion, with HTTP contract tests typically asserting status code, content type, and response body together
- **Test isolation:** Each test function operates independently using a fresh `test_client()` instance via the fixture; no shared state between tests; tests can run in any order
- **Performance constraints:** The full test suite should execute in under 2 seconds — Flask's in-process `test_client()` requires no network I/O, and all responses are static
- **Maintainability standards:**
  - Test names clearly describe the behavior being verified (e.g., `test_get_health_returns_json_ok`)
  - Tests verify stable external behavior (HTTP status, body, headers), not Flask internal implementation details
  - Minimal mocking — only for the `__main__` startup path
  - Parametrization used where it reduces duplication without harming readability (e.g., testing multiple HTTP methods against the catch-all)
- **Repository pattern alignment:** Tests follow pytest idiomatic conventions with function-based tests, fixtures in `conftest.py`, and `assert` statements rather than `unittest.TestCase` class hierarchies

## 0.8 Scope Boundaries

### 0.8.1 Exhaustively In Scope

**New test files:**

- `tests/__init__.py` — Package marker for test discovery
- `tests/conftest.py` — Shared Flask test client fixture
- `tests/test_http_contract.py` — All HTTP endpoint and routing behavior tests
- `tests/test_lifecycle.py` — Import safety, configuration constants, and startup behavior tests

**Test infrastructure files (if needed):**

- `pytest.ini` or equivalent section in `pyproject.toml` — Only if custom pytest configuration becomes necessary
- `.coveragerc` — Only if persistent coverage settings are desired beyond CLI flags

**Source file under test:**

- `app.py` — Sole target of all test assertions (read-only; not modified)

**Test execution commands:**

- `pytest` — Run all tests
- `pytest --cov=app --cov-report=term-missing` — Run with coverage measurement
- `pytest -v` — Run with verbose output

### 0.8.2 Explicitly Out of Scope

**Source code modifications:**

- `app.py` — Must NOT be modified; tests verify existing behavior as-is
- `requirements.txt` — Must NOT be modified for production dependencies; testing dependencies are development-only

**Legacy/placeholder files:**

- `server.js` — Empty Node.js placeholder; no testing relevance
- `package.json` — Empty Node.js placeholder; no testing relevance
- `package-lock.json` — Empty Node.js placeholder; no testing relevance

**Documentation changes:**

- `README.md` — No modification required; minimal test-running instructions may be added only if explicitly requested
- `blitzy/documentation/**` — Internal governance artifacts; not part of testing scope

**Infrastructure and CI/CD:**

- GitHub Actions or any CI/CD workflow creation/modification — Explicitly excluded per user rule ("Do not make any updates or changes in GitHub App to create or update a workflow")
- Docker, containerization, or deployment configuration — Not in scope
- Production WSGI server replacement — Not in scope

**Test categories excluded:**

- Browser/UI tests — No frontend exists
- Database tests — No persistence layer exists
- External service integration tests — No outbound connections exist
- Load/performance/stress tests — No SLAs defined
- Security/penetration tests — No security mechanisms to test
- End-to-end tests requiring a real running server — Flask test client provides equivalent coverage

**Out-of-scope enhancements:**

- Refactoring `app.py` architecture (e.g., splitting into multiple modules)
- Adding new HTTP endpoints or modifying response behavior
- Introducing environment variable configuration
- Adding logging, monitoring, or observability features
- Any functional code changes beyond test file creation

## 0.9 Execution Parameters

### 0.9.1 Testing-Specific Instructions

**Test execution command:**

```bash
pytest
```

**Coverage measurement command:**

```bash
pytest --cov=app --cov-report=term-missing
```

**Verbose execution (for debugging):**

```bash
pytest -v
```

**Single test execution pattern:**

```bash
pytest tests/test_http_contract.py::test_get_health_returns_json_ok
```

**Run only HTTP contract tests:**

```bash
pytest tests/test_http_contract.py
```

**Run only lifecycle tests:**

```bash
pytest tests/test_lifecycle.py
```

**Specific test patterns to follow in the repository:**

- pytest function-based tests (no class hierarchy required given the project's minimal scope)
- `conftest.py` for shared fixtures following pytest's automatic fixture discovery
- Parametrization via `@pytest.mark.parametrize` where it reduces duplication for multi-method and multi-path scenarios
- Standard `assert` statements with pytest's built-in assertion introspection for clear failure messages

**Excluded test categories per user instruction:**

- No browser tests
- No database tests
- No external service tests
- No load tests
- No deployment/infrastructure tests

**Environment setup requirements for tests:**

- Python 3.13+ virtual environment with `Flask==3.1.3`, `pytest`, and `pytest-cov` installed
- Tests run from the repository root directory where `app.py` resides
- No environment variables, secrets, or external services required
- No database or file system state to initialize

## 0.10 Special Instructions for Testing

### 0.10.1 Testing-Specific Requirements

The following directives are explicitly emphasized by the user and must govern all implementation decisions:

- **Minimal change principle:** ONLY modify test files and test-related configurations. Do NOT modify `app.py`, `requirements.txt`, or any existing production file.
- **Do NOT modify source code:** The application code in `app.py` must remain completely unchanged. Tests must verify existing behavior without requiring any refactoring, dependency injection adjustments, or visibility changes in the source.
- **Follow real behavior over mocks:** Use the actual Flask `test_client()` for HTTP contract tests. Do not mock Flask routing or response generation — this would weaken contract confidence. Mocking is permitted only for isolating `app.run()` in the `__main__` startup path.
- **Ensure tests run independently:** Each test function must be self-contained and produce the same result regardless of execution order. No shared mutable state between tests.
- **Match existing code style and naming conventions:** Test files should follow Python/pytest conventions with descriptive function names (e.g., `test_get_health_returns_json_status_ok`), clear docstrings where helpful, and PEP 8 compliant formatting.
- **Keep test infrastructure minimal:** The project is a 93-line single-file application. Test infrastructure (fixtures, helpers, configuration) should be proportionally minimal — no overengineered abstraction layers.
- **Do NOT create or modify CI/CD workflows:** Per the user-specified implementation rule, no GitHub Actions workflow files or CI/CD pipeline definitions should be created, modified, or updated.
- **Maintain backward compatibility:** The test suite must not alter any existing interface, API contract, or file. Running `pytest` should produce clean results without side effects on the application.
- **Deterministic and fast:** All tests should be synchronous, deterministic, and complete in under 2 seconds total. No timing-dependent assertions, no real network calls, no flaky test patterns.

### 0.10.2 Validation Process

Testing implementation is considered complete and correct when all of the following criteria are satisfied:

- All documented HTTP behaviors from the 7-test curl verification suite are covered by automated tests
- Route precedence around `/health` is explicitly tested (GET → health handler; non-GET → catch-all)
- Representative supported HTTP methods (`GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `HEAD`, `OPTIONS`) are tested against the catch-all
- Import safety (`import app` does not start server) and startup behavior (`__main__` guard) are covered
- All tests pass cleanly with `pytest` (exit code 0)
- Coverage output from `pytest --cov=app --cov-report=term-missing` meets the 90%+ target
- No production behavior has changed — `app.py` is byte-identical before and after test implementation
- The test suite reproduces the existing manual curl validation logic in automated form
- Intentionally changing a response body or route behavior in `app.py` causes at least one test to fail, confirming meaningful assertions

