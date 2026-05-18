# Technical Specification

# 0. Agent Action Plan

## 0.1 Intent Clarification

### 0.1.1 Core Testing Objective

Based on the provided requirements, the Blitzy platform understands that the testing objective is to **introduce a first-time automated test suite for the minimal Express.js 5.2.1 HTTP server defined in `server.js`** so that every observable behavior (the two registered GET routes, the Express default 404 handler, the `127.0.0.1:3000` loopback binding, and the single `console.log` startup message) is verified by deterministic, in-process, local tests — without altering any runtime behavior, adding CI/CD, introducing new middleware or routes, or migrating the project off CommonJS.

**Request Categorization:** This is an **[Add new tests]** engagement. The repository currently contains zero test files and a non-functional `npm test` placeholder (`echo "Error: no test specified" && exit 1`); there are no existing test suites to update, fix, or rescope. All test assets — test files, test configuration, dev dependencies, and an updated `test` script — are net-new additions.

The user's requirements translate into the following explicit testing requirements, restated with technical precision:

- **Route contract verification (F-002, F-003):** Prove via HTTP integration tests that `GET /` returns the byte-exact body `Hello, World!\n` (including the trailing `\n`) with HTTP 200, and that `GET /evening` returns the byte-exact body `Good evening` with HTTP 200.
- **Default 404 verification (F-005):** Prove that an unregistered route such as `GET /missing` returns an HTTP 404 response produced by Express's built-in final handler (no custom error middleware is to be introduced).
- **Startup configuration verification (F-001):** Prove that `app.listen()` is invoked with the port `3000` and hostname `127.0.0.1`, and that the startup log emitted on listen-callback is exactly `Server running at http://127.0.0.1:3000/`.
- **npm workflow verification:** Replace the placeholder `npm test` script so that `npm test` exits `0` when the test suite passes, without introducing any production-behavior changes to `npm start`.
- **Coverage quality:** Achieve 100% coverage of the observable HTTP behavior (both routes plus 404) and ≥ 90% practical statement/line coverage of `server.js`.

**Implicit testing needs surfaced from the requirements:**

- **Content-Type / Content-Length assertions (implicit):** Express's `res.send(string)` sets `Content-Type: text/html; charset=utf-8` by default for string payloads, and the `ETag` header is also emitted by default. Tests must assert the exact body and status but should avoid over-constraining content-type/encoding headers in ways that would trigger false failures against Express 5.2.1 defaults.
- **Exact-byte response assertions (implicit):** Because the user explicitly requires the trailing newline on `Hello, World!\n`, assertions must use strict equality on `response.text` rather than partial matchers such as `toContain`, to ensure a missing or added newline would fail the test.
- **Testability of `app.listen()` without binding a real port (implicit):** To avoid port conflicts on developer machines or parallel test runs, Supertest must be invoked against the Express `app` instance directly (Supertest auto-binds to an ephemeral port) rather than against `http://127.0.0.1:3000`. The `app.listen()` call in `server.js` must be guarded so it does not execute when `server.js` is `require`d by a test file.
- **Verifiability of the startup `console.log` message (implicit):** Because the listen callback is only invoked by an actual `app.listen()` call, either a `console.log` spy plus an invocation of the listen callback, or a mocked `app.listen` that captures the callback, is required to cover lines 15–16 of `server.js`.
- **Test isolation from the `127.0.0.1:3000` production bind (implicit):** No test must ever bind a listener on `127.0.0.1:3000`, as doing so would race against a developer-running `npm start` and cause `EADDRINUSE` on parallel runs.
- **Deterministic, repeatable runs (implicit):** No network, no filesystem writes outside of Jest's coverage output folder, no timers — so the suite is safe for repeated local execution and does not flake.

### 0.1.2 Special Instructions and Constraints

The following directives are captured verbatim from the user's **MINIMAL CHANGE CLAUSE & TESTING DISCIPLINE GUIDELINES** and elsewhere in the request, and are treated as hard constraints on the Blitzy platform's output:

- **User Directive (verbatim):** "IMPORTANT: Make only the changes that are absolutely necessary to implement comprehensive testing coverage."
- **User Directive (verbatim):** "Focus specifically on adding test files and minimal test infrastructure without modifying production code unless required for testability."
- **User Directive (verbatim):** "Add only minimal dev dependencies"
- **User Directive (verbatim):** "Do not add runtime dependencies unless absolutely necessary"
- **User Directive (verbatim):** "Do not refactor `server.js` unless required for safe testing"
- **User Directive (verbatim):** "Do not change endpoint behavior"
- **User Directive (verbatim):** "Do not add middleware or new routes"
- **User Directive (verbatim):** "Do not add CI/CD, Docker, TypeScript, ESM, auth, database, or deployment config"
- **User Directive (verbatim):** "Keep all test code isolated in dedicated test files"
- **User Directive (verbatim):** "If production code must change for testability, keep it minimal and preserve all existing behavior"
- **User Directive (verbatim):** "Prefer real in-process HTTP tests. Mock only when necessary to: avoid binding a real port; inspect `app.listen`; capture `console.log`"
- **User Directive (verbatim):** "Use inline static expectations. No fixture system is needed."
- **User Directive (verbatim):** "Use async/await with Supertest. Avoid real network timing unless absolutely necessary."
- **User Directive (verbatim):** "Do not add CI/CD workflows. No `.github/workflows` changes should be introduced."
- **User Rule (from project configuration):** "Do not make any updates or changes in GitHub App to create or update a workflow." (implementation rule named "exit code 137 test")

**User-provided examples preserved verbatim** (referenced as labeled examples in later sub-sections):

- **User Example (file layout):** `tests/server.test.js` or `__tests__/server.test.js`
- **User Example (optional file):** `tests/startup.test.js` only if startup behavior is tested separately
- **User Example (framework choice):** "`jest` or `vitest`"
- **User Example (HTTP library):** "`supertest` for Express HTTP tests"
- **User Example (coverage tool):** "built-in coverage or `c8`/`nyc` if needed"
- **User Example (acceptance criteria):** "run `npm test`; run coverage if added; intentionally change response strings/statuses to confirm tests fail; confirm no CI/CD, middleware, or production-hardening changes were introduced"

**Web-search / research requirements:** The Blitzy platform performed web research to confirm the current-stable, CommonJS-compatible versions of the testing stack on Node.js v20+. The results (see Section 0.3.2) are embedded directly in the Dependency Inventory and the transformation map; no further research is pending.

### 0.1.3 Technical Interpretation

These testing requirements translate to the following technical test-implementation strategy, driven by the Jest + Supertest + built-in coverage combination that the user called out as one of the two acceptable options:

- **To verify `GET /` and `GET /evening` contracts,** we will **create** `tests/server.test.js` containing a Jest `describe` block per endpoint that imports the Express `app` instance from `server.js` and uses `supertest(app)` to issue HTTP GET requests, asserting `response.status === 200` and strict equality on `response.text` against the exact expected body (including the `\n` on `Hello, World!\n`).
- **To verify Express's default 404 contract,** we will **create** an additional `describe` block in `tests/server.test.js` that issues `GET /missing` (and representative negative paths) via Supertest and asserts `response.status === 404`.
- **To verify the startup configuration and log message,** we will **create** `tests/startup.test.js` that uses Jest's `jest.spyOn` on `console.log` and `jest.spyOn(app, 'listen')` (or a mocked Express module) to capture the arguments passed to `app.listen` (port, hostname, callback), invoke the captured callback synchronously, and assert the exact arguments (`3000`, `'127.0.0.1'`) and log output (`Server running at http://127.0.0.1:3000/`). No real listener is opened.
- **To make `server.js` safely `require`-able from tests without starting a real listener,** we will **update** `server.js` with the **minimum** change of (a) adding `module.exports = app` at the bottom and (b) guarding the `app.listen(...)` call with `if (require.main === module)` so the module only auto-listens when executed via `node server.js` (i.e., the existing `npm start` path). This preserves `npm start`, the hardcoded `127.0.0.1:3000` binding, the exact startup log, the CommonJS style, and all observable behavior.
- **To replace the placeholder `npm test` script,** we will **update** `package.json` by (a) replacing `"test": "echo \"Error: no test specified\" && exit 1"` with `"test": "jest"`, (b) adding an optional `"test:coverage": "jest --coverage"` script, and (c) declaring `jest` and `supertest` under `devDependencies` with pinned caret versions. No runtime dependencies are added.
- **To document the new workflow for developers,** we will **update** `README.md` with a minimal "Testing" section showing `npm test` and `npm run test:coverage` — strictly local-developer-friendly, no CI/CD guidance.

### 0.1.4 Coverage Requirements Interpretation

The user explicitly stated: **Target 100% coverage of observable HTTP behavior and at least 90% practical coverage of `server.js`.** The Blitzy platform interprets these two targets as the binding quality criteria for implementation completeness:

- **100% observable HTTP behavior coverage** means every branch of the request/response surface described in Sections 1.3.1 and 2.1 of this specification is exercised by an assertion-bearing test: `GET /` (F-002), `GET /evening` (F-003), and unmatched-route 404 (F-005). Tests must also include content assertions (body + status) rather than status-only assertions.
- **≥ 90% practical coverage of `server.js`** means the Jest coverage report (statements/branches/functions/lines, as measured by Jest's built-in V8 coverage) must report ≥ 90% for `server.js`. Given the 17-line file, this target is achievable at 100% by exercising the route handlers via Supertest and by invoking the captured `app.listen` callback in the startup test; the 90% floor exists to tolerate a single line variance if the guarded `require.main === module` branch proves non-trivially measurable under the chosen coverage tool.

Implicit coverage expectations layered on top of the user's explicit targets:

- **Industry standard for Express.js services** (per §6.6.6.2 of this specification, which recommends a ≥ 80% quality gate) is comfortably exceeded by the ≥ 90% target.
- **Existing coverage patterns in the repository:** None exist (the coverage baseline is 0%, see §6.6.4.4). Every percentage point achieved is net-new.
- **Critical path analysis:** Every line in `server.js` is on a critical path because the file is 17 lines, single-purpose, and entirely composed of initialization + route handlers + the listen call. There are no non-critical utility functions to deprioritize.

To achieve comprehensive testing, coverage must include:

- Both synchronous route handlers, exercised end-to-end through the Express router via Supertest (not by calling the handler function directly, to avoid bypassing Express's dispatch).
- The default 404 path, exercised through Supertest against an unregistered URL.
- The `app.listen()` call site with its callback body, exercised by a controlled invocation in the startup test with `console.log` spied.
- The `module.exports = app` line added during the minimal testability refactor, exercised implicitly by every test file that `require`s the module.

## 0.2 Test Discovery and Analysis

### 0.2.1 Existing Test Infrastructure Assessment

A systematic repository scan was performed using `get_source_folder_contents`, `read_file`, and direct shell inspection of the repository root (`package.json`, `package-lock.json`, `server.js`, `README.md`, and the `blitzy/documentation/` subtree). The scan confirms — in complete alignment with §6.6.1 "Non-Applicability Determination" of this specification — that **no automated test infrastructure of any kind exists today**. The table below consolidates the evidence.

| Search Pattern | Locations Inspected | Result | Evidence |
|---|---|---|---|
| `*.test.js`, `*.spec.js` | Repository root and all subdirectories | **None found** | Only `server.js`, `package.json`, `package-lock.json`, `README.md` + `blitzy/documentation/*` exist |
| `test_*.js`, `spec_*.js` | Repository root and all subdirectories | **None found** | No files matching these patterns |
| `tests/`, `test/`, `__tests__/`, `spec/` directories | Repository root | **None found** | Only `blitzy/` directory besides the 4 root files |
| Jest config (`jest.config.js/ts/mjs/cjs`, `jest.config.json`, `jest` key in `package.json`) | Repository root, `package.json` | **None found** | `package.json` has only `dependencies` + 2 scripts; no `jest` config block |
| Mocha config (`.mocharc.*`) | Repository root | **None found** | — |
| Vitest config (`vitest.config.*`) | Repository root | **None found** | — |
| AVA / Tape / Jasmine configs | Repository root | **None found** | — |
| Coverage config (`.nycrc`, `.c8rc`, `nyc` key) | Repository root | **None found** | — |
| ESLint / Prettier configs | Repository root | **None found** | Consistent with §3.7.5 inventory |
| Testing devDependencies in `package.json` | `package.json` | **None found** | Only `"dependencies": { "express": "^5.2.1" }` — no `devDependencies` block |
| Testing packages in transitive tree | `package-lock.json` | **None resolved** | Transitive set contains only Express + its 65 supporting packages (body-parser, router, etc.) — no `jest`, `supertest`, `mocha`, `chai`, `sinon`, `nyc`, `c8` |
| `npm test` behavior | `package.json` scripts | **Placeholder** | `"test": "echo \"Error: no test specified\" && exit 1"` — exits non-zero |

**Test-infrastructure findings, summarized:** Repository analysis reveals **no current testing framework is installed** — the testing framework to be introduced, its runner configuration location, its coverage tool, its mocking library, and its fixtures/factories do not yet exist. The table below fills in each slot with the target state after this engagement:

| Dimension | Current State | Target State (this engagement) |
|---|---|---|
| Testing framework | None | Jest (single tool covers runner + assertion library + mocking + coverage) |
| Testing framework version | N/A | `^29.7.0` (see Section 0.3.2 for rationale) |
| Test runner configuration location | N/A | `jest` key embedded in `package.json` (preferred — zero additional files) |
| Coverage tool | None | Jest's built-in V8-based coverage (`--coverage`), no separate `nyc`/`c8` dependency |
| Mock / stub library | None | Jest built-ins (`jest.fn`, `jest.spyOn`, `jest.mock`) — no `sinon` |
| HTTP integration library | None | `supertest` `^7.1.4` (see Section 0.3.2) |
| Fixtures / factories | None | Inline literal expectations per user directive ("Use inline static expectations. No fixture system is needed.") |
| Test data management | None | N/A — server returns hardcoded static strings only |

**Production source surface to be tested** (from `read_file` on `server.js`):

```javascript
const express = require('express');
const app = express();
```

```javascript
app.get('/', (req, res) => { res.send('Hello, World!\n'); });
app.get('/evening', (req, res) => { res.send('Good evening'); });
```

```javascript
app.listen(port, hostname, () => { console.log(`Server running at http://${hostname}:${port}/`); });
```

The 17-line `server.js` file at the repository root has three testable concerns: two GET route handlers (lines 7–9, 11–13), the `app.listen()` invocation with its logging callback (lines 15–17), and the implicit Express default 404 handler (framework default, no code in `server.js`). These are the exact test targets enumerated in Section 0.1.1.

### 0.2.2 Web Search Research Conducted

Web research was performed to confirm the current-stable versions of each testing-stack package on Node.js v20+ with CommonJS, and to validate the standard Express 5.x + Supertest pattern. The findings below drive the version pins in Section 0.6.1 and the test authoring patterns in Section 0.4.

| Research Topic | Finding | Impact on Plan |
|---|---|---|
| Jest compatibility with Node.js v20+ and CommonJS | Jest 29.7.0 supports Node 14.15, 16.10, 18.0+ and is battle-tested on Node 20. Jest 30.x (released June 2025) requires Node 18+ and drops Node 14/16/19/21; it supports CommonJS cleanly. Either 29.7.0 or 30.x is compatible with this project's Node 20.x+ / CommonJS constraint. | The plan pins `jest` to `^29.7.0` for maximum ecosystem stability, Node-version headroom, and reproducibility (29.7.0 has been stable since September 2023 and is the most widely deployed major release). Jest 30 is acceptable and preserved as the documented alternative; no breaking behavior differences for this use case. |
| Supertest latest stable on Node 20+ | Supertest 7.x (latest 7.2.2 as of 2026) is the current major, with 7.1.4 being a widely-adopted pin. It accepts an Express `app` instance and auto-binds an ephemeral listener, which is the recommended pattern for in-process integration tests. | The plan pins `supertest` to `^7.1.4` (a stable release after the Express 5.x compatibility fixes) and passes the imported `app` directly — no `app.listen(3000)` inside tests. This matches the user directive "Prefer real in-process HTTP tests" and "avoid binding a real port". |
| Express 5.2.1 + Supertest compatibility | Supertest 7.x is compatible with Express 5.2.1; no additional adapters or shims are required. The request/response interface `.expect(status).expect('Content-Type', ...)` and the body access pattern `response.text` / `response.body` remain identical to Express 4 usage. | Tests may use either `.expect(200)` fluent assertions or `expect(response.status).toBe(200)` Jest assertions. The plan standardizes on Jest `expect` assertions for consistency with the rest of the suite. |
| Recommended strategy to reach full coverage on an Express `app.listen()` entry file | Community best practice (widely confirmed across multiple 2024–2026 Express + Jest tutorials) is to (a) separate `module.exports = app` from the `app.listen()` call, OR (b) guard the `app.listen()` call with `if (require.main === module)` so the listen is skipped when the module is `require`d by a test. Pattern (b) requires only 2 added lines and preserves `npm start` byte-for-byte. | The plan adopts pattern (b) — the minimal-change variant — in line with the user directive "Do not refactor `server.js` unless required for safe testing" and "If production code must change for testability, keep it minimal and preserve all existing behavior." |
| Recommended approach to test the `app.listen()` arguments and the startup log | Mock `app.listen` (or spy on it) to capture the `(port, hostname, callback)` arguments, then invoke the captured callback synchronously inside the test and assert on `console.log`. This avoids opening any real port and keeps the test deterministic. | This pattern is embedded directly in Section 0.4.2's "Startup test blueprint". The startup test never opens a real listener; Supertest handles the ephemeral-port listen for route tests only. |
| Test organization conventions for Node/Express/Jest CommonJS projects | Convention: a top-level `tests/` (or `__tests__/`) directory containing `*.test.js` files, with Jest's default `testMatch` recognizing both patterns. Jest config commonly embedded in `package.json` under the `jest` key for single-file projects. | The plan uses `tests/server.test.js` and `tests/startup.test.js` (per the user's example) and embeds the `jest` key in `package.json` — zero additional configuration files beyond dependency and script updates. |
| Common pitfalls with Jest + Supertest on Express apps | (1) Calling `app.listen(3000)` at module load time causes `EADDRINUSE` on parallel/watch runs; fixed by the `require.main === module` guard. (2) Not using `async/await` with Supertest leads to unhandled-promise warnings; fixed by awaiting every Supertest call. (3) Over-asserting on Content-Type creates brittle tests against Express defaults; fixed by asserting only on body + status for the two GET contracts. (4) Leaving open handles (e.g., never-closed servers) causes Jest to hang; mitigated because Supertest closes its ephemeral listener and the startup test never opens one. | All four pitfalls are pre-emptively addressed by the test-authoring conventions in Section 0.4.3 and the scope boundaries in Section 0.8. |

**Summary of research conclusion:** The Jest + Supertest + built-in coverage stack, at the version pins documented in Section 0.6.1, is the lowest-risk, minimum-dependency-count, CommonJS-native solution that meets the user's "minimal dev dependencies" directive and the 100%-observable-HTTP / ≥ 90%-`server.js` coverage targets.

## 0.3 Testing Scope Analysis

### 0.3.1 Test Target Identification

The testing scope is bounded by `server.js` — the single runtime source file — and by the five features enumerated in §2.1 of this specification (F-001 through F-005). The table below enumerates every code element that must be covered by at least one test, cross-referenced to its feature ID, source file line range, and the test category required.

**Primary code to be tested**

- **Module / Application:** The Express.js 5.2.1 application defined in `server.js` at the repository root. No sub-modules, classes, or helper functions exist; the entire testable surface is 17 lines of procedural CommonJS bootstrap + route registration + `app.listen()`.

- **Functions:** Three function-call sites in `server.js`, each mapped to its required test categories:

| Function / Call Site | Source File:Lines | Feature | Required Test Categories |
|---|---|---|---|
| `require('express')` + `express()` | `server.js:1–2` | F-001 | Module-load smoke (covered implicitly by any test that requires `server.js`) |
| Route handler for `GET /` | `server.js:7–9` | F-002 | Happy path: 200 + exact body `Hello, World!\n`; implicit content-type not over-asserted |
| Route handler for `GET /evening` | `server.js:11–13` | F-003 | Happy path: 200 + exact body `Good evening`; implicit content-type not over-asserted |
| Default 404 (Express framework default, no code in `server.js`) | N/A (framework) | F-005 | Negative path: `GET /missing` → 404 |
| `app.listen(port, hostname, callback)` | `server.js:15–17` | F-001 | Startup configuration: args `= (3000, '127.0.0.1', <callback>)`; callback emits exact log `Server running at http://127.0.0.1:3000/` |
| `console.log(...)` inside listen callback | `server.js:16` | F-001 | Log-content verification via `jest.spyOn(console, 'log')` |

**Existing test file mapping**

The table below maps every source file to its existing test file, confirming the full-greenfield nature of this engagement (no pre-existing test categories exist anywhere for any file):

| Source File | Existing Test File | Test Categories Present |
|---|---|---|
| `server.js` | **None** | **None** — no unit, integration, contract, or smoke tests |
| `package.json` | N/A (manifest, not testable code) | — |
| `package-lock.json` | N/A (lockfile, not testable code) | — |
| `README.md` | N/A (documentation, not testable code) | — |

Because no existing test files exist, there are no pre-existing mocking patterns, test helpers, or fixture files to reuse. Every test artifact is net-new under this engagement.

**Dependencies requiring mocking or stubbing**

Per the user directive "Prefer real in-process HTTP tests. Mock only when necessary," mocking is kept to the minimum required to avoid port binding, to inspect `app.listen`, and to capture `console.log`. The table below is exhaustive — nothing beyond these three spies/mocks is justified:

| Mock / Stub Target | Technique | Purpose | Test File |
|---|---|---|---|
| `console.log` | `jest.spyOn(console, 'log').mockImplementation(() => {})` | Capture the startup-log string for exact-match assertion without polluting test stdout | `tests/startup.test.js` |
| `app.listen` (or the `express()`-returned `app` object's `listen` method) | `jest.spyOn(app, 'listen').mockImplementation((port, hostname, cb) => { capturedArgs = { port, hostname, cb }; return { close: jest.fn() }; })` | Capture the arguments passed to `app.listen` and obtain a reference to the callback for manual invocation — without opening a real TCP listener | `tests/startup.test.js` |
| External services | **None** | The app makes no external calls (no DB, no HTTP fetches, no filesystem I/O, no environment variables, no third-party APIs — per §1.3.2 and §3.5 of this specification) | — |
| Database interactions | **None** | No database exists (§3.6) | — |
| File system operations | **None** | Neither route handler nor the listen call touches the filesystem | — |

The Supertest library is **not** a mock; it is a real HTTP client that drives the real Express router over an ephemeral localhost socket bound by Supertest itself.

### 0.3.2 Version Compatibility Research

The table below consolidates the verified, compatible versions of every testing-stack package the plan introduces. Each pin was confirmed via npm registry lookups and Jest/Supertest release notes (see Section 0.2.2 for the research narrative). **No `latest` or `1.0.0` placeholder versions appear anywhere in this plan.**

Based on current Node.js v20.20.2 / npm v11.x runtime (per §3.4) and the CommonJS module system constraint (C-003), the recommended testing stack is:

| Role | Package (npm) | Pinned Version | Compatibility Rationale |
|---|---|---|---|
| Test runner + assertion + mocking + coverage | `jest` | `^29.7.0` | Jest 29.x supports Node ≥ 14.15 / 16.10 / 18.0; 29.7.0 is the widely-deployed stable release used across the Express + Node.js ecosystem in 2024–2026. Built-in `expect` assertions, `jest.fn/spyOn/mock`, and `--coverage` (V8 / Istanbul) eliminate the need for Chai, Sinon, and c8/nyc. Jest 30.x (≥ Node 18) is an accepted newer alternative and would require no code changes; 29.7.0 is chosen for maximum headroom and ecosystem parity. |
| HTTP integration driver | `supertest` | `^7.1.4` | Supertest 7.x is the current major line (7.2.2 latest at time of writing), compatible with Express 5.2.1. Accepts an `express()` `app` instance directly, binds an ephemeral port automatically, and exposes `response.text` / `response.body` / `response.status` for assertions. Dropping Node 14/16 in its test matrix means it is aligned with the Node 20+ baseline of this project. |
| Assertion library | — | (bundled) | Jest's built-in `expect` covers all required assertions (strict-equality on body text, numeric equality on status codes, exact-args matching on spy calls). **No separate assertion library (Chai, expect.js, should.js) is introduced.** |
| Mocking library | — | (bundled) | Jest's built-in `jest.fn`, `jest.spyOn`, and `jest.mock` are sufficient for the two spies enumerated in Section 0.3.1. **No separate mocking library (Sinon, testdouble) is introduced.** |
| Coverage tool | — | (bundled) | Jest's `--coverage` flag emits statement/branch/function/line coverage via its built-in V8 / Istanbul engine, writing to `coverage/` by default. **No separate coverage tool (`nyc`, `c8`) is introduced unless the user later requests it.** |

**Version-conflict resolution status:** The plan introduces two dev-only packages — `jest@^29.7.0` and `supertest@^7.1.4` — whose peer dependencies are fully self-contained (they ship their own supporting packages under the `@jest/*` and `superagent` namespaces). No conflicts exist with the single production dependency, `express@^5.2.1`. The 66-package production dependency tree remains untouched; the new test dependencies resolve into the `devDependencies` subtree only. `npm audit` on the resulting tree is expected to continue reporting 0 vulnerabilities in production dependencies (consistent with §5.4.1 of this specification).

## 0.4 Test Implementation Design

### 0.4.1 Test Strategy Selection

Given the 17-line, single-process, stateless, loopback-only surface of `server.js`, the plan adopts a tight, two-layer test strategy that deliberately omits layers that would be unjustified for this project's scope (no unit tests for pure functions — there are none; no end-to-end browser tests — there is no UI; no load tests — out of scope per user instruction).

- **HTTP integration tests (primary layer) — `tests/server.test.js`:** Cover every observable HTTP contract by driving the Express router via Supertest against the imported `app` instance. Tests run fully in-process with an ephemeral, Supertest-managed listener; no real binding to `127.0.0.1:3000` occurs. This layer verifies F-002, F-003, and F-005.
- **Lightweight startup / configuration tests (secondary layer) — `tests/startup.test.js`:** Cover the `app.listen(port, hostname, callback)` invocation and the `console.log(...)` inside the listen callback by spying on `console.log` and on `app.listen`, capturing the arguments, invoking the callback synchronously, and asserting exact values. No real port is opened. This layer verifies F-001's configuration and logging acceptance criteria.
- **Edge-case tests (folded into primary layer):** Boundary conditions — specifically the presence of the trailing newline on `Hello, World!\n` and the absence of any newline on `Good evening` — are asserted inline in `tests/server.test.js`. A dedicated edge-case test file is unnecessary given the trivially small surface.
- **Error-handling tests (folded into primary layer):** The single error-handling behavior (Express default 404 for unmatched routes) is a single test case in `tests/server.test.js`.
- **Performance-boundary tests:** Not applicable — performance testing is explicitly excluded by the user, and §5.4.4 of this specification confirms no SLAs are defined.

### 0.4.2 Test Case Blueprint

The two blueprints below enumerate every test case to be implemented. Each blueprint is sized to be exhaustive for its component — there is no "to-be-discovered" residual scope.

Component: server.js — HTTP route surface (tests/server.test.js)
---
Test Categories:
- Happy path — GET /:
  - Returns HTTP status 200
  - Returns response.text === 'Hello, World!\n' (strict equality, including trailing \n)
- Happy path — GET /evening:
  - Returns HTTP status 200
  - Returns response.text === 'Good evening' (strict equality, no trailing newline)
- Edge cases:
  - GET / response.text length === 14 bytes (Hello, World!\n)
  - GET /evening response.text length === 12 bytes
- Error cases:
  - GET /missing returns HTTP status 404 (Express default 404 handler)
  - (Optional) GET / with trailing path suffix (e.g., /extra) returns HTTP 404

Component: server.js — startup / configuration (tests/startup.test.js)
---
Test Categories:
- Happy path — app.listen invocation:
  - app.listen called exactly once
  - Called with port === 3000
  - Called with hostname === '127.0.0.1'
  - Called with a function as the third argument (the callback)
- Happy path — startup log:
  - When the captured callback is invoked, console.log is called exactly once
  - console.log is called with the exact string 'Server running at http://127.0.0.1:3000/'
- Error cases:
  - (Not applicable — no error branches exist in the 3-line listen block)
- Performance boundaries:
  - (Not applicable)

### 0.4.3 Existing Test Extension Strategy

Because **no existing test files exist**, the standard categories "tests to extend," "tests to refactor," and "tests to fix" do not apply to this engagement. The table below records this explicitly to prevent ambiguity:

| Category | Applicability | Action |
|---|---|---|
| Tests to extend (add cases to an existing file) | **Not applicable** | Every test file is net-new; nothing exists to extend. |
| Tests to refactor (update to a modern assertion style) | **Not applicable** | No legacy assertion styles exist. |
| Tests to fix (repair broken tests) | **Not applicable** | There are no tests — broken or otherwise. The only pre-existing test-related artifact is the `npm test` placeholder script that exits with an error; replacing that script is a `package.json` update, not a test fix. |

### 0.4.4 Test Data and Fixtures Design

Per the user directive "Use inline static expectations. No fixture system is needed," the plan uses **zero fixture files, zero factory objects, and zero shared test-data modules**. Every expected value is a literal string embedded directly in the `expect(...)` call. The table below confirms each dimension:

| Dimension | Approach |
|---|---|
| Required test data structures | None. Tests assert against literal strings (`'Hello, World!\n'`, `'Good evening'`, `'Server running at http://127.0.0.1:3000/'`), numeric literal status codes (`200`, `404`), and literal port/hostname values (`3000`, `'127.0.0.1'`). |
| Fixture organization strategy | **No fixtures.** No `tests/fixtures/`, `tests/factories/`, or `tests/data/` directories are created. |
| Mock object specifications | Two spies, declared inline in `tests/startup.test.js`:<br>• `jest.spyOn(console, 'log').mockImplementation(() => {})`<br>• `jest.spyOn(app, 'listen').mockImplementation((port, hostname, cb) => { /* capture port, hostname, cb; return fake server with a close method */ })` |
| Test database / state management | **Not applicable.** The system is fully stateless (confirmed by §6.6.3.3 of this specification). No `beforeAll`/`afterAll` hooks are needed for state setup or teardown. Each test is independent. |
| Test isolation mechanism | Each test uses `beforeEach` / `afterEach` (where spies are present) to call `jest.restoreAllMocks()` and reset captured state. No global mutable fixtures are shared across tests. |

**Canonical test-authoring conventions (applied to all test files):**

- Use CommonJS `require()` to import `supertest` and `../server` (matches the project's CommonJS constraint C-003).
- Use `async` / `await` when invoking Supertest (per user directive).
- Use strict equality assertions on `response.text` and `response.status`; avoid `.toContain`, `.toMatch`, and partial matchers.
- Never call `app.listen(3000, ...)` from inside a test file; rely on Supertest's ephemeral-port binding for integration tests and on `jest.spyOn(app, 'listen')` for startup tests.
- Each `describe` block corresponds to one feature ID (F-002, F-003, F-005, F-001) for traceability.
- Each `it`/`test` description is a concise assertion narrative (e.g., `it('responds with HTTP 200 and exact "Hello, World!\\n" body', ...)`).

## 0.5 Test File Transformation Mapping

### 0.5.1 File-by-File Test Plan

The table below is the **complete, exhaustive** list of every file that must be created, updated, deleted, or referenced to execute this engagement. The target file appears first in each row; the transformation mode and the source/reference file appear second and third. **No test file is left as "pending" or "to be discovered"** — the project's minuscule 4-file repository and single-source-file surface make the scope fully enumerable.

| Target Test File | Transformation | Source File / Test | Purpose / Changes |
|---|---|---|---|
| `tests/server.test.js` | **CREATE** | `server.js` (repository root) | Create the primary HTTP integration-test suite. Import the Express `app` via `require('../server')`, drive requests through `supertest(app)`, and assert exact body + status for `GET /` (F-002), `GET /evening` (F-003), and `GET /missing` (F-005). Uses `async`/`await` per user directive. |
| `tests/startup.test.js` | **CREATE** | `server.js` (repository root) | Create the secondary startup-configuration test suite. Spy on `console.log` and on the Express `app`'s `listen` method before requiring `server.js`; after requiring, assert that `app.listen` was called with `(3000, '127.0.0.1', <callback>)` and that invoking the captured callback produces `console.log('Server running at http://127.0.0.1:3000/')`. Never opens a real listener. |
| `server.js` | **UPDATE** | `server.js` (repository root) | Apply the absolute minimum change required for safe testing: (1) append `module.exports = app;` at the end of the file and (2) wrap the `app.listen(port, hostname, () => { ... });` call in `if (require.main === module) { ... }`. These two edits preserve every observable behavior: `npm start` still invokes `node server.js` which still binds to `127.0.0.1:3000` and still emits the exact startup log; tests that `require('../server')` receive the `app` without side-effect listening. No route logic, no strings, no hostnames, no ports, no logging text, and no dependency imports are modified. |
| `package.json` | **UPDATE** | `package.json` (repository root) | (1) Add `"devDependencies": { "jest": "^29.7.0", "supertest": "^7.1.4" }`. (2) Replace the `test` script from `"echo \"Error: no test specified\" && exit 1"` to `"jest"`. (3) Add `"test:coverage": "jest --coverage"`. (4) Add the `"jest"` configuration key: `{ "testEnvironment": "node", "testMatch": ["**/tests/**/*.test.js"], "collectCoverageFrom": ["server.js"], "coverageThreshold": { "global": { "statements": 90, "branches": 90, "functions": 90, "lines": 90 } } }`. No changes to `name`, `version`, `description`, `main`, `dependencies.express`, `author`, `license`, or the `start` script. |
| `package-lock.json` | **UPDATE** | `package-lock.json` (repository root) | Automatic regeneration by `npm install` after the two new `devDependencies` are declared. No manual edits. The lockfile version (`3`) is preserved; only the `packages` object grows to include the Jest and Supertest resolved subtrees. |
| `README.md` | **UPDATE** | `README.md` (repository root) | Append a minimal "Testing" section documenting `npm test` (run the full suite) and `npm run test:coverage` (run with coverage). No CI/CD instructions, no badge insertions, no architecture prose. Length: ≤ 15 additional lines. |
| `server.js` (as a reference for test patterns) | **REFERENCE** | — | The existing `server.js` is also used **as a reference** for deriving the exact response bodies, status codes, port, hostname, and log string embedded literally in the tests. Line-range anchors: routes at `server.js:7–9` and `server.js:11–13`; listen at `server.js:15–17`. |

**Wildcard patterns applied where useful:**

- `tests/**/*.test.js` — Jest's `testMatch` glob, used in `package.json` configuration to auto-discover all current and future test files under `tests/`.
- `coverage/**` — Generated coverage artifacts (written by Jest) that should be ignored by any subsequent tooling; not created directly, emitted as a side-effect of `jest --coverage`.

**Files explicitly out of scope for this transformation** (listed to prevent accidental inclusion):

- Any file under `.github/workflows/` — prohibited by C-002 and by the user's implementation rule "exit code 137 test".
- Any `Dockerfile` / `docker-compose.yml` — out of scope.
- Any `tsconfig.json` / `.eslintrc.*` / `.prettierrc` — out of scope.
- Any `blitzy/documentation/*.md` — these are governance/handoff artifacts, not test artifacts; they are not touched by this engagement.

### 0.5.2 New Test Files Detail

**`tests/server.test.js` — HTTP integration test suite**

- **Test categories:** Happy path for both GET routes, edge case for exact response-body length, error case for the Express default 404.
- **Mock dependencies:** None in this file. The test drives the real Express router via Supertest against the real `app` instance exported from `server.js`. No `app.listen` spy, no `console.log` spy.
- **Assertions focus:** Strict equality on `response.text` (including the trailing `\n` on `Hello, World!\n`); strict equality on `response.status` (`200` for the two routes, `404` for the unmatched route).
- **Structure:** One top-level `describe('server.js HTTP contracts', ...)` block containing three nested `describe` blocks — `describe('GET /', ...)`, `describe('GET /evening', ...)`, and `describe('unknown routes', ...)` — each with 1–2 `it` tests.
- **Imports (CommonJS):**

```javascript
const request = require('supertest');
const app = require('../server');
```

**`tests/startup.test.js` — Startup configuration and log test suite**

- **Test categories:** Happy path for `app.listen` arguments; happy path for the startup-log string emitted by the listen callback.
- **Mock dependencies:** `console.log` (spied to capture the startup log), `app.listen` (spied to capture `(port, hostname, callback)` and avoid opening a real listener).
- **Assertions focus:** Exact equality on the port (`3000`), the hostname (`'127.0.0.1'`), the callback type (`function`), and the log string (`'Server running at http://127.0.0.1:3000/'`).
- **Structure:** One top-level `describe('server.js startup', ...)` block with 2–3 `it` tests; setup performed in `beforeEach` and mocks restored in `afterEach` via `jest.restoreAllMocks()`.
- **Module-load sequence:** The test spies on `console.log` and on the Express module's returned `app.listen` **before** it `require`s `../server`, so the spies are in place when `server.js` executes its top-level `app.listen(...)` call under `require.main === module` (the test forces this branch by loading the module via `require('child_process').fork` or by using `jest.isolateModules` to re-evaluate `server.js` with mocks pre-applied). Simpler alternative retained in the test file: `require('../server')` after spies are attached, and then manually invoke the listen callback captured by the spy.

**No third test file is created.** Additional files such as `tests/fixtures/*.js`, `tests/helpers/*.js`, or `tests/mocks/*.js` are explicitly **not** created — per the user directives "Use inline static expectations. No fixture system is needed." and "Add only minimal dev dependencies."

### 0.5.3 Test Files to Modify Detail

No test files exist to modify. This section is recorded for completeness and does not list any files.

| Action | Files | Details |
|---|---|---|
| Update existing tests | **None** | No test files exist in the repository prior to this engagement. |
| Update fixtures | **None** | No fixtures exist prior, and none are created. |
| Update test utilities | **None** | No utilities exist prior, and none are created. |

### 0.5.4 Test Configuration Updates

| Configuration Site | Action | Contents |
|---|---|---|
| `package.json` → `"jest"` key | **CREATE (embedded)** | `"testEnvironment": "node"` (not `jsdom` — the app has no browser surface); `"testMatch": ["**/tests/**/*.test.js"]`; `"collectCoverageFrom": ["server.js"]`; `"coverageThreshold": { "global": { "statements": 90, "branches": 90, "functions": 90, "lines": 90 } }`. |
| `package.json` → `"scripts"` | **UPDATE** | `"test": "jest"` (replaces placeholder); `"test:coverage": "jest --coverage"` (new). `"start": "node server.js"` is preserved byte-for-byte. |
| `package.json` → `"devDependencies"` | **CREATE (section)** | `"jest": "^29.7.0"`, `"supertest": "^7.1.4"`. |
| Standalone config files (`jest.config.js`, `.mocharc.*`, `vitest.config.*`, `.nycrc`, `.c8rc`, `karma.conf.*`, `tests/setup.js`) | **None created** | All Jest configuration lives in the `"jest"` key of `package.json` — zero extra configuration files are introduced. This honors the "minimal dev infrastructure" directive. |
| Coverage output (`coverage/`) | **Auto-generated** | Emitted by `jest --coverage`; no manual creation. If a `.gitignore` is later introduced, `coverage/` would be a typical ignore entry — but **adding `.gitignore` is out of scope** for this engagement (no `.gitignore` exists today per §3.7.5, and the user did not request one). |

### 0.5.5 Cross-File Test Dependencies

Because the suite is intentionally small and fixture-free, cross-file dependencies are minimal. The table below is the complete inventory.

| Dependency Type | Location | Usage |
|---|---|---|
| Shared fixtures | **None** | No `tests/fixtures/` directory; expected strings are inline literals. |
| Shared mock objects | **None** | Each of the two spies in `tests/startup.test.js` is declared locally and restored in its own `afterEach`. |
| Test utilities / helpers | **None** | No `tests/helpers/`, `tests/utils/`, or `tests/factories/` directories. |
| Shared imports | The only shared import pattern across the two test files is `const app = require('../server');` in `tests/server.test.js` (and `require('../server')` after spy attachment in `tests/startup.test.js`). This mirrors the production `require('express')` style in `server.js` and does not require any import-path transformation rules. |
| Import-path transformations | **None required** | `server.js` is not being moved, renamed, or split into sub-modules. The only path used by the tests is the relative `../server`. No refactor patterns such as `from src.services.x import y` → `from src.services.specific import y` apply here. |

## 0.6 Dependency Inventory

### 0.6.1 Testing Dependencies

The plan introduces **exactly two new dev-only packages** — `jest` and `supertest`. No runtime dependencies are added. The Express 5.2.1 production dependency remains unchanged, keeping the production dependency tree at the current 66 packages (per §3.2.1). All versions below were validated against the npm registry and Node.js v20+ compatibility.

| Registry | Package Name | Version | Purpose |
|---|---|---|---|
| npm | `jest` | `^29.7.0` | Test runner, assertion library (`expect`), mocking utilities (`jest.fn`, `jest.spyOn`, `jest.mock`), and built-in V8/Istanbul coverage. Node ≥ 14.15 / 16.10 / 18.0 compatibility envelope covers this project's Node 20.x+ runtime. |
| npm | `supertest` | `^7.1.4` | SuperAgent-driven HTTP assertion library for Node servers. Accepts an Express `app` instance, binds an ephemeral port, and exposes a fluent `.get()` / `.expect()` API plus `response.text` / `response.status` / `response.body` accessors for Jest assertions. Compatible with Express 5.2.1. |

**No additional packages are added.** The table below explicitly records the packages the plan considered and deliberately excluded, to prevent any expansion of the dev-dependency footprint:

| Registry | Candidate Package | Excluded Because |
|---|---|---|
| npm | `chai` / `expect.js` / `should.js` | Jest's built-in `expect` covers every assertion this suite needs — strict equality, numeric equality, type checks, spy call-arg checks. |
| npm | `sinon` / `testdouble` | Jest's built-in `jest.fn`, `jest.spyOn`, and `jest.mock` cover the two spies (`console.log`, `app.listen`) this suite needs. |
| npm | `nyc` / `c8` | Jest's `--coverage` flag provides statement/branch/function/line coverage out of the box via V8 or Istanbul. Adding a third-party coverage tool would violate the "minimal dev dependencies" directive. |
| npm | `@jest/globals` | Not required when using Jest's default global-injection mode (`describe`, `it`, `expect` are globally available). Adding this package would require explicit `import { describe, it, expect } from '@jest/globals'` in every test file, which adds ceremony without benefit for a CommonJS project. |
| npm | `@types/jest`, `@types/supertest`, `ts-jest`, `typescript` | This project is plain CommonJS JavaScript per constraint C-003; TypeScript and type definitions are explicitly out of scope. |
| npm | `jest-mock-extended`, `jest-when`, `jest-extended` | No advanced mocking behaviors or extended matchers are required for this surface. |
| npm | `nock`, `msw` | No external HTTP calls exist to mock; the server is purely an HTTP responder. |
| npm | `cross-env`, `dotenv` | No environment variables are read by `server.js`; out of scope per §1.3.2. |

**Expected `npm install` outcome after these edits:**

- `package.json` grows by one `devDependencies` block (2 entries) and two `scripts` entries; `dependencies` remains exactly `{ "express": "^5.2.1" }`.
- `package-lock.json` gains the Jest dependency subtree (approximately 150–200 additional packages under `node_modules/jest/**` — typical for a Jest install) and the Supertest subtree (approximately 15–20 additional packages including `superagent`, `methods`, `cookie-signature`). These all resolve under `devDependencies` and do not affect the production dependency tree.
- `npm audit` is expected to report `0 vulnerabilities` in production dependencies, consistent with §5.4.1. Dev dependency advisories, if any, do not affect runtime security posture and are not a failure criterion for this engagement.

### 0.6.2 Import Updates

No pre-existing test files exist; therefore no existing test imports require rewriting. The table below enumerates the **new** import statements introduced by the plan, for reference only — these are not "updates" in the sense of modifying existing imports.

| Test File | New Import Statements | Rationale |
|---|---|---|
| `tests/server.test.js` | `const request = require('supertest');`<br>`const app = require('../server');` | CommonJS `require()` statements — consistent with the project's module system (C-003). The `../server` path resolves to `server.js` at the repository root, which now exports `app` after the minimal-change update. |
| `tests/startup.test.js` | `const app = require('../server');`<br>(plus `jest.spyOn(app, 'listen')` and `jest.spyOn(console, 'log')` within test setup — no additional `require` lines) | Same CommonJS style. Spies are applied to already-imported globals (`console`) and the already-imported `app` module; no new import paths. |
| `server.js` (production) | **No new imports.** Only `module.exports = app;` is added; `require('express')` remains unchanged. | Preserves the minimal-change principle. |
| `package.json` | N/A (manifest, not code) | — |

**Import transformation rules (none required for this engagement):**

- Old: *(no prior test imports exist)*
- New: `const app = require('../server')` (in both new test files)
- Apply to: the two new test files only; no repository-wide import refactor is required.

No cascading import rewrites are triggered elsewhere in the codebase because no other `.js` files exist besides `server.js`, and `server.js` itself is not being restructured.

## 0.7 Coverage and Quality Targets

### 0.7.1 Coverage Metrics

**Current coverage baseline** (prior to this engagement, confirmed via §6.6.4.4 of this specification): `server.js` statement/branch/function/line coverage is `0%`. There is no existing coverage tooling, no `coverage/` directory, and no historical coverage report to compare against.

**Target coverage** (per user requirement "Target 100% coverage of observable HTTP behavior and at least 90% practical coverage of `server.js`"):

| Metric | Target | Basis |
|---|---|---|
| Observable HTTP behavior coverage | **100%** | User requirement: every observable HTTP contract (`GET /`, `GET /evening`, unmatched-route 404) must have a corresponding assertion-bearing test. |
| `server.js` statement coverage | **≥ 90%** | User requirement: "at least 90% practical coverage of `server.js`." |
| `server.js` branch coverage | **≥ 90%** | Derived from the user's statement target. The only branch in `server.js` after the minimal-change refactor is `if (require.main === module)`; both paths (truthy when run via `npm start`, falsy when required by tests) will be exercised across the suite. |
| `server.js` function coverage | **≥ 90%** | Three functions exist: the `GET /` handler, the `GET /evening` handler, and the `app.listen` callback. All three are exercised. |
| `server.js` line coverage | **≥ 90%** | Derived from the 17-line file being near-fully executed by the suite. |
| Coverage gate in `package.json` | `coverageThreshold.global` = `{ statements: 90, branches: 90, functions: 90, lines: 90 }` | Enforces the user's 90% target programmatically: `jest --coverage` fails (non-zero exit) if any of the four dimensions drops below 90%. |

**Coverage gaps to address** (the full enumeration, given the tiny surface):

| Component | Currently | Target | Focus Areas |
|---|---|---|---|
| `server.js` bootstrap (lines 1–5 — require, express(), hostname, port) | 0% | 100% (implicitly covered by any `require('../server')` in the test suite) | No dedicated test needed; coverage comes for free with module load. |
| `server.js` GET / handler (lines 7–9) | 0% | 100% | Exercised by `tests/server.test.js` via `supertest(app).get('/')`. Focus: exact body + status. |
| `server.js` GET /evening handler (lines 11–13) | 0% | 100% | Exercised by `tests/server.test.js` via `supertest(app).get('/evening')`. Focus: exact body + status. |
| `server.js` app.listen call (line 15) + callback body (line 16) | 0% | ≥ 90% | Exercised by `tests/startup.test.js` via `jest.spyOn(app, 'listen')` and callback invocation with `console.log` spy. Focus: correct args, correct log text. |
| Default 404 path (framework, no server.js code) | 0% | Contract-level 100% (no statement coverage impact on `server.js`) | Exercised by `tests/server.test.js` via `supertest(app).get('/missing')`. Focus: status 404. |

**Per-file coverage targets:**

- `server.js` → `≥ 90%` across statements/branches/functions/lines (enforced by `coverageThreshold.global`). The single file listed in `collectCoverageFrom` is `server.js`, so no other file is measured.
- Every other file in the repository (`package.json`, `package-lock.json`, `README.md`, `blitzy/documentation/*.md`, and the test files themselves) is excluded from coverage measurement.

### 0.7.2 Test Quality Criteria

The test suite must satisfy the quality criteria below, which operationalize the user's "test observable behavior, not Express internals; minimize mocks; avoid timing-sensitive tests; keep test files small and explicit" guidance.

| Criterion | Target |
|---|---|
| Assertion density | ≥ 2 assertions per `it` block (status + body for route tests; args + log for startup tests). Avoid single-assertion tests that cover only status without body. |
| Test isolation | Every test is independent; no shared mutable state across tests. `beforeEach`/`afterEach` in `tests/startup.test.js` restore spies via `jest.restoreAllMocks()`. |
| Test execution time | Full suite `npm test` completes in ≤ 5 seconds on a developer laptop. No test uses real timers, real network I/O, or `setTimeout` waits. |
| Deterministic behavior | Every test must produce identical results on repeat invocations. No random inputs, no time-dependent assertions, no environment-dependent values. |
| Maintainability | Test files are ≤ 100 lines each. Test descriptions (`describe` / `it`) read as behavior narratives. No cleverness — prefer explicit assertions over abstraction layers. |
| Conformance to repository style | Plain JavaScript (ES2020+, matches `server.js`), CommonJS `require()` (matches C-003), `const`/arrow-function style (matches `server.js` conventions), 2-space indentation (matches `server.js`). |
| Content-Type over-assertion avoidance | Do **not** assert against `Content-Type` or `Content-Length` headers. Express 5.2.1's `res.send(string)` sets `Content-Type: text/html; charset=utf-8` with an auto-computed `Content-Length`, but these are framework defaults and not part of the F-002/F-003 contract. Asserting on them would test Express internals, not the observable contract. |
| Exact-body assertion style | Use `expect(response.text).toBe('Hello, World!\n')` with the trailing `\n` literal. Do **not** use `.toContain`, `.toMatch`, or `.trim()`-adjusted comparisons, because the trailing newline is part of the contract per user requirement. |
| Failure signal quality | Intentionally changing a response string (e.g., editing `'Hello, World!\n'` → `'Hello, World'` in `server.js`) must cause at least one test in `tests/server.test.js` to fail with a clear, human-readable diff between expected and actual. This is one of the user's explicit validation criteria. |
| Open-handle safety | No test must leave an open handle (unclosed server, pending timer). Supertest closes its ephemeral listener automatically; the startup test never opens one. Jest must not warn about open handles when `npm test` exits. |

## 0.8 Scope Boundaries

### 0.8.1 Exhaustively In Scope

The Blitzy platform treats the following items — enumerated with explicit paths and trailing glob patterns — as the **complete and final** list of files, configuration, and behaviors in scope for this engagement. Nothing outside this list may be created, modified, or deleted.

- **New test files:**
    - `tests/server.test.js` — all HTTP-integration test cases for F-002, F-003, and F-005 (see Section 0.5.2).
    - `tests/startup.test.js` — all startup-configuration and log-message test cases for F-001 (see Section 0.5.2).
    - `tests/**/*.test.js` — wildcard reserved for any future test files under `tests/` if the test count grows; no additional files are created in this engagement.
- **Test file updates:**
    - **None.** No pre-existing test files exist to update.
- **Production code updates (minimal, testability-driven only):**
    - `server.js` — append `module.exports = app;` and wrap the `app.listen(...)` call in `if (require.main === module) { ... }`. These two changes are limited to additive lines; no route logic, strings, ports, hostnames, or log text are modified. This is the minimum change required to make `server.js` safely `require`-able from the test files.
- **Test configuration:**
    - `package.json` — add `"devDependencies": { "jest": "^29.7.0", "supertest": "^7.1.4" }`, add the `"jest"` configuration key (`testEnvironment`, `testMatch`, `collectCoverageFrom`, `coverageThreshold`), replace the `test` script with `"jest"`, and add `"test:coverage": "jest --coverage"`.
    - `package-lock.json` — automatic regeneration via `npm install`; no manual edits.
    - **No** standalone `jest.config.js`, `.mocharc.*`, `vitest.config.*`, `.c8rc`, `.nycrc`, `karma.conf.*`, `tests/setup.js` file is created.
- **Test utilities and helpers:**
    - **None.** No `tests/helpers/**`, `tests/mocks/**`, `tests/factories/**`, `tests/utils/**`, `tests/fixtures/**` directories or files are created. The suite is fixture-free per user directive.
- **Documentation updates:**
    - `README.md` — append one small "Testing" section (≤ 15 added lines) documenting `npm test` and `npm run test:coverage`. No CI badges, no architecture prose, no coverage-threshold tutorial.
    - **No** new files under `docs/testing/**`, `docs/**`, `blitzy/documentation/**` are created or edited. The Technical Specifications and Project Guide under `blitzy/documentation/` are governance artifacts and are not within the in-scope set for modification.

### 0.8.2 Explicitly Out of Scope

The following items are explicitly excluded. Any request or inference that would lead the Blitzy platform to touch an out-of-scope item must be rejected in favor of the minimal-change principle, regardless of how minor the change might appear.

- **Source-code modifications beyond the two-line testability change to `server.js`:** No refactor, no extraction of route handlers into separate files, no introduction of a `createApp()` factory, no environment-variable parsing for `PORT`/`HOST`, no logger replacement, no `process.exit` handlers, no graceful-shutdown logic, no signal handling.
- **Feature additions while adding tests:** No new routes (e.g., `/health`, `/metrics`, `/morning`), no new middleware (no `body-parser`, no `cors`, no `helmet`, no `express.json`), no new Express configuration (`app.set`, `app.disable`, etc.).
- **CI/CD and automation:**
    - **No** `.github/workflows/**` files are created, edited, or deleted (prohibited by Constraint C-002 and by the user implementation rule "exit code 137 test" which states "Do not make any updates or changes in GitHub App to create or update a workflow").
    - **No** pre-commit hooks, `husky` configuration, `lint-staged` configuration.
    - **No** GitLab CI, CircleCI, Jenkins, Travis, Azure Pipelines configurations.
- **Containerization and deployment:** No `Dockerfile`, `docker-compose.yml`, `k8s/**`, `helm/**`, `.dockerignore`, cloud deployment scripts, Terraform, CloudFormation, or infrastructure-as-code artifacts.
- **Module system or language migration:** No conversion to ESM (`"type": "module"` in `package.json`, `import`/`export`), no TypeScript (`tsconfig.json`, `*.ts`, `@types/*`), no Babel/SWC transpilation.
- **Code quality tooling additions outside test execution:** No ESLint, Prettier, Stylelint, Husky, Commitlint, Changelog tooling, or release automation.
- **Cross-cutting concerns not already in `server.js`:** No authentication, no authorization, no rate limiting, no request logging (Morgan, Winston, Pino), no audit trail, no HTTPS/TLS, no CORS, no security headers (Helmet), no caching layer, no connection pooling, no database, no ORM.
- **Unrelated test categories:** No browser tests (Cypress, Playwright, Puppeteer), no load tests (k6, Artillery, JMeter), no contract tests (Pact), no mutation tests (Stryker), no E2E tests against a deployed environment, no accessibility tests.
- **Performance optimizations beyond test coverage:** No tests that benchmark response latency or throughput; no introduction of `autocannon` or similar load generators.
- **Third-party dependency internals:** No tests that exercise Express's router internals, `path-to-regexp` regex matching, `body-parser` parsing, or any transitive package. Tests assert only on the observable contract of this project's `server.js`.
- **Future environment variable support:** No parsing of `process.env.PORT`, `process.env.HOST`, or any `.env` file. This is listed as future work in §1.3.2 but is out of scope here.
- **Any items explicitly excluded by the user instructions** above, which are restated verbatim in Section 0.1.2.

**Out-of-scope file-and-path matrix** (prohibited touches):

| Path / Pattern | Reason |
|---|---|
| `.github/workflows/**` | C-002 prohibits CI/CD; user rule "exit code 137 test" explicitly forbids workflow changes. |
| `Dockerfile`, `docker-compose*.yml`, `.dockerignore` | Containerization out of scope. |
| `tsconfig.json`, `*.ts`, `*.tsx`, `@types/**` | C-003 prohibits TypeScript. |
| `.eslintrc*`, `.prettierrc*`, `.stylelintrc*` | Code-quality tooling out of scope. |
| `.env*`, `.nvmrc`, `.npmrc` | Environment configuration out of scope (except where already absent per §3.7.5). |
| `k8s/**`, `helm/**`, `terraform/**`, `*.tf` | Deployment infrastructure out of scope. |
| `src/**`, `app/**`, `lib/**` (any new source directory) | No source-code reorganization. `server.js` stays at the repository root. |
| `tests/fixtures/**`, `tests/mocks/**`, `tests/helpers/**`, `tests/utils/**`, `tests/factories/**` | Fixture-free suite per user directive. |
| `blitzy/documentation/**` | Governance artifacts; untouched by this engagement. |
| `coverage/**` | Auto-generated by `jest --coverage`; not hand-edited. |

## 0.9 Execution Parameters

### 0.9.1 Testing-Specific Instructions

The commands below are the exact, reproducible invocations that developers and validators will use to run the suite after the engagement completes. Every command is non-interactive, deterministic, and safe to run on a developer laptop.

| Operation | Exact Command | Expected Behavior |
|---|---|---|
| Install dependencies (first-time setup) | `npm install` | Resolves `express@5.2.1` + `jest@^29.7.0` + `supertest@^7.1.4` against `package-lock.json`; exits with status `0`. |
| Run the full test suite | `npm test` | Jest auto-discovers `tests/**/*.test.js`, runs both files, prints a pass/fail summary, exits with status `0` on success. Replaces the previous placeholder which exited with status `1`. |
| Run tests with coverage measurement | `npm run test:coverage` | Jest runs the suite with `--coverage`, emits a text summary to stdout, writes HTML/lcov reports under `coverage/`, and enforces `coverageThreshold.global` (≥ 90% across statements/branches/functions/lines). Exits non-zero if any threshold is violated. |
| Run a single test file | `npx jest tests/server.test.js` | Runs only the named file; useful for iterative debugging. |
| Run a single test by name | `npx jest -t "GET /evening"` | Runs only tests whose description matches the `-t` pattern. |
| Watch mode (interactive, **developer-only — never used in CI-like automation**) | `npx jest --watch` | Re-runs tests on file save. **Not used by `npm test`**, which must be non-interactive and CI-safe even though this project has no CI. |
| Debug mode | `node --inspect-brk node_modules/.bin/jest --runInBand tests/server.test.js` | Starts a Node inspector session with tests serialized (`--runInBand`); developer attaches Chrome DevTools or VS Code. |
| Production startup (unchanged) | `npm start` | Continues to work exactly as before — runs `node server.js`, binds to `127.0.0.1:3000`, prints `Server running at http://127.0.0.1:3000/`. The `require.main === module` guard ensures this path is unaffected by the testability refactor. |
| Manual endpoint verification (unchanged) | `curl http://127.0.0.1:3000/`, `curl http://127.0.0.1:3000/evening`, `curl -i http://127.0.0.1:3000/missing` | Continue to return `Hello, World!`, `Good evening`, and a 404 respectively — identical to the pre-engagement contract. |

**Test-execution configuration highlights** (sourced from the embedded `"jest"` key in `package.json`):

- `testEnvironment: "node"` — the Jest default node environment; no `jsdom` (there is no browser surface).
- `testMatch: ["**/tests/**/*.test.js"]` — matches the two files in the plan and reserves the `tests/` directory for future tests; does not match files under `node_modules/`, `blitzy/documentation/`, or `coverage/`.
- `collectCoverageFrom: ["server.js"]` — coverage is scoped strictly to the single production source file.
- `coverageThreshold.global: { statements: 90, branches: 90, functions: 90, lines: 90 }` — enforces the user's ≥ 90% target on `jest --coverage` runs.

**Environment setup requirements for tests:**

- Node.js v20.x+ (same as the runtime prerequisite for `server.js`, per §3.4.1). No secondary Node version is required.
- npm v10.x+ (same as the runtime prerequisite, per §3.4.2). No secondary package manager is required.
- No environment variables are required — the tests use literal values (`3000`, `'127.0.0.1'`, exact response strings). No `.env` file is created.
- No external network access is required — Supertest binds an ephemeral port on the loopback interface; the startup test opens no sockets at all.
- No database, no Redis, no queue, no external service — consistent with the zero-external-integration posture documented across §3.5, §3.6, and §6.3.

**Excluded test categories per user instruction** (restated to close the loop on Section 0.8.2):

- No browser tests, no load/performance tests, no external-API contract tests, no deployment/smoke tests against a remote environment, no CI/CD integration tests, no mutation tests.

**Specific test patterns followed in the repository:**

- CommonJS `require()` in every test file, matching `server.js` and constraint C-003.
- Arrow-function test bodies (`it('...', async () => { ... })`), matching the arrow-function style used in the route handlers in `server.js`.
- `const`-only variable declarations, matching `server.js`.
- 2-space indentation, matching `server.js`.
- No custom reporters, no Jest plugins, no Jest transformers (the default CommonJS handling is sufficient).

## 0.10 Special Instructions for Testing

The Blitzy platform's execution of this engagement is constrained by the user-specified testing directives below. Each directive is captured verbatim (or as a close paraphrase of a verbatim user requirement) with an explicit mapping to the concrete implementation behavior it governs. When any conflict arises during implementation, these directives take precedence over any other guidance, general best practice, or convenience pattern — including templates from external testing tutorials.

### 0.10.1 Minimal-Change Directive

- **User requirement (verbatim):** "IMPORTANT: Make only the changes that are absolutely necessary to implement comprehensive testing coverage."
- **User requirement (verbatim):** "Focus specifically on adding test files and minimal test infrastructure without modifying production code unless required for testability."
- **Implementation behavior:**
    - The only production file modified is `server.js`, and only by two additive edits: `module.exports = app;` at the end of the file and wrapping the `app.listen(...)` call in `if (require.main === module) { ... }`. Every existing line retains its exact content, whitespace, and order. The hardcoded `hostname = '127.0.0.1'` and `port = 3000` are preserved byte-for-byte. The startup log template literal `` `Server running at http://${hostname}:${port}/` `` is preserved byte-for-byte. No other production file is edited.
    - `README.md` receives a single appended "Testing" section (≤ 15 lines). No existing lines in `README.md` are reworded, reformatted, or reordered. Existing endpoint tables and prerequisites remain byte-identical.
    - `package.json` receives one new `devDependencies` block, two new `scripts` entries (`test:coverage`) / replacements (`test`), and one new `jest` configuration block. Existing fields (`name`, `version`, `description`, `main`, `dependencies`, `author`, `license`) are not reordered or otherwise modified. The `start` script is preserved exactly.

### 0.10.2 Source-Code Preservation Directive

- **User requirement (verbatim):** "DO NOT modify source code unless absolutely necessary for testability" (paraphrased from the Testing Discipline Guidelines).
- **User requirement (verbatim):** "Do not refactor `server.js` unless required for safe testing."
- **User requirement (verbatim):** "Do not change endpoint behavior."
- **User requirement (verbatim):** "Do not add middleware or new routes."
- **User requirement (verbatim):** "Do not add CI/CD, Docker, TypeScript, ESM, auth, database, or deployment config."
- **User requirement (verbatim):** "If production code must change for testability, keep it minimal and preserve all existing behavior."
- **Implementation behavior:** The single refactor accepted — guarding `app.listen(...)` and exporting `app` — is chosen precisely because it is the smallest known change that still allows Supertest to drive the real router without binding `127.0.0.1:3000`. Alternative, larger refactors (extracting a `createApp()` factory, splitting routes into a separate `routes.js` module, parameterizing the port) are **rejected** as unnecessary. Endpoint behavior, middleware stack (none), response bodies, status codes, port, hostname, and the startup log remain identical.

### 0.10.3 Minimal Dev-Dependency Directive

- **User requirement (verbatim):** "Add only minimal dev dependencies"
- **User requirement (verbatim):** "Do not add runtime dependencies unless absolutely necessary"
- **Implementation behavior:** Exactly two new `devDependencies` are introduced — `jest@^29.7.0` and `supertest@^7.1.4`. Zero new runtime dependencies are introduced. Alternative packages that would nominally assist testing (see Section 0.6.1's exclusion table) are **rejected** because Jest's built-in `expect`, `jest.fn`, `jest.spyOn`, `jest.mock`, and `--coverage` subsume their functionality.

### 0.10.4 Test-Isolation and Pattern Directives

- **User requirement (verbatim):** "Keep all test code isolated in dedicated test files"
- **User requirement (verbatim):** "Follow existing test patterns in [specific file]" — not directly applicable because no existing tests exist; reframed by the Blitzy platform as "match existing code style and naming conventions in tests."
- **User requirement (verbatim):** "Match existing code style and naming conventions in tests."
- **User requirement (verbatim):** "Maintain test isolation using [specific pattern]" — paraphrased as "ensure every test is independent."
- **User requirement (verbatim):** "Use [specific mocking library] for external dependencies" — the plan uses Jest's built-in mocks as the chosen mocking mechanism (see Section 0.3.1).
- **User requirement (verbatim):** "Ensure all tests can run independently and in parallel"
- **Implementation behavior:**
    - All test code lives under `tests/` with `*.test.js` extension; no test code leaks into `server.js`, `README.md`, or any runtime file.
    - Test files use the same style as `server.js`: CommonJS `require()`, arrow functions, `const` declarations, 2-space indentation, lowercase file names with underscores avoided.
    - Each `it`/`test` block is independent and does not rely on execution order. Where spies are used (`tests/startup.test.js`), `beforeEach` installs them and `afterEach` calls `jest.restoreAllMocks()`.
    - Tests can run in parallel (Jest's default); nothing in the suite assumes a singleton process state.

### 0.10.5 Backward-Compatibility Directive

- **User requirement (verbatim):** "Maintain backward compatibility in test utilities" — paraphrased as "do not break existing tooling or scripts."
- **Observable contracts that must remain unchanged** (restated from the user's System Boundaries section):
    - `GET /` → `Hello, World!\n`, HTTP 200
    - `GET /evening` → `Good evening`, HTTP 200
    - Unknown routes → Express default 404
    - `npm start` → `node server.js`
    - Startup log exactly `Server running at http://127.0.0.1:3000/`
- **Implementation behavior:** The contract-preservation requirements drive the assertions in `tests/server.test.js` and `tests/startup.test.js` — each of the five bullet points above maps to at least one test case. Failing any of these assertions signals a regression.

### 0.10.6 Validation Directive

- **User requirement (verbatim):** "run `npm test`; run coverage if added; intentionally change response strings/statuses to confirm tests fail; confirm no CI/CD, middleware, or production-hardening changes were introduced."
- **Implementation behavior:** The completion criteria for this engagement, in order, are:
    - `npm install` completes successfully with zero vulnerabilities in production dependencies.
    - `npm test` exits with status `0` and reports all tests passing for both `tests/server.test.js` and `tests/startup.test.js`.
    - `npm run test:coverage` reports `≥ 90%` across all four coverage dimensions for `server.js` and emits a `coverage/` report.
    - A manual mutation check — temporarily changing `'Hello, World!\n'` to `'Hello, World!'` in `server.js` — causes `tests/server.test.js` to fail with a visible string diff; reverting the change makes the test pass again. The same holds for the `Good evening` string and for the startup log string.
    - A repository diff comparing pre- and post-engagement state shows no `.github/workflows/**` files added or changed, no `Dockerfile` added, no middleware added to `server.js`, and no new runtime dependencies in `package.json`.
- **Explicit acceptance conditions** (from user's Quality Assurance section, verbatim):
    - "both endpoint contracts are covered"
    - "default 404 behavior is covered"
    - "startup config/logging is covered where practical"
    - "`npm test` passes"
    - "coverage target is met"
    - "no runtime behavior changes"

### 0.10.7 Workflow-Prohibition Directive

- **User rule (from project implementation rules, verbatim):** Rule name `"exit code 137 test"` — content: "Do not make any updates or changes in GitHub App to create or update a workflow."
- **User requirement (verbatim):** "Do not add CI/CD workflows. No `.github/workflows` changes should be introduced."
- **Implementation behavior:** Under no circumstances does the Blitzy platform create, edit, or delete any file under `.github/workflows/`, any GitHub App configuration, any `.gitlab-ci.yml`, `.circleci/config.yml`, `azure-pipelines.yml`, `Jenkinsfile`, or equivalent pipeline artifact. The engagement explicitly avoids any action that could be interpreted as workflow authorship.

