# Technical Specification

# 0. Agent Action Plan

## 0.1 Executive Summary

Based on the bug description, the Blitzy platform understands that the bug is a **response-contract violation** in the Flask server's successful endpoint responses: all three route handlers (`GET /`, `GET /evening`, `POST /evening`) return the `Content-Type: text/html; charset=utf-8` header instead of the specified `Content-Type: text/plain; charset=utf-8`.

This is not a crash or runtime exception — it is a silent HTTP metadata defect. The response bodies and status codes are correct, but the MIME type advertised in the `Content-Type` header misrepresents the payload format. The technical specification (Section 2.2, Functional Requirements) explicitly describes all endpoint outputs as "Plain-text body," confirming that `text/plain` is the intended content type.

The root cause is that the route handlers in `server.py` (lines 8, 13, 18) return bare Python string tuples (e.g., `return "Hello, World!", 200`), which Flask wraps into `Response` objects using its default MIME type of `text/html`. Flask's `Response` class inherits `default_mimetype = 'text/html'` from Werkzeug's base response, and no explicit override is applied anywhere in the application.

**Reproduction commands:**

```plaintext
curl -i http://127.0.0.1:3000/
curl -i http://127.0.0.1:3000/evening
curl -i -X POST http://127.0.0.1:3000/evening
```

**Observed defect in every response:**

```plaintext
Content-Type: text/html; charset=utf-8
```

**Expected header:**

```plaintext
Content-Type: text/plain; charset=utf-8
```

**Error classification:** Response-contract / MIME type mismatch — affects all three success paths, reproducible on every request, no special payload or conditions required.

## 0.2 Root Cause Identification

Based on research, THE root cause is: **Flask's default MIME type (`text/html`) is applied to all responses because the route handlers return bare string tuples without an explicit `Content-Type` override.**

- **Located in:** `server.py`, lines 8, 13, and 18
- **Triggered by:** Returning a 2-tuple `(body_string, status_code)` from a Flask route handler. When Flask receives this form, it constructs a `Response` object via `werkzeug.wrappers.Response`, which defines `default_mimetype = 'text/html'`. Since no `mimetype`, `content_type`, or headers argument is provided, Werkzeug applies the default, resulting in `Content-Type: text/html; charset=utf-8`.
- **Evidence:**
  - `server.py` line 8: `return "Hello, World!", 200` — no content type specified
  - `server.py` line 13: `return "Good evening", 200` — no content type specified
  - `server.py` line 18: `return "Good evening", 201` — no content type specified
  - Flask test client inspection confirms all three endpoints return `mimetype=text/html` and `content_type=text/html; charset=utf-8`
  - Flask's `Response` class (documented in Werkzeug source and confirmed via web search) sets `default_mimetype = 'text/html'` as a class attribute
  - The existing test suite (`tests/test_server.py`) validates only `response.status_code` and `response.data` — it contains zero assertions on `response.content_type` or `response.mimetype`, so the defect was never caught by automated testing

- **This conclusion is definitive because:**
  - Direct inspection of `server.py` shows all three return statements use the 2-tuple form `(string, int)` with no header or content-type parameter
  - Flask's internal `make_response()` pipeline wraps bare strings into `Response` objects using `default_mimetype = 'text/html'` — this is not configurable without explicitly passing a different content type
  - Test client execution confirmed `text/html` on all three endpoints
  - The technical specification (Section 2.2) labels all outputs as "Plain-text body," confirming the contract violation

## 0.3 Diagnostic Execution

### 0.3.1 Code Examination Results

- **File analyzed:** `server.py`
- **Problematic code block:** Lines 6–18 (all three route handler functions)
- **Specific failure points:**
  - Line 8: `return "Hello, World!", 200` — `root()` handler for `GET /`
  - Line 13: `return "Good evening", 200` — `evening_get()` handler for `GET /evening`
  - Line 18: `return "Good evening", 201` — `evening_post()` handler for `POST /evening`
- **Execution flow leading to bug:**
  - Client sends HTTP request (e.g., `GET /`)
  - Flask's routing dispatches to the registered handler (e.g., `root()`)
  - Handler returns a Python 2-tuple: `("Hello, World!", 200)`
  - Flask's `Flask.make_response()` receives the tuple and separates `body="Hello, World!"` and `status=200`
  - Flask constructs `Response(body, status=status)` using `werkzeug.wrappers.Response`
  - Werkzeug's `Response.__init__` applies `default_mimetype = 'text/html'` since no `mimetype` or `content_type` argument was provided
  - The response is returned with `Content-Type: text/html; charset=utf-8`

### 0.3.2 Repository File Analysis Findings

| Tool Used | Command / Action | Finding | File:Line |
|-----------|-----------------|---------|-----------|
| read_file | Read `server.py` | All three route handlers return bare 2-tuples `(string, int)` with no content-type specification | `server.py:8,13,18` |
| read_file | Read `tests/test_server.py` | 13 test functions exist; none assert on `content_type` or `mimetype` — only `status_code` and `data` are checked | `tests/test_server.py:1-86` |
| read_file | Read `tests/conftest.py` | `client` fixture returns `app.test_client()` — standard Flask test client, no custom configuration | `tests/conftest.py:1-8` |
| read_file | Read `requirements.txt` | Single dependency: `Flask>=3.0` | `requirements.txt:1` |
| bash | `python3 -c "from server import app; ..."` (test client content-type check) | All three endpoints return `content_type=text/html; charset=utf-8` and `mimetype=text/html` | Runtime output |
| bash | `python3 -m pytest -v` | All 13 existing tests pass — the bug is invisible to the current test suite | Runtime output |
| get_tech_spec_section | Retrieved Section 2.2 Functional Requirements | Technical Specifications columns for F-002, F-003, F-004 all describe output as "Plain-text body" | Tech spec |
| web_search | "Flask 3 set response content type text/plain" | Confirmed: Flask's `Response.default_mimetype = 'text/html'`; string returns get this default. Fix requires explicit content-type via 3-tuple, `make_response`, or `Response` object | Web sources |

### 0.3.3 Fix Verification Analysis

- **Steps followed to reproduce the bug:**
  - Installed Flask 3.1.3 and pytest 9.0.2 in the project environment
  - Ran `python3 -m pytest -v` — all 13 tests passed (confirming the existing suite does not detect the defect)
  - Executed Python script using `app.test_client()` to inspect `response.content_type` and `response.mimetype` for all three endpoints
  - Confirmed all three endpoints return `text/html; charset=utf-8` instead of `text/plain; charset=utf-8`

- **Confirmation tests used to ensure the bug was fixed:**
  - Validated the 3-tuple return approach `(body, status, {"Content-Type": "text/plain; charset=utf-8"})` using a test Flask app — confirmed it produces `content_type=text/plain; charset=utf-8` and `mimetype=text/plain`
  - Verified that `response.data` (body bytes) and `response.status_code` remain unchanged after the 3-tuple fix
  - Confirmed no duplicate `Content-Type` headers are emitted when using 3-tuple with a string body (per Flask GitHub issue #3628: string/bytes bodies do not pre-set a Content-Type)

- **Boundary conditions and edge cases covered:**
  - Error responses (404 for `/nonexistent`, 405 for `POST /`) remain unchanged — they use Flask's default error handlers and are out of scope
  - The `if __name__ == "__main__"` block (lines 21–25) is unaffected
  - Import-safety behavior is unaffected — the `app` object is still importable without starting the server

- **Whether verification was successful:** Yes — **confidence level: 98%**. The fix has been validated through direct test-client inspection and is consistent with Flask's documented response-handling behavior for the installed version (Flask 3.1.3, Werkzeug 3.1.7).

## 0.4 Bug Fix Specification

### 0.4.1 The Definitive Fix

The fix converts each route handler's return statement from a 2-tuple `(body, status)` to a 3-tuple `(body, status, headers)` with an explicit `Content-Type: text/plain; charset=utf-8` header. This is Flask's built-in mechanism for setting response headers without requiring additional imports or refactoring.

- **Files to modify:** `server.py` (3 return statements), `tests/test_server.py` (3 new test functions)
- **This fixes the root cause by:** Providing an explicit `Content-Type` header in the response tuple, which overrides Werkzeug's `default_mimetype = 'text/html'` with the correct `text/plain; charset=utf-8` value. Flask's `make_response()` applies the headers dict from the 3-tuple directly onto the response object, ensuring the correct MIME type is sent to the client.

### 0.4.2 Change Instructions

**File: `server.py`**

- MODIFY line 8 from:
```python
    return "Hello, World!", 200
```
to:
```python
    return "Hello, World!", 200, {"Content-Type": "text/plain; charset=utf-8"}
```

- MODIFY line 13 from:
```python
    return "Good evening", 200
```
to:
```python
    return "Good evening", 200, {"Content-Type": "text/plain; charset=utf-8"}
```

- MODIFY line 18 from:
```python
    return "Good evening", 201
```
to:
```python
    return "Good evening", 201, {"Content-Type": "text/plain; charset=utf-8"}
```

**File: `tests/test_server.py`**

- INSERT after line 17 (after `test_get_root_response_body`), a new test to verify the `GET /` content type:
```python
def test_get_root_content_type(client):
    response = client.get("/")
    assert response.content_type == "text/plain; charset=utf-8"
```

- INSERT after line 27 (after `test_get_evening_response_body`), a new test to verify the `GET /evening` content type:
```python
def test_get_evening_content_type(client):
    response = client.get("/evening")
    assert response.content_type == "text/plain; charset=utf-8"
```

- INSERT after line 37 (after `test_post_evening_response_body`), a new test to verify the `POST /evening` content type:
```python
def test_post_evening_content_type(client):
    response = client.post("/evening")
    assert response.content_type == "text/plain; charset=utf-8"
```

### 0.4.3 Fix Validation

- **Test command to verify fix:**
```bash
python3 -m pytest tests/test_server.py -v --tb=short
```

- **Expected output after fix:** All 16 tests pass (13 existing + 3 new content-type assertions), with exit code 0.

- **Confirmation method:** The three new tests (`test_get_root_content_type`, `test_get_evening_content_type`, `test_post_evening_content_type`) each assert `response.content_type == "text/plain; charset=utf-8"`. These tests will fail on the current (unfixed) code and pass after the 3-tuple fix is applied — serving as both verification and regression protection.

## 0.5 Scope Boundaries

### 0.5.1 Changes Required (Exhaustive List)

| Action | File Path | Lines | Specific Change |
|--------|-----------|-------|-----------------|
| MODIFIED | `server.py` | Line 8 | Add `{"Content-Type": "text/plain; charset=utf-8"}` as third element to the return tuple in `root()` |
| MODIFIED | `server.py` | Line 13 | Add `{"Content-Type": "text/plain; charset=utf-8"}` as third element to the return tuple in `evening_get()` |
| MODIFIED | `server.py` | Line 18 | Add `{"Content-Type": "text/plain; charset=utf-8"}` as third element to the return tuple in `evening_post()` |
| MODIFIED | `tests/test_server.py` | After line 17 | Insert `test_get_root_content_type` function asserting `response.content_type == "text/plain; charset=utf-8"` |
| MODIFIED | `tests/test_server.py` | After line 27 | Insert `test_get_evening_content_type` function asserting `response.content_type == "text/plain; charset=utf-8"` |
| MODIFIED | `tests/test_server.py` | After line 37 | Insert `test_post_evening_content_type` function asserting `response.content_type == "text/plain; charset=utf-8"` |

No other files require modification. No files are created or deleted.

### 0.5.2 Explicitly Excluded

- **Do not modify:** `server.js`, `package.json`, `package-lock.json` — legacy/inactive Node.js artifacts irrelevant to the Flask application
- **Do not modify:** `tests/conftest.py` — the existing `client` fixture already provides the `app.test_client()` instance needed for header assertions; no changes required
- **Do not modify:** `tests/__init__.py` — empty package initializer, no functional role
- **Do not modify:** `requirements.txt` — no new dependencies are introduced by this fix
- **Do not modify:** `pytest.ini` — test discovery configuration remains unchanged
- **Do not modify:** `README.md` — documentation accurately describes the endpoints; the content-type fix does not alter the documented API contract
- **Do not modify:** Files under `blitzy/documentation/` — generated documentation is not affected by this fix
- **Do not refactor:** The `if __name__ == "__main__"` block in `server.py` (lines 21–25) — server startup and header suppression logic are unrelated to the bug
- **Do not refactor:** Error handling behavior (404/405) — these use Flask's default error handlers and are not part of the bug scope
- **Do not add:** Any new dependencies, imports, or framework-level changes — the fix uses Flask's built-in 3-tuple response mechanism already available in the current codebase

## 0.6 Verification Protocol

### 0.6.1 Bug Elimination Confirmation

- **Execute:** `python3 -m pytest tests/test_server.py -v --tb=short`
- **Verify output matches:** 16 tests passed (13 original + 3 new content-type tests), exit code 0
- **Confirm error no longer appears in:** Test client response headers — all three success endpoints must return `content_type=text/plain; charset=utf-8` instead of `text/html; charset=utf-8`
- **Validate functionality with inline script:**
```bash
python3 -c "
from server import app
with app.test_client() as c:
    for m,p in [('GET','/'),('GET','/evening'),('POST','/evening')]:
        r = c.get(p) if m=='GET' else c.post(p)
        assert r.content_type == 'text/plain; charset=utf-8', f'{m} {p}: {r.content_type}'
print('All content-type assertions passed')
"
```

### 0.6.2 Regression Check

- **Run existing test suite:** `python3 -m pytest tests/test_server.py -v --tb=short`
- **Verify unchanged behavior in:**
  - Response bodies: `GET /` → `b"Hello, World!"`, `GET /evening` → `b"Good evening"`, `POST /evening` → `b"Good evening"`
  - Status codes: `GET /` → 200, `GET /evening` → 200, `POST /evening` → 201
  - Error handling: `GET /nonexistent` → 404, `POST /nonexistent` → 404, `POST /` → 405, `DELETE /evening` → 405
  - Application importability: `app` is a `Flask` instance, `server` module exposes `app` attribute
  - GET vs POST status differentiation on `/evening`
- **Confirm performance metrics:** Test suite execution remains under 2 seconds (baseline: 0.04s)

## 0.7 Rules

The following rules and coding guidelines are acknowledged and will be strictly followed:

- **User-specified rule — "exit code 137 test":** Do not make any updates or changes in GitHub App to create or update a workflow.
- **Minimal change principle:** Only the three return statements in `server.py` and the addition of three regression test functions in `tests/test_server.py` are modified. Zero modifications are permitted outside the bug fix scope.
- **Preserve all existing behavior:** Route paths (`/`, `/evening`), HTTP methods (`GET`, `POST`), response bodies (`Hello, World!`, `Good evening`), status codes (200, 201), localhost binding (`127.0.0.1:3000`), import-safe `if __name__ == "__main__"` guard, existing server header suppression, and 404/405 error handling must remain exactly as they are.
- **No external dependency changes:** No new packages, imports, or framework-level changes are introduced. The fix uses Flask's built-in 3-tuple response mechanism.
- **Preserve existing test structure:** The 13 existing test functions in `tests/test_server.py` remain unmodified. New content-type assertion tests are added alongside the existing suite, following the same naming conventions and fixture usage patterns.
- **Version compatibility:** All changes are compatible with the project's declared dependency (`Flask>=3.0`) and runtime requirement (Python 3.10+). The 3-tuple return format is a stable Flask feature available across all supported versions.
- **No CI/CD workflow modifications:** Per the user-specified rule, no GitHub Actions workflows or CI pipeline files will be created, modified, or deleted.

## 0.8 References

### 0.8.1 Repository Files Searched

| File / Folder | Purpose of Inspection | Key Finding |
|---------------|----------------------|-------------|
| `server.py` | Primary bug location — route handler return statements | Lines 8, 13, 18 return bare 2-tuples without Content-Type |
| `tests/test_server.py` | Existing test coverage analysis | 13 tests validate status codes and bodies; zero content-type assertions |
| `tests/conftest.py` | Fixture configuration review | `client` fixture provides `app.test_client()` — no changes needed |
| `tests/__init__.py` | Package initializer check | Empty file, no modifications required |
| `requirements.txt` | Dependency version verification | `Flask>=3.0` (installed: Flask 3.1.3) |
| `pytest.ini` | Test runner configuration | `testpaths = tests` — standard pytest discovery |
| `README.md` | Project documentation and prerequisites | Python 3.10+, endpoints documented as plain-text |
| `blitzy/` | Documentation folder inspection | Contains generated docs; out of scope for this fix |
| Root folder (`""`) | Full repository structure mapping | 9 top-level items: 6 files, 2 folders, 1 legacy Node.js set |

### 0.8.2 Technical Specification Sections Consulted

| Section | Content Retrieved | Relevance |
|---------|-------------------|-----------|
| 1.1 Executive Summary | Project overview, purpose as minimal test harness | Confirmed endpoints serve "static plain-text responses" |
| 2.2 Functional Requirements | F-002, F-003, F-004 requirement details | All output columns specify "Plain-text body" — confirms text/plain as the intended MIME type |
| 3.2 Frameworks & Libraries | Flask version, capabilities, transitive dependencies | Confirmed Flask 3.1.3 with Werkzeug, default_mimetype = 'text/html' |

### 0.8.3 External Research Sources

| Source | Query / URL | Finding |
|--------|-------------|---------|
| Miguel Grinberg Blog | "Customizing the Flask Response Class" | Confirmed `Response.default_mimetype = 'text/html'` as class attribute; subclassing or explicit override needed |
| Flask GitHub Issue #3628 | Duplicate Content-Type headers investigation | Confirmed string/bytes bodies do not pre-set Content-Type, so 3-tuple override is safe and does not produce duplicates |
| Runebook.dev | Flask Response.content_type documentation | Confirmed `Response` object and `mimetype` argument for custom content types |
| CopyProgramming | Flask content-type setting guide | Validated 3-tuple approach: `return x, 200, {'Content-Type': 'text/plain; charset=utf-8'}` |
| Flask official docs (via multiple sources) | Tuple return format: `(body, status, headers)` | Confirmed the 3-tuple is a stable, documented response format across Flask 1.x–3.x |

### 0.8.4 Attachments

No external attachments (Figma designs, screenshots, or supplementary files) were provided for this task.

