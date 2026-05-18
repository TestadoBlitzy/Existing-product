# Testing Guide

This guide is the canonical reference for testing the `hello-world` Express
service. The suite uses Jest 30.3.0 as the test runner and Supertest 7.2.2 for
in-memory HTTP assertions (Source: `package.json` `devDependencies`). All tests
live under `tests/` and are discovered by the glob
`**/tests/**/*.test.js` (Source: `jest.config.js`). Coverage is collected on
`src/**/*.js` and `server.js`, with global thresholds of 90% lines, 90%
functions, 80% branches, and 90% statements (Source: `jest.config.js`). The
repository has **no CI/CD pipelines configured in-repo** — there is no
`.github/workflows/`, `.gitlab-ci.yml`, `Jenkinsfile`, or equivalent. The
`test:ci` script is provided for operators who run Jest in a CI environment,
but no such environment is defined inside this repository.

For related operator topics, see [`./architecture.md`](./architecture.md) for
the `server.js` / `src/app.js` split that makes Supertest testing possible,
[`./observability.md`](./observability.md) for why the logger must be mocked
during tests, and [`./api.md`](./api.md) for the endpoint contracts that the
route suites assert against.

---

## Overview

The test suite is organized into three concentric layers, each cited from
production source code:

1. **Unit tests** — Cover individual middleware, route, utility, and config
   modules in isolation. Live under `tests/middleware/`, `tests/routes/`,
   `tests/utils/`, and `tests/config/`.
2. **Integration tests** — Drive HTTP requests through the full middleware
   pipeline assembled by `src/app.js`. Live in `tests/app.test.js` and the
   `tests/routes/*.test.js` suites that use Supertest.
3. **Lifecycle tests** — Exercise `server.js` bootstrap, signal handlers, and
   exit codes through mocked process events. Live in `tests/server.test.js`.

Key facts (each cited from a single source file):

- Jest 30.3.0 is the test runner (Source: `package.json` `devDependencies`).
- Supertest 7.2.2 drives in-memory HTTP assertions
  (Source: `package.json` `devDependencies`).
- Tests are discovered by `testMatch: ['**/tests/**/*.test.js']`
  (Source: `jest.config.js`).
- Coverage is collected on `['src/**/*.js', 'server.js', '!**/node_modules/**']`
  (Source: `jest.config.js`).
- Global thresholds: 90% lines, 90% functions, 80% branches, 90% statements
  (Source: `jest.config.js`).
- Mocks are cleared and restored between tests via `clearMocks: true` and
  `restoreMocks: true` (Source: `jest.config.js`).

---

## Test Runner Configuration

### Jest Configuration File

The single source of truth for Jest is [`../jest.config.js`](../jest.config.js).
It is a CommonJS module that exports a plain options object — there is no
`.babelrc`, no TypeScript transformer, and no preset (Source: `jest.config.js`).
The configuration shape, taken verbatim from the file:

```js
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    'server.js',
    '!**/node_modules/**',
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/tests/',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'json-summary'],
  coverageThreshold: {
    global: {
      lines: 90,
      functions: 90,
      branches: 80,
      statements: 90,
    },
  },
  verbose: true,
  clearMocks: true,
  restoreMocks: true,
};
```

Field-by-field rationale (all values verified against `jest.config.js`):

- `testEnvironment: 'node'` — The service is a server-side HTTP application
  with no DOM; Jest's default `'jsdom'` environment is unnecessary and would
  add startup overhead. (Source: `jest.config.js`)
- `testMatch: ['**/tests/**/*.test.js']` — Discovers every `*.test.js` file
  nested anywhere under a `tests/` directory. The glob is anchored to the
  repo so suites added under `tests/<new-folder>/*.test.js` are picked up
  automatically. (Source: `jest.config.js`)
- `collectCoverageFrom: ['src/**/*.js', 'server.js', '!**/node_modules/**']` —
  Coverage is measured against every production source file plus the
  bootstrap entry point, excluding installed packages. (Source: `jest.config.js`)
- `coveragePathIgnorePatterns: ['/node_modules/', '/tests/']` — Test files
  themselves are excluded from coverage reports so test-helper churn does
  not artificially inflate metrics. (Source: `jest.config.js`)
- `coverageDirectory: 'coverage'` — All reporter output is written to
  `./coverage/`. The directory is `.gitignore`-listed and regenerated on each
  run. (Source: `jest.config.js`)
- `coverageReporters: ['text', 'lcov', 'json-summary']` — Three formats
  emitted in parallel (see [Coverage Reporters](#coverage-reporters) below).
  (Source: `jest.config.js`)
- `verbose: true` — Prints each test name as it runs. This is why
  `npm test` shows per-test progress; operators can override with
  `npx jest --verbose=false` for a quieter run. (Source: `jest.config.js`)
- `clearMocks: true` — Calls `mockClear()` on every Jest mock before each
  test, resetting `.mock.calls` and `.mock.results` but preserving the
  mock implementation. (Source: `jest.config.js`)
- `restoreMocks: true` — Calls `mockRestore()` on every spy created with
  `jest.spyOn()` after each test, restoring the original implementation.
  This is what makes the `processOnSpy` / `processExitSpy` cleanup in
  `tests/server.test.js` automatic. (Source: `jest.config.js`,
  `tests/server.test.js`)

### Coverage Thresholds

The four global thresholds are enforced on every run with `--coverage`. If any
threshold is not met, Jest exits with a non-zero code. The values are taken
verbatim from `jest.config.js`:

| Metric     | Threshold | Rationale                                                  |
|------------|-----------|------------------------------------------------------------|
| Lines      | 90%       | Catches dead code and unreachable branches in core logic.  |
| Functions  | 90%       | Ensures every exported function is exercised at least once.|
| Branches   | 80%       | Lower than lines/functions because exhaustive coverage of  |
|            |           | every `if`/`else` and ternary combination (e.g.,           |
|            |           | `isProduction && isServerError` in `errorHandler.js`) is   |
|            |           | impractical without scenario explosion.                    |
| Statements | 90%       | Mirrors line coverage in practice; included for parity.    |

Source: `jest.config.js` `coverageThreshold.global`.

### Coverage Reporters

`coverageReporters: ['text', 'lcov', 'json-summary']` produces three artifacts
in parallel on every run (Source: `jest.config.js`):

- `text` — A summary table printed to the terminal at the end of every run.
  This is what operators see in their shell when running `npm test`.
- `lcov` — A machine-readable report at `coverage/lcov.info` and an HTML
  drill-down at `coverage/lcov-report/index.html`. The `.info` file is
  consumed by external coverage tools (Codecov, Coveralls, SonarQube) when
  configured by an operator outside this repository.
- `json-summary` — `coverage/coverage-summary.json` containing per-file and
  total totals. Useful for scripted threshold checks.

### Mock Lifecycle

`clearMocks: true` and `restoreMocks: true` work together to keep tests
independent (Source: `jest.config.js`):

- Between tests, `clearMocks` resets `.mock.calls` and `.mock.results` on
  every `jest.fn()` and `jest.spyOn()` mock. Implementations defined via
  `jest.fn(() => ...)` or `mockImplementation()` are **not** reset by
  `clearMocks`.
- After every test, `restoreMocks` calls `.mockRestore()` on every spy
  created with `jest.spyOn()`, returning the spied object to its original
  implementation. This is why suites do not need to explicitly call
  `jest.restoreAllMocks()` in their `afterEach` blocks (though
  `tests/server.test.js` calls it explicitly for clarity — Source:
  `tests/server.test.js`).

---

## Suite Organization

### Top-Level Files

Two suites live at the root of `tests/` because they describe cross-cutting
behavior that does not belong to any single module:

- **`tests/app.test.js`** — Full middleware pipeline integration tests.
  Exercises the 9-layer pipeline in `src/app.js`: Helmet security headers,
  CORS, compression, body parsing, Morgan logging, rate limiting, route
  handling, the 404 catch-all, and the centralized error handler. Uses
  Supertest against the exported `app` factory. (Source: `tests/app.test.js`,
  `src/app.js`)
- **`tests/server.test.js`** — Server bootstrap and lifecycle tests.
  Mocks `dotenv`, `../src/app`, and `../src/utils/logger`, then `require`s
  `server.js` with `jest.resetModules()` per test to exercise signal
  handlers (`SIGTERM`, `SIGINT`), `unhandledRejection`, `uncaughtException`,
  graceful shutdown via `server.close()`, and the exit-code contract
  (`exit(0)` on signals, `exit(1)` on uncaught exceptions).
  (Source: `tests/server.test.js`, `server.js`)

### Subfolder Layout

The full `tests/` tree exactly matches:

```bash
tests/
├── app.test.js
├── server.test.js
├── config/
│   └── index.test.js
├── helpers/
│   └── setup.js
├── middleware/
│   ├── errorHandler.test.js
│   ├── notFound.test.js
│   └── validateInput.test.js
├── routes/
│   ├── index.test.js
│   ├── health.test.js
│   └── api.test.js
└── utils/
    ├── logger.test.js
    └── sanitizer.test.js
```

Per-folder purpose:

- **`tests/config/`** — Configuration module tests.
  `tests/config/index.test.js` verifies default values, environment override
  parsing, `parseIntSafe` edge cases (valid `0`, NaN fallback, empty string,
  whitespace, decimals), and `Object.freeze()` immutability on both the root
  config object and the nested `rateLimit` object. (Source:
  `tests/config/index.test.js`, `src/config/index.js`)
- **`tests/helpers/`** — Shared test utilities (no `.test.js` files inside).
  `tests/helpers/setup.js` is the foundational mock-factory and
  environment-management module — see
  [Shared Helpers](#shared-helpers-testshelperssetupjs) below. (Source:
  `tests/helpers/setup.js`)
- **`tests/middleware/`** — One file per middleware export:
  - `errorHandler.test.js` covers the 4-argument error middleware including
    the production 5xx-message masking branch. (Source:
    `tests/middleware/errorHandler.test.js`, `src/middleware/errorHandler.js`)
  - `notFound.test.js` covers the terminal 404 handler and its
    sanitized-URL reflection contract. (Source:
    `tests/middleware/notFound.test.js`, `src/middleware/notFound.js`)
  - `validateInput.test.js` covers the Zod schema factory, the 400 error
    shape, and the re-exported `z` namespace. (Source:
    `tests/middleware/validateInput.test.js`,
    `src/middleware/validateInput.js`)
- **`tests/routes/`** — One file per route module:
  - `index.test.js` covers the root `GET /` byte-identical
    `Hello, World!\n` contract and the `router.all('/')` 405 method guard.
    (Source: `tests/routes/index.test.js`, `src/routes/index.js`)
  - `health.test.js` covers `GET /health` JSON payload (`status`, `uptime`,
    `timestamp`, `memory`, `nodeVersion`) and its 405 guard. (Source:
    `tests/routes/health.test.js`, `src/routes/health.js`)
  - `api.test.js` covers `GET /api` and `GET /api/info` plus both 405
    guards. (Source: `tests/routes/api.test.js`, `src/routes/api.js`)
- **`tests/utils/`** — One file per utility export:
  - `logger.test.js` covers Winston logger construction, the configured
    transports, and the Morgan-compatible `logger.stream.write` adapter.
    (Source: `tests/utils/logger.test.js`, `src/utils/logger.js`)
  - `sanitizer.test.js` covers `sanitizeLogInput` (ANSI strip, control-char
    strip, 1000-character cap) and `sanitizeUrl` (HTML-entity encoding,
    2048-character cap). (Source: `tests/utils/sanitizer.test.js`,
    `src/utils/sanitizer.js`)

---

## Shared Helpers (`tests/helpers/setup.js`)

`tests/helpers/setup.js` exports six functions used across the entire test
suite. It has zero external dependencies and only depends on Jest's built-in
`jest.fn()` global (Source: `tests/helpers/setup.js`). The full export list,
verbatim from the file:

```js
module.exports = {
  createMockReq,
  createMockRes,
  createMockNext,
  backupEnv,
  restoreEnv,
  withEnv
};
```

### `createMockReq(overrides = {})`

Returns a plain Express-shaped request object with sensible defaults:
`originalUrl: '/test'`, `method: 'GET'`, `body: {}`, `query: {}`, `params: {}`.
The `overrides` argument is spread on top, so callers can replace any field
(Source: `tests/helpers/setup.js`).

```js
const { createMockReq } = require('./helpers/setup');

const req = createMockReq();
// req.originalUrl === '/test', req.method === 'GET'

const notFoundReq = createMockReq({
  originalUrl: '/nonexistent',
  method: 'POST'
});
```

### `createMockRes()`

Returns a chainable response object whose `status()`, `json()`, and `set()`
methods are `jest.fn().mockReturnThis()` mocks. The `mockReturnThis()` is
critical because middleware code chains calls like
`res.status(404).json({ status: 'error' })` (Source: `tests/helpers/setup.js`,
`src/middleware/notFound.js`).

```js
const { createMockRes } = require('./helpers/setup');

const res = createMockRes();
res.status(200).json({ ok: true });
expect(res.status).toHaveBeenCalledWith(200);
expect(res.json).toHaveBeenCalledWith({ ok: true });
```

### `createMockNext()`

Returns a fresh `jest.fn()` on every call. Used to assert pass-through behavior
(`expect(next).toHaveBeenCalled()`) or terminal behavior
(`expect(next).not.toHaveBeenCalled()`) (Source: `tests/helpers/setup.js`).

```js
const { createMockNext } = require('./helpers/setup');

const next = createMockNext();
notFoundMiddleware(req, res, next);
expect(next).not.toHaveBeenCalled(); // notFound terminates the cycle
```

### `backupEnv()`

Returns a shallow copy of the current `process.env`. Use in a `beforeEach`
to capture the environment state before any test mutates it
(Source: `tests/helpers/setup.js`).

```js
const { backupEnv, restoreEnv } = require('./helpers/setup');

let envBackup;
beforeEach(() => { envBackup = backupEnv(); });
afterEach(() => { restoreEnv(envBackup); });
```

### `restoreEnv(backup)`

Restores `process.env` to a previously captured snapshot using a two-pass
algorithm (Source: `tests/helpers/setup.js`):

1. Pass 1 — Removes any keys present in `process.env` but absent from the
   backup (keys added during the test).
2. Pass 2 — Restores original values for every key in the backup (handles
   modified and deleted keys).

This shape is required because `process.env` is a special Node.js object
where `hasOwnProperty` does not always behave like a standard object
(Source: `tests/helpers/setup.js`).

### `withEnv(vars, fn)`

Higher-order utility that backs up env, applies `vars` via `Object.assign`,
runs `fn`, and restores env in a `finally` block (Source:
`tests/helpers/setup.js`). The env is restored even if `fn` throws.

```js
const { withEnv } = require('./helpers/setup');

withEnv({ NODE_ENV: 'production', PORT: '8080' }, () => {
  jest.resetModules();
  const config = require('../src/config');
  expect(config.env).toBe('production');
  expect(config.port).toBe(8080);
});
// process.env is restored here, regardless of test outcome
```

A complete example wiring these helpers into a middleware unit test:

```js
const {
  createMockReq,
  createMockRes,
  createMockNext
} = require('./helpers/setup');
const notFound = require('../src/middleware/notFound');

test('notFound returns 404 JSON', () => {
  const req = createMockReq({ originalUrl: '/nonexistent' });
  const res = createMockRes();
  const next = createMockNext();

  notFound(req, res, next);

  expect(res.status).toHaveBeenCalledWith(404);
  expect(next).not.toHaveBeenCalled();
});
```

(Source: `tests/helpers/setup.js`, `src/middleware/notFound.js`)

---

## Mocking Conventions

Three module-level mocks are used consistently across the suite. Jest hoists
every `jest.mock()` call to the top of the containing file automatically, so
the mocks take effect before any `require()` of the mocked module
(Source: `tests/app.test.js`, `tests/server.test.js`).

### Logger Mock (mandatory for suites that import `src/app.js`)

Every suite that requires `src/app.js`, `server.js`, or any module that
transitively imports `src/utils/logger.js` **must** mock the logger first.
Without the mock, Winston creates real file transports during module load,
writing to `logs/combined.log` and `logs/error.log` while tests are
running (Source: `src/utils/logger.js`, where two
`new winston.transports.File({ ... })` calls are unconditional).

The canonical mock shape, used in `tests/app.test.js` and every
`tests/routes/*.test.js` file:

```js
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  http: jest.fn(),
  stream: { write: jest.fn() }
}));
```

(Source: `tests/app.test.js`)

The five mock fields mirror the real logger's surface area
(`logger.info/warn/error/http` plus `logger.stream.write` for Morgan)
(Source: `src/utils/logger.js`). Suites nested two folders deep (such as
`tests/routes/index.test.js`) use the relative path `'../../src/utils/logger'`
instead (Source: `tests/routes/index.test.js`).

### Dotenv Mock (used by `tests/server.test.js`)

`server.js` calls `require('dotenv').config()` on its first line of executable
code, which reads `.env` from disk into `process.env` (Source: `server.js`).
The lifecycle test suite mocks `dotenv` so that test environment variables
are not overwritten by whatever `.env` happens to be on disk:

```js
jest.mock('dotenv', () => ({
  config: jest.fn()
}));
```

(Source: `tests/server.test.js`)

### App Mock (used by `tests/server.test.js`)

`tests/server.test.js` is the only suite that imports `server.js` directly,
and it does so to verify bootstrap behavior — not to make HTTP requests. To
avoid binding a real TCP socket, the test mocks `../src/app` so that
`app.listen(port, host, cb)` returns a mock server object whose `close()`
synchronously invokes its callback:

```js
let mockServer;
let mockListenCallback;

jest.mock('../src/app', () => ({
  listen: jest.fn((port, host, cb) => {
    // Capture the listen callback for manual invocation in tests
    mockListenCallback = cb;
    // Create a mock server with close() that invokes callback synchronously
    mockServer = {
      close: jest.fn((closeCb) => {
        if (closeCb) closeCb();
      })
    };
    return mockServer;
  })
}));
```

(Source: `tests/server.test.js`)

The captured `mockListenCallback` and `mockServer` are then used by lifecycle
tests to (1) drive the "server listening" log message and (2) assert that
`SIGTERM` / `SIGINT` handlers invoke `server.close()` followed by
`process.exit(0)` (Source: `tests/server.test.js`).

### `jest.resetModules()` for Config Re-Import

`src/config/index.js` reads `process.env` at module-load time and exports a
deeply frozen object (Source: `src/config/index.js`). Once required, the
config is cached by Node's CommonJS loader and the freeze prevents any
runtime mutation. Tests that need to observe a different config value
must therefore:

1. Set `process.env.<VAR>` to the desired value.
2. Call `jest.resetModules()` to clear Node's `require` cache.
3. `require('../src/config')` again to trigger a fresh module load.

This pattern is encapsulated by `withEnv()` together with `jest.resetModules()`
in `tests/config/index.test.js`:

```js
const { backupEnv, restoreEnv } = require('../helpers/setup');

let envBackup;
beforeEach(() => {
  envBackup = backupEnv();
  jest.resetModules();
});
afterEach(() => { restoreEnv(envBackup); });

test('port reads PORT env var', () => {
  process.env.PORT = '8080';
  const config = require('../../src/config');
  expect(config.port).toBe(8080);
});
```

(Source: `tests/config/index.test.js`, `tests/helpers/setup.js`)

The same pattern is used in `tests/server.test.js` to require `server.js`
with fresh module state on every test (Source: `tests/server.test.js`).

---

## Supertest Integration Pattern

Supertest drives requests against the Express `app` instance **without**
binding a TCP socket. This works because `src/app.js` exports the configured
Express factory but does not call `app.listen()` — the listen call lives
exclusively in `server.js` (Source: `src/app.js`, `server.js`). The split
is the testability payoff documented in
[`./architecture.md`](./architecture.md).

The canonical Supertest pattern, with the mandatory logger mock above it:

```js
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  http: jest.fn(),
  stream: { write: jest.fn() }
}));

const request = require('supertest');
const app = require('../src/app');

test('GET / returns plain text greeting', async () => {
  const res = await request(app).get('/');
  expect(res.status).toBe(200);
  expect(res.headers['content-type']).toMatch(/text\/plain/);
  expect(res.text).toBe('Hello, World!\n');
});
```

(Source: `tests/routes/index.test.js`, `src/routes/index.js`,
`src/app.js`)

Supertest also supports the OPTIONS, POST, PUT, PATCH, DELETE, and HEAD
verbs out of the box; the route suites use these to assert the 405 Method
Not Allowed behavior of every `router.all('/')` and `router.all('/info')`
guard (Source: `tests/routes/index.test.js`,
`tests/routes/health.test.js`, `tests/routes/api.test.js`).

---

## Running the Tests

### NPM Scripts

The three test scripts, verbatim from `package.json` `scripts`:

| Script               | Command                                 |
|----------------------|-----------------------------------------|
| `npm test`           | `jest --coverage --verbose`             |
| `npm run test:watch` | `jest --watch`                          |
| `npm run test:ci`    | `jest --coverage --ci --watchAll=false` |

Use case for each:

- `npm test` — Default local run with coverage and per-test logging.
- `npm run test:watch` — Interactive watch mode during development.
- `npm run test:ci` — Non-interactive run for CI environments.

(Source: `package.json` `scripts.test`, `scripts.test:watch`,
`scripts.test:ci`)

Examples:

```bash
# Run the full suite with coverage and verbose output
npm test

# Watch mode — re-runs affected tests on file save
npm run test:watch

# CI-safe execution: no watch, no interactive prompts, exits non-zero on failure
npm run test:ci
```

Notes (Source: `jest.config.js`, `package.json`):

- `npm test` enables `--coverage` even though `coverageThreshold` is also
  defined in `jest.config.js`. The flag enables report generation; the
  thresholds enforce the pass/fail gate.
- `npm test` adds `--verbose` redundantly to `verbose: true` in
  `jest.config.js`. Both have the same effect; the duplication makes the
  script self-documenting.
- `npm run test:ci` adds `--ci` (disables snapshot writes and exits on
  the first unexpected condition) and `--watchAll=false` (suppresses
  watch even if Jest detects an interactive terminal).

### Running a Specific Suite

Jest supports several scoping flags for narrowing what runs. Examples that
match files already in the repository:

```bash
# Single file
npx jest tests/routes/health.test.js

# Whole folder
npx jest tests/middleware

# Regex on the test path
npx jest --testPathPattern=routes

# Regex on the test name (the describe/test string)
npx jest -t "returns 200"
```

These flags can be combined with `--coverage` if a one-off coverage report
for a subset of files is needed.

### Coverage Output

After any run with `--coverage`, results are written to `./coverage/`
(Source: `jest.config.js` `coverageDirectory: 'coverage'`). The three
configured reporters produce:

- **`text`** — Summary table printed to the terminal at the end of every
  run; consumed by operators reading the shell.
- **`lcov`** — `coverage/lcov.info` plus an HTML drill-down at
  `coverage/lcov-report/index.html`; consumed by external coverage services
  (Codecov, Coveralls, SonarQube) configured outside this repository.
- **`json-summary`** — `coverage/coverage-summary.json`; consumed by
  scripted threshold checks.

(Source: `jest.config.js` `coverageReporters`)

If any of the four thresholds (lines, functions, branches, statements) is
not met, Jest exits with a non-zero code. CI runners can rely on the exit
code directly; no extra parsing of `coverage-summary.json` is required
(Source: `jest.config.js` `coverageThreshold`).

---

## Source Citations

- `jest.config.js` — Jest configuration: `testEnvironment`, `testMatch`,
  `collectCoverageFrom`, `coveragePathIgnorePatterns`, `coverageDirectory`,
  `coverageReporters`, `coverageThreshold`, `verbose`, `clearMocks`,
  `restoreMocks`
- `package.json` — `devDependencies` (Jest 30.3.0, Supertest 7.2.2),
  `scripts.test`, `scripts.test:watch`, `scripts.test:ci`
- `server.js` — bootstrap sequence, `dotenv.config()` placement,
  `app.listen()`, signal handler registration
- `src/app.js` — Express application factory; absence of `app.listen()`
  enables Supertest in-process testing
- `src/config/index.js` — module-load `process.env` read and
  `Object.freeze` immutability
- `src/utils/logger.js` — Winston file transports that necessitate the
  logger mock
- `tests/app.test.js` — middleware pipeline integration suite and
  canonical logger-mock shape
- `tests/server.test.js` — server lifecycle suite, dotenv mock, app mock,
  process spy pattern
- `tests/config/index.test.js` — env-driven config tests using
  `jest.resetModules()`
- `tests/helpers/setup.js` — `createMockReq`, `createMockRes`,
  `createMockNext`, `backupEnv`, `restoreEnv`, `withEnv`
- `tests/middleware/errorHandler.test.js` — error middleware tests
- `tests/middleware/notFound.test.js` — 404 middleware tests
- `tests/middleware/validateInput.test.js` — Zod validation tests
- `tests/routes/index.test.js` — root route contract tests
- `tests/routes/health.test.js` — `/health` payload tests
- `tests/routes/api.test.js` — `/api` and `/api/info` tests
- `tests/utils/logger.test.js` — logger construction tests
- `tests/utils/sanitizer.test.js` — sanitizer tests

---

[Back to README](../README.md)
