# Technical Specification

# 0. Agent Action Plan

## 0.1 Executive Summary

Based on the bug description, the Blitzy platform understands that the bug is a **response contract violation on the root `GET /` endpoint**: the handler returns `Content-Type: application/json` with a JSON-structured body (`{"status":"success","message":"Hello, World! Welcome to the Express server."}`) instead of the documented plain-text contract requiring `Content-Type: text/plain` with a body of exactly `Hello, World!\n`.

**Technical Failure Classification:** API contract mismatch — the Express route handler in `src/routes/index.js` (line 45) uses `res.json()`, which automatically sets `Content-Type: application/json; charset=utf-8` and serializes the response object as JSON. The documented contract mandates `Content-Type: text/plain` with the literal string `Hello, World!\n`.

**Precise Symptoms:**
- **Observed Content-Type:** `application/json; charset=utf-8`
- **Expected Content-Type:** `text/plain`
- **Observed Body:** `{"status":"success","message":"Hello, World! Welcome to the Express server."}`
- **Expected Body:** `Hello, World!\n`
- **Status Code:** `200 OK` (correct, no change needed)

**Reproduction Steps:**

```bash
curl -i http://localhost:3000/
```

**Trigger Conditions:** Every successful `GET /` request. No special inputs, authentication, or timing required. The bug is deterministic and 100% reproducible.

**Error Type:** Logic error — incorrect response serialization method and content type. Not a crash, not a race condition, not a null reference. The server functions correctly at the transport level but violates its own documented API contract.

**Scope of Impact:** Limited to the root endpoint (`GET /`). All other endpoints (`/health`, `/api`, `/api/info`) correctly return JSON and are unaffected. The existing test suite (371 tests, all passing) encodes the current incorrect behavior, meaning tests for the root route also require alignment with the corrected contract.


## 0.2 Root Cause Identification

Based on research, THE root causes are:

**Root Cause 1: Incorrect response method in route handler**

- **Located in:** `src/routes/index.js`, line 45
- **Triggered by:** The `GET /` handler uses `res.json()` instead of `res.type('text/plain').send()`
- **Evidence:** Line 45 reads `res.json({ status: 'success', message: 'Hello, World! Welcome to the Express server.' });` — the `res.json()` method in Express 5.2.1 automatically sets the `Content-Type` header to `application/json; charset=utf-8` and serializes the argument via `JSON.stringify()`. The documented contract requires `Content-Type: text/plain` and a literal string body of `Hello, World!\n`.
- **This conclusion is definitive because:** Direct inspection of the route handler at `src/routes/index.js:45` shows `res.json()` is explicitly called. The Express 5 API documentation confirms that `res.json()` always sets `Content-Type: application/json`. No middleware in the pipeline overrides this header for the root route. The actual HTTP response was verified to return `Content-Type: application/json; charset=utf-8` via live server testing.

**Root Cause 2: Test assertions encode the wrong contract**

- **Located in:** `tests/routes/index.test.js`, lines 53–81 and lines 93–97
- **Triggered by:** The test suite was written to match the current (incorrect) implementation rather than the documented API contract
- **Evidence:**
  - Line 55–57: Asserts `content-type` contains `application/json` (should be `text/plain`)
  - Line 62: Asserts `res.body.status` equals `'success'` (JSON parsing — should verify `res.text`)
  - Lines 67–69: Asserts `res.body.message` equals `'Hello, World! Welcome to the Express server.'` (should verify plain text `Hello, World!\n`)
  - Lines 74–81: Asserts exact JSON shape `{ status, message }` (should verify exact plain text body)
  - Lines 95–97: HEAD test asserts `application/json` content type (should be `text/plain`)
- **This conclusion is definitive because:** The test expectations directly contradict the documented API contract specified in the bug report. The tests pass because they validate the buggy behavior rather than the correct behavior.

**Root Cause 3: App-level integration tests assume JSON for root endpoint**

- **Located in:** `tests/app.test.js`, lines 109–123, 133–138, and 281–289
- **Triggered by:** Cross-endpoint assertions include the root route in JSON content-type checks
- **Evidence:**
  - Line 110: The array `['/', '/health', '/api', '/api/info']` includes `/` in a loop that asserts `application/json` for all endpoints
  - Lines 117–123: Directly tests `GET /` expecting `res.body.status` and `res.body.message` (JSON properties)
  - Line 136: HEAD test on `/` expects `application/json` content type
  - Lines 287–288: Compression test on `GET /` asserts `res.body` has `status: 'success'` and `message` property (JSON body assertions)
- **This conclusion is definitive because:** After fixing the route handler, these tests will fail because they assert the old JSON format. They must be updated to expect `text/plain` and a string body.

**Note on File Location Discrepancy:** The user's problem statement identifies `server.js` as the primary file. However, `server.js` is the bootstrap/entry point that calls `app.listen()` — it does not contain route handlers. The actual `GET /` handler resides in `src/routes/index.js` (line 44–49), which is mounted via `src/app.js` (line 161). This is a typical Express application factory pattern where route definitions are separated from server lifecycle management.


## 0.3 Diagnostic Execution

### 0.3.1 Code Examination Results

- **File analyzed:** `src/routes/index.js`
- **Problematic code block:** Lines 44–49
- **Specific failure point:** Line 45, the `res.json()` call
- **Execution flow leading to bug:**
  - Client sends `GET /` request
  - Express middleware pipeline processes request (Helmet → CORS → Compression → Body parsers → Morgan → Rate limiter)
  - Request reaches `src/routes/index.js` via `app.use('/', routes)` in `src/app.js` line 161
  - `router.get('/')` handler at line 44 matches the request
  - `validateInput` middleware passes (empty query/body validated)
  - Handler executes `res.json({ status: 'success', message: 'Hello, World! Welcome to the Express server.' })` at line 45
  - Express `res.json()` calls `JSON.stringify()` on the object, sets `Content-Type: application/json; charset=utf-8`, and sends the serialized JSON string
  - Client receives JSON body with JSON content type instead of plain text

### 0.3.2 Repository File Analysis Findings

| Tool Used | Command Executed | Finding | File:Line |
|-----------|-----------------|---------|-----------|
| read_file | `src/routes/index.js` lines 44–49 | `res.json()` used to send response with JSON object body | `src/routes/index.js:45` |
| read_file | `src/app.js` line 161 | Routes module mounted at `'/'` via `app.use('/', routes)` | `src/app.js:161` |
| read_file | `server.js` lines 40, 56 | `server.js` imports `src/app` and calls `app.listen()` — no route handler logic here | `server.js:40,56` |
| grep | `grep -rn "Hello, World" --include="*.js" .` | String `Hello, World` found in route handler and test assertions | `src/routes/index.js:38,47`, `tests/routes/index.test.js:68,76` |
| grep | `grep -rn "text/plain" --include="*.js" .` | No usage of `text/plain` in application source files | None in `src/` |
| grep | `grep -n "content-type\|application/json" tests/app.test.js` | Multiple assertions enforce JSON content type for root endpoint | `tests/app.test.js:109-113,136` |
| node (live test) | Start server, `GET http://127.0.0.1:3001/` | Confirmed `Content-Type: application/json; charset=utf-8` and JSON body | Runtime verification |
| npm test | `jest --ci --verbose tests/routes/index.test.js` | All 29 route tests pass — tests encode current (buggy) behavior | Test baseline |
| npm test | `jest --ci --verbose` (full suite) | All 371 tests pass — comprehensive baseline established | Full test baseline |

### 0.3.3 Fix Verification Analysis

- **Steps followed to reproduce bug:**
  - Installed dependencies via `npm install`
  - Started Express app on port 3001 via inline Node.js script
  - Sent `GET /` request using Node.js `http.get()`
  - Observed response headers: `Content-Type: application/json; charset=utf-8`
  - Observed response body: `{"status":"success","message":"Hello, World! Welcome to the Express server."}`
  - Confirmed mismatch with expected `Content-Type: text/plain` and body `Hello, World!\n`

- **Confirmation tests used to ensure that bug was fixed:**
  - After applying fix, run `CI=true npx jest --watchAll=false --ci --verbose` to verify all updated tests pass
  - Verify `GET /` returns `Content-Type: text/plain; charset=utf-8` (Express adds charset automatically for text types)
  - Verify `GET /` body is exactly `Hello, World!\n`
  - Verify `HEAD /` returns `Content-Type: text/plain` with empty body
  - Verify all other endpoints (`/health`, `/api`, `/api/info`) still return `application/json`
  - Verify 405/400/404 error responses remain as JSON

- **Boundary conditions and edge cases covered:**
  - HEAD request on `/` should return `text/plain` content type with no body
  - 405 handler for non-GET methods on `/` must remain JSON (error responses are always JSON)
  - Compression middleware must not interfere with `text/plain` response delivery
  - Zod input validation on `GET /` still rejects unexpected query parameters with 400 JSON error

- **Confidence level:** 95% — The fix is a straightforward response method change with well-understood Express 5.2.1 API behavior. The remaining 5% accounts for potential edge cases in compression middleware behavior with plain text responses.


## 0.4 Bug Fix Specification

### 0.4.1 The Definitive Fix

**File 1: `src/routes/index.js`**

- **Current implementation at line 45:**

```javascript
res.json({ status: 'success', message: 'Hello, World! Welcome to the Express server.' });
```

- **Required change at line 45:**

```javascript
res.type('text/plain').send('Hello, World!\n');
```

- **This fixes the root cause by:** Replacing `res.json()` (which sets `Content-Type: application/json` and sends JSON) with `res.type('text/plain').send()`, which explicitly sets `Content-Type: text/plain; charset=utf-8` and sends the plain-text string body `Hello, World!\n`. The `res.type()` method is the Express-idiomatic way to set MIME types and is fully supported in Express 5.2.1. The trailing `\n` newline is included per the documented contract.

**File 2: `tests/routes/index.test.js`**

- Tests in the `GET /` describe block (lines 48–82) must be updated to assert `text/plain` content type and plain text body instead of JSON
- Tests in the `HEAD /` describe block (lines 93–97) must be updated to assert `text/plain` content type

**File 3: `tests/app.test.js`**

- The JSON content-type loop at line 110 must exclude `/` from the endpoint array
- The JSON body assertion at lines 117–123 must be replaced with plain text assertions for the root endpoint
- The HEAD content-type assertion at line 136 must change to `text/plain`
- The compression test at lines 281–289 must be updated to verify plain text delivery

### 0.4.2 Change Instructions

**File: `src/routes/index.js`**

- MODIFY line 45 from:

```javascript
  res.json({
    status: 'success',
    message: 'Hello, World! Welcome to the Express server.'
  });
```

to:

```javascript
  // Fixed: Return plain text per documented API contract (Content-Type: text/plain)
  res.type('text/plain').send('Hello, World!\n');
```

- MODIFY the JSDoc comment at lines 37–39 from referencing "JSON response" to "plain-text response" to match the updated behavior. Update the comment to reflect that the response is `text/plain` format.

**File: `tests/routes/index.test.js`**

- MODIFY lines 53–58: Change test name from `'returns JSON content type'` to `'returns text/plain content type'`. Change assertion from `expect(res.headers['content-type']).toEqual(expect.stringContaining('application/json'))` to `expect(res.headers['content-type']).toEqual(expect.stringContaining('text/plain'))`

- MODIFY lines 60–62: Change test name to `'returns correct plain text body'`. Change assertion from `expect(res.body.status).toBe('success')` to `expect(res.text).toBe('Hello, World!\n')`

- MODIFY lines 65–69: Change test name to `'returns exact Hello, World! body with newline'`. Change assertion to verify `expect(res.text).toBe('Hello, World!\n')`

- MODIFY lines 72–81: Replace the entire JSON shape test. Change the test to verify exact plain text body with `expect(res.text).toBe('Hello, World!\n')` and optionally verify no JSON parsing occurs (i.e., `res.body` should be empty or not an object with `status`/`message` keys)

- MODIFY lines 93–97: Change HEAD test from asserting `application/json` to asserting `text/plain` in `content-type` header

**File: `tests/app.test.js`**

- MODIFY line 110: Change the endpoint array from `['/', '/health', '/api', '/api/info']` to `['/health', '/api', '/api/info']` to exclude root endpoint from JSON-specific assertions

- MODIFY lines 117–123: Replace the JSON body assertion test. Change the test to verify that `GET /` returns `text/plain` content type and that `res.text` equals `'Hello, World!\n'`. Update test name to reflect plain text verification.

- MODIFY line 136: Change `expect(res.headers['content-type']).toMatch(/application\/json/)` to `expect(res.headers['content-type']).toMatch(/text\/plain/)`

- MODIFY lines 281–289: Update the compression test. Replace `expect(res.body).toHaveProperty('status', 'success')` and `expect(res.body).toHaveProperty('message')` with `expect(res.text).toBe('Hello, World!\n')`. Update the comment from "Response body is still valid JSON" to "Response body is correct plain text".

### 0.4.3 Fix Validation

- **Test command to verify fix:**

```bash
CI=true npx jest --watchAll=false --ci --verbose
```

- **Expected output after fix:** All 371 tests pass (test count unchanged — assertions modified, not tests added or removed)

- **Confirmation method:**
  - Run full test suite and verify 0 failures
  - Start server manually and send `curl -i http://localhost:3000/` to verify:
    - `Content-Type: text/plain; charset=utf-8`
    - Body: `Hello, World!\n`
    - Status: `200 OK`
  - Verify `curl -i http://localhost:3000/health` still returns `application/json`
  - Verify `curl -X POST http://localhost:3000/` still returns 405 JSON error


## 0.5 Scope Boundaries

### 0.5.1 Changes Required (Exhaustive List)

| Action | File Path | Lines | Specific Change |
|--------|-----------|-------|-----------------|
| MODIFIED | `src/routes/index.js` | 37–39 | Update JSDoc comment to reference plain-text response instead of JSON |
| MODIFIED | `src/routes/index.js` | 45 | Replace `res.json({...})` with `res.type('text/plain').send('Hello, World!\n')` |
| MODIFIED | `tests/routes/index.test.js` | 53–58 | Change content type assertion from `application/json` to `text/plain` |
| MODIFIED | `tests/routes/index.test.js` | 60–62 | Change body assertion from `res.body.status` to `res.text === 'Hello, World!\n'` |
| MODIFIED | `tests/routes/index.test.js` | 65–69 | Update welcome message assertion to verify plain text body |
| MODIFIED | `tests/routes/index.test.js` | 72–81 | Replace JSON shape assertion with plain text body assertion |
| MODIFIED | `tests/routes/index.test.js` | 93–97 | Change HEAD content type from `application/json` to `text/plain` |
| MODIFIED | `tests/app.test.js` | 110 | Remove `/` from the JSON endpoint array (keep `/health`, `/api`, `/api/info`) |
| MODIFIED | `tests/app.test.js` | 117–123 | Replace JSON body test with plain text assertions for `GET /` |
| MODIFIED | `tests/app.test.js` | 136 | Change HEAD `/` content type assertion from `application/json` to `text/plain` |
| MODIFIED | `tests/app.test.js` | 281–289 | Update compression test to verify plain text body instead of JSON properties |

**No files are CREATED or DELETED.**

### 0.5.2 Explicitly Excluded

- **Do not modify:** `server.js` — Although the user identified this file, it is the bootstrap entry point and does not contain route handler logic. The route handler resides in `src/routes/index.js`.
- **Do not modify:** `src/app.js` — The middleware pipeline configuration is correct and unrelated to the response format of a single endpoint.
- **Do not modify:** `src/routes/health.js`, `src/routes/api.js` — These routes correctly return JSON and are unaffected by this bug.
- **Do not modify:** `src/middleware/errorHandler.js`, `src/middleware/notFound.js`, `src/middleware/validateInput.js` — Error and validation middleware are unaffected.
- **Do not modify:** `src/config/index.js`, `src/utils/logger.js`, `src/utils/sanitizer.js` — Infrastructure modules are unrelated.
- **Do not modify:** `package.json`, `package-lock.json`, `ecosystem.config.js`, `jest.config.js` — No dependency, configuration, or tooling changes required.
- **Do not modify:** `README.md` — Documentation updates are out of scope for this minimal bug fix.
- **Do not modify:** Any file under `tests/config/`, `tests/helpers/`, `tests/middleware/`, `tests/utils/`, or `tests/server.test.js` — These test files do not assert against the root route's response format.
- **Do not refactor:** The validation middleware or the 405 method handler on `/` — these work correctly and return JSON as intended for error responses.
- **Do not add:** New dependencies, new middleware, new endpoints, or new test files. This is a targeted fix only.


## 0.6 Verification Protocol

### 0.6.1 Bug Elimination Confirmation

- **Execute:** `CI=true npx jest --watchAll=false --ci --verbose tests/routes/index.test.js`
- **Verify output matches:**
  - `GET /` tests pass with `text/plain` content type assertion
  - `GET /` tests pass with `res.text === 'Hello, World!\n'` body assertion
  - `HEAD /` tests pass with `text/plain` content type assertion
  - All 405 and 400 tests remain passing (unchanged JSON assertions)
- **Confirm error no longer appears in:** HTTP response headers — `Content-Type` must be `text/plain; charset=utf-8` instead of `application/json; charset=utf-8`
- **Validate functionality with:** Live server test:

```bash
node -e "
const app = require('./src/app');
const s = app.listen(3000, () => {
  require('http').get('http://localhost:3000/', r => {
    let d=''; r.on('data',c=>d+=c);
    r.on('end',()=>{
      console.log('CT:', r.headers['content-type']);
      console.log('Body:', JSON.stringify(d));
      s.close();
    });
  });
});"
```

Expected: `CT: text/plain; charset=utf-8` and `Body: "Hello, World!\n"`

### 0.6.2 Regression Check

- **Run existing test suite:** `CI=true npx jest --watchAll=false --ci --coverage --verbose`
- **Verify test results:** All 371 tests pass (0 failures, 0 skipped)
- **Verify unchanged behavior in:**
  - `GET /health` — returns `application/json` with health telemetry (run `tests/routes/health.test.js`)
  - `GET /api` — returns `application/json` with API welcome message (run `tests/routes/api.test.js`)
  - `GET /api/info` — returns `application/json` with metadata (run `tests/routes/api.test.js`)
  - `POST /` — returns `405 Method Not Allowed` with JSON error body (unchanged)
  - `GET /?unexpected=param` — returns `400 Validation failed` with JSON error body (unchanged)
  - `GET /nonexistent` — returns `404 Not Found` with JSON error body (unchanged)
  - Rate limiting — `429 Too Many Requests` with JSON error body (unchanged)
  - Security headers — Helmet headers present on all responses (unchanged)
  - CORS — `Access-Control-Allow-Origin: *` present (unchanged)
- **Confirm coverage thresholds:** Coverage remains above the enforced minimums (90% lines, 90% functions, 80% branches, 90% statements) as defined in `jest.config.js`


## 0.7 Rules

The following rules and coding guidelines are acknowledged and will be strictly followed:

**User-Specified Rules:**
- **"exit code 137 test" rule:** Do not make any updates or changes in GitHub App to create or update a workflow. This rule is acknowledged and will be respected — no CI/CD workflow files (e.g., `.github/workflows/`) will be created, modified, or deleted.

**Bug Fix Constraints (from Problem Statement):**
- Make the exact specified change only — fix the response format on `GET /` from JSON to `text/plain` with `Hello, World!\n` body
- Zero modifications outside the bug fix — no refactoring, no new features, no new abstractions
- Do not change server architecture — the Node.js/Express framework, `http` module usage, and application factory pattern remain untouched
- Do not change port and host — `localhost:3000` configuration remains as-is via `src/config`
- Do not change request routing behavior — the endpoint structure (`/`, `/health`, `/api`, `/api/info`) is preserved
- Do not change existing success status codes — `200 OK` is retained
- Preserve zero-dependency design — no new npm packages are added
- Preserve ability to start server via `node server.js`
- Preserve endpoint structure, HTTP method handling, module exports used by tests
- Maintain compatibility with Jest 30.3.0 + Supertest 7.2.2 test suite
- Avoid modifying `package.json` and package/tooling configuration
- Avoid modifying unrelated documentation or generated files
- Test infrastructure changes limited to minimal assertion updates

**Development Pattern Compliance:**
- Follow existing CommonJS (`require`/`module.exports`) module pattern throughout
- Maintain `'use strict'` declarations in all modified files
- Follow existing Express 5.2.1 idioms — use `res.type()` for MIME type setting (Express-native API)
- Preserve the existing comment style with JSDoc annotations and section separators
- Maintain the existing code formatting conventions (2-space indentation, single quotes, semicolons)
- Error responses (405, 400, 404, 429, 500) remain as JSON per the standardized error contract
- Only the success response for `GET /` changes from JSON to plain text

**Version Compatibility:**
- All changes must be compatible with Node.js >= 18.0.0 (project minimum)
- All changes must be compatible with Express.js 5.2.1 (installed version)
- All changes must be compatible with Jest 30.3.0 and Supertest 7.2.2 (installed dev dependencies)


## 0.8 References

### 0.8.1 Codebase Files and Folders Searched

| File/Folder Path | Purpose of Inspection | Key Finding |
|-------------------|----------------------|-------------|
| (root) `/` | Map full repository structure | Identified `src/`, `tests/`, config files, `server.js` entry point |
| `package.json` | Determine dependencies, Node.js engine requirement, scripts | Express ^5.2.1, Jest ^30.3.0, Supertest ^7.2.2, Node >=18.0.0 |
| `server.js` | Check if route handler logic resides here | No route handlers — only bootstrap, `app.listen()`, and lifecycle management |
| `src/app.js` | Understand middleware pipeline and route mounting | Routes mounted at line 161 via `app.use('/', routes)` |
| `src/routes/index.js` | **Primary bug location** — root endpoint handler | Line 45: `res.json()` returns JSON instead of `text/plain` |
| `src/routes/health.js` | Verify other routes are unaffected | Returns JSON — no changes needed |
| `src/routes/api.js` | Verify other routes are unaffected | Returns JSON — no changes needed |
| `tests/routes/index.test.js` | Identify test assertions that encode buggy behavior | Lines 53–97: Assert `application/json` and JSON body for `GET /` |
| `tests/app.test.js` | Identify cross-cutting test assertions affected | Lines 109–123, 133–138, 281–289: Include root endpoint in JSON assertions |
| `tests/routes/` (folder) | Map all route test files | Three test files: `index.test.js`, `health.test.js`, `api.test.js` |
| `src/` (folder) | Map full application source tree | Five areas: `app.js`, `config/`, `middleware/`, `routes/`, `utils/` |
| `tests/` (folder) | Map full test tree | Seven areas: `app.test.js`, `server.test.js`, `config/`, `helpers/`, `middleware/`, `routes/`, `utils/` |
| `README.md` | Review documented endpoint contracts | Documents `GET /` as "Welcome message (JSON)" |
| `.env` | Review runtime configuration | Standard development defaults (port 3000, host 0.0.0.0) |
| `jest.config.js` | Review test configuration and coverage thresholds | 90% lines/functions/statements, 80% branches enforced |
| `node_modules/express/package.json` | Verify exact Express version | Express 5.2.1 confirmed |

### 0.8.2 External Research

| Source | Query/URL | Key Finding |
|--------|-----------|-------------|
| Express.js 5.x API Documentation | `expressjs.com/en/api.html` | Confirmed `res.type()` sets Content-Type MIME header, `res.send()` sends string body; `res.json()` always sets `application/json` |
| Express.js GitHub Issues | Express `res.type` / `res.send` behavior | Confirmed `res.type('text/plain').send(body)` is the idiomatic Express pattern for plain text responses |

### 0.8.3 Tech Spec Sections Referenced

| Section | Key Information Used |
|---------|---------------------|
| 2.2 FEATURE CATALOG (F-001) | Endpoint inventory showing `GET /` returns `{ status, message }` — confirms current implementation is JSON |
| 2.3 FUNCTIONAL REQUIREMENTS (F-001-RQ-001) | Acceptance criteria: `GET /` returns JSON with `application/json` — contradicts user's documented contract requiring `text/plain` |
| 2.2 FEATURE CATALOG (F-002) | 9-layer middleware pipeline architecture — confirms no middleware interferes with Content-Type |
| 2.2 FEATURE CATALOG (F-013) | Test suite details: 371 tests, 100% coverage, Jest + Supertest |

### 0.8.4 Attachments

No attachments were provided for this project. No Figma URLs or design files are applicable to this bug fix.


