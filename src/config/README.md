# src/config — Configuration Module

## Purpose

This folder is the application's centralized, immutable runtime configuration
layer. It reads environment variables **once** at module load, applies safe
numeric parsing via `parseIntSafe`, merges the parsed values with secure
defaults, and exposes a single `Object.freeze`d configuration object whose
nested `rateLimit` sub-object is also frozen. The exported config is the
single source of truth for runtime settings consumed by `src/app.js`,
`src/utils/logger.js`, `src/routes/api.js`, and `server.js`. The module is
**pure data** — it has no I/O (no file reads, no network calls, no side
effects beyond reading `process.env`). Source: `src/config/index.js`.

## Key Files

| Path | Role | Source |
|---|---|---|
| `src/config/index.js` | The only file. Exports `Object.freeze({ env, port, host, logLevel, corsOrigin, bodyLimit, rateLimit: Object.freeze({ windowMs, max }) })`. | `src/config/index.js` |

This folder intentionally contains no subfolders and no helper files — the
configuration surface is small enough to fit in a single cohesive module.

## Architecture Fit

- **Consumers** — the following modules import the frozen config object:
  - `src/app.js` reads `config.corsOrigin`, `config.bodyLimit`, and
    `config.rateLimit.{windowMs, max}` when registering CORS, body parsers,
    and the rate limiter. Source: `src/app.js` lines 48, 93, 112-113, 135-137.
  - `src/utils/logger.js` reads `config.logLevel` to set the Winston logger
    level. Source: `src/utils/logger.js` line 39.
  - `src/routes/api.js` reads `config.env` for the `GET /api/info` response
    payload. Source: `src/routes/api.js` line 76.
  - `server.js` reads `config.port`, `config.host`, and `config.env` for
    binding the HTTP server and emitting the startup log line. Source:
    `server.js` line 41 (`const config = require('./src/config');`) and the
    `app.listen(config.port, config.host, ...)` call at line 56.

- **Load-order requirement (CRITICAL)**: `dotenv.config()` MUST run before
  `require('./src/config')` (directly or transitively). Source: `server.js`
  lines 24-31 invoke `require('dotenv').config()` first (line 31), then
  require `./src/app` (line 40); `src/app.js` transitively requires
  `./config` (line 48). If `src/config` is loaded before `dotenv`, it sees
  only the real environment variables already present in the process and
  falls back to hardcoded defaults for anything not in `process.env`.

- **No network, no FS, no runtime side effects**: the module reads
  `process.env`, assembles a plain object, and freezes it. It does NOT
  create sockets, listeners, servers, or connections. It does NOT load
  `dotenv` itself — that is deliberately `server.js`'s responsibility.
  Source: `src/config/index.js` (full file — no `require` of any other
  module).

## Public Interface

Import forms (all CommonJS, all return the same frozen instance per Node.js
`require` caching):

- From `src/app.js` (sibling): `const config = require('./config');`
  Source: `src/app.js` line 48.
- From `src/utils/logger.js` (relative up-one):
  `const config = require('../config');`
  Source: `src/utils/logger.js` line 23.
- From `src/routes/api.js` (relative up-one):
  `const config = require('../config');`
  Source: `src/routes/api.js` line 15.
- From `server.js` (from repo root):
  `const config = require('./src/config');`
  Source: `server.js` line 41.

Exported surface (shape with default values — this is a documentation
snippet, not runtime code):

```js
// Exported surface (shape with default values)
{
  env: 'development',       // string from NODE_ENV or 'development'
  port: 3000,                // number from PORT or 3000
  host: '0.0.0.0',           // string from HOST or '0.0.0.0'
  logLevel: 'debug',         // string from LOG_LEVEL or 'debug'
  corsOrigin: '*',           // string from CORS_ORIGIN or '*'
  bodyLimit: '10kb',         // string from BODY_LIMIT or '10kb'
  rateLimit: {               // frozen sub-object
    windowMs: 900000,        // number from RATE_LIMIT_WINDOW_MS or 900000
    max: 100                 // number from RATE_LIMIT_MAX or 100
  }
}
```

Source: `src/config/index.js` lines 24-36.

Both the root object and the nested `rateLimit` object are frozen via
`Object.freeze`. Attempting to assign a property in either fails silently in
sloppy mode and throws a `TypeError` in strict mode. Source:
`src/config/index.js` lines 32, 38.

## Dependencies

This module has **zero npm dependencies** and **zero internal module
imports**. There are no `require(...)` calls anywhere in
`src/config/index.js`. Source: `src/config/index.js` (full file, 38 lines).

- The module is **effectively downstream** of `dotenv`, which is required by
  `server.js` BEFORE this module is loaded (transitively). If operators
  invoke the module from a bespoke script that does not first load `dotenv`,
  they must set environment variables via another mechanism — shell
  exports, PM2 `env`/`env_production` blocks, or container env. Source:
  `server.js` line 31; `ecosystem.config.js` `env` and `env_production`
  blocks (lines 108-113, 130-135).

## Data Flow

The load-time data flow runs exactly once, when the module is first
`require`d:

1. `process.env` is populated by one of:
   - (a) `dotenv.config()` from `server.js` (Source: `server.js` line 31), or
   - (b) the deployment environment directly — PM2 `env`/`env_production`
     blocks (Source: `ecosystem.config.js`), shell environment, container
     env, or Kubernetes env.
2. `src/config/index.js` reads each relevant variable, applying
   `|| <default>` for string fields (Source: lines 25, 27, 28, 29, 31) and
   `parseIntSafe(value, <default>)` for numeric fields (Source: lines 26,
   33, 34).
3. Values are assembled into a plain object literal (Source: lines 24-36).
4. The nested `rateLimit` object is frozen first via the inline
   `Object.freeze({ ... })` wrapper (shallow freeze of the inner object).
   Source: `src/config/index.js` line 32.
5. The root `config` object is frozen as a whole when it is exported.
   Source: `src/config/index.js` line 38.
6. `module.exports = Object.freeze(config);` exposes the frozen object.
   Source: `src/config/index.js` line 38.

This entire flow executes **once**, at module load time, because Node.js
caches `require`d modules. Every subsequent `require('./config')` returns
the same frozen instance. Source: Node.js module resolution semantics +
`src/config/index.js` module-level evaluation.

## Configuration

The runtime configuration contract is fully expressed by the table below.
All values match `src/config/index.js` and `.env.example` byte-for-byte.

| Variable | Type | Default | Purpose | Source |
|---|---|---|---|---|
| `NODE_ENV` | string | `development` | App mode; setting `production` enables CWE-209 5xx error masking in `errorHandler.js` | `src/config/index.js` line 25 |
| `PORT` | number | `3000` | HTTP listening port | `src/config/index.js` line 26 |
| `HOST` | string | `0.0.0.0` | Bind address; `0.0.0.0` listens on all interfaces | `src/config/index.js` line 27 |
| `LOG_LEVEL` | string | `debug` | Winston log level (`error`, `warn`, `info`, `http`, `verbose`, `debug`, `silly`) | `src/config/index.js` line 28 |
| `CORS_ORIGIN` | string | `*` | CORS allowed origin(s); narrow in production | `src/config/index.js` line 29 |
| `BODY_LIMIT` | string | `10kb` | Max request body size for JSON and URL-encoded parsers | `src/config/index.js` line 31 |
| `RATE_LIMIT_WINDOW_MS` | number | `900000` | Rate limit window in milliseconds (15 minutes) | `src/config/index.js` line 33 |
| `RATE_LIMIT_MAX` | number | `100` | Max requests per IP per window | `src/config/index.js` line 34 |

The canonical operator-facing template is `.env.example`. During initial
setup, operators copy it via `cp .env.example .env` and then edit `.env`
locally. Source: `.env.example`.

### parseIntSafe

The `parseIntSafe` helper normalizes string-valued environment variables
into integers without falling into a common JavaScript pitfall.

- **Signature (CommonJS)**: `parseIntSafe(value, fallback) => number`.
  Source: `src/config/index.js` lines 19-22.
- **Behavior**: invokes `parseInt(value, 10)`, then returns
  `Number.isNaN(parsed) ? fallback : parsed`. Source:
  `src/config/index.js` lines 20-21.
- **Rationale (CRITICAL — a common JavaScript bug pattern)**:
  - The naive pattern `parseInt(value, 10) || fallback` incorrectly
    replaces a valid `0` with the fallback because `0` is falsy in
    JavaScript (it short-circuits the `||` operator).
  - `parseIntSafe` explicitly tests `Number.isNaN` so a legitimate `"0"`
    input yields `0`, not the fallback. This matters whenever a numeric
    config field has `0` as a legitimate value (for example, `PORT=0` is a
    documented Node.js idiom that asks the OS to assign an ephemeral free
    port for tests).
  - Source: `src/config/index.js` JSDoc lines 10-17 (the helper's JSDoc
    explicitly documents this rationale).

## Error Handling

This module does NOT throw under any documented condition. Specifically:

- **Invalid numeric environment variables** (for example,
  `PORT=not-a-number`) fall back to the documented default via
  `parseIntSafe`, because `parseInt('not-a-number', 10)` returns `NaN` and
  the helper substitutes the fallback. Source: `src/config/index.js`
  lines 19-22 + lines 26, 33, 34.
- **A missing `.env` file is NOT an error** — `dotenv.config()` simply
  proceeds without loading anything (it returns a result object with an
  `error` property, but it does not throw), and `src/config/index.js` then
  uses defaults for every absent variable via the `||` fallbacks. Source:
  `server.js` line 31; `src/config/index.js` `||` defaults on lines 25,
  27-29, 31.
- **An invalid `BODY_LIMIT` value** (for example, `BODY_LIMIT=invalid-size`)
  is NOT rejected here — it is passed through to `express.json` and
  `express.urlencoded`, which would throw at **request time**, not at
  config load. This is called out under `## Limitations` below.

## Security Notes

- **Deep immutability**: `Object.freeze` is applied to BOTH the root
  `config` object and the nested `rateLimit` sub-object. `Object.freeze` is
  shallow — freezing only the root would leave `config.rateLimit` mutable.
  Freezing both prevents tampering at both levels. Source:
  `src/config/index.js` lines 32, 38.
- **Rationale for freezing**: prevents runtime mutation by downstream
  modules, test suites, or plugins. Once the app boots, configuration is a
  stable contract; any attempt to "hot-patch" a setting fails (silently in
  sloppy mode, via `TypeError` in strict mode) rather than silently
  corrupting shared state. Source: `src/config/index.js` lines 32, 38.
- **Production masking dependency**: `src/middleware/errorHandler.js`
  reads `process.env.NODE_ENV` DIRECTLY (not via `config.env`) for the
  CWE-209 5xx masking check. Because `src/config/index.js` captures
  `NODE_ENV` into `config.env` at load time as well, the two reads are
  effectively equivalent in practice, but the decoupling means that
  neither `errorHandler` nor `config` retroactively react to runtime
  mutations of `process.env`. Source: `src/middleware/errorHandler.js`
  line 76; `src/config/index.js` line 25.
- **No secrets in the config surface**: this module exposes NO secrets —
  no API keys, no database credentials, no JWT secrets. The service has
  none by design. If secrets are ever added in the future, operators must
  ensure they are never passed to the logger, never reflected in
  responses, and never persisted in repository-committed files. Source:
  `src/config/index.js` (full file — no credential-like fields).
- **Payload-size limit (`BODY_LIMIT`, default `10kb`)** mitigates CWE-400
  payload-based DoS via the body parsers registered in `src/app.js`.
  Source: `src/config/index.js` line 30 (`SECURITY:` comment) + line 31;
  consumer at `src/app.js` lines 112-113.

## Examples

**Example 1 (`js`) — consuming config:**

```js
const config = require('./src/config');

console.log(config.port);              // 3000 (by default)
console.log(config.rateLimit.max);     // 100 (by default)

// Both root and rateLimit are frozen
config.port = 4000;                    // Fails silently in sloppy mode; throws in strict mode.
config.rateLimit.max = 200;            // Same — nested freeze prevents mutation.
```

Source: `src/config/index.js` lines 24-38.

**Example 2 (`bash`) — overriding via environment:**

```bash
# Copy the operator template
cp .env.example .env

# Edit .env to override defaults
echo "PORT=8080" >> .env
echo "LOG_LEVEL=info" >> .env

# Or override at the deployment platform level (PM2 env_production block)
pm2 start ecosystem.config.js --env production
```

Source: `.env.example`; `ecosystem.config.js` lines 130-135.

**Example 3 (`js`) — testing alternate configurations:**

```js
// Pattern used by tests/config/index.test.js to verify env-driven behavior.
// withEnv and backupEnv come from tests/helpers/setup.js.
const { withEnv } = require('../helpers/setup');

withEnv({ PORT: '0' }, () => {
  jest.resetModules();                  // Drop the cached frozen instance.
  const config = require('../../src/config');
  expect(config.port).toBe(0);          // parseIntSafe preserves the valid zero value.
});
```

Source: `tests/helpers/setup.js` (`withEnv`, `backupEnv`, `restoreEnv`);
`src/config/index.js` lines 19-22.

## Limitations

- **Load-once semantics**: configuration is read ONCE at module load.
  Changing environment variables at runtime has NO effect until the
  process restarts (or, in tests, until `jest.resetModules()` is called
  followed by a fresh `require`). Source: Node.js `require` caching +
  `src/config/index.js` module-level evaluation.
- **No schema validation for non-numeric fields**: beyond `parseIntSafe`
  for numerics, environment values are consumed as-is. A malformed
  `BODY_LIMIT` (for example, `BODY_LIMIT=invalid-size`) passes through to
  the `express.json` / `express.urlencoded` middleware, which would throw
  at request time rather than at config load. Source:
  `src/config/index.js` line 31; `src/app.js` lines 112-113.
- **No nested-path overrides via env**: the env variable naming scheme is
  flat plus one level of nesting (`RATE_LIMIT_*` keys map to
  `config.rateLimit.*`). There is no generic `RATE_LIMIT__SUB__FIELD`
  convention or similar. Source: `src/config/index.js` lines 32-35.
- **No per-environment config profiles inside this module**:
  per-environment overrides are handled by PM2's `env` and `env_production`
  blocks in `ecosystem.config.js`, not by this module. Source:
  `ecosystem.config.js` lines 108-113 and 130-135.
- **`dotenv` is NOT loaded here**: the caller (`server.js`) is responsible
  for invoking `dotenv.config()` BEFORE requiring this module. Source:
  `server.js` lines 24-31.
- **Testing alternate configurations requires `jest.resetModules()`**:
  because Node caches the frozen instance, tests that need a different
  config must call `jest.resetModules()` (often together with `withEnv`
  from `tests/helpers/setup.js`) to force a fresh module load under a
  different environment. Source: `tests/helpers/setup.js`.
- **Error handler decoupling**: `src/middleware/errorHandler.js` reads
  `process.env.NODE_ENV` directly (line 76) rather than `config.env`.
  Both are equivalent at load time, but this is a subtle decoupling worth
  noting for operators who grep for references to `config.env`. Source:
  `src/middleware/errorHandler.js` line 76; `src/config/index.js` line 25.

## See Also

- [src module](../README.md) — parent `src/` module README.
- [Project README](../../README.md) — top-level repository README.
- [Deployment guide](../../docs/deployment.md) — `.env` loading, PM2 env
  blocks, runtime env overrides.
- [Security guide](../../docs/security.md) — CWE-209 masking, CORS, rate
  limiting, body-size limits.
- [Observability guide](../../docs/observability.md) — `config.logLevel`
  effect on Winston.
- [.env.example](../../.env.example) — canonical operator template.

