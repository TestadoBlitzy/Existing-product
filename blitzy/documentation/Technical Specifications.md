# Technical Specification

# 0. Agent Action Plan

## 0.1 Executive Summary

Based on the bug description, the Blitzy platform understands that the bug is an **Express 5.x startup failure caused by a missing error-argument check in the `app.listen()` callback**, which produces a silent, misleading success on EADDRINUSE port conflicts. When `server.js` is executed directly (via `node server.js` or `npm start`) and TCP port 3000 is already occupied by another process, the Express 5.x `app.listen()` method invokes the user-provided callback with the `EADDRINUSE` error object as its first argument — a behavioral change from Express 4.x. Because the current callback `() => { console.log(...) }` declares zero parameters and therefore ignores the error argument, it unconditionally prints the misleading message `Server running at http://127.0.0.1:3000/`, then the process exits with code 0 (signaling success) while the server never actually binds to the port.

**Technical Failure Classification:** Express 5.x listen-callback error-argument contract violation — the callback does not inspect its first argument for an `Error` instance, causing silent swallowing of `EADDRINUSE`.

**Reproduction Steps (executable):**

- Start a blocker process on port 3000: `node -e "require('net').createServer().listen(3000, '127.0.0.1', () => console.log('blocking'))"`
- In a second terminal, run: `node server.js`
- Observe: stdout prints `Server running at http://127.0.0.1:3000/`, process exits with code 0, but `http://127.0.0.1:3000/` is unreachable — Backprop validation is blocked

**Specific Error Type:** Infrastructure-level port-binding failure (EADDRINUSE) masked by Express 5.x callback error-forwarding semantics. This is not a race condition or null reference — it is a **contract mismatch** between the Express 5.x `app.listen()` API and the server.js callback signature.

**Impact:** The startup path silently fails, emitting a false-positive "running" message and exit code 0. Automated health checks, CI/CD pipelines, and Backprop validation cannot distinguish this from a successful launch, making the failure invisible to all downstream observers.

## 0.2 Root Cause Identification

### 0.2.1 Primary Root Cause: Express 5.x Callback Error-Forwarding Not Handled

Based on research, THE root cause is: **Express 5.x's `app.listen()` method forwards EADDRINUSE errors to the listen callback as the first argument, but the callback in `server.js` ignores all arguments, silently swallowing the error.**

**Located in:** `server.js`, lines 21–24

**Problematic code:**

```javascript
if (require.main === module) {
  app.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
  });
}
```

**Triggered by:** Express 5.x (v5.2.1) changed the `app.listen()` implementation compared to Express 4.x. The internal implementation at `node_modules/express/lib/application.js` lines 598–606 now does:

```javascript
app.listen = function listen() {
  var server = http.createServer(this)
  var args = slice.call(arguments)
  if (typeof args[args.length - 1] === 'function') {
    var done = args[args.length - 1] = once(args[args.length - 1])
    server.once('error', done)  // <-- NEW in Express 5
  }
  return server.listen.apply(server, args)
}
```

The critical line `server.once('error', done)` registers the same callback for both `'listening'` and `'error'` events, wrapped with `once()`. When EADDRINUSE occurs, the `'error'` event fires first, calling `done(err)`. The callback receives the Error object as argument 0, but since it is declared as `() => { ... }` (zero-arity), the error is silently discarded.

**Evidence:**

- Reproduction confirms: when port 3000 is occupied, `server.js` prints `Server running at http://127.0.0.1:3000/`, exits with code 0, and the server is unreachable
- The Express 5.x source at `node_modules/express/lib/application.js:603` explicitly registers `server.once('error', done)`, which does not exist in Express 4.x
- GitHub Issue [expressjs/express#6191](https://github.com/expressjs/express/issues/6191) documents this exact behavioral difference — the callback fires on error in Express 5 but throws an uncaught exception in Express 4
- Express PR #2623 intentionally introduced this change for Express 5.0, noted as "people are unconditionally assuming the callback means the server is up"

**This conclusion is definitive because:** The Express 5.x source code unambiguously shows the error-to-callback forwarding, and live reproduction confirms the callback fires with the error argument when the port is occupied. The zero-arity arrow function `() => { ... }` in server.js structurally cannot access argument 0, making the error invisible by design.

### 0.2.2 Secondary Root Cause: Hardcoded Port With No Override Mechanism

**Located in:** `server.js`, lines 3–4

```javascript
const hostname = '127.0.0.1';
const port = 3000;
```

The port is hardcoded to `3000` with no `process.env.PORT` fallback. This means every invocation binds to the same fixed port, and there is no way to redirect the server to an available port without editing source code. Combined with the primary root cause, this makes EADDRINUSE collisions both frequent and unrecoverable.

### 0.2.3 Tertiary Root Cause: No Server Reference Retained for Error Handling

**Located in:** `server.js`, lines 21–24

The return value of `app.listen()` (an `http.Server` instance) is not captured in a variable. Without a reference, there is no opportunity to attach a `server.on('error', ...)` handler after the call, and no way to implement graceful shutdown or retry logic.

## 0.3 Diagnostic Execution

### 0.3.1 Code Examination Results

**File analyzed:** `server.js` (relative to repository root)

**Problematic code block:** Lines 21–25

```javascript
if (require.main === module) {
  app.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
  });
}
```

**Specific failure point:** Line 22, the arrow function `() => { ... }` — the zero-arity callback declaration. Under Express 5.x, this callback is invoked as `callback(err)` on EADDRINUSE, but the arrow function discards argument 0.

**Execution flow leading to bug (step-by-step trace):**

- User executes `node server.js` while port 3000 is occupied
- `require.main === module` evaluates to `true` (direct execution)
- `app.listen(3000, '127.0.0.1', callback)` is called
- Express 5.x internally: creates `http.Server`, wraps `callback` with `once()`, registers it as both `server.once('error', done)` and the `'listening'` handler via `server.listen(3000, '127.0.0.1', done)`
- OS returns `EADDRINUSE` — the `'error'` event fires on the server
- `done(err)` is invoked — the `once` wrapper ensures only one invocation
- The original callback `() => { console.log(...) }` runs, ignoring the `err` argument
- `console.log('Server running at http://127.0.0.1:3000/')` prints (FALSE POSITIVE)
- No event-loop references remain (server never bound) — process exits with code 0
- `http://127.0.0.1:3000/` remains unreachable

### 0.3.2 Repository File Analysis Findings

| Tool Used | Command Executed | Finding | File:Line |
|-----------|-----------------|---------|-----------|
| read_file | `read_file server.js [1, -1]` | Hardcoded `const port = 3000` and `const hostname = '127.0.0.1'` with no env override | `server.js:3-4` |
| read_file | `read_file server.js [1, -1]` | Zero-arity callback in `app.listen()` ignores error argument | `server.js:22` |
| read_file | `read_file server.js [1, -1]` | Server reference from `app.listen()` not captured | `server.js:22` |
| bash | `node -e "console.log(require('express/package.json').version)"` | Express version 5.2.1 confirmed | `package.json:13` |
| bash | `cat node_modules/express/lib/application.js \| grep -n -A 15 "app.listen"` | Express 5.x registers `server.once('error', done)` on callback | `application.js:603` |
| read_file | `read_file __tests__/server.lifecycle.test.js [1, -1]` | EADDRINUSE test exists but validates raw `error` event on server, not callback behavior | `server.lifecycle.test.js:96-110` |
| read_file | `read_file __tests__/server.test.js [1, -1]` | 33 HTTP contract tests — all pass, no startup logic tested | `server.test.js:1-219` |
| bash | Reproduction script occupying port 3000 then spawning `node server.js` | Confirmed: exit code 0, misleading stdout, empty stderr, server unreachable | Runtime |

### 0.3.3 Fix Verification Analysis

**Steps followed to reproduce bug:**

- Ran `npm install` to restore all dependencies (Express 5.2.1, Jest 30.3.0, Supertest 7.2.2)
- Ran `npx jest --watchAll=false --ci` — all 42 tests pass (baseline confirmation)
- Occupied port 3000 with a `net.createServer()` blocker on `127.0.0.1`
- Spawned `node server.js` as a child process
- Observed: stdout = `Server running at http://127.0.0.1:3000/`, exit code = 0, stderr = empty
- Verified `http://127.0.0.1:3000/` was unreachable (only blocker was listening)

**Confirmation tests used to ensure that bug was fixed:**

- `__tests__/server.lifecycle.test.js` — validates `EADDRINUSE` error event emission on port collision (line 97–109)
- `__tests__/server.test.js` — validates all 33 HTTP contract behaviors remain unmodified
- Manual reproduction script that occupies port, runs `server.js`, and checks exit code + output

**Boundary conditions and edge cases covered:**

- Port 3000 available (normal startup — must still work)
- Port 3000 occupied by another process (EADDRINUSE — must log error and exit non-zero)
- `PORT` environment variable set to alternate value (override must bind to that port)
- Module imported (not run directly) — `require.main !== module`, no listen call triggered
- Server exports unchanged — `module.exports = app` still functional for Supertest

**Whether verification was successful, and confidence level:** Verification of bug reproduction: **successful, 99% confidence**. The bug is deterministic and 100% reproducible whenever port 3000 is occupied.

## 0.4 Bug Fix Specification

### 0.4.1 The Definitive Fix

**Files to modify:**

- `server.js` — lines 3–4 (port/host constants) and lines 21–25 (listen block)
- `__tests__/server.lifecycle.test.js` — add/update tests for error-handling callback behavior

**Current implementation at lines 3–4:**

```javascript
const hostname = '127.0.0.1';
const port = 3000;
```

**Required change at lines 3–4:**

```javascript
const hostname = process.env.HOST || '127.0.0.1';
const port = parseInt(process.env.PORT, 10) || 3000;
```

**Current implementation at lines 21–25:**

```javascript
if (require.main === module) {
  app.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
  });
}
```

**Required change at lines 21–25:**

```javascript
if (require.main === module) {
  const server = app.listen(port, hostname, (err) => {
    if (err) {
      // Express 5.x forwards listen errors (e.g. EADDRINUSE)
      // to the callback as the first argument
      console.error(`Failed to start server: ${err.message}`);
      process.exit(1);
    }
    console.log(`Server running at http://${hostname}:${port}/`);
  });
}
```

**This fixes the root cause by:**

- Accepting the `err` argument that Express 5.x passes to the callback on listen failure
- Checking `if (err)` before printing the success message — ensuring the log only appears on actual successful binding
- Calling `process.exit(1)` on error — providing a non-zero exit code that CI/CD pipelines, health checks, and Backprop validation can detect
- Logging `console.error(...)` with the actual error message — giving operators actionable diagnostic information
- Supporting `process.env.PORT` and `process.env.HOST` — enabling port override to avoid conflicts without source edits
- Storing the server reference in `const server` — enabling future extensibility for graceful shutdown

### 0.4.2 Change Instructions

**MODIFY line 3** from:
```javascript
const hostname = '127.0.0.1';
```
to:
```javascript
// Allow host override via environment variable; default to localhost-only binding
const hostname = process.env.HOST || '127.0.0.1';
```

**MODIFY line 4** from:
```javascript
const port = 3000;
```
to:
```javascript
// Allow port override via environment variable; default to 3000
const port = parseInt(process.env.PORT, 10) || 3000;
```

**MODIFY lines 21–25** from:
```javascript
if (require.main === module) {
  app.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
  });
}
```
to:
```javascript
if (require.main === module) {
  // Capture server reference for potential graceful shutdown
  const server = app.listen(port, hostname, (err) => {
    if (err) {
      // Express 5.x forwards listen errors (e.g. EADDRINUSE) to the callback
      // as the first argument — handle gracefully instead of printing false success
      console.error(`Failed to start server: ${err.message}`);
      process.exit(1);
    }
    console.log(`Server running at http://${hostname}:${port}/`);
  });
}
```

**Test file updates — `__tests__/server.lifecycle.test.js`:**

The existing `'Port conflict (EADDRINUSE)'` describe block (lines 96–110) tests error event emission on the raw server. This test remains valid and unchanged. An additional test should be added within this block to validate that when the callback pattern is used (mirroring server.js), the error is passed as the first argument to the callback — confirming Express 5.x behavior and the fix's correctness.

Additionally, the `'should emit the expected startup log message format'` test (lines 56–69) simulates the log message with hardcoded port 3000. This test must be reviewed to ensure compatibility with the environment-variable-driven port. The test's structure — which manually calls `console.log()` rather than testing the actual listen path — means it already works independently of the real port. It requires no modification since it validates the message format, not the actual binding.

### 0.4.3 Fix Validation

**Test command to verify fix:**

```bash
CI=true npx jest --watchAll=false --ci --verbose
```

**Expected output after fix:** All 42 existing tests pass, plus any new tests added for error-callback validation.

**Confirmation method:**

- Run the full 42-test suite — all must pass without regression
- Reproduce the EADDRINUSE scenario: occupy port 3000, run `node server.js`, confirm:
  - stderr contains `Failed to start server: listen EADDRINUSE: address already in use 127.0.0.1:3000`
  - stdout does NOT contain `Server running at`
  - Exit code is 1 (not 0)
- Test environment variable override: `PORT=4000 node server.js` — confirm server starts on port 4000
- Test normal startup: `node server.js` with port 3000 free — confirm `Server running at http://127.0.0.1:3000/` appears and server responds to HTTP requests

### 0.4.4 Edge Cases and Boundary Conditions

- **Non-numeric PORT value:** `parseInt(process.env.PORT, 10)` returns `NaN` for non-numeric strings; the `|| 3000` fallback correctly defaults to 3000
- **PORT=0:** `parseInt('0', 10)` returns `0`, which is falsy — the `|| 3000` fallback activates, binding to 3000. Port 0 (OS-assigned ephemeral) is not needed per requirements (localhost-only defaults preserved)
- **Negative PORT value:** `parseInt('-1', 10)` returns `-1`, which is truthy — Node.js will reject this with an appropriate error, caught by the `if (err)` handler
- **Empty PORT:** `parseInt('', 10)` returns `NaN` — falls through to default 3000
- **Callback invoked without error on success:** On successful bind, Express 5.x calls the callback with no arguments. `if (err)` evaluates to `if (undefined)` which is falsy — the success log prints correctly
- **require.main !== module (import path):** The entire listen block is guarded — no change in behavior when the module is imported by tests or other modules

## 0.5 Scope Boundaries

### 0.5.1 Changes Required (Exhaustive List)

| Action | File Path | Lines | Specific Change |
|--------|-----------|-------|-----------------|
| MODIFIED | `server.js` | 3 | Change `const hostname = '127.0.0.1'` to `const hostname = process.env.HOST \|\| '127.0.0.1'` with explanatory comment |
| MODIFIED | `server.js` | 4 | Change `const port = 3000` to `const port = parseInt(process.env.PORT, 10) \|\| 3000` with explanatory comment |
| MODIFIED | `server.js` | 21–25 | Replace the `app.listen()` block: capture server reference, accept `err` parameter in callback, add `if (err)` guard with `console.error` and `process.exit(1)`, retain success log on clean start |
| MODIFIED | `__tests__/server.lifecycle.test.js` | Within `Port conflict (EADDRINUSE)` block (96–110) | Add test validating that the Express 5.x `app.listen()` callback receives the error as its first argument during port collision |

**No other files require modification.**

### 0.5.2 Explicitly Excluded

**Do not modify:**

- `__tests__/server.test.js` — All 33 HTTP contract tests are route/response-level validations using Supertest. They test `GET /`, `GET /evening`, 404 behaviors, method restrictions, edge cases, and header suppression. None depend on startup logic. They must remain untouched.
- `package.json` — The dependency versions (`express@^5.2.1`, `jest@30.3.0`, `supertest@7.2.2`), scripts (`start`, `test`), metadata, and CommonJS `main` entry are all correct and unrelated to the bug.
- `jest.config.js` — Test environment (`node`), coverage directory, coverage collection targets, and test discovery patterns are correct.
- `README.md` — Documentation updates are outside the bug fix scope.
- `blitzy/` — Documentation-only folder, no runtime code.
- `package-lock.json` — No dependency changes required.

**Do not refactor:**

- Route handler implementations (lines 11–19 in `server.js`) — these work correctly and are not related to the startup bug
- The `app.disable('x-powered-by')` call (line 9) — header suppression is functional and unrelated
- The `module.exports = app` export (line 27) — the CommonJS export pattern must remain unchanged
- The `require.main === module` guard pattern (line 21) — this guard is correct; only the code inside it changes

**Do not add:**

- New npm dependencies or devDependencies
- GitHub Actions workflows or CI/CD configuration
- Graceful shutdown signal handlers (SIGTERM/SIGINT) — outside the minimal fix scope
- Port-finding/retry logic — the fix should fail fast with an actionable error, not auto-retry
- New route handlers or middleware

## 0.6 Verification Protocol

### 0.6.1 Bug Elimination Confirmation

**Execute the full test suite:**

```bash
CI=true npx jest --watchAll=false --ci --verbose
```

**Verify output matches:** All 42+ tests pass (42 existing + any new lifecycle tests).

**Confirm error no longer appears in:** The startup path. After the fix, running `node server.js` while port 3000 is occupied must:

- Print to stderr: `Failed to start server: listen EADDRINUSE: address already in use 127.0.0.1:3000`
- NOT print to stdout: `Server running at http://127.0.0.1:3000/`
- Exit with code 1 (non-zero)

**Validate functionality with manual integration test:**

```bash
node server.js &
curl -s http://127.0.0.1:3000/ && echo "Root OK"
curl -s http://127.0.0.1:3000/evening && echo "Evening OK"
kill %1
```

Expected: `Hello, World!` and `Good evening` responses with status 200.

### 0.6.2 Regression Check

**Run existing test suite:**

```bash
CI=true npx jest --watchAll=false --ci --verbose
```

**Verify unchanged behavior in:**

- `GET /` — returns 200 with `Hello, World!\n` and `text/plain` content type
- `GET /evening` — returns 200 with `Good evening` and `text/plain` content type
- 404 behavior for undefined routes (`/nonexistent`, `/foo/bar`, `/evening/extra`)
- 404 behavior for unsupported HTTP methods (POST, PUT, DELETE, PATCH on `/` and `/evening`)
- Edge cases: query parameters, case-insensitive routing, HEAD requests, trailing slashes, double slashes
- `X-Powered-By` header suppression across all response types
- Server lifecycle: start, bind to `127.0.0.1`, return valid address, shutdown, close event, EADDRINUSE error emission
- App export: `app` is defined, callable, not auto-listening on require

**Confirm performance metrics:**

```bash
CI=true npx jest --watchAll=false --ci --verbose 2>&1 | tail -5
```

Expected: Test suite completes in under 2 seconds (current baseline: ~0.6s). No open handles, no warnings.

**Environment variable override test:**

```bash
PORT=4567 node server.js &
curl -s http://127.0.0.1:4567/ && echo "Custom port OK"
kill %1
```

Expected: Server starts on port 4567, responds correctly, all routes functional.

## 0.7 Rules

### 0.7.1 User-Specified Rules

- **"exit code 137 test" rule:** Do not make any updates or changes in GitHub App to create or update a workflow. This rule is acknowledged and will be strictly followed — no GitHub Actions workflow files will be created or modified.

### 0.7.2 System Boundary Rules (from Problem Statement)

- Limit changes to startup/binding logic in `server.js` and related lifecycle tests only
- Do not modify route behavior, response bodies, headers, exports, API contracts, or test fixture simplicity
- Preserve the passing 42-test suite — all existing tests must continue to pass
- Preserve deterministic 200/404 semantics — route responses remain unchanged
- Preserve `X-Powered-By` suppression — `app.disable('x-powered-by')` untouched
- Preserve CommonJS module export pattern — `module.exports = app` untouched
- Preserve localhost-only execution defaults — default binding remains `127.0.0.1`

### 0.7.3 Development Standards Compliance

- **CommonJS convention:** The project uses `require`/`module.exports` (CommonJS). All changes and new test code must use CommonJS — no ES module syntax (`import`/`export`).
- **Strict mode in tests:** Both test files use `'use strict'`. Any new test code must include the `'use strict'` directive.
- **Express 5.x compatibility:** All code must be compatible with Express 5.2.1. The error-callback pattern `(err) => { ... }` is the Express 5.x-idiomatic way to handle listen errors.
- **Node.js 18+ compatibility:** The project requires Node.js >= 18 (per README.md). All code must use APIs available in Node.js 18 LTS.
- **Jest 30.3.0 conventions:** Tests use `describe`/`it`/`expect` with callback-style `done` parameter for async operations. New tests must follow this pattern.
- **Minimal change principle:** Make the exact specified change only. Zero modifications outside the bug fix scope. No cosmetic refactors, no opportunistic improvements.
- **Existing patterns preserved:** `console.log` for success messages, `console.error` for error messages — consistent with Node.js conventions and existing codebase style.

## 0.8 References

### 0.8.1 Repository Files Examined

| File Path | Purpose | Relevance |
|-----------|---------|-----------|
| `server.js` | Main application entry point — Express 5.x app with routes and listen block | **Primary bug location** — lines 3–4 (hardcoded port/host) and lines 21–25 (listen callback without error handling) |
| `package.json` | npm package manifest — defines dependencies, scripts, metadata | Confirmed Express `^5.2.1`, Jest `30.3.0`, Supertest `7.2.2`; `npm start` = `node server.js` |
| `package-lock.json` | Lockfile for deterministic installs | Confirmed exact dependency tree and integrity hashes |
| `jest.config.js` | Jest test runner configuration | Confirmed `testEnvironment: 'node'`, coverage on `server.js`, test discovery in `__tests__/` |
| `README.md` | Project documentation and onboarding guide | Confirmed Node.js >= 18 requirement, endpoint documentation, default URL |
| `__tests__/server.test.js` | HTTP contract test suite (33 tests) | Validated all route, status, header, and edge-case assertions — none depend on startup logic |
| `__tests__/server.lifecycle.test.js` | Server lifecycle test suite (9 tests) | Validated startup, shutdown, EADDRINUSE, and export tests — target for new error-callback test |
| `node_modules/express/lib/application.js` | Express 5.x `app.listen()` source implementation | Confirmed error-forwarding behavior at lines 598–606; `server.once('error', done)` is the root cause mechanism |
| `blitzy/` | Documentation subtree | Reviewed for context — planning and handoff records for the testing engagement |

### 0.8.2 External References

| Source | URL | Relevance |
|--------|-----|-----------|
| Express PR #2623 | `https://github.com/expressjs/express/pull/2623` | Original PR introducing listen error-to-callback forwarding in Express 5.x |
| Express Issue #6191 | `https://github.com/expressjs/express/issues/6191` | Community-reported behavioral difference between Express 4 and 5 on EADDRINUSE |
| Express Issue #6444 | `https://github.com/expressjs/express/issues/6444` | Confirms Express 5 invokes callback on error, Express 4 throws uncaught exception |
| Express 5 Migration Guide | `https://expressjs.com/en/guide/migrating-5.html` | Official Express 4→5 migration documentation |

### 0.8.3 Attachments

No external attachments (Figma URLs, design files, or supplementary documents) were provided for this task.

### 0.8.4 Search Queries Executed

| Query | Tool | Key Finding |
|-------|------|-------------|
| "Express 5 app.listen error callback EADDRINUSE" | web_search | Confirmed Express 5.x forwards errors to callback; Issue #6191 documents exact behavior |
| "Express 5.x app.listen signature change vs Express 4" | web_search | Confirmed PR #2623 introduced this change intentionally for Express 5.0; Express 4 throws uncaught exception |

### 0.8.5 Runtime Environment

| Component | Version |
|-----------|---------|
| Node.js | v20.20.1 |
| npm | 11.1.0 |
| Express | 5.2.1 |
| Jest | 30.3.0 |
| Supertest | 7.2.2 |
| OS | Linux (container) |

