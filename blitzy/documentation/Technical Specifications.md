# Technical Specification

# 0. Agent Action Plan

## 0.1 Intent Clarification


### 0.1.1 Core Testing Objective

Based on the provided requirements, the Blitzy platform understands that the testing objective is to **close the two remaining automated coverage gaps** in a minimal, single-file Python/Flask application (`server.py`, 36 lines) while preserving the existing 24-test pytest suite, adding formal code coverage tooling, and maintaining the project's deliberate minimalism.

**Request Category:** Add new tests + Improve coverage

The specific testing requirements, restated with technical precision, are:

- **Preserve the existing 24/24 passing test suite** in `tests/test_server.py` — no regressions, no modifications to passing tests, no behavioral changes to the application under test
- **Close the F-008 coverage gap:** Add automated tests verifying that the `if __name__ == "__main__":` guard block applies Werkzeug version string suppression (`WSGIRequestHandler.version_string = lambda self: ""`) when `server.py` is executed directly
- **Close the F-009 coverage gap:** Add automated tests verifying that the startup path invokes `app.run(host="127.0.0.1", port=3000)` with the exact hardcoded host and port values
- **Achieve 100% requirements coverage** across features F-001 through F-009, elevating F-008 and F-009 from manual/runtime verification to automated test verification
- **Achieve near-complete line/function coverage** for `server.py`, targeting the three currently-missed lines (32, 34, 35) that live inside the `__main__` guard
- **Add formal coverage reporting** via `pytest-cov` to address the known gap G-004 (no coverage tool configured)
- **Maintain deterministic, fast-running tests** — no flaky tests, no real network binding during testing, no long-lived subprocess management

**Implicit testing needs surfaced:**

- The `__main__` guard block (lines 31–35 of `server.py`) requires controlled execution to avoid actually binding a socket during testing; `app.run()` must be monkeypatched or otherwise intercepted
- The Werkzeug import inside the `__main__` block (`from werkzeug.serving import WSGIRequestHandler`) must be verified as part of the startup path without relying on network side effects
- Test isolation must ensure that monkeypatching the `__main__` path does not interfere with the shared `client` fixture or existing test functions
- Coverage configuration should be lightweight and dev-only, consistent with the project's philosophy of excluding test tooling from `requirements.txt`

### 0.1.2 Special Instructions and Constraints

**User-Specified Directives (preserved exactly):**

- "Only work within the active Python/Flask app and existing pytest-based test infrastructure"
- "Focus on `server.py`, `tests/`, and minimal dev-only test configuration"
- "Do not expand scope into new features or architectural refactors"
- "Make only the changes that are absolutely necessary to implement comprehensive testing coverage"
- "Focus specifically on adding test files and minimal test infrastructure without modifying existing production code unless required for testability"
- "Do not make any updates or changes in GitHub App to create or update a workflow" (implementation rule: exit code 137 test)

**Testing Discipline Requirements:**

- Use existing mocking patterns (the project currently uses zero mocking; new tests should use minimal monkeypatching only for the `__main__` block)
- Match repository test conventions: function-level tests with `test_` prefix, inline assertions, `pytest.fixture` injection, section comment markers
- Isolate all new test code in dedicated test files under `tests/`
- Prefer the testing approach that requires the least modification to existing code
- Do not fix code quality issues discovered during testing unless required for test implementation

**User Example (preserved verbatim):**

User specified exact test execution commands:
- `pytest`
- `pytest --cov=server --cov-report=term-missing`

### 0.1.3 Technical Interpretation

These testing requirements translate to the following technical test implementation strategy:

- To **test F-008 (Werkzeug version suppression)**, we will create `tests/test_startup.py` containing tests that use `runpy.run_module("server", run_name="__main__")` with `monkeypatch` to intercept `app.run()` and then assert that `WSGIRequestHandler.version_string` has been replaced with the empty-string lambda
- To **test F-009 (localhost binding configuration)**, we will add tests in `tests/test_startup.py` that capture the arguments passed to `app.run()` via monkeypatching and assert `host="127.0.0.1"` and `port=3000`
- To **enable formal coverage reporting**, we will add `pytest-cov` as a dev-only testing dependency and verify coverage output via `pytest --cov=server --cov-report=term-missing`
- To **preserve the existing test suite**, we will not modify `tests/test_server.py` or `tests/conftest.py` — new tests go into a separate, focused file

### 0.1.4 Coverage Requirements Interpretation

**Explicit coverage targets from user:**
- 100% requirements coverage across F-001 through F-009
- Near-complete line/function coverage for `server.py`
- Maintain the existing 24/24 passing suite

**Implicit coverage expectations based on repository analysis:**
- Current measured coverage is 86% (21 statements, 3 missed: lines 32, 34, 35)
- Target coverage after closing F-008 and F-009 gaps: **100% line coverage** (21/21 statements covered)
- The project's existing convention of 100% pass rate and sub-second execution should be preserved
- Coverage tool addition should address known gap G-004 without adding unnecessary complexity

To achieve comprehensive testing, coverage should include all five endpoint contracts (already covered by 24 existing tests), all error handling behaviors (already covered), import-safety verification (already covered), and the two remaining startup-path behaviors: Werkzeug version suppression (F-008) and hardcoded localhost binding (F-009).


## 0.2 Test Discovery and Analysis


### 0.2.1 Existing Test Infrastructure Assessment

Repository analysis reveals a **pytest-based testing setup** with a mature, well-organized 24-test suite achieving 100% pass rate in 0.08 seconds of execution time and 86% line coverage of the single source file `server.py`.

**Test File Discovery Results:**

| File Path | Type | Lines | Purpose |
|-----------|------|-------|---------|
| `tests/__init__.py` | Package marker | 1 (empty) | Marks `tests/` as a Python package for pytest discovery |
| `tests/conftest.py` | Fixture module | 8 | Defines shared `client` fixture via `app.test_client()` |
| `tests/test_server.py` | Test module | 144 | Contains all 24 test functions across 4 categories |
| `pytest.ini` | Configuration | 2 | Sets `testpaths = tests` for test discovery |

**Test Framework Configuration:**

| Attribute | Value | Evidence |
|-----------|-------|----------|
| Current testing framework | pytest | `tests/test_server.py` imports, `pytest.ini` |
| Framework version | 9.0.2 | `pip show pytest` in venv |
| Test runner configuration | `pytest.ini` at project root | `testpaths = tests` |
| Coverage tools in use | None currently configured (G-004) | No `pytest-cov` in dependencies |
| Mock/stub libraries detected | None | Zero mock imports across all test files |
| Test data fixtures/factories | None — inline hardcoded assertions only | `tests/test_server.py` |
| Shared fixture | `client` fixture in `tests/conftest.py` | Returns `app.test_client()` |

**Existing Test Suite Composition (24 tests in `tests/test_server.py`):**

| Section Marker | Category | Test Count | Features Covered |
|----------------|----------|------------|------------------|
| `# --- Happy Path Tests ---` | Happy Path | 15 | F-001, F-002, F-003, F-005 |
| `# --- Edge Case Tests ---` | Edge Case | 2 | F-004 |
| `# --- Error Case Tests: 404 Not Found ---` | Error (404) | 3 | F-006 |
| `# --- Error Case Tests: 405 Method Not Allowed ---` | Error (405) | 2 | F-006 |
| `# --- Application Importability Tests ---` | Importability | 2 | F-007 |

**Coverage Gap Analysis:**

The following line-level gaps were confirmed by running `pytest --cov=server --cov-report=term-missing`:

| Source File | Statements | Missed | Coverage | Missing Lines |
|-------------|-----------|--------|----------|---------------|
| `server.py` | 21 | 3 | 86% | 32, 34, 35 |

The three missed lines correspond exactly to the `if __name__ == "__main__":` guard block:
- **Line 32:** `from werkzeug.serving import WSGIRequestHandler` — conditional import of Werkzeug's request handler class
- **Line 34:** `WSGIRequestHandler.version_string = lambda self: ""` — suppresses the server version header (F-008)
- **Line 35:** `app.run(host="127.0.0.1", port=3000)` — starts the development server on localhost:3000 (F-009)

### 0.2.2 Web Search Research Conducted

- **pytest-cov compatibility with pytest 9 and Python 3.10:** Confirmed that pytest-cov 7.1.0 is fully compatible with Python >=3.9 and pytest >=7. It requires coverage >=7.10.6 as a transitive dependency. The installed version (7.1.0) with coverage 7.13.5 is fully compatible with the project's Python 3.10 and pytest 9.0.2 stack.
- **Best practices for testing `__main__` blocks:** The recommended approach for testing guarded startup code is to use `runpy.run_module()` with `run_name="__main__"` combined with monkeypatching to intercept side-effecting calls like `app.run()`. This avoids actually starting a server while exercising the full `__main__` code path.
- **Mocking strategies for Flask `app.run()`:** Monkeypatching `app.run` via pytest's built-in `monkeypatch` fixture is the minimal, dependency-free approach. This avoids adding `pytest-mock` or `unittest.mock` imports while remaining consistent with the project's zero-mock philosophy.
- **Common pitfalls with startup-path testing:** Tests exercising `runpy.run_module` must handle module re-importation carefully to avoid polluting the module cache (`sys.modules`). Proper cleanup ensures test isolation.


## 0.3 Testing Scope Analysis


### 0.3.1 Test Target Identification

**Primary code to be tested:**

- Module: `server.py` (36 lines) at project root — requires startup-path lifecycle tests for lines 31–35
  - Function: `if __name__ == "__main__":` block — requires controlled-execution tests to cover Werkzeug version suppression and `app.run()` invocation
  - Statement: `WSGIRequestHandler.version_string = lambda self: ""` (line 34) — requires assertion that the lambda replacement is applied
  - Statement: `app.run(host="127.0.0.1", port=3000)` (line 35) — requires assertion on exact host and port arguments

**Existing test file mapping:**

| Source File | Existing Test File | Test Categories Present | Coverage Status |
|-------------|--------------------|------------------------|-----------------|
| `server.py` (lines 1–28: routes) | `tests/test_server.py` | Happy path, edge case, error case, importability | 100% of route handlers covered |
| `server.py` (lines 31–35: `__main__`) | None | None | 0% — F-008 and F-009 untested |
| `tests/conftest.py` | N/A (fixture module) | N/A | Provides shared `client` fixture |

**Dependencies requiring mocking:**

| Dependency | Mock Strategy | Reason |
|------------|---------------|--------|
| `app.run()` | Monkeypatch with a capturing callable | Prevent real socket binding during test execution; capture `host` and `port` arguments for assertion |
| `WSGIRequestHandler.version_string` | Assert post-execution state after `runpy.run_module` | Verify the lambda replacement was applied without needing a live HTTP server |
| `sys.modules["server"]` | Cleanup after `runpy.run_module` | Prevent module cache pollution between test runs |

No external services, databases, or file system operations require mocking. The project has zero external dependencies beyond Flask/Werkzeug.

### 0.3.2 Version Compatibility Research

Based on the project's Python 3.10 runtime and Flask >=3.0 dependency constraint, the recommended testing stack is:

| Tool | Name | Installed Version | Compatibility | Rationale |
|------|------|-------------------|---------------|-----------|
| Testing framework | pytest | 9.0.2 | Python 3.10+ ✅ | Already in use; latest stable release matching project's tested version |
| Coverage plugin | pytest-cov | 7.1.0 | pytest >=7, Python >=3.9 ✅ | Lightweight pytest integration for `coverage.py`; requires no configuration beyond CLI flags |
| Coverage engine | coverage | 7.13.5 | Python 3.9+ ✅ | Transitive dependency of pytest-cov; provides line/branch coverage measurement |
| Assertion library | Built-in `assert` | N/A | N/A | pytest's assertion introspection provides detailed failure diagnostics |
| Mocking | pytest `monkeypatch` fixture | Built into pytest | N/A | Zero additional dependencies; sufficient for intercepting `app.run()` |
| Startup-path execution | Python `runpy` stdlib module | Built into Python 3.10 | N/A | Enables controlled `__main__` block execution without subprocess overhead |

**Version conflict assessment:** No conflicts detected. All components are mutually compatible with the project's Python 3.10 and Flask 3.1.3 runtime.


## 0.4 Test Implementation Design


### 0.4.1 Test Strategy Selection

**Test types to implement:**

- **Integration-style tests (existing, preserved):** The 24 existing tests in `tests/test_server.py` use Flask's in-memory `test_client()` to validate the complete HTTP contract. These cover F-001 through F-007 at 100% requirements coverage and remain untouched.
- **Lifecycle/startup tests (new):** Focused tests in `tests/test_startup.py` exercise the `if __name__ == "__main__":` guard block using `runpy.run_module` with monkeypatching. These close the F-008 and F-009 coverage gaps.
- **Minimal unit-style assertions (new):** Within the startup tests, individual assertions verify exact configuration values (host string, port integer, version suppression lambda) rather than end-to-end runtime behavior.
- **Edge case tests (new):** Verify that the `__main__` block is not executed during normal import (complementing the existing `test_app_import_does_not_start_server` importability test with startup-specific assertions).

**Test types explicitly excluded per user instructions:**
- Browser tests, database tests, external API tests, production deployment tests
- Performance/load testing, security penetration testing
- CI/CD workflow creation or modification

### 0.4.2 Test Case Blueprint

```
Component: __main__ Guard Block (server.py lines 31-35)
Test Categories:
- Happy path: Direct execution triggers version suppression and app.run() with correct args
- Edge cases: Import does not trigger __main__ block side effects
- Error cases: Verify startup behavior fails meaningfully if host/port values change
- Performance boundaries: Not applicable (startup-path tests are single-execution)
```

**Detailed test scenarios for `tests/test_startup.py`:**

| Test Function Name | Category | Assertion |
|--------------------|----------|-----------|
| `test_main_calls_app_run` | Happy path | `app.run()` is called exactly once when `server.py` is executed as `__main__` |
| `test_main_binds_to_localhost` | Happy path | `app.run()` receives `host="127.0.0.1"` |
| `test_main_binds_to_port_3000` | Happy path | `app.run()` receives `port=3000` |
| `test_main_suppresses_werkzeug_version` | Happy path | `WSGIRequestHandler.version_string` returns empty string after `__main__` execution |
| `test_import_does_not_call_app_run` | Edge case | Importing `server` does not invoke `app.run()` |

### 0.4.3 Existing Test Extension Strategy

- **Tests to extend:** None — the existing `tests/test_server.py` is complete for its scope (F-001 through F-007) and requires no modifications
- **Tests to refactor:** None — existing tests follow clean patterns and use current pytest conventions
- **Tests to fix:** None — all 24 tests pass without warnings or deprecation notices

The sole extension point is the **addition of a new test file** (`tests/test_startup.py`) to cover the `__main__` guard block without altering any existing test code.

### 0.4.4 Test Data and Fixtures Design

**Required test data structures:** None — all assertions compare against hardcoded scalar values (`"127.0.0.1"`, `3000`, `""`)

**Fixture organization strategy:**

| Fixture | Location | Scope | Purpose |
|---------|----------|-------|---------|
| `client` (existing) | `tests/conftest.py` | Function | Shared Flask in-memory test client for route testing |
| `mock_app_run` (new, if useful) | `tests/test_startup.py` (inline) | Function | Monkeypatched `app.run` that captures keyword arguments without binding a socket |

New fixtures, if any, should be defined inline within `tests/test_startup.py` rather than in `conftest.py` to avoid polluting the shared fixture namespace. The startup tests are self-contained and do not share fixtures with the existing route tests.

**Mock object specifications:**

- `app.run` is replaced with a no-op callable that records `host` and `port` kwargs
- `WSGIRequestHandler.version_string` is inspected (not mocked) after `runpy` execution to verify the lambda replacement
- No mock objects, `unittest.mock.Mock` instances, or `pytest-mock` fixtures are used — only pytest's built-in `monkeypatch`

**Test database/state management:** Not applicable — the application has zero persistence, zero state, and zero database interactions.


## 0.5 Test File Transformation Mapping


### 0.5.1 File-by-File Test Plan

| Target Test File | Transformation | Source File/Test | Purpose/Changes |
|-----------------|----------------|------------------|-----------------|
| `tests/test_startup.py` | CREATE | `server.py` (lines 31–35) | New test file covering `__main__` guard block: Werkzeug version suppression (F-008) and localhost binding configuration (F-009) using `runpy.run_module` with `monkeypatch` |
| `tests/test_server.py` | REFERENCE | `tests/test_server.py` | Use as the canonical example for test naming conventions, assertion patterns, section comment markers, and inline data style — do not modify |
| `tests/conftest.py` | REFERENCE | `tests/conftest.py` | Use as the fixture pattern reference; shared `client` fixture remains unchanged — do not modify |
| `tests/__init__.py` | REFERENCE | `tests/__init__.py` | Package marker remains unchanged — do not modify |
| `pytest.ini` | UPDATE | `pytest.ini` | Optionally add minimal coverage configuration (e.g., `addopts` for default `--cov` flags) if it reduces repetitive CLI invocations; otherwise leave unchanged |

### 0.5.2 New Test Files Detail

**`tests/test_startup.py`** — Startup path lifecycle tests for `__main__` guard block

- **Test categories:**
  - Happy path: Verify `app.run()` is called with exact `host="127.0.0.1"` and `port=3000` during direct execution
  - Happy path: Verify `WSGIRequestHandler.version_string` is replaced with empty-string lambda during direct execution
  - Edge case: Verify import-path does not trigger `app.run()` invocation
- **Mock dependencies:**
  - `monkeypatch` on `app.run` to prevent real socket binding and capture call arguments
  - `sys.modules` cleanup after `runpy.run_module` to maintain test isolation
- **Assertions focus:**
  - Exact keyword argument matching for `host` and `port` on `app.run()`
  - Return value of `WSGIRequestHandler.version_string(None)` equals `""` after `__main__` execution
  - `app.run` call count (exactly once per `__main__` execution)
- **Naming conventions:** Follow existing `test_{subject}_{assertion}` pattern from `test_server.py`
- **Section markers:** Use comment-based section markers consistent with existing test organization (e.g., `# --- Startup Path Tests ---`)

### 0.5.3 Test Files to Modify Detail

**`pytest.ini`** — Minimal optional update for coverage convenience

- Potential addition: `addopts = --cov=server --cov-report=term-missing` to make coverage reporting the default behavior when running `pytest`
- This is a quality-of-life enhancement only; if the user prefers explicit CLI invocation (`pytest --cov=server --cov-report=term-missing`), the file can remain unchanged
- No structural or behavioral changes to test discovery, collection, or execution

### 0.5.4 Test Configuration Updates

| Config File | Update | Purpose |
|-------------|--------|---------|
| `pytest.ini` | Optionally add `addopts` with coverage flags | Enable default coverage reporting without explicit CLI flags |
| `.coveragerc` | Not created | The user specified minimal dev-only coverage tooling; CLI flags via `pytest --cov=server` are sufficient without a dedicated configuration file |

### 0.5.5 Cross-File Test Dependencies

**Shared fixtures:**
- `tests/conftest.py` provides the `client` fixture to `tests/test_server.py` — this relationship remains unchanged
- `tests/test_startup.py` does **not** use the `client` fixture; it operates independently via `runpy` and `monkeypatch`

**Mock objects:**
- No shared mock objects — startup tests use inline monkeypatching scoped to individual test functions

**Test utilities:**
- No shared test utility modules are needed; the project's scale (36 lines of source code) does not warrant a `tests/helpers/` directory
- A small inline helper (e.g., a `_run_server_as_main` function within `test_startup.py`) may encapsulate the `runpy.run_module` + cleanup pattern to reduce duplication across startup tests

**Import updates required:**
- `tests/test_startup.py` will import: `runpy` (stdlib), `sys` (stdlib), and selectively reference `server.app` for monkeypatching
- No import changes to existing test files
- No import changes to production code


## 0.6 Dependency Inventory


### 0.6.1 Testing Dependencies

All testing packages relevant to this exercise, with exact versions verified from the installed environment:

| Registry | Package Name | Version | Purpose |
|----------|--------------|---------|---------|
| pip (PyPI) | pytest | 9.0.2 | Testing framework — already installed, dev-only dependency |
| pip (PyPI) | pytest-cov | 7.1.0 | Coverage plugin for pytest — new dev-only addition to close gap G-004 |
| pip (PyPI) | coverage | 7.13.5 | Coverage measurement engine — transitive dependency of pytest-cov |
| stdlib | runpy | (Python 3.10 built-in) | Controlled module execution with `run_name="__main__"` for startup-path testing |
| stdlib | sys | (Python 3.10 built-in) | Module cache management (`sys.modules`) for test isolation during `runpy` usage |

**Runtime dependencies (unchanged):**

| Registry | Package Name | Version Constraint | Installed Version | Purpose |
|----------|--------------|-------------------|-------------------|---------|
| pip (PyPI) | Flask | >=3.0 | 3.1.3 | Core web framework — sole runtime dependency declared in `requirements.txt` |
| pip (PyPI) | Werkzeug | (transitive via Flask) | 3.1.7 | WSGI utilities — provides `WSGIRequestHandler` tested in F-008 |

**Dependency installation notes:**
- `pytest` and `pytest-cov` are **dev-only** dependencies, intentionally excluded from `requirements.txt` per the project's design philosophy (Feature F-010)
- `coverage` is installed automatically as a transitive dependency of `pytest-cov`
- No new runtime dependencies are added to `requirements.txt`
- No `package.json`, `package-lock.json`, or Node.js dependencies are relevant (legacy artifacts are empty)

### 0.6.2 Import Updates

**New test file imports (`tests/test_startup.py`):**

- `import runpy` — for executing `server.py` with `__name__ == "__main__"`
- `import sys` — for managing `sys.modules` cleanup between tests
- `from werkzeug.serving import WSGIRequestHandler` — for asserting version string suppression post-execution

**Existing test file imports (unchanged):**

- `tests/test_server.py` — `import server`, `from flask import Flask`, `from server import app` — no changes
- `tests/conftest.py` — `import pytest`, `from server import app` — no changes

**Import transformation rules:** Not applicable — no refactoring or import path changes are needed. All existing import paths remain stable.


## 0.7 Coverage and Quality Targets


### 0.7.1 Coverage Metrics

**Baseline coverage (measured with `pytest --cov=server --cov-report=term-missing`):**

| Metric | Value |
|--------|-------|
| Current line coverage | 86% (18/21 statements) |
| Current missed lines | 3 (lines 32, 34, 35) |
| Current test count | 24 (all passing) |
| Current execution time | 0.08 seconds |

**Target coverage after implementation:**

| Metric | Target | Rationale |
|--------|--------|-----------|
| Line coverage for `server.py` | ~100% (21/21 statements) | Close the `__main__` guard coverage gap by exercising lines 32, 34, 35 via `runpy` |
| Requirements coverage (F-001–F-009) | 100% | All nine features verified by automated tests |
| Test pass rate | 100% | All existing tests preserved; all new tests pass |
| Test execution time | < 1 second | In-memory tests with monkeypatched startup path; no network I/O |

**Coverage gaps to address:**

| Component | Current Coverage | Target Coverage | Gap Description |
|-----------|-----------------|-----------------|-----------------|
| `server.py` lines 1–28 (routes + app init) | 100% | 100% | Already fully covered by 24 existing tests |
| `server.py` line 31 (`if __name__`) | 100% (branch condition evaluated) | 100% | Guard condition is always evaluated during import |
| `server.py` line 32 (`from werkzeug...`) | 0% | 100% | Conditional import inside `__main__` block — covered by new startup tests |
| `server.py` line 34 (`version_string = ...`) | 0% | 100% | Werkzeug version suppression — covered by new F-008 test |
| `server.py` line 35 (`app.run(...)`) | 0% | 100% | Server startup call — covered by new F-009 test |

**Per-file coverage targets:**

| File | Target | Notes |
|------|--------|-------|
| `server.py` | ~100% line coverage | All 21 statements exercised |
| `tests/test_server.py` | N/A (test code) | Not a coverage target |
| `tests/test_startup.py` | N/A (test code) | Not a coverage target |
| `tests/conftest.py` | N/A (test infrastructure) | Not a coverage target |

### 0.7.2 Test Quality Criteria

| Criterion | Requirement | Implementation |
|-----------|-------------|----------------|
| **Assertion density** | Each test function contains at least one explicit `assert` statement | Follow existing pattern: one focused assertion per test function |
| **Test isolation** | Every test is independently executable and order-independent | New startup tests use `monkeypatch` fixture (auto-reverted per test); `sys.modules` cleanup ensures no state leakage |
| **Performance** | Total suite execution < 1 second | All tests use in-memory execution (Flask test client or `runpy` with monkeypatching); zero network I/O |
| **Determinism** | 100% deterministic — no flaky test risk | No timing dependencies, no random data, no external services, no real socket binding |
| **Maintainability** | Tests read as clear specifications of expected behavior | Descriptive function names encoding the subject and assertion; inline hardcoded expected values |
| **Convention compliance** | Follow repository patterns exactly | `test_` prefix naming, section comment markers, function-level scope, `pytest.fixture` injection, explicit `assert` statements |


## 0.8 Scope Boundaries


### 0.8.1 Exhaustively In Scope

**New test files:**
- `tests/test_startup.py` — focused startup-path lifecycle tests for `__main__` guard block (F-008, F-009)

**Test file references (unchanged, used as pattern guides):**
- `tests/test_server.py` — existing 24-test suite (F-001 through F-007)
- `tests/conftest.py` — shared `client` fixture definition
- `tests/__init__.py` — package marker

**Test configuration:**
- `pytest.ini` — optional minimal update for coverage convenience (e.g., `addopts`)

**Test infrastructure additions:**
- `pytest-cov` 7.1.0 — dev-only coverage plugin (not added to `requirements.txt`)
- `coverage` 7.13.5 — transitive dependency of `pytest-cov`

**Source file under test:**
- `server.py` — read-only analysis and test target; no modifications to production code

### 0.8.2 Explicitly Out of Scope

**Source code modifications:**
- No changes to `server.py` — the application code is not modified for testability or any other reason
- No changes to `requirements.txt` — test tooling remains dev-only, consistent with the project's dependency philosophy

**Legacy/irrelevant artifacts:**
- `server.js` (empty), `package.json` (empty), `package-lock.json` — legacy Node.js artifacts excluded from all testing
- `blitzy/` — documentation-only folder; not relevant to test implementation

**Feature additions and refactoring:**
- No new endpoints, routes, or application features
- No refactoring of existing route handlers or application structure
- No architectural changes to the single-file application layout

**Infrastructure and deployment:**
- No CI/CD pipeline creation or modification (explicitly per implementation rule: "Do not make any updates or changes in GitHub App to create or update a workflow")
- No GitHub Actions workflows
- No Docker, container, or production WSGI deployment configuration
- No environment variable configuration

**Testing scope exclusions per user instruction:**
- No browser tests, database tests, external API tests, or production deployment tests
- No performance/load testing or security penetration testing
- No testing of third-party dependency internals beyond verifying current integration behavior (Werkzeug `version_string` suppression)
- No tests for features that do not exist (auth, persistence, middleware, templates, frontend/UI)
- No README or documentation changes beyond minimal testing instructions if strictly needed

**Code quality observations (noted but not fixed):**
- `README.md` documents only 3 of 5 endpoints (missing `/morning`) — documentation inconsistency is out of scope per user instructions


## 0.9 Execution Parameters


### 0.9.1 Testing-Specific Instructions

**Test execution commands:**

| Purpose | Command |
|---------|---------|
| Run full test suite | `pytest` |
| Run with coverage reporting | `pytest --cov=server --cov-report=term-missing` |
| Run only startup tests | `pytest tests/test_startup.py -v` |
| Run only existing route tests | `pytest tests/test_server.py -v` |
| Run single test by name | `pytest -k "test_main_calls_app_run" -v` |
| Run with verbose output | `pytest -v` |

**Test patterns to follow in the repository:**

- **Naming:** `test_{http_method_or_subject}_{assertion_target}` (e.g., `test_main_binds_to_localhost`, `test_main_suppresses_werkzeug_version`)
- **Assertions:** Use Python's built-in `assert` statement with pytest's assertion introspection — no assertion libraries
- **Organization:** Group tests under section comment markers (e.g., `# --- Startup Path Tests ---`)
- **Fixture usage:** Use `pytest.fixture` for shared state; use `monkeypatch` fixture for startup-path interception
- **Data style:** Inline hardcoded expected values — no external data files, factories, or fixtures beyond the shared `client`

**Excluded test categories per user instruction:**
- No browser or E2E tests
- No database or persistence tests
- No external API or integration tests
- No performance or load tests
- No security tests

**Environment setup requirements for tests:**
- Python 3.10+ virtual environment with Flask >=3.0 and pytest installed
- `pytest-cov` installed for coverage reporting (dev-only)
- No environment variables, secrets, or external services required
- No port binding or network access required during test execution


## 0.10 Special Instructions for Testing


### 0.10.1 Testing-Specific Requirements

The following directives are explicitly emphasized by the user and must be strictly observed during implementation:

- **Minimal change principle:** ONLY add test files and test-related configurations. Do not modify `server.py`, `requirements.txt`, or any production artifact.
- **Do NOT modify source code:** The application under test (`server.py`) must remain completely unchanged. All testability is achieved through the existing `if __name__ == "__main__":` guard pattern and external test instrumentation (`runpy`, `monkeypatch`).
- **Follow existing test patterns:** New tests in `tests/test_startup.py` must follow the naming conventions, assertion style, and organizational structure established in `tests/test_server.py`.
- **Maintain test isolation:** Use pytest's `monkeypatch` fixture for all startup-path interception. Monkeypatch automatically reverts changes after each test function, ensuring no state leakage between tests.
- **Prefer minimal mocking:** Use the real Flask test client for route coverage (existing tests). Mock only when necessary to safely test startup behavior without binding a real socket — specifically, monkeypatch `app.run` to a capturing no-op callable.
- **Ensure all tests can run independently:** Every test function must be independently executable via `pytest -k "test_name"` and must produce the same result regardless of execution order.
- **Maintain backward compatibility in test utilities:** The shared `client` fixture in `tests/conftest.py` must remain unchanged. New test infrastructure goes into `tests/test_startup.py` only.
- **Match existing code style and naming conventions:** Function names follow `test_{subject}_{assertion}`, section markers use `# --- Category ---`, assertions use bare `assert` statements, and no class-based test organization.
- **Do not create or modify GitHub workflows:** Per the implementation rule "Do not make any updates or changes in GitHub App to create or update a workflow."
- **Keep coverage tooling dev-only:** `pytest-cov` is a development-time dependency only and must not be added to `requirements.txt`.

### 0.10.2 Validation Criteria for Completion

Testing implementation is considered complete when all of the following conditions are met:

| Criterion | Validation Method |
|-----------|-------------------|
| Existing 24 tests still pass | `pytest tests/test_server.py -v` — 24 passed |
| F-008 (Werkzeug version suppression) covered | `tests/test_startup.py` contains test asserting `WSGIRequestHandler.version_string` returns `""` |
| F-009 (localhost binding) covered | `tests/test_startup.py` contains tests asserting `app.run(host="127.0.0.1", port=3000)` |
| Full suite passes | `pytest -v` — all tests passed (existing 24 + new startup tests) |
| Coverage reporting available | `pytest --cov=server --cov-report=term-missing` produces coverage report |
| Near-complete line coverage | Coverage report shows ~100% for `server.py` (lines 32, 34, 35 now covered) |
| No application behavior changed | `server.py` is byte-for-byte identical to its original state |
| New tests fail meaningfully | Temporarily changing host/port values or removing version suppression in `server.py` causes the new startup tests to fail |
| Import safety preserved | `test_app_import_does_not_start_server` and `test_app_is_flask_instance` continue to pass |
| Deterministic execution | Running `pytest -v` multiple times produces identical results with zero flaky tests |


