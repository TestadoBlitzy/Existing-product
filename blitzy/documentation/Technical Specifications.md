# Technical Specification

# 0. Agent Action Plan

## 0.1 Intent Clarification

### 0.1.1 Core Testing Objective

Based on the provided requirements, the Blitzy platform understands that the testing objective is to **add a comprehensive, ground-up automated test suite** to a Node.js/Express.js 5 application that currently has zero automated test coverage. The codebase (`hello_world`) is a production-oriented HTTP API server with nine runtime dependencies, four GET endpoints, a 9-layer middleware pipeline, and deliberate testability patterns—but no test infrastructure whatsoever.

**Request Category:** Add new tests (greenfield test suite)

The testing requirements translate to the following deliverables:

- **Unit tests** for pure utility modules (`sanitizer.js`, `config/index.js`) and middleware factories (`validateInput.js`, `notFound.js`, `errorHandler.js`) that can be tested in isolation with mock `req`/`res`/`next` objects
- **Integration tests** for all four HTTP endpoints (`GET /`, `GET /health`, `GET /api`, `GET /api/info`) exercised through the complete Express middleware pipeline using in-process HTTP requests via the application factory pattern in `src/app.js`
- **Behavioral contract tests** for 405 Method Not Allowed enforcement on all endpoints, 404 handling for unknown routes, rate-limiting rejection at 429, and validation rejection at 400
- **Environment-dependent behavior tests** for production error masking (CWE-209) versus non-production diagnostic output in `errorHandler.js`
- **Lightweight server lifecycle tests** for `server.js` bootstrap, graceful shutdown signal handling (`SIGTERM`/`SIGINT`), and unhandled error safety nets (`unhandledRejection`/`uncaughtException`)
- **Configuration module tests** for environment variable parsing, safe defaults, `parseIntSafe()` edge cases, and `Object.freeze()` immutability enforcement
- **Sanitization edge-case tests** for ANSI escape stripping, control character removal, HTML entity encoding, and length truncation boundaries

Implicit testing needs surfaced from repository analysis:

- The `src/utils/logger.js` module creates real file transports during import—tests must suppress file I/O by mocking Winston or the logger module to prevent `logs/combined.log` and `logs/error.log` side effects
- The `src/config/index.js` module reads `process.env` at module-load time via CommonJS `require()`—configuration tests require cache-clearing (`jest.resetModules()`) and controlled `process.env` manipulation between test cases
- The rate limiter in `src/app.js` maintains per-process state—integration tests that hit the rate limit threshold must account for state accumulation across requests within the same test or use isolated app instances
- Express 5's async promise support means rejected promises in route handlers automatically flow to the error handler, which should be verified in error-path tests

### 0.1.2 Special Instructions and Constraints

The user has provided the following directives that constrain the testing implementation:

- **Minimal Change Clause**: "Make only the changes that are absolutely necessary to implement comprehensive testing coverage." Existing production code must remain untouched unless strictly required for testability. No refactoring, no interface changes, no feature additions.
- **Implementation Rule — No CI/CD workflow creation**: "Do not make any updates or changes in GitHub App to create or update a workflow." Tests must be CI-ready but no pipeline files (`.github/workflows/`, Jenkinsfiles, etc.) shall be created.
- **Framework Preference**: Use Jest or Vitest as the primary test runner with Supertest for HTTP integration testing. Prefer the lightest setup that integrates cleanly with CommonJS and Node 18+.
- **Mocking Strategy**: Prefer real integration testing for Express app behavior. Use mocking only for isolation-critical scenarios: `process.on`/`process.exit` spying, environment variable control, prevention of real file logging side effects, and simulating exceptional conditions.
- **Test Data Simplicity**: Keep fixtures minimal and inline. No database seeding, no large fixture systems. Use small helper factories for mock `req`/`res`/`next` and controlled environment variable setup/teardown.
- **Documentation Scope**: Add only minimal testing documentation—how to run tests, how to run coverage, and conventions for adding new tests. Do not expand into broad project documentation.
- **No Source Modification**: "Do NOT modify source code unless absolutely necessary for testability." The existing application factory pattern already enables test imports without server binding.

### 0.1.3 Technical Interpretation

These testing requirements translate to the following technical test implementation strategy:

- To **test pure utility functions**, we will create `tests/utils/sanitizer.test.js` exercising `sanitizeLogInput()` and `sanitizeUrl()` with boundary-value inputs (null, undefined, empty string, ANSI escape sequences, control characters, strings exceeding `MAX_LOG_LENGTH` of 1,000 and `MAX_URL_LENGTH` of 2,048, and HTML special characters)
- To **test configuration parsing**, we will create `tests/config/index.test.js` manipulating `process.env` before each fresh `require()` of the config module, validating default values, custom overrides, `parseIntSafe()` edge cases (including valid `0`), and `Object.freeze()` immutability
- To **test input validation middleware**, we will create `tests/middleware/validateInput.test.js` invoking the factory with Zod schemas and passing mock request/response objects to verify 400 rejection and `next()` pass-through
- To **test the 404 handler**, we will create `tests/middleware/notFound.test.js` with mock objects verifying the 404 JSON response structure, URL sanitization in the response body, and logger invocation
- To **test the centralized error handler**, we will create `tests/middleware/errorHandler.test.js` verifying status code resolution (`err.statusCode` → `err.status` → `500`), production error masking, non-production stack trace inclusion, and sanitized log output
- To **test route behavior via integration**, we will create `tests/routes/index.test.js`, `tests/routes/health.test.js`, and `tests/routes/api.test.js` using Supertest against the Express app imported from `src/app.js`, validating response status codes, JSON structure, security headers, 405 enforcement with `Allow: GET, HEAD`, and validation rejection
- To **test the full middleware pipeline**, we will create `tests/app.test.js` verifying end-to-end request processing including rate limiting (429), unknown route handling (404), and error propagation through the centralized error handler
- To **test server lifecycle**, we will create `tests/server.test.js` verifying signal handler registration, graceful shutdown behavior, and unhandled error safety nets by spying on `process.on`, `process.exit`, and `server.close()`
- To **test logger behavior**, we will create `tests/utils/logger.test.js` with lightweight assertions on the exported logger shape, stream adapter presence, and Morgan-compatible `write()` method—without over-mocking Winston internals

### 0.1.4 Coverage Requirements Interpretation

**Explicit coverage targets from user requirements:**
- At least **90% line/function coverage overall**
- **Near-complete coverage** for core HTTP behavior, validation, sanitization, and error handling
- **Full coverage** of critical request/response and middleware contracts

**Implicit coverage expectations based on analysis:**
- `src/utils/sanitizer.js` — **100% line and branch coverage** (pure functions, zero dependencies, security-critical CWE-117 and CWE-209 protection)
- `src/middleware/validateInput.js` — **100% function coverage** (input validation gate, injection prevention)
- `src/middleware/errorHandler.js` — **100% branch coverage** including both the production masking path (`isProduction && isServerError`) and the non-production diagnostic path
- `src/middleware/notFound.js` — **100% line coverage** (simple, deterministic handler)
- `src/config/index.js` — **100% branch coverage** including `parseIntSafe()` edge cases (valid `0`, `NaN`, undefined)
- `src/routes/*.js` — **100% endpoint coverage** for all four GET routes and all four 405 enforcement handlers
- `src/app.js` — **≥90% line coverage** via integration tests exercising the full pipeline
- `server.js` — **≥80% line coverage** where feasible through process event spying and server lifecycle mocking
- `src/utils/logger.js` — **≥70% line coverage** with lightweight module shape assertions

To achieve comprehensive testing, coverage should include all happy-path responses, all error responses (400, 404, 405, 429, 500), environment-dependent branching (production vs. development), input validation rejection, sanitization boundary conditions, and configuration default/override paths.

## 0.2 Test Discovery and Analysis

### 0.2.1 Existing Test Infrastructure Assessment

Repository analysis confirms the codebase has **zero automated test infrastructure**. The following exhaustive search was conducted:

**Test Files — None Found:**

| Expected Artifact | Status | Evidence |
|---|---|---|
| `__tests__/` directory | ❌ Not present | Root folder listing contains only `src/`, `blitzy/`, and config files |
| `test/` or `tests/` directory | ❌ Not present | No test directory at any level of the repository |
| `*.test.js` or `*.spec.js` files | ❌ Not present | No test files anywhere in the source tree |
| `jest.config.js` / `jest.config.ts` | ❌ Not present | No Jest configuration file |
| `vitest.config.js` / `vitest.config.ts` | ❌ Not present | No Vitest configuration file |
| `.mocharc.yml` / `.mocharc.json` | ❌ Not present | No Mocha configuration |
| `.nycrc` / `nyc.config.js` / `.c8rc` | ❌ Not present | No coverage tool configuration |
| `pytest.ini` / `karma.conf.js` | ❌ Not present | No alternative test framework config |
| `.github/workflows/` | ❌ Not present | No CI/CD pipeline configuration |

**Test Script — Placeholder Only:**

The `package.json` contains a no-op test script at line 12:
```json
"test": "echo \"Error: no test specified\" && exit 1"
```

This placeholder exits with code 1, confirming no test runner is configured.

**Development Dependencies — None:**

The `package.json` declares exactly **zero** `devDependencies`. No testing framework, assertion library, mocking utility, or coverage tool is present in the project.

**Testability Patterns — Already Implemented:**

Despite the absence of tests, the codebase incorporates four deliberate testability patterns identified during analysis:

| Pattern | Location | Testability Benefit |
|---|---|---|
| Application Factory | `src/app.js` exports configured Express app without `app.listen()` | Enables Supertest in-process HTTP testing without port binding |
| Pure Utility Functions | `src/utils/sanitizer.js` has zero dependencies and deterministic behavior | Direct invocation with boundary-value test inputs |
| Middleware Factory | `src/middleware/validateInput.js` returns `(req, res, next)` functions | Testable with mock Express objects |
| Immutable Configuration | `src/config/index.js` uses `Object.freeze()` and reads `process.env` | Controllable via environment variable injection |

**Repository analysis reveals:** A Node.js/Express.js 5 application with a CommonJS module system, zero test infrastructure, and a placeholder npm test script. The codebase has strong testability architecture but requires complete test framework installation and test suite creation from scratch.

### 0.2.2 Current Testing Framework and Tooling

| Aspect | Current State |
|---|---|
| Testing framework | None installed |
| Test runner configuration | None |
| Coverage tools in use | None |
| Mock/stub libraries | None |
| Test data fixtures or factories | None |
| Test helper utilities | None |
| Linting/static analysis | None |
| Pre-commit hooks | None |

### 0.2.3 Source Module Inventory for Test Targeting

The following source modules were identified through deep repository analysis and require test coverage:

| Source Module | Lines | Dependencies | Testability Tier |
|---|---|---|---|
| `src/utils/sanitizer.js` | 193 | Zero (pure functions) | Tier 1 — Direct unit testing |
| `src/config/index.js` | 38 | `process.env` only | Tier 1 — Env-controlled unit testing |
| `src/middleware/validateInput.js` | 90 | `zod` | Tier 2 — Mock req/res/next |
| `src/middleware/notFound.js` | 54 | `logger`, `sanitizer` | Tier 2 — Mock req/res/next + logger |
| `src/middleware/errorHandler.js` | 102 | `logger`, `sanitizer` | Tier 2 — Mock req/res/next + logger |
| `src/routes/index.js` | 78 | `express`, `validateInput`, sub-routers | Tier 3 — Supertest integration |
| `src/routes/health.js` | 63 | `express`, `validateInput` | Tier 3 — Supertest integration |
| `src/routes/api.js` | 93 | `express`, `config`, `validateInput` | Tier 3 — Supertest integration |
| `src/app.js` | 193 | All middleware, routes, config, logger | Tier 3 — Full pipeline integration |
| `src/utils/logger.js` | 127 | `winston`, `config` | Tier 4 — Lightweight shape tests |
| `server.js` | 112 | `dotenv`, `app`, `config`, `logger` | Tier 4 — Process lifecycle spying |

### 0.2.4 Web Search Research Conducted

The following research was conducted to validate testing tool compatibility:

- **Jest 30 Compatibility with Node.js 20 and CommonJS**: Jest 30.3.0 is the latest stable version. Jest 30 drops support for Node 14, 16, 19, and 21 but fully supports Node 18.x and above, making it compatible with this project's Node.js 20.20.1 runtime. CommonJS modules continue to work without configuration changes.
- **Supertest 7.2.2 Compatibility with Express 5**: Supertest 7.2.2 is the latest stable version and provides a SuperAgent-driven HTTP testing library that accepts Express app instances directly — leveraging the application factory pattern in `src/app.js`.
- **Jest 30 Breaking Changes Assessment**: Jest 30 removes deprecated matcher aliases (e.g., `toBeCalled` → `toHaveBeenCalled`), renames `--testPathPattern` to `--testPathPatterns`, and bundles all modules into `index.js`. None of these changes affect a greenfield test suite since all tests will use canonical API names from the start.

## 0.3 Testing Scope Analysis

### 0.3.1 Test Target Identification

**Primary code to be tested:**

| Module/Class | Path | Test Types Required |
|---|---|---|
| `sanitizeLogInput()`, `sanitizeUrl()` | `src/utils/sanitizer.js` | Unit (pure function boundary-value tests) |
| `parseIntSafe()`, config object, freeze | `src/config/index.js` | Unit (env-controlled module reload tests) |
| `validateInput()` factory, `z` re-export | `src/middleware/validateInput.js` | Unit (mock req/res/next) |
| `notFound` middleware | `src/middleware/notFound.js` | Unit (mock req/res/next with logger mock) |
| `errorHandler` middleware | `src/middleware/errorHandler.js` | Unit (mock error/req/res/next with env toggling) |
| Root route `GET /`, 405 handler | `src/routes/index.js` | Integration (Supertest) |
| Health route `GET /health`, 405 handler | `src/routes/health.js` | Integration (Supertest) |
| API routes `GET /api`, `GET /api/info`, 405 handlers | `src/routes/api.js` | Integration (Supertest) |
| Middleware pipeline assembly, rate limiter | `src/app.js` | Integration (Supertest full-pipeline) |
| Logger singleton, stream adapter | `src/utils/logger.js` | Lightweight unit (module shape verification) |
| Bootstrap, shutdown, error safety nets | `server.js` | Lifecycle (process spy-based) |

**Existing test file mapping:**

| Source File | Existing Test File | Test Categories Present |
|---|---|---|
| `src/utils/sanitizer.js` | None | None |
| `src/config/index.js` | None | None |
| `src/middleware/validateInput.js` | None | None |
| `src/middleware/notFound.js` | None | None |
| `src/middleware/errorHandler.js` | None | None |
| `src/routes/index.js` | None | None |
| `src/routes/health.js` | None | None |
| `src/routes/api.js` | None | None |
| `src/app.js` | None | None |
| `src/utils/logger.js` | None | None |
| `server.js` | None | None |

**Dependencies requiring mocking:**

| Dependency | Mock Strategy | Consumers |
|---|---|---|
| `src/utils/logger` (Winston) | `jest.mock()` with no-op implementations to suppress file I/O in `logs/` directory | `notFound.js`, `errorHandler.js`, `app.js`, `server.js` |
| `process.env` | Direct assignment with `beforeEach`/`afterEach` cleanup | `config/index.js`, `errorHandler.js` |
| `process.on` / `process.exit` | `jest.spyOn()` to capture signal handler registration and exit calls | `server.js` |
| `process.uptime()` / `process.memoryUsage()` | `jest.spyOn()` for deterministic health endpoint responses | `routes/health.js` |
| `http.Server.prototype.listen` / `close` | `jest.spyOn()` or mock to prevent actual port binding in server lifecycle tests | `server.js` |
| File system (Winston transports) | Logger mock prevents `logs/combined.log` and `logs/error.log` writes | All modules importing logger |

### 0.3.2 Version Compatibility Research

Based on the current Node.js v20.20.1 runtime with Express 5.2.1 (CommonJS module system), the recommended testing stack:

| Category | Tool | Recommended Version | Compatibility Rationale |
|---|---|---|---|
| Testing Framework | Jest | `^30.3.0` | Latest stable; supports Node 18+; built-in assertion, mocking, and coverage; CommonJS-native; no Babel required |
| HTTP Integration | Supertest | `^7.2.2` | Latest stable; accepts Express app instances directly; SuperAgent-driven; compatible with Express 5 app factory pattern |
| Mocking | Jest built-in | Bundled with Jest 30 | `jest.mock()`, `jest.spyOn()`, `jest.fn()` sufficient for logger, process, and env mocking |
| Coverage | Jest `--coverage` | Bundled with Jest 30 | Istanbul/V8-based coverage reporting; no additional dependency |
| Assertion | Jest `expect` | Bundled with Jest 30 | Full matcher API including `toHaveBeenCalled`, `toMatchObject`, `toHaveProperty` |

**Version conflict analysis:** No conflicts detected. Jest 30 requires Node ≥18, this project runs Node 20.20.1. Supertest 7.x works with any Express version that exports an `http.Server`-compatible app. Express 5.2.1's app factory export is fully compatible. All packages use the npm public registry with no private registry requirements.

**Jest 30 vs Jest 29 decision rationale:** Jest 30.3.0 is selected over the older Jest 29.x line because this is a greenfield test suite with no existing tests to migrate, eliminating all breaking-change risks. Jest 30 provides performance improvements (bundled modules, improved memory cleanup), native `.mts`/`.cts` support, and the latest matcher API.

## 0.4 Test Implementation Design

### 0.4.1 Test Strategy Selection

**Test types to implement:**

- **Unit tests** — Focus on isolated, pure-function modules and middleware factories where real dependencies can be replaced with mocks. Targets: `sanitizer.js` (pure functions), `config/index.js` (env-controlled), `validateInput.js` (factory with mock req/res/next), `notFound.js` (mock req/res + logger mock), `errorHandler.js` (mock error/req/res + env toggling).
- **Integration tests** — Cover the complete Express middleware pipeline via Supertest against the `src/app.js` factory export. Validates actual HTTP semantics: status codes, response JSON structure, security headers, CORS, compression negotiation, and rate limiting. Targets: all four GET endpoints, 405 enforcement on all endpoints, 404 for unknown routes, 429 rate-limit rejection, validation rejection (400).
- **Edge case tests** — Address boundary conditions in sanitization (strings at exactly `MAX_LOG_LENGTH` and `MAX_URL_LENGTH`, strings with mixed ANSI/control/HTML characters), configuration parsing (PORT=0, empty strings, missing env vars), and validation (deeply nested unexpected properties, empty vs. absent body).
- **Error handling tests** — Verify the complete error flow: `err.statusCode` vs. `err.status` vs. default 500 precedence, production masking of 5xx errors, non-production stack trace inclusion, and sanitized log output for malicious URLs in error context.
- **Lifecycle tests** — Lightweight verification of `server.js` bootstrap and shutdown behavior through process event spying, without invasive production code changes.

### 0.4.2 Test Case Blueprint

```
Component: src/utils/sanitizer.js
Test Categories:
- Happy path: Normal strings pass through unchanged; empty string returns empty
- Edge cases: null/undefined → empty string; non-string coercion; exactly MAX_LOG_LENGTH chars
- ANSI stripping: ESC[31m red, ESC[0m reset, multi-sequence removal
- Control chars: \n, \r, \t, \x00, \x7f removal
- HTML encoding (sanitizeUrl): &, <, >, ", ' → entities
- Truncation: 1001-char string → 1000 + "...[truncated]"; 2049-char URL → 2048 + "...[truncated]"
```

```
Component: src/config/index.js
Test Categories:
- Happy path: Default values when env vars absent
- Custom overrides: PORT=8080, NODE_ENV=production, RATE_LIMIT_MAX=50
- Edge cases: PORT=0 (valid zero via parseIntSafe); PORT=abc (falls to default 3000)
- Immutability: Object.freeze() prevents mutation of config.port and config.rateLimit.max
- Nested freeze: config.rateLimit sub-object is independently frozen
```

```
Component: src/middleware/validateInput.js
Test Categories:
- Happy path: Valid empty body/query passes through to next()
- Validation failure: Unexpected query parameter → 400 with dot-notation path
- Empty schemas: No schemas provided → calls next() immediately
- Multiple segments: Both body and query schemas; fails on first invalid
- Error message format: Correct "Validation failed: query: ..." prefix
```

```
Component: src/middleware/notFound.js
Test Categories:
- Happy path: Returns 404 JSON with sanitized URL in message
- Edge cases: Malicious URL with HTML entities sanitized in response
- Logger call: logger.warn() invoked with sanitized URL
- Response termination: Does not call next()
```

```
Component: src/middleware/errorHandler.js
Test Categories:
- Status code resolution: err.statusCode=403 → 403; err.status=422 → 422; neither → 500
- Production masking: NODE_ENV=production + 500 → "Internal Server Error" message
- Non-production transparency: NODE_ENV=development + 500 → original error message + stack
- Client errors: 4xx errors retain specific message even in production
- Logging: logger.error() called with sanitized req.originalUrl and req.method
```

```
Component: src/routes/* (via Supertest integration)
Test Categories:
- Happy path: GET / → 200 + {status:"success", message:"Hello, World!..."}
- Happy path: GET /health → 200 + {status:"ok", uptime, timestamp, memory, nodeVersion}
- Happy path: GET /api → 200 + {status:"success", message:"Welcome to the API"}
- Happy path: GET /api/info → 200 + {status:"success", data:{version, environment, nodeVersion}}
- 405 enforcement: POST/PUT/PATCH/DELETE on each endpoint → 405 + Allow header
- Validation rejection: GET /?unexpected=param → 400
- 404 handling: GET /nonexistent → 404 JSON
```

```
Component: src/app.js (full pipeline integration)
Test Categories:
- Rate limiting: Rapid requests exceeding threshold → 429 JSON
- Security headers: Helmet CSP, HSTS, X-Content-Type-Options present
- CORS: Access-Control-Allow-Origin present
- Compression: Accept-Encoding: gzip → compressed response
- Error propagation: Errors flow to centralized error handler
```

```
Component: server.js (lifecycle)
Test Categories:
- Signal handlers: SIGTERM and SIGINT handlers registered via process.on()
- Error safety nets: unhandledRejection and uncaughtException handlers registered
- Bootstrap: app.listen() called with config.port and config.host
```

### 0.4.3 Existing Test Extension Strategy

Not applicable — no existing tests to extend. All test files are new creations.

### 0.4.4 Test Data and Fixtures Design

**Required test data structures:**

- **Sanitizer test inputs**: Inline string constants for ANSI sequences (`\x1b[31mred\x1b[0m`), control characters (`line1\nline2\r`), HTML entities (`<script>alert('xss')</script>`), and boundary-length strings generated programmatically
- **Mock req/res/next factories**: Lightweight factory functions returning objects with `jest.fn()` methods for `res.status()`, `res.json()`, `res.set()`, and `next()`
- **Environment variable sets**: Plain JavaScript objects for controlled `process.env` manipulation (`{ NODE_ENV: 'production', PORT: '8080' }`)
- **Mock error objects**: Simple `Error` instances with custom `statusCode` or `status` properties for error handler testing

**Fixture organization strategy:**

All test data is inline within test files. No separate fixture files are required because:
- Request/response expectations are tightly coupled to individual test cases
- Environment variable sets are 2–3 properties each
- Mock error objects are single-line constructions

**Mock object specifications:**

- **Mock logger**: `{ info: jest.fn(), warn: jest.fn(), error: jest.fn(), http: jest.fn(), stream: { write: jest.fn() } }` — prevents all Winston file I/O
- **Mock req**: `{ originalUrl: '/test', method: 'GET', body: {}, query: {}, params: {} }` — minimal Express request shape
- **Mock res**: `{ status: jest.fn().mockReturnThis(), json: jest.fn(), set: jest.fn().mockReturnThis() }` — chainable Express response shape
- **Mock next**: `jest.fn()` — captures middleware pass-through calls

**Test database/state management:** Not applicable — the application is stateless with no database. Rate limiter state is managed per-app-instance and resets between test suites.

## 0.5 Test File Transformation Mapping

### 0.5.1 File-by-File Test Plan

| Target Test File | Transformation | Source File/Reference | Purpose/Changes |
|---|---|---|---|
| `tests/utils/sanitizer.test.js` | CREATE | `src/utils/sanitizer.js` | Comprehensive unit tests for `sanitizeLogInput()` and `sanitizeUrl()` covering null/undefined, empty strings, ANSI escape stripping, control character removal, HTML entity encoding, truncation at MAX_LOG_LENGTH (1000) and MAX_URL_LENGTH (2048), and non-string coercion |
| `tests/config/index.test.js` | CREATE | `src/config/index.js` | Unit tests for environment variable parsing, default values for all 8 config properties, `parseIntSafe()` edge cases (valid 0, NaN, undefined), custom overrides, `Object.freeze()` immutability on root and nested `rateLimit` object |
| `tests/middleware/validateInput.test.js` | CREATE | `src/middleware/validateInput.js` | Unit tests for validation middleware factory: empty schemas pass-through, valid input calls `next()`, invalid query/body returns 400 with formatted error details, `z` re-export verification, fail-fast semantics |
| `tests/middleware/notFound.test.js` | CREATE | `src/middleware/notFound.js` | Unit tests for 404 handler: correct JSON response structure, URL sanitization in response body, `logger.warn()` invocation with sanitized input, response termination without calling `next()` |
| `tests/middleware/errorHandler.test.js` | CREATE | `src/middleware/errorHandler.js` | Unit tests for error handler: `err.statusCode`/`err.status`/default 500 precedence, production 5xx masking, non-production stack trace inclusion, 4xx message pass-through, sanitized log output |
| `tests/routes/index.test.js` | CREATE | `src/routes/index.js` | Integration tests via Supertest: `GET /` response validation (200, JSON structure), `POST /` → 405 with `Allow: GET, HEAD` header, validation rejection for unexpected query parameters |
| `tests/routes/health.test.js` | CREATE | `src/routes/health.js` | Integration tests via Supertest: `GET /health` response validation (200, status/uptime/timestamp/memory/nodeVersion fields), `POST /health` → 405, validation rejection |
| `tests/routes/api.test.js` | CREATE | `src/routes/api.js` | Integration tests via Supertest: `GET /api` (200, welcome message), `GET /api/info` (200, version/environment/nodeVersion), `POST /api` → 405, `DELETE /api/info` → 405, validation rejection |
| `tests/app.test.js` | CREATE | `src/app.js` | Full pipeline integration tests: rate limiter 429 behavior, 404 for unknown routes, security header presence (Helmet CSP, X-Content-Type-Options), CORS header, JSON content-type enforcement, error propagation to centralized handler |
| `tests/server.test.js` | CREATE | `server.js` | Lightweight lifecycle tests: signal handler registration (SIGTERM/SIGINT via `process.on`), error safety net registration (unhandledRejection/uncaughtException), graceful shutdown flow via `server.close()` spy |
| `tests/utils/logger.test.js` | CREATE | `src/utils/logger.js` | Lightweight module shape tests: exported logger has expected methods (info, warn, error, http), `logger.stream` property exists with `write()` method, Morgan-compatible stream trims trailing newlines |
| `tests/helpers/setup.js` | CREATE | N/A | Shared test setup: environment variable backup/restore utility, mock Express `req`/`res`/`next` factory functions, consistent logger mock configuration |
| `jest.config.js` | CREATE | N/A | Jest configuration: test file discovery pattern (`tests/**/*.test.js`), CommonJS environment, coverage thresholds (90% lines/functions), coverage collection from `src/**/*.js` and `server.js` |
| `package.json` | UPDATE | `package.json` | Replace placeholder test script with `jest --coverage --verbose`, add `test:watch` and `test:ci` scripts, add `devDependencies` for `jest` and `supertest` |

### 0.5.2 New Test Files Detail

**`tests/utils/sanitizer.test.js`** — Pure function unit tests
- Test categories: null/undefined handling, empty string passthrough, ANSI escape sequence removal, control character stripping, HTML entity encoding (`&`, `<`, `>`, `"`, `'`), truncation at boundary lengths, non-string type coercion (numbers, objects)
- Mock dependencies: None (zero-dependency pure functions)
- Assertions focus: Return value equality, string length verification, presence/absence of specific character patterns

**`tests/config/index.test.js`** — Environment-controlled configuration tests
- Test categories: Default values for all 8 properties, custom overrides via `process.env`, `parseIntSafe()` with `0`/`NaN`/missing values, `Object.freeze()` immutability verification
- Mock dependencies: `process.env` manipulation with `jest.resetModules()` for fresh `require()` on each test
- Assertions focus: Property equality, type checking, freeze mutation rejection (`TypeError` in strict mode or silent fail)

**`tests/middleware/validateInput.test.js`** — Middleware factory unit tests
- Test categories: No schemas → `next()` called, valid empty body/query → `next()` called, unexpected query parameter → 400 response, unexpected body property → 400 response, error message contains dot-notation field path
- Mock dependencies: Mock `req`, `res`, `next` objects
- Assertions focus: `next()` call count, `res.status()` arguments, `res.json()` payload structure

**`tests/middleware/notFound.test.js`** — 404 handler unit tests
- Test categories: Standard 404 response shape, URL sanitization in response, logger warning call, no `next()` invocation
- Mock dependencies: `src/utils/logger` mocked via `jest.mock()`
- Assertions focus: Response status 404, JSON body structure `{ status: 'error', statusCode: 404, message: 'Not Found - ...' }`

**`tests/middleware/errorHandler.test.js`** — Error handler unit tests
- Test categories: `err.statusCode` precedence, `err.status` fallback, default 500, production masking, non-production stack trace, client error message preservation
- Mock dependencies: `src/utils/logger` mocked, `process.env.NODE_ENV` toggled
- Assertions focus: Response status codes, message content, `stack` property presence/absence, logger invocation arguments

**`tests/routes/index.test.js`** — Root route integration tests
- Integration points: Supertest → Express app → Helmet → CORS → Compression → Body Parser → Morgan → Rate Limiter → Root Router → validateInput → Route Handler
- Test data requirements: Inline expectations; no fixtures needed

**`tests/routes/health.test.js`** — Health endpoint integration tests
- Integration points: Same full pipeline as root route, plus `process.uptime()`, `process.memoryUsage()`, `process.version` in response
- Test data requirements: Runtime-provided values; assertions use `expect.any(Number)` for dynamic fields

**`tests/routes/api.test.js`** — API endpoint integration tests
- Integration points: Full pipeline plus `package.json` version read and `config.env` in `/api/info` response
- Test data requirements: Expected version from `package.json`, expected environment from config defaults

**`tests/app.test.js`** — Full pipeline integration tests
- Integration points: Rate limiter threshold testing, unknown route → 404, error propagation, security header verification
- Test data requirements: Controlled request count for rate-limit testing

**`tests/server.test.js`** — Server lifecycle tests
- Integration points: `process.on()` spy, `app.listen()` mock, `server.close()` spy
- Test data requirements: Mock server and logger objects

**`tests/utils/logger.test.js`** — Logger module shape tests
- Test categories: Exported object has `info`/`warn`/`error`/`http` methods, `stream` property has `write()` method, `stream.write()` trims trailing newlines
- Mock dependencies: Minimal — tests module exports, not Winston internals
- Assertions focus: `typeof` checks, function existence, stream behavior

**`tests/helpers/setup.js`** — Shared test utilities
- Fixture types: `createMockReq()`, `createMockRes()`, `createMockNext()` factory functions; `backupEnv()`/`restoreEnv()` utilities for safe `process.env` manipulation

### 0.5.3 Test Configuration Updates

| Config File | Update Description |
|---|---|
| `jest.config.js` | CREATE — Define `testEnvironment: 'node'`, `testMatch: ['**/tests/**/*.test.js']`, coverage collection from `['src/**/*.js', 'server.js']`, coverage thresholds at 90% lines/functions, `coveragePathIgnorePatterns: ['/node_modules/', '/tests/']` |
| `package.json` | UPDATE — Replace `"test"` script with `"jest --coverage --verbose"`, add `"test:watch": "jest --watch"`, add `"test:ci": "jest --coverage --ci --watchAll=false"`, add `devDependencies` block with `jest` and `supertest` |

### 0.5.4 Cross-File Test Dependencies

**Shared fixtures:**
- `tests/helpers/setup.js` — Imported by middleware unit tests (`validateInput.test.js`, `notFound.test.js`, `errorHandler.test.js`) and server lifecycle tests for mock object factories and environment utilities

**Mock objects:**
- Logger mock defined once in `jest.mock('../src/utils/logger')` pattern, applied per-file in middleware and route tests to suppress Winston file transports

**Test utilities:**
- `createMockReq(overrides)` — Creates minimal Express request object with customizable `originalUrl`, `method`, `body`, `query`, `params`
- `createMockRes()` — Creates chainable Express response object with `status()`, `json()`, `set()` as `jest.fn()` methods
- `createMockNext()` — Returns `jest.fn()` for middleware pass-through verification
- `withEnv(vars, fn)` — Temporarily sets environment variables, runs function, restores original values

**Import updates required:**
- All test files use relative imports to source modules (e.g., `require('../../src/utils/sanitizer')`)
- Integration tests import `src/app.js` directly for Supertest usage: `const app = require('../../src/app')`
- Server lifecycle tests require controlled `require()` with `jest.resetModules()` to avoid cached module state

## 0.6 Dependency Inventory

### 0.6.1 Testing Dependencies

All testing packages are installed as `devDependencies` only, keeping the production dependency surface unchanged at exactly nine packages.

| Registry | Package Name | Version | Purpose |
|---|---|---|---|
| npm | `jest` | `^30.3.0` | Primary test framework — assertion, mocking, coverage, and test runner. Supports Node ≥18, CommonJS natively. Latest stable release with bundled modules and memory leak fixes. |
| npm | `supertest` | `^7.2.2` | HTTP integration testing library — sends in-process requests to the Express app via `src/app.js` factory export without binding to a network port. SuperAgent-driven, promise-compatible. |

**Rationale for minimal dependency set:**

- **Jest alone provides** assertion (`expect`), mocking (`jest.mock`, `jest.spyOn`, `jest.fn`), coverage (`--coverage` via Istanbul/V8), and test running — no additional assertion library, mocking library, or coverage tool is needed
- **Supertest** is the standard Express integration testing library, directly compatible with the application factory pattern
- No additional packages (such as `sinon`, `chai`, `nyc`, or `c8`) are required, keeping the `devDependencies` footprint to exactly two packages

### 0.6.2 Runtime Dependencies (Existing — Unchanged)

The following production dependencies remain completely unchanged. Listed for reference as they form the application under test:

| Registry | Package Name | Resolved Version | Purpose |
|---|---|---|---|
| npm | `express` | 5.2.1 | Core web framework |
| npm | `helmet` | 8.1.0 | Security response headers |
| npm | `cors` | 2.8.6 | Cross-Origin Resource Sharing |
| npm | `compression` | 1.8.1 | Response body compression |
| npm | `morgan` | 1.10.1 | HTTP request access logging |
| npm | `express-rate-limit` | 8.3.1 | Request rate throttling |
| npm | `winston` | 3.19.0 | Structured logging with transports |
| npm | `dotenv` | 17.3.1 | Environment variable loading |
| npm | `zod` | 3.25.76 | Schema validation |

### 0.6.3 Import Updates

**Test files requiring specific import patterns:**

- `tests/utils/sanitizer.test.js` — Direct import:
  ```javascript
  const { sanitizeLogInput, sanitizeUrl } = require('../../src/utils/sanitizer');
  ```
- `tests/config/index.test.js` — Cache-clearing import pattern for fresh module state:
  ```javascript
  jest.resetModules();
  const config = require('../../src/config');
  ```
- `tests/middleware/*.test.js` — Logger mock applied before import:
  ```javascript
  jest.mock('../../src/utils/logger');
  ```
- `tests/routes/*.test.js` and `tests/app.test.js` — Supertest wrapping app import:
  ```javascript
  const request = require('supertest');
  const app = require('../../src/app');
  ```
- `tests/server.test.js` — Controlled require with full module reset and process spying:
  ```javascript
  jest.resetModules();
  jest.mock('../../src/utils/logger');
  ```

**Import transformation rules:**
- All test files import source modules via relative paths from the `tests/` directory
- No path aliases or module name mapping is required — Jest resolves CommonJS `require()` natively
- Logger mock declarations must precede any imports of modules that depend on the logger (middleware, routes, app, server) to ensure the mock is in place during module initialization

## 0.7 Coverage and Quality Targets

### 0.7.1 Coverage Metrics

**Current coverage:** 0% — No automated tests exist. The `package.json` test script is a no-op placeholder.

**Target coverage:** ≥90% line and function coverage overall, based on the user's explicit requirement of "at least 90% line/function coverage overall and near-complete coverage for core HTTP behavior."

**Coverage gaps to address:**

| Component | Current | Target | Focus Areas |
|---|---|---|---|
| `src/utils/sanitizer.js` | 0% | 100% | All code paths: null handling, ANSI stripping, control char removal, HTML encoding, truncation |
| `src/config/index.js` | 0% | 100% | Default values, custom overrides, `parseIntSafe()` NaN/0/valid branches, freeze verification |
| `src/middleware/validateInput.js` | 0% | 100% | Empty schemas, valid input, validation failure, error formatting |
| `src/middleware/notFound.js` | 0% | 100% | Response construction, logger call, URL sanitization |
| `src/middleware/errorHandler.js` | 0% | 100% | Status code resolution (3 branches), production masking, stack trace toggling |
| `src/routes/index.js` | 0% | 100% | GET / response, 405 handler |
| `src/routes/health.js` | 0% | 100% | GET /health response, 405 handler |
| `src/routes/api.js` | 0% | 100% | GET /api, GET /api/info, both 405 handlers |
| `src/app.js` | 0% | ≥90% | Middleware pipeline exercised via integration tests; rate limiter handler branch |
| `src/utils/logger.js` | 0% | ≥70% | Module export shape, stream adapter; transport internals not targeted |
| `server.js` | 0% | ≥80% | Signal handlers, error safety nets; `app.listen()` callback branch |

**Per-file coverage targets:**

| File | Lines Target | Branches Target | Functions Target |
|---|---|---|---|
| `src/utils/sanitizer.js` | 100% | 100% | 100% |
| `src/config/index.js` | 100% | 100% | 100% |
| `src/middleware/validateInput.js` | 100% | 100% | 100% |
| `src/middleware/notFound.js` | 100% | 100% | 100% |
| `src/middleware/errorHandler.js` | 100% | 100% | 100% |
| `src/routes/*.js` | 100% | 100% | 100% |
| `src/app.js` | ≥90% | ≥85% | ≥90% |
| `src/utils/logger.js` | ≥70% | ≥60% | ≥80% |
| `server.js` | ≥80% | ≥70% | ≥80% |

### 0.7.2 Test Quality Criteria

**Assertion density expectations:**
- Each test case should contain at least one meaningful assertion beyond status code verification
- Integration tests should validate both response status and response body structure
- Middleware unit tests should verify both the positive path (`next()` called) and negative path (`res.status().json()` called)

**Test isolation requirements:**
- Each test file must be independently runnable via `jest tests/path/to/file.test.js`
- Environment variable changes must be reverted in `afterEach` or `afterAll` hooks
- Logger mocks must be reset between tests to prevent assertion pollution
- Rate limiter state must not leak between integration test suites (use separate app imports or reset mechanisms)
- No test should depend on execution order within a file or across files

**Performance constraints for test execution:**
- The entire test suite should complete in under 30 seconds for local development
- Unit tests (sanitizer, config, middleware) should complete in under 5 seconds
- Integration tests (routes, app) should complete in under 15 seconds
- Server lifecycle tests should complete in under 5 seconds
- No individual test case should exceed 5 seconds

**Maintainability standards:**
- Test file names mirror source file names with `.test.js` suffix
- Test directory structure mirrors `src/` directory structure
- `describe` blocks map to module or function names
- `it`/`test` descriptions clearly state behavior being verified in natural language
- Mock setup is co-located with its test suite, not hidden in global setup files
- Inline test data preferred over external fixture files for readability

**Following repository conventions:**
- CommonJS `require()` / `module.exports` used throughout (matching source code)
- Strict mode (`'use strict'`) in test files matching source conventions
- JSON response structure assertions match the documented API contracts exactly

## 0.8 Scope Boundaries

### 0.8.1 Exhaustively In Scope

**New test files:**
- `tests/utils/sanitizer.test.js` — Unit tests for sanitization functions
- `tests/utils/logger.test.js` — Lightweight logger module shape tests
- `tests/config/index.test.js` — Configuration parsing and immutability tests
- `tests/middleware/validateInput.test.js` — Validation middleware factory tests
- `tests/middleware/notFound.test.js` — 404 handler tests
- `tests/middleware/errorHandler.test.js` — Error handler tests with env toggling
- `tests/routes/index.test.js` — Root route integration tests
- `tests/routes/health.test.js` — Health endpoint integration tests
- `tests/routes/api.test.js` — API routes integration tests
- `tests/app.test.js` — Full middleware pipeline integration tests
- `tests/server.test.js` — Server lifecycle and process event tests
- `tests/helpers/setup.js` — Shared test utilities and mock factories

**Test configuration files:**
- `jest.config.js` — Jest configuration with coverage thresholds, test patterns, and environment settings

**Package manifest updates:**
- `package.json` — `devDependencies` addition (`jest`, `supertest`), test script replacement, additional test convenience scripts

**Source files covered by tests (read-only, no modifications):**
- `src/utils/sanitizer.js`
- `src/utils/logger.js`
- `src/config/index.js`
- `src/middleware/validateInput.js`
- `src/middleware/notFound.js`
- `src/middleware/errorHandler.js`
- `src/routes/index.js`
- `src/routes/health.js`
- `src/routes/api.js`
- `src/app.js`
- `server.js`

### 0.8.2 Explicitly Out of Scope

**Source code modifications:**
- No changes to any `src/**/*.js` file unless absolutely required for testability (none identified; the application factory pattern already enables testing)
- No changes to `server.js` runtime behavior
- No refactoring of existing middleware, routes, or utilities

**Features and functionality:**
- No new API endpoints, routes, or middleware
- No authentication, authorization, or session management
- No database connectivity or persistence layer
- No WebSocket or real-time communication support
- No HTTPS termination or TLS configuration
- No frontend, UI, or browser-based rendering

**Infrastructure and deployment:**
- No CI/CD pipeline creation (explicitly prohibited by user implementation rule: "Do not make any updates or changes in GitHub App to create or update a workflow")
- No GitHub Actions, Jenkins, GitLab CI, or other automation pipeline files
- No Docker, Kubernetes, or container configuration changes
- No PM2 cluster-mode runtime validation in live multi-process mode
- No reverse proxy or load balancer configuration

**Testing categories excluded:**
- No browser/UI tests
- No database integration tests
- No cloud infrastructure tests
- No true end-to-end deployment tests
- No performance/load testing beyond basic test execution time constraints
- No security penetration testing tooling
- No real log file rotation side-effect validation
- No external tool integrations (Backprop ingestion/analysis)
- No third-party dependency internal testing (testing Express, Helmet, or Winston internals)

**Files explicitly excluded from modification:**
- `ecosystem.config.js` — PM2 deployment configuration, deployment-only concern
- `.env` / `.env.example` — Runtime environment configuration, not test artifacts
- `README.md` — Documentation updates are minimal and limited to test execution instructions only
- `blitzy/**` — Documentation folder, not part of test scope
- `package-lock.json` — Auto-generated by npm, not manually edited

**Unimplemented future-phase capabilities excluded:**
- Authentication and authorization
- Database integration
- WebSocket support
- CI/CD automation
- HTTPS termination
- Multi-language support
- API versioning

## 0.9 Execution Parameters

### 0.9.1 Testing-Specific Instructions

**Test execution command:**
```bash
npm test
```
Resolves to: `jest --coverage --verbose` — runs all tests with coverage reporting and detailed output.

**Coverage measurement command:**
```bash
npm test -- --coverage
```
Coverage is included by default in the `npm test` script. The Jest `--coverage` flag generates an Istanbul-based report with line, branch, function, and statement metrics.

**Watch mode command:**
```bash
npm run test:watch
```
Resolves to: `jest --watch` — re-runs tests on file changes for rapid development feedback.

**CI execution command:**
```bash
npm run test:ci
```
Resolves to: `jest --coverage --ci --watchAll=false` — non-interactive execution suitable for automation environments, outputs structured results without watch mode.

**Single test execution pattern:**
```bash
npx jest tests/utils/sanitizer.test.js --verbose
```
Run a specific test file. Supports glob patterns: `npx jest tests/middleware/` runs all middleware tests.

**Debug mode execution:**
```bash
node --inspect-brk node_modules/.bin/jest --runInBand tests/specific.test.js
```
Launches Jest with Node.js debugger attached for breakpoint-based debugging.

### 0.9.2 Test Patterns and Conventions

**Test file naming:** `*.test.js` suffix matching the source module name (e.g., `sanitizer.js` → `sanitizer.test.js`)

**Test directory structure mirrors source:**
```
tests/
├── utils/
│   ├── sanitizer.test.js
│   └── logger.test.js
├── config/
│   └── index.test.js
├── middleware/
│   ├── validateInput.test.js
│   ├── notFound.test.js
│   └── errorHandler.test.js
├── routes/
│   ├── index.test.js
│   ├── health.test.js
│   └── api.test.js
├── helpers/
│   └── setup.js
├── app.test.js
└── server.test.js
```

**Test organization within files:**
- Top-level `describe` block named after the module (e.g., `describe('sanitizer')`)
- Nested `describe` blocks for each exported function (e.g., `describe('sanitizeLogInput')`)
- Individual `test()` or `it()` blocks with descriptive natural language names
- Setup/teardown in `beforeEach`/`afterEach` blocks closest to the tests that need them

**Environment setup requirements for tests:**
- `NODE_ENV` is automatically set to `'test'` by Jest unless explicitly overridden
- `process.env` manipulation must be scoped to individual test cases with cleanup in `afterEach`
- Logger mock must be declared before importing any module that depends on the logger
- No `.env` file loading during tests — all environment variables are controlled programmatically
- The `logs/` directory does not need to exist during test execution (logger is mocked)

### 0.9.3 Excluded Test Categories

Per user directives, the following test categories are explicitly excluded:

- Browser/UI tests — no frontend exists
- Database tests — no database exists
- Cloud infrastructure tests — deployment is out of scope
- End-to-end deployment tests — testing stops at the application layer
- PM2 cluster-mode runtime tests in live multi-process mode — PM2 is a deployment concern
- Real log file rotation side-effect tests — logger is mocked to prevent file I/O

## 0.10 Special Instructions for Testing

### 0.10.1 Minimal Change Principle

The following constraints are derived directly from the user's explicit directives and must be honored throughout the implementation:

- **ONLY add test files and test-related configuration** — no modifications to any source file under `src/` or to `server.js` unless strictly required for testability. Repository analysis confirms the existing application factory pattern (`src/app.js` exports without `app.listen()`) already enables Supertest integration testing without any source changes.
- **DO NOT modify source code** for testing convenience. The current code is production-ready and architecturally testable as-is. If a source change were ever considered necessary, it must be documented with explicit justification and limited to the absolute minimum (e.g., a single dependency injection point).
- **DO NOT refactor production code** even if test analysis reveals improvement opportunities. Quality issues discovered during testing should be noted in comments or documentation but not fixed as part of this testing implementation.
- **DO NOT modify existing interfaces or behaviors** — all four GET endpoint contracts, all 405/404/500 response structures, JSON-only response policy, middleware ordering, security posture, and environment-driven configuration must remain exactly as implemented.
- **DO NOT create CI/CD pipeline files** — per the user's implementation rule: "Do not make any updates or changes in GitHub App to create or update a workflow." Tests must be runnable via `npm test` locally and in any standard Node.js environment, but no `.github/workflows/`, `Jenkinsfile`, or equivalent pipeline definitions shall be created.

### 0.10.2 Testing Discipline Guidelines

- **Isolate all test code** in the dedicated `tests/` directory and `jest.config.js` — no test utilities, fixtures, or helpers placed in `src/` or the project root (except `jest.config.js`)
- **Create test utilities in `tests/helpers/`** to avoid cluttering production code directories
- **Follow existing code patterns**: CommonJS `require()`/`module.exports`, `'use strict'` directive where source files use it, consistent JSON response structure assertions matching the documented API contracts
- **Use the test runner's built-in mocking** (`jest.mock()`, `jest.spyOn()`, `jest.fn()`) rather than introducing additional mocking libraries
- **Prefer real integration testing** for Express app behavior — send actual HTTP requests via Supertest rather than mocking Express internals when validating route and middleware behavior
- **Use mocking only when isolation is necessary:**
  - Spying on `process.on`, `process.exit`, or server close handlers
  - Controlling environment variables for configuration tests
  - Preventing real file logging side effects (Winston file transports)
  - Simulating exceptional conditions in middleware error paths
- **Ensure all tests can run independently** — no test should depend on another test's execution or state
- **Clean up after every test** — restore `process.env`, clear module caches, reset mock call counts in `afterEach` blocks

### 0.10.3 Validation Process

The test suite is confirmed working when all of the following criteria are met:

- All tests pass cleanly via `npm test` from the project root
- Coverage output shows ≥90% line and function coverage overall
- Intentionally breaking a representative route response (e.g., changing status code from 200 to 201 in `GET /`) causes the corresponding test to fail meaningfully
- Production/non-production error-path assertions correctly distinguish between `NODE_ENV=production` (masked errors) and other environments (full error details + stack)
- No unnecessary production source modifications were introduced — a `git diff` on `src/` and `server.js` should show zero changes
- The placeholder test script (`echo "Error: no test specified" && exit 1`) has been replaced with a functional `jest` command in `package.json`
- All `devDependencies` are correctly listed in `package.json` and resolved in `package-lock.json`

