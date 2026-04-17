# Technical Specification

# 0. Agent Action Plan

## 0.1 Intent Clarification


### 0.1.1 Core Testing Objective

Based on the provided requirements, the Blitzy platform understands that the testing objective is to **introduce the first-ever automated test suite** for the `hao-backprop-test` project — a minimal Python 3 / Flask HTTP server (`app.py`, 64 lines) that currently has zero automated tests. The codebase relies solely on manual and runtime validation (10/10 curl-based tests passing) and has no `tests/` directory, no test configuration, and no test dependencies declared.

**Request Category:** Add new tests (greenfield test suite creation)

The testing requirements, restated with enhanced clarity:

- **HTTP Contract Verification** — Every HTTP request to any path, using any method, must return `200 OK` with `Content-Type: text/plain; charset=utf-8` and the exact body `Hello, World!\n` (14 bytes). This universal behavior is implemented via the `@app.before_request` hook in `app.py` (lines 34–53), which short-circuits all Flask routing and method validation.
- **HEAD Request Semantics** — HEAD requests must return `200 OK` with `Content-Length: 14` and an empty body, preserving standard HTTP semantics as enforced by Werkzeug's response handling.
- **Structural Impossibility Guarantees** — No request path produces `404 Not Found` and no method produces `405 Method Not Allowed`, because the `before_request` hook intercepts before Flask's URL dispatcher and method validator can execute.
- **Import Safety** — Importing `app.py` as a module (e.g., `from app import app`) must not auto-start the HTTP server, thanks to the `if __name__ == '__main__':` guard at line 59.
- **Startup Behavior** — When executed directly (`python app.py`), the module must print exactly `Server running at http://127.0.0.1:3000/` to stdout before binding to `127.0.0.1:3000`.
- **Startup Configuration** — The `app.run()` call must use `host='127.0.0.1'` and `port=3000`, matching the original Node.js server's binding configuration.

**Implicit Testing Needs Surfaced:**

- Edge case coverage for query strings, trailing slashes, and deeply nested paths — all must produce the same invariant response
- Verification that sequential/repeated requests produce identical results (statelessness confirmation)
- Content-Length header accuracy (exactly `14`) for standard body-bearing responses
- Response body byte-level accuracy (14 bytes: `48 65 6c 6c 6f 2c 20 57 6f 72 6c 64 21 0a`)

### 0.1.2 Special Instructions and Constraints

**Minimal Change Clause (User-Specified, Critical):**
- ONLY add test files and minimal test infrastructure; do NOT modify existing production code (`app.py`) unless absolutely required for testability
- Do not refactor production code, expand the application architecture, or introduce new runtime features
- Preserve the flat single-file app structure exactly as-is

**Testing Discipline Guidelines (User-Specified):**
- Use Flask's built-in `test_client()` for real in-process behavior — prefer little to no mocking
- Mock only where strictly necessary: capturing startup `print()` output, preventing actual server startup during `__main__` path tests, and isolating `app.run()` invocation
- Do not mock Flask routing/request behavior in ways that weaken confidence in the universal interceptor contract
- Keep naming explicit and lightweight
- No browser tests, database tests, external API tests, or deployment/infrastructure tests
- Tests must be synchronous and deterministic — no timing-based assertions or real network binding
- Tests should run cleanly with standard `pytest` commands, CI-friendly but without creating CI/CD pipelines

**Implementation Rule (User-Specified):**
- User Example: "Do not make any updates or changes in GitHub App to create or update a workflow." — This explicitly prohibits creating or modifying any GitHub Actions workflow files (`.github/workflows/`)

**Existing Pattern Adherence:**
- No existing test patterns to follow (greenfield); establish clean, minimal conventions
- Use `tests/` directory with explicit file names per user specification
- Use `conftest.py` only if shared fixtures are genuinely helpful

### 0.1.3 Technical Interpretation

These testing requirements translate to the following technical test implementation strategy:

- To **verify the HTTP contract**, we will **create** `tests/test_http_contract.py` using Flask's `app.test_client()` to simulate HTTP requests across all standard methods (GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD) and multiple path patterns (root, arbitrary, nested, query-string-bearing), asserting status code `200`, content type `text/plain; charset=utf-8`, and body `Hello, World!\n` for each
- To **verify HEAD request semantics**, we will **add test cases** within `tests/test_http_contract.py` that assert HEAD returns `200` with `Content-Length: 14` and an empty body (`b''`)
- To **verify structural impossibilities** (no 404, no 405), we will **add negative test cases** within `tests/test_http_contract.py` that explicitly assert unknown paths and uncommon methods do not produce error status codes
- To **verify import safety**, we will **create** `tests/test_startup.py` with a test that imports `app.py` as a module and confirms no server binding occurs
- To **verify startup behavior**, we will **add test cases** within `tests/test_startup.py` that use `unittest.mock.patch` to capture `print()` output and intercept `app.run()` invocation, verifying the exact startup message string and host/port configuration
- To **provide shared fixtures**, we will **create** `tests/conftest.py` with a reusable `client` fixture that provides the Flask test client and optionally a response-assertion helper

### 0.1.4 Coverage Requirements Interpretation

**Explicit User Targets:**
- **90%+ line/function coverage** of `app.py`
- **100% coverage** of all externally visible HTTP behavior (universal response contract)
- **100% coverage** of startup message behavior (`print()` call at line 62)

**Implicit Coverage Expectations:**
- Based on Python/pytest industry standards for minimal applications, 90%+ coverage is highly achievable since `app.py` has only ~10 executable lines outside the `__main__` guard
- The `__main__` guard block (lines 59–64) should be tested via mock-based startup path verification, which will cover `print()` and `app.run()` calls and bring total coverage above 90%
- Existing repository coverage: **0%** (no automated tests exist)
- The tech spec (Section 6.6.5.1) identifies 100% line coverage (excluding `__main__`) and 100% branch/function/path coverage as achievable targets

To achieve comprehensive testing, coverage should include:
- All lines within the `hello_world()` before_request handler (line 53)
- The Flask app instantiation (line 18)
- Module-level imports (line 11)
- The `__main__` guard branch including `print()` and `app.run()` (lines 59–64) via mock-isolated execution
- Full enumeration of HTTP methods and URL path patterns through the test client


## 0.2 Test Discovery and Analysis


### 0.2.1 Existing Test Infrastructure Assessment

A comprehensive repository search was conducted to assess the current testing state. The repository at `/tmp/blitzy/Existing-product/exit-code-137-test-9_76c7d6` was examined for any test-related files, configuration, or infrastructure.

**Search Results:**

All files in the repository (excluding `.git/` and `__pycache__/`):

| File Path | Purpose | Test-Related |
|-----------|---------|-------------|
| `app.py` | Flask application source (64 lines) | Target of tests, not a test file |
| `requirements.txt` | Dependency manifest (`Flask==3.1.3`) | No test dependencies declared |
| `README.md` | Project documentation | No testing instructions |
| `blitzy/documentation/Project Guide.md` | Migration status report | Documents 10/10 manual runtime tests |
| `blitzy/documentation/Technical Specifications.md` | Migration contract | Explicitly excludes test suite creation from scope |

**Test Infrastructure Findings:**

- **Test files found:** None — no files matching `*test*`, `*spec*`, `test_*`, `*_test.*`, `*_spec.*` patterns exist anywhere in the repository
- **Test directories found:** None — no `tests/`, `test/`, `spec/`, or `__tests__/` directories exist
- **Testing framework in dependencies:** None — `requirements.txt` contains only `Flask==3.1.3` with no pytest, unittest, or any test-related package
- **Test configuration files found:** None — no `pytest.ini`, `pyproject.toml` (with pytest config), `setup.cfg`, `tox.ini`, `conftest.py`, or `.coveragerc` files exist
- **Coverage tools in use:** None
- **Mock/stub libraries detected:** None
- **Test data fixtures or factories present:** None
- **CI/CD configuration:** None — no `.github/workflows/`, `Jenkinsfile`, `.circleci/`, or similar files exist

**Existing Validation (Non-Automated):**

Repository analysis reveals **zero automated test infrastructure** with validation performed exclusively through runtime/manual testing. The tech spec (Section 6.6.2.1) documents 10/10 HTTP validation tests passing using `curl` and the Blitzy Validator, covering:

| # | Validation | Method | Result |
|---|------------|--------|--------|
| 1 | Root path GET | `GET /` | 200 ✅ |
| 2 | Random path GET | `GET /random-path` | 200 ✅ |
| 3 | POST request | `POST /test` | 200 ✅ |
| 4 | PUT request | `PUT /data` | 200 ✅ |
| 5 | DELETE request | `DELETE /resource` | 200 ✅ |
| 6 | PATCH request | `PATCH /item` | 200 ✅ |
| 7 | OPTIONS request | `OPTIONS /` | 200 ✅ |
| 8 | HEAD request | `HEAD /` | 200, Content-Length: 14 ✅ |
| 9 | TRACE request | `TRACE /` | 200 ✅ |
| 10 | Deep nested path | `GET /a/b/c/d/e` | 200 ✅ |

Risk R-002 in the tech spec (Section 2.7) identifies "No automated test suite" as a **Low severity** open risk, with an estimated 0.5-hour implementation effort for the recommended pytest suite.

### 0.2.2 Web Search Research Conducted

The following research was conducted to validate testing tool compatibility and best practices:

- **pytest version compatibility with Python 3.9:** Research confirmed that pytest 9.0.0 (released November 2025) dropped Python 3.9 support. The latest Python 3.9-compatible version is **pytest 8.4.2** (released September 2025), which was installed and verified working in the test environment.
- **pytest-cov compatibility:** pytest-cov 7.1.0 (using coverage 7.10.7 under the hood) was verified as compatible with Python 3.9 and pytest 8.4.2 through successful installation and import in the virtual environment.
- **Flask test client best practices:** Flask's built-in `app.test_client()` is the standard approach for testing Flask applications without starting the Werkzeug server, as documented in Flask's official testing documentation. It provides in-process WSGI dispatch, making tests fast and deterministic.
- **before_request hook testing patterns:** The `before_request` hook behaves identically through the test client as in production — it intercepts all requests before routing, making the test client a high-fidelity simulation environment with no special configuration needed.
- **Python 3.9 end-of-life:** Python 3.9 reached end-of-life in October 2025, but remains the highest explicitly documented supported version per the project's `README.md` (`Python 3.9 or newer`). The test suite is designed to work on Python 3.9+ without version-specific workarounds.


## 0.3 Testing Scope Analysis


### 0.3.1 Test Target Identification

**Primary Code to Be Tested:**

The sole test target is `app.py` (64 lines), which contains all application logic in a single module. The testable components map directly to functional requirements from the tech spec (Section 2.2):

- **Module:** `app.py` at project root — requires unit tests and integration-style HTTP contract tests
  - **`Flask(__name__)` instantiation** (line 18) — verify app object creation at module scope
  - **`@app.before_request` handler `hello_world()`** (lines 34–53) — verify universal request interception and static response construction
  - **`Response('Hello, World!\n', status=200, mimetype='text/plain')`** (line 53) — verify exact response attributes
  - **`if __name__ == '__main__':` block** (lines 59–64) — verify startup print and server binding configuration
  - **`print('Server running at http://127.0.0.1:3000/')`** (line 62) — verify exact startup message string
  - **`app.run(host='127.0.0.1', port=3000)`** (line 64) — verify binding parameters without actual socket binding

**Existing Test File Mapping:**

| Source File | Existing Test File | Test Categories Present |
|-------------|-------------------|------------------------|
| `app.py` | None — no test file exists | None — zero automated test coverage |

**Dependencies Requiring Mocking:**

The application has zero external runtime dependencies beyond Flask itself. Mocking is required only for startup behavior testing:

- **`builtins.print`** — mock to capture stdout output during `__main__` path execution without displaying to console
- **`app.app.run`** — mock to prevent actual TCP socket binding and Werkzeug server startup during `__main__` path tests
- **`__name__` attribute** — use `runpy.run_module()` or `subprocess` to simulate direct module execution where the `__main__` guard evaluates to `True`

No external services, databases, file system operations, or network calls need to be mocked or stubbed.

### 0.3.2 Version Compatibility Research

Based on the project's Python 3.9+ requirement (`README.md`) and Flask 3.1.3 pinned dependency (`requirements.txt`), the verified compatible testing stack is:

| Tool | Version | Python 3.9 Compatible | Rationale |
|------|---------|----------------------|-----------|
| pytest | 8.4.2 | Yes | Latest version before 9.0.0 which dropped Python 3.9 support |
| pytest-cov | 7.1.0 | Yes | Coverage reporting plugin; installed and verified in Python 3.9 venv |
| coverage | 7.10.7 | Yes | Underlying coverage engine used by pytest-cov |
| Flask (test client) | 3.1.3 | Yes | Built-in `app.test_client()` — no additional package needed |
| Python `unittest.mock` | stdlib | Yes | Standard library; no version dependency |
| Python `subprocess` | stdlib | Yes | Standard library; for optional startup execution tests |

**Version Conflicts Identified:** None. All packages install cleanly in a Python 3.9.25 virtual environment with Flask 3.1.3. The full dependency tree verified via `pip freeze`:

- Flask 3.1.3 → Werkzeug 3.1.7, Jinja2 3.1.6, MarkupSafe 3.0.3, ItsDangerous 2.2.0, Click 8.1.8, Blinker 1.9.0
- pytest 8.4.2 → pluggy 1.6.0, iniconfig 2.1.0, packaging 26.0, exceptiongroup 1.3.1, tomli 2.4.1
- pytest-cov 7.1.0 → coverage 7.10.7
- Additional backports for Python 3.9: importlib-metadata 8.7.1, typing-extensions 4.15.0, zipp 3.23.0

No version conflicts, no dependency resolution failures, and no deprecated API warnings during testing tool usage were observed.


## 0.4 Test Implementation Design


### 0.4.1 Test Strategy Selection

**Test types to implement:**

- **Integration-style HTTP contract tests** — Focus on the observable HTTP interface using Flask's test client. These exercise the full `before_request` → `Response` pipeline in-process, verifying status code, headers, and body for every combination of HTTP method and URL path pattern. This is the primary test category per user specification.
- **Unit-style import/startup tests** — Focus on module-level behavior: import safety (no auto-start), startup message exactness, and `app.run()` parameter verification. These use `unittest.mock.patch` to isolate side effects without starting a real server.
- **Edge case tests** — Address boundary conditions: query strings, trailing slashes, deeply nested paths, empty paths, and uncommon HTTP methods. Verify the invariant response contract holds under all conditions.
- **Negative/structural impossibility tests** — Confirm that no request produces `404`, `405`, or any non-200 status code, validating the `before_request` hook's architectural guarantee.

**Test types explicitly excluded per user instruction:**

- No browser/UI tests (no UI exists)
- No database tests (no database exists)
- No external API tests (no external integrations)
- No deployment/infrastructure tests
- No load/performance tests
- No end-to-end tests beyond the in-process test client

### 0.4.2 Test Case Blueprint

**Component: Universal Request Handler (`hello_world` via `@app.before_request`)**

```
Component: hello_world (app.py lines 34-53)
Test Categories:
- Happy path: GET/POST/PUT/DELETE/PATCH/OPTIONS to / return 200 with correct body and headers
- Edge cases: Nested paths, query strings, trailing slashes, empty segments
- Error cases: No 404 on unknown paths, no 405 on any method
- HEAD semantics: Empty body with correct Content-Length
```

**Component: Module Import Behavior**

```
Component: app.py module-level code (lines 1-18)
Test Categories:
- Happy path: Import creates Flask app instance without starting server
- Edge cases: Repeated imports remain safe
- Error cases: N/A (no error states possible at import)
```

**Component: Server Entry Point (`__main__` guard)**

```
Component: __main__ block (app.py lines 59-64)
Test Categories:
- Happy path: Prints exact startup message, calls app.run with correct host/port
- Edge cases: Startup message string exact match including trailing slash
- Error cases: N/A (startup errors are infrastructure-level, not testable in unit scope)
```

### 0.4.3 Existing Test Extension Strategy

There are no existing test files to extend, refactor, or fix. This is a **greenfield test suite creation** from scratch. The strategy is:

- **Create** `tests/conftest.py` — shared fixtures for test client and app import
- **Create** `tests/test_http_contract.py` — all HTTP behavior verification tests
- **Create** `tests/test_startup.py` — module import and `__main__` startup behavior tests
- **Create** `pytest.ini` — minimal pytest configuration for test discovery and coverage defaults

No existing test files need modification, update, or deletion.

### 0.4.4 Test Data and Fixtures Design

**Required Test Data Structures:**

No complex test data is needed. The application is fully deterministic and stateless — every request produces the identical response regardless of input. Test data consists only of:

- HTTP method names (strings): `'GET'`, `'POST'`, `'PUT'`, `'DELETE'`, `'PATCH'`, `'OPTIONS'`, `'HEAD'`
- URL path strings: `'/'`, `'/random-path'`, `'/a/b/c/d/e'`, `'/?key=value'`, `'/trailing/'`
- Expected response constants: status `200`, content type `'text/plain; charset=utf-8'`, body `'Hello, World!\n'`, content length `14`

**Fixture Organization Strategy:**

- `tests/conftest.py` — single shared fixture file containing:
  - `client` fixture (session-scoped): provides `app.test_client()` for HTTP tests
  - `app_instance` fixture (session-scoped): provides the imported `app` object for direct inspection

**Mock Object Specifications:**

- `unittest.mock.patch('builtins.print')` — captures stdout during `__main__` execution path
- `unittest.mock.patch('app.app.run')` — prevents actual server startup during `__main__` tests

**Test Database/State Management:**

Not applicable. The application is completely stateless (no database, no sessions, no cache, no file I/O). Each test case is fully independent and produces identical results regardless of execution order. No setup, teardown, or cleanup is required.


## 0.5 Test File Transformation Mapping


### 0.5.1 File-by-File Test Plan

Every test file to be created, updated, or referenced is mapped below with the target file listed first. Since this is a greenfield test suite, all test files use the **CREATE** transformation mode.

| Target Test File | Transformation | Source File/Reference | Purpose/Changes |
|-----------------|----------------|----------------------|-----------------|
| `tests/test_http_contract.py` | CREATE | `app.py` (lines 34–53) | Comprehensive HTTP contract tests: all methods return 200, all paths return same response, correct Content-Type, correct body, HEAD semantics, no 404/405, query string invariance, statelessness |
| `tests/test_startup.py` | CREATE | `app.py` (lines 59–64) | Startup behavior tests: import safety verification, exact startup message string, app.run() host/port parameters, __main__ guard isolation |
| `tests/conftest.py` | CREATE | `app.py` (line 18) | Shared pytest fixtures: Flask test client fixture, app instance fixture for reuse across test modules |
| `pytest.ini` | CREATE | N/A | Minimal pytest configuration: test paths, coverage defaults, output formatting |
| `requirements-test.txt` | CREATE | `requirements.txt` | Test-only dependency manifest: pytest and pytest-cov pinned versions, isolated from production dependencies |

### 0.5.2 New Test Files Detail

**`tests/test_http_contract.py`** — HTTP contract verification (primary test module)
- **Test categories:** Happy path (all standard HTTP methods), edge cases (paths, query strings), HEAD semantics, negative tests (no 404/405), statelessness
- **Mock dependencies:** None — uses Flask test client exclusively for real in-process behavior
- **Assertions focus:**
  - `response.status_code == 200` for every request
  - `response.content_type == 'text/plain; charset=utf-8'` for every request
  - `response.data == b'Hello, World!\n'` for body-bearing responses
  - `response.content_length == 14` for Content-Length header
  - `len(response.data) == 0` for HEAD requests (empty body)
  - `response.status_code != 404` and `response.status_code != 405` for structural impossibility checks
- **Estimated test count:** ~20 test functions covering all methods, path patterns, edge cases, and negative scenarios

**`tests/test_startup.py`** — Module import and startup behavior
- **Test categories:** Import safety, startup message, server binding configuration
- **Mock dependencies:** `unittest.mock.patch` for `builtins.print` and `app.app.run`
- **Assertions focus:**
  - Importing `app` module does not call `app.run()`
  - `__main__` execution path prints exactly `'Server running at http://127.0.0.1:3000/'`
  - `app.run()` is called with `host='127.0.0.1'` and `port=3000`
- **Estimated test count:** 3–5 test functions

**`tests/conftest.py`** — Shared pytest fixtures
- **Fixture types:**
  - `client` — session-scoped fixture returning `app.test_client()` for efficient test client reuse
  - `app_instance` — session-scoped fixture returning the Flask `app` object for direct attribute inspection

### 0.5.3 Test Files to Modify Detail

No existing test files require modification. This is a greenfield implementation — all test infrastructure is being created from scratch.

### 0.5.4 Test Configuration Updates

**`pytest.ini`** — New pytest configuration file at project root
- Set `testpaths = tests` to limit test discovery to the `tests/` directory
- Set `python_files = test_*.py` for explicit test file naming convention
- Set `python_functions = test_*` for explicit test function naming convention
- Add `addopts = -v` for verbose output by default

**`requirements-test.txt`** — New test-only dependency manifest at project root
- `pytest==8.4.2` — test runner framework (latest Python 3.9-compatible version)
- `pytest-cov==7.1.0` — coverage reporting plugin
- Isolated from `requirements.txt` to avoid polluting production dependencies

**Coverage configuration** — Managed via command-line flags rather than a separate `.coveragerc` file to maintain minimal configuration footprint:
- `pytest --cov=app --cov-report=term-missing` for coverage with line-level detail

### 0.5.5 Cross-File Test Dependencies

**Shared Fixtures:**
- Location: `tests/conftest.py`
- Usage: Both `tests/test_http_contract.py` and `tests/test_startup.py` consume the `client` fixture; `test_startup.py` additionally uses `app_instance` for import-safety verification
- pytest auto-discovers `conftest.py` — no explicit imports needed in test files

**Mock Objects:**
- Location: Inline within `tests/test_startup.py` using `unittest.mock.patch` decorators/context managers
- Purpose: Isolate `print()` and `app.run()` during `__main__` path testing
- No shared mock utilities file needed — mocking scope is limited to a single test file

**Test Utilities:**
- No dedicated `tests/helpers/` or `tests/utils/` directory is needed
- If assertion duplication arises in `test_http_contract.py`, a small local helper function (e.g., `assert_hello_response(response)`) can be defined within the test file itself to validate the standard response contract (status 200, content type, body)

**Import Dependencies Across Test Files:**

```
tests/conftest.py    →  imports from app (app.py line 18: Flask app instance)
tests/test_http_contract.py  →  uses client fixture from conftest.py (auto-discovered)
tests/test_startup.py        →  uses app_instance fixture from conftest.py + unittest.mock from stdlib
```


## 0.6 Dependency Inventory


### 0.6.1 Testing Dependencies

All testing packages required for this implementation, verified as compatible with Python 3.9.25 and Flask 3.1.3:

| Registry | Package Name | Version | Purpose |
|----------|-------------|---------|---------|
| pip (PyPI) | pytest | 8.4.2 | Test runner and framework — discovers, collects, and executes test functions |
| pip (PyPI) | pytest-cov | 7.1.0 | Coverage reporting plugin — integrates coverage measurement into pytest execution |
| pip (PyPI) | coverage | 7.10.7 | Underlying coverage measurement engine (installed automatically as pytest-cov dependency) |
| stdlib | unittest.mock | N/A (Python 3.9 stdlib) | Mock/patch utilities for isolating print() and app.run() in startup tests |
| stdlib | subprocess | N/A (Python 3.9 stdlib) | Optional: process-level execution for __main__ behavior tests if needed |

**Transitive test dependencies (auto-installed with pytest 8.4.2):**

| Registry | Package Name | Version | Required By |
|----------|-------------|---------|-------------|
| pip (PyPI) | pluggy | 1.6.0 | pytest (plugin system) |
| pip (PyPI) | iniconfig | 2.1.0 | pytest (configuration parsing) |
| pip (PyPI) | packaging | 26.0 | pytest (version handling) |
| pip (PyPI) | exceptiongroup | 1.3.1 | pytest (Python 3.9 backport for ExceptionGroup) |
| pip (PyPI) | tomli | 2.4.1 | pytest (TOML parsing for Python < 3.11) |
| pip (PyPI) | typing-extensions | 4.15.0 | pytest (typing backports for Python 3.9) |
| pip (PyPI) | pygments | 2.19.2 | pytest (syntax highlighting in output) |
| pip (PyPI) | importlib-metadata | 8.7.1 | Flask/pytest (metadata backport for Python 3.9) |
| pip (PyPI) | zipp | 3.23.0 | importlib-metadata dependency |

**Packages explicitly NOT needed (per user instruction and system simplicity):**

| Package Category | Example | Reason Not Needed |
|-----------------|---------|-------------------|
| Mocking libraries | pytest-mock, responses | No external services to mock; stdlib unittest.mock suffices |
| Browser automation | selenium, playwright | No UI exists |
| HTTP mocking | requests-mock, httpretty | Flask test client provides real in-process behavior |
| Database fixtures | factory-boy, faker | No database or data layer exists |
| Async testing | pytest-asyncio | No async code exists |
| Load testing | locust, pytest-benchmark | Out of scope per user instruction |

### 0.6.2 Import Updates

Since this is a greenfield test suite with no existing test files, there are no import transformations needed. The new test files will establish fresh import patterns:

**New import patterns to be established:**

- `tests/conftest.py`:
  - `from app import app` — imports the Flask application instance for test client creation

- `tests/test_http_contract.py`:
  - No direct imports from `app.py` needed — uses the `client` fixture from `conftest.py` (auto-discovered by pytest)

- `tests/test_startup.py`:
  - `from unittest.mock import patch` — for mocking print() and app.run()
  - `import importlib` or `import runpy` — for controlled re-execution of the module's `__main__` path
  - `from app import app` — for verifying the app object exists after import without server startup


## 0.7 Coverage and Quality Targets


### 0.7.1 Coverage Metrics

**Current Coverage:** 0% — no automated tests exist in the repository. All prior validation was manual (10/10 curl-based runtime tests per tech spec Section 6.6.2.1).

**Target Coverage:** 90%+ line/function coverage of `app.py`, with 100% coverage of all externally visible HTTP behavior and startup message behavior, as specified by the user.

**Coverage Gaps to Address:**

| Component | Current Coverage | Target Coverage | Strategy |
|-----------|-----------------|-----------------|----------|
| Module imports (line 11) | 0% | 100% | Covered automatically when test imports `app` module |
| Flask app instantiation (line 18) | 0% | 100% | Covered automatically when test imports `app` module |
| `@app.before_request` decorator registration (line 34) | 0% | 100% | Covered automatically when test imports `app` module |
| `hello_world()` handler body (line 53) | 0% | 100% | Covered by every HTTP test client request |
| `__main__` guard condition (line 59) | 0% | 90%+ | Covered via mock-isolated `runpy.run_module()` or subprocess |
| `print()` startup message (line 62) | 0% | 100% | Covered via patched `__main__` path execution |
| `app.run()` call (line 64) | 0% | 100% | Covered via patched `__main__` path execution |

**Focus Areas:**
- **Critical paths:** The `before_request` handler (line 53) is the most important single line — every HTTP contract test exercises it
- **Error handlers:** None exist in the application; structural impossibility tests confirm no error codes are generated
- **Edge cases:** Query strings, nested paths, trailing slashes, uncommon HTTP methods — all must produce the invariant 200 response

**Per-File Coverage Targets:**

| File | Line Coverage Target | Branch Coverage Target | Notes |
|------|---------------------|----------------------|-------|
| `app.py` | 90%+ overall, 100% excluding `__main__` | 100% (single branch: `__main__` guard) | The `__main__` branch tested via mock-isolated execution |

### 0.7.2 Test Quality Criteria

**Assertion Density:**
- Each test function should contain at least 1–3 meaningful assertions
- HTTP contract tests assert status code, content type, and body together per request
- No assertions on Flask internals — only on observable external behavior

**Test Isolation:**
- Each test function is fully independent and stateless
- Tests can run in any order and produce identical results
- Session-scoped fixtures for the test client are safe because the application is stateless
- No shared mutable state between tests

**Performance Constraints:**
- Full test suite must complete in under 5 seconds (tech spec Section 6.6.5.2)
- All tests use Flask's in-memory test client — zero network I/O
- Subprocess-based startup tests (if used) should be limited to 1–2 cases to minimize overhead
- No real socket binding in any test

**Maintainability Standards:**
- Test naming follows `test_<behavior>_<condition>` pattern for clear intent
- Each test file has a focused responsibility (HTTP contract vs. startup behavior)
- Minimal mocking — only where structurally necessary for `__main__` path isolation
- No custom test framework or abstraction layer — direct pytest idioms only
- Comments and docstrings only where behavior is non-obvious

**Repository Test Pattern Adherence:**
- No pre-existing test patterns to follow — this suite establishes the repository's testing conventions
- Conventions align with the tech spec's recommendations (Section 6.6.3): pytest + Flask test client, `test_<behavior>` naming, single assertion focus per test where practical
- Test file organization matches user specification: `tests/test_http_contract.py` and `tests/test_startup.py`


## 0.8 Scope Boundaries


### 0.8.1 Exhaustively In Scope

**New Test Files:**
- `tests/test_http_contract.py` — all HTTP request/response behavior tests
- `tests/test_startup.py` — module import safety and `__main__` startup behavior tests
- `tests/conftest.py` — shared pytest fixtures (Flask test client, app instance)

**Test Configuration:**
- `pytest.ini` — pytest runner configuration (test paths, naming conventions, verbosity)
- `requirements-test.txt` — test-only dependency manifest (pytest==8.4.2, pytest-cov==7.1.0)

**Test Subject (read-only, not modified):**
- `app.py` — the sole file under test; all tests verify its behavior without modifying its source

**Documentation (minimal):**
- Brief test-running instructions if warranted by implementation complexity

### 0.8.2 Explicitly Out of Scope

**Source Code Modifications:**
- `app.py` — must NOT be modified; tests verify existing behavior as-is
- No production code refactoring, no dependency injection additions, no testability-driven restructuring

**Legacy/Placeholder Files (excluded from testing per user instruction):**
- `server.js` — empty Node.js placeholder, not part of active runtime
- `package.json` — empty Node.js manifest, not part of active runtime
- `package-lock.json` — empty Node.js lockfile, not part of active runtime

**Documentation Artifacts (excluded from testing per user instruction):**
- `README.md` — documentation verification is not in scope
- `blitzy/documentation/Project Guide.md` — Blitzy documentation artifact
- `blitzy/documentation/Technical Specifications.md` — Blitzy documentation artifact

**CI/CD and Deployment:**
- No GitHub Actions workflows (`.github/workflows/`) — explicitly prohibited by user rule: "Do not make any updates or changes in GitHub App to create or update a workflow"
- No Jenkinsfile, CircleCI, or other CI pipeline configuration
- No Docker, Procfile, or deployment artifacts

**Future Hardening Work (excluded per user instruction):**
- Gunicorn/uWSGI production server configuration
- TLS/HTTPS configuration
- Authentication/authorization
- CORS headers
- Concurrency enhancements
- Health check endpoints
- Dependency pinning (`pip freeze`) for transitive packages
- Deployment configuration

**Test Categories Excluded:**
- Browser/UI tests (no UI exists)
- Database/persistence tests (no database exists)
- External API tests (no external integrations)
- Load/performance tests (single-user test fixture)
- End-to-end tests beyond in-process test client
- Security penetration testing
- Third-party dependency internal testing

**Unrelated Test Files:**
- No tests for empty placeholder files
- No tests for documentation content or formatting
- No tests for Blitzy platform artifacts in the `blitzy/` directory


## 0.9 Execution Parameters


### 0.9.1 Testing-Specific Instructions

**Test Execution Commands:**

| Command | Purpose |
|---------|---------|
| `pytest` | Run all tests with default configuration from `pytest.ini` |
| `pytest -v` | Run all tests with verbose output (method-level detail) |
| `pytest --cov=app --cov-report=term-missing` | Run all tests with line-level coverage reporting for `app.py` |
| `pytest tests/test_http_contract.py` | Run only HTTP contract tests |
| `pytest tests/test_startup.py` | Run only startup/import behavior tests |
| `pytest tests/test_http_contract.py::test_get_root_returns_hello` | Run a single specific test function |
| `pytest -x` | Stop on first failure (useful for debugging) |
| `pytest -v --tb=short` | Verbose output with shortened tracebacks |

**Environment Setup for Tests:**

```
python3.9 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install -r requirements-test.txt
pytest
```

**Test Patterns Followed:**
- All test files placed in `tests/` directory at project root
- Test file names prefixed with `test_` for pytest auto-discovery
- Test function names prefixed with `test_` following `test_<behavior>_<condition>` convention
- Session-scoped fixtures in `tests/conftest.py` for test client reuse
- No test classes — flat function-based tests for simplicity per the app's minimal architecture

**Excluded Test Categories Per User Instruction:**
- No browser/UI tests
- No database tests
- No external API tests
- No deployment/infrastructure tests
- No load/performance tests
- No CI/CD pipeline tests or workflow files

**Test Validation Process:**
- Run `pytest` and confirm all tests pass (exit code 0)
- Run `pytest --cov=app --cov-report=term-missing` and confirm 90%+ line coverage
- Intentionally modify response body in `app.py` (e.g., change `Hello, World!\n` to `Hello!\n`) and confirm HTTP contract tests fail
- Intentionally modify startup string and confirm startup tests fail
- Revert all intentional modifications and confirm full pass
- Confirm that importing `app` in a Python REPL does not start a server


## 0.10 Special Instructions for Testing


The following testing-specific requirements are explicitly emphasized by the user and must be strictly observed throughout implementation:

**Minimal Change Principle (Critical):**
- ONLY modify test files and test-related configurations — do not modify `app.py` or any other production source file
- Do not refactor production code unless absolutely required for testability (and no such requirement exists for this application)
- Preserve the flat single-file application structure exactly as-is
- Do not expand the application architecture or introduce new runtime features

**No CI/CD Workflow Changes (Critical — User Implementation Rule):**
- "Do not make any updates or changes in GitHub App to create or update a workflow" — no `.github/workflows/` files may be created or modified
- Tests must be runnable locally via standard `pytest` commands without any CI infrastructure

**Testing Approach Discipline:**
- Use Flask's built-in `test_client()` for all HTTP behavior testing — this provides real in-process WSGI dispatch with full fidelity to the `before_request` hook architecture
- Prefer little to no mocking — mock only `print()` and `app.run()` for `__main__` path isolation
- Do NOT mock Flask routing, request handling, or the `before_request` hook — tests must exercise the real interceptor pipeline to provide genuine confidence
- Keep all tests synchronous and deterministic — no timing-based assertions, no real network binding, no async patterns
- Avoid flaky network/timing dependencies — all tests use the in-memory test client

**Test File Organization:**
- Place all tests under `tests/` directory as specified by the user
- Use explicit file names: `test_http_contract.py` for HTTP behavior, `test_startup.py` for startup/import behavior
- Create `conftest.py` only for genuinely shared fixtures (test client, app instance)
- Keep naming explicit and lightweight — no deep directory nesting

**Behavioral Preservation:**
- All existing external behavior must remain unchanged after test implementation
- Universal handling of all methods and all paths must continue to work
- Response body `Hello, World!\n`, status `200`, content type `text/plain; charset=utf-8` must be preserved
- Localhost binding on `127.0.0.1:3000` must be preserved
- Startup message `Server running at http://127.0.0.1:3000/` must be preserved
- The `before_request` hook pattern must remain the request handling mechanism

**Quality Observations (Note but Do Not Fix):**
- If any code quality issues are discovered during test implementation (e.g., missing type hints, absent docstrings in specific locations, or potential improvements), they should be documented as observations but NOT addressed unless required for test implementation
- The test suite should validate current behavior, not improve the application


