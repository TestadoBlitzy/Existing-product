# Technical Specification

# 0. Agent Action Plan

## 0.1 Intent Clarification

### 0.1.1 Core Testing Objective

Based on the provided requirements, the Blitzy platform understands that the testing objective is to **add a comprehensive, brand-new unit test suite** for the `server.js` application module in the `hao-backprop-test` (npm: `hello_world`) Node.js/Express.js project. The project currently has **zero test infrastructure** — no test framework, no test files, no `devDependencies`, and no test configuration — so this effort represents a greenfield test implementation from scratch.

**Request Category:** Add new tests (greenfield — no existing tests to build upon)

The user's requirements explicitly enumerate six test dimensions for `server.js`:

- **HTTP responses** — Verify that each route handler returns the correct response body (`Hello, World!\n` for `GET /` and `Good evening` for `GET /evening`)
- **Status codes** — Assert HTTP 200 for defined routes, HTTP 404 for undefined routes, and appropriate status codes for unsupported HTTP methods
- **Headers** — Confirm `Content-Type: text/plain` on all route responses, verify that `X-Powered-By` header is absent (suppressed via `app.disable('x-powered-by')` at `server.js` line 9), and validate other Express-managed headers
- **Server startup/shutdown** — Test that the server binds to `127.0.0.1:3000`, emits the correct startup log message, and handles process termination scenarios
- **Error handling** — Validate Express.js default 404 handling for unmatched routes, behavior on unsupported HTTP methods (POST, PUT, DELETE, PATCH on defined routes), and any error states during server lifecycle
- **Edge cases** — Cover boundary conditions such as requests with query parameters, requests with trailing slashes, concurrent requests, large headers, and other atypical input scenarios

**Implicit testing needs surfaced:**
- The existing `server.js` does not export the `app` instance — it calls `app.listen()` at the module level (line 21). For Supertest-based testing, a structural separation between the Express `app` definition and the `listen()` invocation is required
- Express.js 5.x default error responses differ from 4.x — tests must account for Express 5.2.1 behavior specifically (HTML-formatted 404 body from `finalhandler`)
- The `\n` trailing newline in `Hello, World!\n` must be precisely asserted in tests
- The hardcoded `hostname` (`127.0.0.1`) and `port` (`3000`) constants should be tested to confirm correct server binding configuration

### 0.1.2 Special Instructions and Constraints

**User-Specified Implementation Rule:**
- `"Do not make any updates or changes in GitHub App to create or update a workflow."` — This explicitly prohibits creating or modifying any CI/CD workflow files (e.g., `.github/workflows/*.yml`). All testing will be executed locally via npm scripts only.

**Inferred Testing Constraints:**
- The project uses **CommonJS** module syntax (`require()` / `module.exports`), not ES modules — all test files must follow this convention
- The project follows strict coding conventions: 2-space indentation, single quotes, semicolons required, `const` variable declarations
- The testing framework must be either **Jest** or **Mocha** as specified by the user — based on ecosystem analysis, Jest is the recommended choice given its built-in assertions, mocking, and coverage capabilities
- The `server.js` source file will require minimal modification to export the `app` object for testability — this is a standard Express testing pattern, not a feature addition

### 0.1.3 Technical Interpretation

These testing requirements translate to the following technical test implementation strategy:

- To **test HTTP responses**, we will create unit tests using Supertest to send HTTP GET requests to the Express `app` and assert response body content matches the exact strings defined in `server.js` route handlers
- To **test status codes**, we will create assertions for HTTP 200 on `GET /` and `GET /evening`, HTTP 404 on undefined routes (e.g., `GET /nonexistent`), and HTTP 404/405 for unsupported methods on defined routes
- To **test headers**, we will assert `Content-Type` includes `text/plain`, verify the absence of the `X-Powered-By` header across all response types, and check standard Express response headers
- To **test server startup/shutdown**, we will create tests that verify the server's `listen()` behavior, the startup console log message, and ensure proper cleanup of the listening socket
- To **test error handling**, we will create tests that exercise Express.js default error middleware for 404 responses and verify proper behavior under error conditions
- To **test edge cases**, we will create tests for malformed URLs, extra path segments, query string handling, HEAD requests, and response encoding

### 0.1.4 Coverage Requirements Interpretation

**Explicit coverage targets:** The user has not specified a numeric coverage threshold.

**Implicit coverage expectations:**
- Given that `server.js` is only 23 lines with two route handlers and one configuration directive, achieving **100% line coverage** and **100% branch coverage** is both feasible and expected
- Industry standard for Node.js unit testing of Express applications targets ≥80% coverage; for a trivial application of this size, anything below 100% would indicate missed functionality
- All three response paths (root route, evening route, 404 unmatched) must be covered
- The `X-Powered-By` disablement on line 9 must be verified

To achieve comprehensive testing, coverage should include every executable line in `server.js`, every branch in the Express routing logic, all response headers and bodies, and all error paths reachable through the Express middleware stack.

## 0.2 Test Discovery and Analysis

### 0.2.1 Existing Test Infrastructure Assessment

A comprehensive repository search confirms **zero test infrastructure** exists in this project. The following discovery procedures were executed:

**Search patterns employed:**
- File name patterns: `*test*`, `*spec*`, `test_*`, `spec_*`, `*_test.*`, `*_spec.*`, `__tests__/` — **zero results** (excluding `node_modules/` and `.git/`)
- Test configuration files: `jest.config.js`, `jest.config.ts`, `.babelrc`, `babel.config.js`, `.mocharc.yml`, `.mocharc.json`, `pytest.ini`, `.coveragerc`, `vitest.config.ts`, `karma.conf.js` — **none found**
- Framework detection via `package.json` — zero `devDependencies` declared; no testing libraries of any kind
- Test directories: `test/`, `tests/`, `__tests__/`, `spec/` — **none exist**

**Repository analysis reveals:** The project has absolutely no testing setup. The sole test-related artifact is the default npm placeholder script in `package.json` line 8: `"test": "echo \"Error: no test specified\" && exit 1"`, which outputs an error message and exits with failure code 1.

| Infrastructure Element | Status | Evidence |
|----------------------|--------|----------|
| Current testing framework | ❌ None installed | `package.json` — zero `devDependencies` |
| Test runner configuration | ❌ Not present | No `jest.config.*`, `.mocharc.*`, or equivalent files |
| Coverage tools in use | ❌ None | No `nyc`, `istanbul`, `c8` in dependencies |
| Mock/stub libraries | ❌ None | No `sinon`, `jest-mock-extended` in dependencies |
| Test data fixtures | ❌ None | No `fixtures/`, `__fixtures__/`, or seed data files |
| CI/CD pipeline | ❌ Prohibited | User rule: "Do not make any updates or changes in GitHub App to create or update a workflow" |

### 0.2.2 Application Source Analysis for Testability

The sole application source file `server.js` (23 lines) was analyzed for testable surface:

```
server.js (lines 1-23):
├─ Line 1:    Module import (express)
├─ Lines 3-4: Configuration constants (hostname, port)
├─ Line 6:    App instantiation (express())
├─ Line 9:    Security config (disable x-powered-by)
├─ Lines 11-14: GET / route handler
├─ Lines 16-19: GET /evening route handler
└─ Lines 21-23: Server binding (app.listen)
```

**Critical testability issue:** The current `server.js` does not export the `app` instance. It invokes `app.listen()` at module load time, which means `require('./server')` would immediately start the server and bind to port 3000. For Supertest-based testing, the standard Express testing pattern requires exporting the `app` object separately from the server startup logic. This necessitates a minimal structural change to `server.js`.

### 0.2.3 Web Search Research Conducted

The following research was conducted to inform the testing strategy:

- **Jest 30.x compatibility with Node.js 20**: Jest 30 drops support for Node 14, 16, 19, and 21; the minimum supported Node versions are 18.x — confirmed compatible with our Node.js v20.19.5 runtime
- **Express.js 5.x testing patterns with Supertest**: The standard pattern for testing Express apps with Supertest requires exporting the `app` object without calling `listen()`, then using `request(app)` in tests — Supertest internally binds to an ephemeral port
- **Jest + Supertest integration best practices**: Tests should use `async/await` with Supertest's chainable API; `expect()` assertions validate status codes, headers, and response bodies; `describe`/`it` blocks organize test suites by endpoint and behavior
- **Express 5.x default 404 behavior**: Express 5.x uses `finalhandler` to generate HTML 404 responses for unmatched routes, unlike Express 4.x which returned plain text — tests must account for this

## 0.3 Testing Scope Analysis

### 0.3.1 Test Target Identification

**Primary code to be tested:**

- **Module:** `server.js` at project root — requires unit tests, HTTP integration tests, header tests, error handling tests, and edge case tests

**Functions and behaviors requiring test coverage:**

| Testable Component | Location | Test Categories Required |
|-------------------|----------|------------------------|
| Express app instantiation | `server.js` line 6 | Unit: app creation, app type verification |
| X-Powered-By suppression | `server.js` line 9 | Header: absence verification across all responses |
| `GET /` route handler | `server.js` lines 11–14 | HTTP response, status code, headers, content body |
| `GET /evening` route handler | `server.js` lines 16–19 | HTTP response, status code, headers, content body |
| `app.listen()` binding | `server.js` lines 21–23 | Server startup, port binding, console log output |
| Express default 404 handler | Implicit (Express internals) | Error handling: unmatched routes, undefined paths |
| Undefined HTTP methods on routes | Implicit (Express routing) | Edge case: POST/PUT/DELETE/PATCH on `GET`-only routes |

**Existing test file mapping:**

| Source File | Existing Test File | Test Categories Present |
|------------|-------------------|----------------------|
| `server.js` | ❌ None | None — greenfield |
| `package.json` | ❌ None | None — no test script |

**Dependencies requiring mocking:**
- **Console output** — `console.log` is called during `app.listen()` callback (line 22); needs to be spied/mocked to verify startup message without cluttering test output
- **TCP port binding** — `app.listen()` binds to a real port; Supertest handles this by using ephemeral ports, but direct `listen()` tests may need port management
- No external services, databases, or file system operations to mock — the application is entirely self-contained

### 0.3.2 Version Compatibility Research

Based on the current Node.js v20.19.5 runtime and Express.js 5.2.1 framework, the recommended testing stack is:

| Tool Category | Package | Recommended Version | Compatibility Rationale |
|--------------|---------|-------------------|------------------------|
| Testing framework | Jest | 30.3.0 | Latest stable; supports Node.js ≥18.x; built-in assertions, mocking, coverage |
| HTTP testing library | Supertest | 7.2.2 | Latest stable; full Express 5.x support; ephemeral port binding; chainable API |
| Coverage tool | Built-in (Jest `--coverage`) | Included with Jest 30.x | Uses `v8` coverage provider by default in Jest 30; no separate `nyc` or `c8` needed |
| Mocking | Built-in (Jest mocks) | Included with Jest 30.x | `jest.spyOn()`, `jest.fn()` for console and module mocking |

**Version conflict analysis:** No conflicts detected. Jest 30.3.0 requires Node.js ≥18.x (our v20.19.5 satisfies this). Supertest 7.2.2 is compatible with Express 5.x applications. All packages use MIT licensing, consistent with the project's MIT license.

**Why Jest over Mocha:** The user specified "Jest or Mocha." Jest is recommended because it provides an all-in-one solution (test runner + assertions + mocking + coverage) without requiring additional packages like Chai, Sinon, and nyc that Mocha would need. This minimizes the number of new `devDependencies` and simplifies configuration for a small project.

## 0.4 Test Implementation Design

### 0.4.1 Test Strategy Selection

**Test types to implement:**

- **Unit tests** — Focus on isolated verification of the Express `app` object: route existence, configuration settings (`x-powered-by` disabled), correct response bodies, headers, and status codes for each route handler
- **Integration tests** — Cover the full HTTP request-response cycle through the Express middleware stack using Supertest, validating that requests flow through routing, handler execution, and response delivery correctly
- **Edge case tests** — Address boundary conditions: trailing slashes on URLs, query parameter handling, requests to non-existent routes, unsupported HTTP methods on defined routes, HEAD requests, and response encoding verification
- **Error handling tests** — Verify Express default 404 behavior for unmatched routes, response structure for error cases, and behavior when unsupported HTTP methods are used on defined endpoints
- **Server lifecycle tests** — Validate `app.listen()` binds correctly, the startup console log message is emitted, and server shutdown/close behavior works properly

### 0.4.2 Test Case Blueprint

```
Component: GET / Route Handler (server.js lines 11-14)
Test Categories:
- Happy path: Returns "Hello, World!\n" with HTTP 200 and text/plain Content-Type
- Edge cases: Request with query params still returns correct response;
  trailing slash behavior; HEAD request returns headers without body
- Error cases: POST/PUT/DELETE/PATCH to "/" returns 404 or appropriate error

Component: GET /evening Route Handler (server.js lines 16-19)
Test Categories:
- Happy path: Returns "Good evening" with HTTP 200 and text/plain Content-Type
- Edge cases: Request with query params; trailing slash; HEAD request
- Error cases: POST/PUT/DELETE/PATCH to "/evening" returns 404 or appropriate error

Component: Security Configuration (server.js line 9)
Test Categories:
- Happy path: X-Powered-By header absent from GET / response
- Edge cases: X-Powered-By absent from GET /evening, 404 responses, all methods

Component: 404 Error Handling (Express defaults)
Test Categories:
- Happy path: GET /nonexistent returns HTTP 404
- Edge cases: Various undefined paths (/foo, /evening/extra, /EVENING)
- Error cases: All HTTP methods on undefined routes return 404

Component: Server Startup (server.js lines 21-23)
Test Categories:
- Happy path: Server starts listening; console.log emits correct message
- Error cases: Port already in use (EADDRINUSE) scenario
```

### 0.4.3 Existing Test Extension Strategy

This is a greenfield implementation — no existing tests to extend, refactor, or fix. All test files will be created from scratch.

### 0.4.4 Test Data and Fixtures Design

**Required test data structures:**
- No complex test fixtures needed — the application returns hardcoded static strings
- Expected response body constants:
  - Root route: `'Hello, World!\n'`
  - Evening route: `'Good evening'`
- Expected configuration constants:
  - Hostname: `'127.0.0.1'`
  - Port: `3000`
  - Startup message: `'Server running at http://127.0.0.1:3000/'`

**Fixture organization strategy:**
- No separate fixture files required — expected values can be defined as constants within test files or as a small shared test utilities module

**Mock object specifications:**
- `console.log` spy — to capture and verify the server startup message without polluting test output
- `console.error` spy — to suppress and optionally verify any error output during tests

**Test database/state management approach:**
- Not applicable — no database, no persistent state. Each test is fully isolated by default since Express routes return deterministic static responses.

## 0.5 Test File Transformation Mapping

### 0.5.1 File-by-File Test Plan

The following table maps every file to be created, updated, or referenced in this testing effort, with target files listed first:

| Target Test File | Transformation | Source File/Test | Purpose/Changes |
|-----------------|----------------|------------------|-----------------|
| `__tests__/server.test.js` | CREATE | `server.js` | Comprehensive unit and integration test suite covering HTTP responses, status codes, headers, error handling, and edge cases for all Express routes |
| `__tests__/server.lifecycle.test.js` | CREATE | `server.js` | Server startup/shutdown tests: `app.listen()` binding, startup console log message, server close behavior, port conflict handling |
| `server.js` | UPDATE | `server.js` | Minimal structural change: export the `app` instance via `module.exports` to enable Supertest testing while preserving existing `listen()` behavior when run directly |
| `package.json` | UPDATE | `package.json` | Add `devDependencies` (jest, supertest); update `scripts.test` to use Jest runner; add Jest configuration |
| `jest.config.js` | CREATE | N/A | Jest configuration file: test environment set to `node`, coverage settings, test match patterns |

### 0.5.2 New Test Files Detail

**`__tests__/server.test.js`** — Primary test suite for HTTP behavior
- **Test categories:**
  - Happy path: `GET /` returns `Hello, World!\n` with 200, `GET /evening` returns `Good evening` with 200
  - Header validation: `Content-Type` includes `text/plain` on all route responses, `X-Powered-By` header absent
  - Error handling: 404 responses for undefined routes (`/nonexistent`, `/foo/bar`, etc.)
  - HTTP method tests: POST, PUT, DELETE, PATCH on defined routes return appropriate error responses
  - Edge cases: query parameters, trailing slashes, case sensitivity (`/Evening` vs `/evening`), HEAD requests, empty path segments
- **Mock dependencies:** None required for Supertest-based HTTP tests — Supertest binds the app to an ephemeral port internally
- **Assertions focus:** Status codes, response body text matching, header presence/absence, Content-Type validation

**`__tests__/server.lifecycle.test.js`** — Server lifecycle tests
- **Test categories:**
  - Startup: `app.listen()` invokes callback, `console.log` is called with correct startup message
  - Shutdown: `server.close()` terminates the listening socket cleanly
  - Error: EADDRINUSE error emitted when port is already in use
- **Mock dependencies:** `console.log` spy (via `jest.spyOn`), port binding for conflict testing
- **Assertions focus:** Callback invocation, console output content, server close event, error event emission

### 0.5.3 Test Files to Modify Detail

No existing test files require modification — this is a greenfield implementation.

### 0.5.4 Source File Modifications for Testability

**`server.js`** — Minimal structural update required:
- **Change:** Export the `app` object via `module.exports = app` and conditionally call `app.listen()` only when the file is executed directly (not imported by tests)
- **Pattern:** Use the `require.main === module` guard to separate app definition from server startup
- **Impact:** Preserves `npm start` behavior while enabling `const app = require('./server')` in test files
- **Assertions:** Existing `npm start` functionality must remain identical post-modification

### 0.5.5 Test Configuration Updates

**`jest.config.js`** — New file:
- `testEnvironment`: `'node'` (not jsdom — this is a server-side application)
- `coverageDirectory`: `'coverage'`
- `collectCoverageFrom`: `['server.js']`
- `coveragePathIgnorePatterns`: `['/node_modules/']`
- `testMatch`: `['**/__tests__/**/*.test.js']`

**`package.json`** — Updates:
- `scripts.test`: Change from placeholder to `'jest --watchAll=false'`
- `devDependencies`: Add `jest` and `supertest` with specific versions

### 0.5.6 Cross-File Test Dependencies

- **Shared fixtures:** No separate fixture files — expected response values defined as constants within each test file
- **Mock objects:** `jest.spyOn(console, 'log')` used in lifecycle tests; no shared mock modules
- **Test utilities:** No shared helper functions required given the simplicity of the application
- **Import updates:** Both test files will `require('../server')` to access the exported Express `app` instance

## 0.6 Dependency Inventory

### 0.6.1 Testing Dependencies

All testing packages will be added as `devDependencies` in `package.json`. The existing runtime dependency (`express@^5.2.1`) remains unchanged.

| Registry | Package Name | Version | Purpose |
|----------|-------------|---------|---------|
| npm | jest | 30.3.0 | Testing framework — test runner, assertion library, mocking, and built-in code coverage |
| npm | supertest | 7.2.2 | HTTP assertions library — sends requests to Express app, validates responses, status codes, and headers |

**Version validation:**
- `jest@30.3.0` — Published to npm registry; requires Node.js ≥18.x; our runtime v20.19.5 satisfies this constraint; MIT license
- `supertest@7.2.2` — Published to npm registry; SuperAgent-driven HTTP testing library; compatible with Express 5.x; MIT license

**Packages explicitly NOT required (and why):**
- `chai` — Jest includes built-in `expect()` assertions; no separate assertion library needed
- `sinon` — Jest includes `jest.spyOn()`, `jest.fn()`, and `jest.mock()` for mocking; no separate library needed
- `nyc` / `c8` — Jest 30.x includes built-in V8 coverage provider via `--coverage` flag; no separate coverage tool needed
- `mocha` — Jest was selected over Mocha as it provides an all-in-one solution with fewer dependencies
- `@types/jest` — Not needed; this is a plain JavaScript (not TypeScript) project

### 0.6.2 Import Updates

**Test files requiring import statements:**

- `__tests__/server.test.js`:
  ```
  const request = require('supertest');
  const app = require('../server');
  ```

- `__tests__/server.lifecycle.test.js`:
  ```
  const app = require('../server');
  ```

**Source file import changes:** None — `server.js` continues to use `const express = require('express')` unchanged. The only structural change is adding `module.exports = app` to export the app instance.

**Import transformation rules:**
- All test files use `require('../server')` to import the Express `app` object (one level up from `__tests__/` directory)
- Supertest is imported via `require('supertest')` in HTTP test files only
- No import path changes to existing source code — only an added export

## 0.7 Coverage and Quality Targets

### 0.7.1 Coverage Metrics

| Metric | Current | Target | Rationale |
|--------|---------|--------|-----------|
| Line coverage | 0% (no tests exist) | 100% | All 23 lines of `server.js` are testable; the app is trivially small |
| Branch coverage | 0% (no tests exist) | 100% | Minimal branching logic — only Express routing decisions |
| Function coverage | 0% (no tests exist) | 100% | Two route handler functions plus one listen callback |
| Statement coverage | 0% (no tests exist) | 100% | Every statement is deterministic and reachable |

**Coverage gaps to address:**

| Component | Current Coverage | Target Coverage | Focus Areas |
|-----------|-----------------|-----------------|-------------|
| `GET /` handler (lines 11–14) | 0% | 100% | Response body, Content-Type header, status code |
| `GET /evening` handler (lines 16–19) | 0% | 100% | Response body, Content-Type header, status code |
| Security config (line 9) | 0% | 100% | X-Powered-By header suppression |
| Server binding (lines 21–23) | 0% | 100% | Listen callback execution, console.log output |
| Module import + constants (lines 1–6) | 0% | 100% | Covered implicitly when app is required |
| Express 404 default handler | N/A (framework code) | Behavioral coverage | 404 status, error response body |

### 0.7.2 Test Quality Criteria

**Assertion density expectations:**
- Each `it()`/`test()` block should contain at least 1–3 focused assertions
- Every test should assert at least one of: status code, response body, or header value
- Avoid over-assertion in a single test — prefer separate tests for distinct behaviors

**Test isolation requirements:**
- Each test must be independent and executable in any order
- No shared mutable state between tests
- Supertest creates fresh connections per request — no server state leaks
- `console.log` spies must be restored after each test via `jest.restoreAllMocks()`

**Performance constraints:**
- Total test suite execution should complete in under 10 seconds (given the trivial application size)
- No artificial `setTimeout` or `sleep` calls — all tests should be near-instantaneous
- Jest's `--maxWorkers=2` used if parallel execution is needed

**Maintainability standards:**
- Test descriptions must clearly state what is being verified: `'GET / returns Hello, World! with status 200'`
- Use `describe` blocks to group tests by endpoint or behavior category
- Follow the repository's coding conventions: 2-space indentation, single quotes, semicolons, `const` declarations

## 0.8 Scope Boundaries

### 0.8.1 Exhaustively In Scope

**New test files:**
- `__tests__/server.test.js` — Primary HTTP test suite for all route handlers, headers, status codes, error handling, and edge cases
- `__tests__/server.lifecycle.test.js` — Server startup/shutdown lifecycle tests

**Source file updates (minimal, for testability only):**
- `server.js` — Add `module.exports = app` export and `require.main === module` guard around `app.listen()` call

**Test configuration:**
- `jest.config.js` — New Jest configuration file with node test environment and coverage settings
- `package.json` — Update `scripts.test` to run Jest; add `devDependencies` for `jest` and `supertest`

**Test scope by behavior:**
- HTTP response body assertions for `GET /` and `GET /evening`
- HTTP status code assertions (200, 404)
- Header assertions (`Content-Type`, `X-Powered-By` absence)
- Express default 404 error handling for unmatched routes
- HTTP method handling (GET, POST, PUT, DELETE, PATCH, HEAD on all endpoints)
- Edge case handling (query parameters, trailing slashes, case sensitivity, undefined paths)
- Server startup verification (listen callback, console output)
- Server shutdown verification (close behavior)

### 0.8.2 Explicitly Out of Scope

- **CI/CD workflow files** — Explicitly prohibited per user rule: "Do not make any updates or changes in GitHub App to create or update a workflow." No `.github/workflows/` files will be created or modified
- **Source code refactoring** — Beyond the minimal `module.exports` addition for testability, no refactoring, feature additions, or structural changes to `server.js`
- **Performance testing / load testing** — No throughput benchmarks, latency measurements, or stress tests (the project has no performance requirements per Section 2.4.2)
- **Security testing** — No penetration testing, input validation testing, or OWASP scanning (the application accepts no user input and binds to loopback only)
- **End-to-end testing** — No browser-based or UI testing (the project has no frontend)
- **Linting / formatting setup** — No ESLint, Prettier, or other code quality tools will be added
- **TypeScript conversion** — No TypeScript types, `@types/` packages, or type definitions
- **Docker / containerization** — No Dockerfile or container testing setup
- **Database testing** — Not applicable; no database exists
- **Additional Express middleware** — No middleware additions, CORS setup, or body parser configuration
- **README.md updates** — Documentation updates are not part of the testing scope unless explicitly needed for testing instructions
- **Unrelated test files** — No tests for `package.json` configuration or `README.md` content validation

## 0.9 Execution Parameters

### 0.9.1 Testing-Specific Instructions

**Environment prerequisites:**
- Node.js v20.19.5 (Iron LTS)
- npm 10.8.2
- Express.js 5.2.1 (existing runtime dependency)
- Jest 30.3.0 and Supertest 7.2.2 (new `devDependencies` to be installed)

**Test execution commands:**

| Command | Purpose |
|---------|---------|
| `npm test` | Run all tests once via Jest (non-watch mode) |
| `npx jest --watchAll=false --ci` | CI-compatible single-run execution |
| `npx jest --coverage` | Run tests with V8 code coverage report |
| `npx jest __tests__/server.test.js` | Run only the HTTP response test suite |
| `npx jest __tests__/server.lifecycle.test.js` | Run only the server lifecycle test suite |
| `npx jest --verbose` | Run tests with detailed per-test output |
| `npx jest --detectOpenHandles` | Detect and report open handles preventing Jest from exiting cleanly |

**Coverage measurement command:**
```
npx jest --coverage --coverageReporters=text --coverageReporters=lcov
```

**Single test execution pattern:**
```
npx jest --testPathPatterns "server.test" --watchAll=false
```

**Debug mode execution:**
```
node --inspect-brk node_modules/.bin/jest --runInBand
```

### 0.9.2 Test Patterns and Conventions

**Specific test patterns to follow in the repository:**
- CommonJS `require()` imports in all test files (matching `server.js` conventions)
- 2-space indentation, single quotes, semicolons (matching repository coding conventions)
- `describe` blocks group tests by endpoint or feature (e.g., `describe('GET /', ...)`)
- `it` or `test` blocks define individual test cases with clear descriptions
- Supertest's chainable API for HTTP assertions: `request(app).get('/').expect(200)`
- `beforeAll` / `afterAll` for setup/teardown of server lifecycle tests
- `jest.spyOn()` for mocking `console.log` in lifecycle tests
- `jest.restoreAllMocks()` in `afterEach` blocks to prevent mock leaks

**Excluded test categories per user instruction:**
- No performance/benchmark tests
- No security/penetration tests
- No end-to-end/browser tests

**Environment setup requirements for tests:**
- Install `devDependencies` via `npm install`
- Ensure port 3000 is not in use when running lifecycle tests that explicitly test `app.listen()`
- No environment variables required — the application uses hardcoded configuration

## 0.10 Special Instructions for Testing

### 0.10.1 Testing-Specific Requirements

The following directives govern the testing implementation:

- **Minimal change principle for source code:** The ONLY modification to `server.js` is adding `module.exports = app` and wrapping the `app.listen()` call in a `require.main === module` guard. No other source code changes are permitted. The modification must preserve identical runtime behavior when executed via `npm start` or `node server.js`.

- **No CI/CD workflow creation:** Per the user-specified rule — `"Do not make any updates or changes in GitHub App to create or update a workflow."` — no `.github/workflows/` files will be created. Testing is executed locally via `npm test` only.

- **Follow CommonJS module conventions:** All test files must use `require()` and `module.exports` syntax, matching the existing `server.js` coding style. Do not use ES module `import`/`export` syntax.

- **Match existing code style:** Tests must follow the repository's established conventions:
  - 2-space indentation
  - Single quotes for strings
  - Semicolons at end of statements
  - `const` for all variable declarations
  - No trailing whitespace

- **Ensure test isolation:** All tests must run independently and in any order. No test should depend on the execution or result of another test. Supertest creates ephemeral connections per request, ensuring no port conflicts between test files.

- **Use Jest built-in capabilities:** Prefer Jest's native mocking (`jest.spyOn`, `jest.fn`), assertions (`expect`), and coverage (`--coverage`) over external libraries. This keeps the dependency footprint minimal (only `jest` and `supertest` added).

- **Clean up after each test:** Use `afterEach(() => jest.restoreAllMocks())` to restore any mocked functions between tests. For lifecycle tests that call `app.listen()`, ensure `server.close()` is called in `afterAll` or `afterEach` to release the bound port.

- **Preserve exact response assertions:** The `GET /` response body includes a trailing newline character (`Hello, World!\n`). Tests must assert the exact string including this newline. The `GET /evening` response body is `Good evening` with no trailing newline.

### 0.10.2 Architectural Decision: App/Server Separation

The most significant implementation decision is separating the Express `app` from the `server.listen()` call. This is the universally accepted pattern for testing Express applications with Supertest:

**Before (current `server.js`):**
```javascript
const app = express();
// ... routes ...
app.listen(port, hostname, () => { ... });
```

**After (testable `server.js`):**
```javascript
const app = express();
// ... routes ...
if (require.main === module) {
  app.listen(port, hostname, () => { ... });
}
module.exports = app;
```

This pattern ensures:
- `npm start` and `node server.js` continue to work identically (direct execution)
- `require('./server')` in test files returns the `app` without starting the server
- Supertest binds the app to an ephemeral port internally, avoiding port conflicts
- No changes to the application's HTTP behavior, routing, or response content

