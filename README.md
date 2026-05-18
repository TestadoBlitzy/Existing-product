# Test-3.1-ADO-NP-1

Repository created automatically

A minimal Node.js HTTP server that responds with "Hello, World!" to all incoming requests. Built using only the built-in Node.js `http` core module — zero runtime dependencies.

## Usage

Start the server:

```bash
node server.js
```

The server binds to `localhost:3000` and returns the following response for every HTTP request (regardless of method or path):

- **Status Code:** `200 OK`
- **Content-Type:** `text/plain`
- **Body:** `Hello, World!`

## Testing

This project uses [Jest](https://jestjs.io/) 30.x as the testing framework. Jest provides a complete solution — test runner, assertion library (`expect`), mocking utilities, and built-in V8 coverage reporting — all in a single package.

### Prerequisites

- **Node.js** 24.x LTS (or compatible version ≥18.x)
- Install devDependencies:

```bash
npm install
```

### Running Tests

| Command | Purpose |
|---------|---------|
| `npm test` | Run all tests via Jest |
| `npm run test:coverage` | Run tests with V8 coverage report |
| `npx jest --verbose` | Run with detailed per-test output |
| `npx jest --watch` | Watch mode for development (re-runs on file changes) |

### Test Coverage

The test file `server.test.js` provides comprehensive coverage including:

- **HTTP Responses** — Verifies the server returns `"Hello, World!"` as the response body
- **Status Codes** — Confirms every response carries `200 OK`
- **Headers** — Validates `Content-Type: text/plain` on all responses
- **Server Startup** — Verifies server creation, port binding, and listening state
- **Server Shutdown** — Confirms graceful close, port release, and callback invocation
- **Error Handling** — Tests `EADDRINUSE` port conflict and post-shutdown behavior
- **Edge Cases** — Covers all HTTP methods (GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS), arbitrary URL paths, requests with bodies/custom headers, and concurrent request handling

**Coverage Targets:**

| Metric | Enforced Threshold | Design Target | Notes |
|--------|-------------------|---------------|-------|
| Statements | ≥90% | ≥90% | 13/14 statements reachable from Jest |
| Branches | ≥80% | ≥80% | 5/6 branches reachable (see note) |
| Functions | ≥90% | ≥90% | 4/4 functions reachable from Jest |
| Lines | ≥90% | ≥90% | 13/14 lines reachable from Jest |

> **Note:** The `if (require.main === module)` auto-start branch in `server.js` (lines 50–52) is structurally unreachable from Jest's V8 coverage context. When Jest loads modules, `require.main` points to the Jest runner — not the module under test. The auto-start behavior is verified behaviorally via a `child_process.fork()` test in `server.test.js`, but child process execution runs in a separate V8 isolate and is not aggregated into Jest's coverage report. The enforced thresholds in `jest.config.js` are set to 90/80/90/90, calibrated just below the actual achievable coverage of ~93/83/100/93 within Jest's V8 context.

## Project Structure

| File | Description |
|------|-------------|
| `server.js` | Minimal HTTP server using the built-in `http` module. Exports `server` instance, `createServer` factory function, `startServer` lifecycle function, and `PORT`/`HOST` constants for programmatic control. Uses `require.main === module` for dual-mode operation (direct execution and test imports). |
| `server.test.js` | Comprehensive Jest test suite covering HTTP responses, status codes, headers, server lifecycle, error handling, and edge cases. |
| `jest.config.js` | Jest configuration specifying Node.js test environment, coverage thresholds, and test file patterns. |
| `package.json` | Project manifest with `jest` as the sole devDependency. Defines `test` and `test:coverage` npm scripts. CommonJS module format (`"type": "commonjs"`). |
| `.gitignore` | Git ignore rules for `node_modules/`, `coverage/`, and log files. |
| `README.md` | Project documentation with usage instructions, testing commands, coverage targets, and project structure. |

## Module Format

This project uses **CommonJS** (`require()` / `module.exports`) throughout. All source and test files follow this convention as specified by `"type": "commonjs"` in `package.json`.
