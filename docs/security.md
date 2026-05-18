# Security Guide

This guide is the canonical, operator-oriented description of every security
control implemented in the `hello-world` Node.js/Express service. It covers
the Helmet API-hardened Content Security Policy, CORS configuration, rate
limiting, request body size limits, Zod input validation, error-message
masking per `CWE-209`, log-injection sanitization per `CWE-117`, and
HTML-entity encoding of reflected URL content. Every claim below is traceable
to a source file via an inline `Source:` citation; nothing in this document
describes a feature that does not exist in the codebase.

## Table of Contents

- [Threat Model](#threat-model)
- [Security Headers (Helmet)](#security-headers-helmet)
- [Cross-Origin Resource Sharing (CORS)](#cross-origin-resource-sharing-cors)
- [Rate Limiting](#rate-limiting)
- [Request Body Size Limits](#request-body-size-limits)
- [Input Validation (Zod)](#input-validation-zod)
- [Error Message Masking (CWE-209)](#error-message-masking-cwe-209)
- [Log Injection Prevention (CWE-117)](#log-injection-prevention-cwe-117)
- [Reflected Content Prevention](#reflected-content-prevention)
- [HTTP Method Restriction (405 Method Not Allowed)](#http-method-restriction-405-method-not-allowed)
- [Defense-in-Depth Summary](#defense-in-depth-summary)
- [Limitations](#limitations)
- [Source Citations](#source-citations)

## Threat Model

The service is an API-only, stateless HTTP server with no persistence layer,
no session state, no user accounts, and no file uploads. The middleware
pipeline composed in `src/app.js` is the entire request-handling surface.
The threat model that guides every control in this document is therefore
intentionally narrow.

**In-scope threats addressed by controls in this codebase:**

- Payload-based denial of service (oversized JSON or URL-encoded bodies).
  Mitigated by the configurable body-size limit in `src/app.js` lines
  112–113.
- HTTP request flooding from a single source. Mitigated by the
  `express-rate-limit` middleware in `src/app.js` lines 135–148.
- Log injection / log forging via user-controlled fields
  (`req.originalUrl`, `req.method`). Mitigated by `sanitizeLogInput` in
  `src/utils/sanitizer.js` lines 97–125, applied at every logging site that
  emits user input.
- Reflected content injection in 404 response bodies that echo the
  unmatched URL. Mitigated by `sanitizeUrl` in `src/utils/sanitizer.js`
  lines 149–186, applied in `src/middleware/notFound.js` line 50.
- Information disclosure through 5xx error messages (file paths,
  module names, connection strings, stack traces). Mitigated by the
  production masking in `src/middleware/errorHandler.js` lines 75–79 and
  the production stack omission in lines 92–94.
- CORS misconfiguration. Bounded by the centralized
  `config.corsOrigin` value read in `src/app.js` lines 92–94 and sourced
  from `process.env.CORS_ORIGIN` in `src/config/index.js` line 29.
- HTTP method abuse (e.g., `DELETE /` falling through to a misleading
  404). Mitigated by the explicit `router.all()` 405 method guards in
  every route file — `src/routes/index.js` lines 54–60,
  `src/routes/health.js` lines 55–61, and `src/routes/api.js` lines
  47–53 and 85–91.
- Clickjacking via `<iframe>` embedding of API responses. Mitigated by
  the `frame-ancestors 'none'` directive in `src/app.js` lines 79–86.
- MIME-type sniffing. Mitigated by Helmet's default
  `X-Content-Type-Options: nosniff` header in `src/app.js` lines 79–86
  (Helmet default, asserted by `tests/app.test.js` lines 56–59).
- Unexpected query parameters or request bodies on GET endpoints.
  Mitigated by strict empty-body / empty-query Zod schemas applied via
  `validateInput` in `src/routes/index.js` line 44,
  `src/routes/health.js` line 41, and `src/routes/api.js` lines 33 and
  71.

**Out-of-scope — not implemented in this service:**

- **Authentication.** There is no authentication middleware, no token
  validation, no session cookie, no API key check. Every endpoint is
  public. Source: `src/app.js` (no auth middleware registered),
  `src/routes/*.js` (no auth check in any handler), `package.json` (no
  auth-related dependency such as `passport`, `jsonwebtoken`, or
  `express-session`).
- **Authorization.** There is no role-based or attribute-based access
  control. Source: same files as above.
- **TLS termination in-app.** The service binds to plain HTTP on
  `config.host:config.port` (Source: `server.js` lines 56–69). TLS is
  expected to be terminated by an upstream reverse proxy or load
  balancer. There is no `https.createServer()` call anywhere in the
  codebase.
- **Network-layer DDoS mitigation.** Rate limiting is per-IP and
  in-process (Source: `src/app.js` lines 135–148). Distributed,
  volumetric, or layer-3/4 attacks are out of scope and expected to be
  handled by an upstream CDN or cloud provider.
- **Web Application Firewall (WAF).** No WAF is bundled with the
  service. The service relies only on the controls described in this
  document.

## Security Headers (Helmet)

### Enabled Defaults

The application registers `helmet()` as the first middleware in the
pipeline (Source: `src/app.js` lines 79–86). With the customized CSP
described below, Helmet sets approximately 13 default HTTP security
response headers on every response. The headers that are asserted by the
test suite and therefore form the public contract of this service are
listed below; consult the Helmet package documentation for the full set
of defaults applied at install time.

- `Content-Security-Policy` — customized for API-only use (see
  [API-Hardened Content Security Policy](#api-hardened-content-security-policy)).
  Asserted by `tests/app.test.js` lines 61–69.
- `Strict-Transport-Security` — emitted with a `max-age=<N>` directive.
  Asserted by `tests/app.test.js` lines 71–76. Note: HSTS only takes
  effect when the response is actually served over HTTPS, which is the
  responsibility of an upstream proxy as described in the
  [Limitations](#limitations) section.
- `X-Content-Type-Options: nosniff` — disables MIME-type sniffing.
  Asserted by `tests/app.test.js` lines 56–59.
- `X-Frame-Options` — defense-in-depth complement to the
  `frame-ancestors 'none'` CSP directive. Source: Helmet default in
  `src/app.js` lines 79–86.
- `X-Powered-By` — **removed** (see
  [X-Powered-By Disabled](#x-powered-by-disabled)). Asserted by
  `tests/app.test.js` lines 78–81.

### API-Hardened Content Security Policy

The CSP is intentionally narrower than Helmet's default (which assumes a
browser-rendered web application). The configuration in `src/app.js`
lines 79–86 is:

```js
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"]
    }
  }
}));
```

Rationale (drawn from the inline comments in `src/app.js` lines 75–78):

- The default Helmet CSP (`default-src 'self'`) is designed for HTML
  pages that load same-origin scripts and stylesheets. This service
  serves JSON (and plain text for `GET /`), never rendered HTML, so it
  has no legitimate need for any content-loading source.
- `default-src 'none'` disallows every content-loading directive by
  default. There is no fallback origin to inherit when a more specific
  directive is missing — every category of resource (scripts, styles,
  images, frames, fonts, connect, media, object, manifest, etc.) is
  blocked unless explicitly re-enabled.
- `frame-ancestors 'none'` prevents the API response from being
  embedded in any `<iframe>`, `<frame>`, `<embed>`, or `<object>`,
  eliminating clickjacking even in the hypothetical case where a
  downstream consumer renders the JSON response as HTML.

The test suite asserts both directives are present in the emitted
header (Source: `tests/app.test.js` lines 61–69):

```js
expect(csp).toContain("default-src 'none'");
expect(csp).toContain("frame-ancestors 'none'");
```

### `X-Powered-By` Disabled

Express sets the `X-Powered-By: Express` response header by default,
which passively advertises the underlying web framework and can aid
fingerprinting. Helmet removes this header as part of its default
behavior — no explicit configuration is required.

The test suite enforces the removal:

```js
expect(res.headers['x-powered-by']).toBeUndefined();
```

Source: `src/app.js` lines 79–86 (Helmet registration);
`tests/app.test.js` lines 78–81 (assertion).


## Cross-Origin Resource Sharing (CORS)

The `cors` middleware is registered as the second step in the pipeline,
immediately after Helmet and before any other middleware that could
process a request body or emit a response (Source: `src/app.js` lines
92–94):

```js
app.use(cors({
  origin: config.corsOrigin
}));
```

The `config.corsOrigin` value comes from `process.env.CORS_ORIGIN` with a
default of `'*'` (Source: `src/config/index.js` line 29):

```js
corsOrigin: process.env.CORS_ORIGIN || '*',
```

**Operator guidance:**

- The default of `'*'` allows requests from any origin. This is suitable
  for local development and for services intentionally exposed as
  public APIs without per-origin restrictions.
- In production, operators **should** narrow the origin via the
  `CORS_ORIGIN` environment variable — for example,
  `CORS_ORIGIN=https://app.example.com` — when the API is consumed only
  by known browser front-ends. Source: `.env.example` lines 32–37
  (operator-facing description of `CORS_ORIGIN`).
- `CORS_ORIGIN` is passed to the `cors` middleware as **one raw string**.
  The service does not parse or split the value before calling
  `cors({ origin: config.corsOrigin })` (Source: `src/config/index.js`
  line 29; `src/app.js` lines 92–94). To support multiple origins,
  code changes would be required — for example, splitting the
  variable into an array or supplying a function for the `origin`
  option in `src/app.js`. Although `.env.example` line 36 mentions
  comma-separated input, the running service does not currently
  consume that format.
- Preflight `OPTIONS` requests are automatically handled by the `cors`
  middleware before reaching any route handler. The handshake is
  asserted by `tests/app.test.js` lines 94–100, which sends a preflight
  and expects a non-error status.

The default wildcard behavior is also asserted by the test suite
(Source: `tests/app.test.js` lines 87–92):

```js
expect(res.headers['access-control-allow-origin']).toBe('*');
```

## Rate Limiting

### Configuration

The application uses the `express-rate-limit` middleware to throttle
requests on a per-IP basis. The configuration in `src/app.js` lines
135–148 is:

```js
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  limit: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      status: 'error',
      statusCode: 429,
      message: 'Too many requests, please try again later.'
    });
  }
});
app.use(limiter);
```

Defaults read from `src/config/index.js` lines 32–35:

| Setting               | Default Value | Environment Variable    |
|-----------------------|---------------|-------------------------|
| `rateLimit.windowMs`  | `900000` (15 minutes) | `RATE_LIMIT_WINDOW_MS` |
| `rateLimit.max`       | `100` requests        | `RATE_LIMIT_MAX`       |

Both values are parsed through `parseIntSafe` (Source:
`src/config/index.js` lines 19–22), which preserves the literal value
`0` correctly — useful for tests that need to exercise the rate
limiter immediately. The `rateLimit` object is itself frozen via
`Object.freeze(...)` in `src/config/index.js` line 32 to prevent
mutation by downstream modules.

### 429 Response Contract

The custom handler in `src/app.js` lines 140–146 returns the exact
JSON payload below for any request that exceeds the rate limit:

```json
{
  "status": "error",
  "statusCode": 429,
  "message": "Too many requests, please try again later."
}
```

This shape matches the standardized error envelope used by
`src/middleware/errorHandler.js` lines 81–85 (for 5xx),
`src/middleware/notFound.js` lines 47–51 (for 404),
`src/middleware/validateInput.js` lines 77–81 (for 400), and the
`router.all()` 405 catch-all in every route file. The intent — stated
in the inline comment in `src/app.js` lines 131–134 — is that API
consumers receive the **same** JSON shape for every error response
regardless of HTTP status code.

### Standard Headers

- `standardHeaders: true` — emits the IETF `draft-6` rate-limit
  headers `RateLimit-Policy`, `RateLimit-Limit`, `RateLimit-Remaining`,
  and `RateLimit-Reset` on every response so that well-behaved clients
  can pace themselves before hitting the limit (Source: `src/app.js`
  lines 128–130 inline comment).
- `legacyHeaders: false` — disables the deprecated `X-RateLimit-*`
  header set to keep responses minimal and to avoid confusing clients
  that read both standards (Source: `src/app.js` line 130 inline
  comment).

## Request Body Size Limits

The body-parser middleware enforces an explicit maximum payload size
on both JSON and URL-encoded bodies (Source: `src/app.js` lines
112–113):

```js
app.use(express.json({ limit: config.bodyLimit }));
app.use(express.urlencoded({ extended: false, limit: config.bodyLimit }));
```

Defaults and behavior:

- `config.bodyLimit` defaults to `'10kb'` (Source: `src/config/index.js`
  line 31) and is configurable via the `BODY_LIMIT` environment
  variable (Source: `.env.example` lines 49–56).
- `extended: false` instructs `express.urlencoded` to use Node.js's
  built-in `querystring` parser rather than the richer `qs` library.
  The `qs` parser supports nested objects and arrays at the cost of a
  larger attack surface (prototype-pollution-style abuses of complex
  query syntax); `querystring` is intentionally simpler. Source:
  `src/app.js` lines 103–106 inline comment.
- Payloads that exceed `config.bodyLimit` are rejected by
  `body-parser` with a 413 (Payload Too Large) error that propagates
  via Express's `next(err)` chain to `src/middleware/errorHandler.js`,
  which formats it into the standardized error envelope.
- The control mitigates **CWE-400 (Uncontrolled Resource
  Consumption)** by capping the maximum memory and parse time that
  any single request can consume. Source: `src/app.js` lines 107–111
  inline comment, and `src/config/index.js` line 30 (`SECURITY:
  Configurable body parser size limit to prevent payload-based DoS
  attacks`).
- The `.env.example` file flags this variable as security-relevant in
  lines 49–56 (`SECURITY: Explicit body size limit prevents
  payload-based DoS attacks.`).



## Input Validation (Zod)

### Empty-Body / Empty-Query Policy on GET Routes

Every public GET endpoint in `src/routes/**` applies the same strict
Zod schema via the `validateInput` middleware factory:

```js
validateInput({
  body: z.object({}).strict().optional(),
  query: z.object({}).strict()
})
```

Application sites:

- `src/routes/index.js` line 44 — `GET /` (root welcome).
- `src/routes/health.js` line 41 — `GET /health`.
- `src/routes/api.js` line 33 — `GET /api`.
- `src/routes/api.js` line 71 — `GET /api/info`.

Behavior:

- `body: z.object({}).strict().optional()` — accepts a missing or
  empty body (`.optional()` allows `undefined`), but if a body is
  present it must be an empty object; `.strict()` causes any
  unrecognized key to fail validation.
- `query: z.object({}).strict()` — the query string must parse to an
  empty object. Any unexpected key such as `?foo=bar` is rejected
  before the route handler is invoked.

Rationale (drawn from the inline `SECURITY:` comments — e.g.,
`src/routes/index.js` line 32, `src/routes/health.js` line 21,
`src/routes/api.js` line 21): GETs traditionally ignore unknown query
parameters, and many web frameworks silently discard them. This
service makes the opposite choice as defense-in-depth — strict
rejection prevents attackers from using unexpected parameters for
probing, parameter-based cache poisoning, or reflected-parameter
injection vectors. Because the service has no legitimate need for
query parameters on any GET endpoint, the cost of strictness is
zero.

### 400 Response Contract

When validation fails, `src/middleware/validateInput.js` lines 77–81
returns:

```json
{
  "status": "error",
  "statusCode": 400,
  "message": "Validation failed: <field>: <message>; <field>: <message>"
}
```

The `<field>` portion is the fully qualified path joined with `.` —
for example, `query` for an unknown query key (Zod attaches the error
to the parent object rather than a specific path), or
`body.someField` for a deeply nested validation error. Each
field/message pair is separated by `; ` to keep the message a single
line suitable for log aggregation tools. Source:
`src/middleware/validateInput.js` lines 63–74.

Demonstration:

```bash
curl -i "http://localhost:3000/?foo=bar"
# HTTP/1.1 400 Bad Request
# Content-Type: application/json; charset=utf-8
# {
#   "status": "error",
#   "statusCode": 400,
#   "message": "Validation failed: query: Unrecognized key(s) in object: 'foo'"
# }
```

The 400 shape is asserted by the test suite in
`tests/routes/index.test.js` (and the equivalent suites for
`/health`, `/api`, and `/api/info`), as well as by direct unit tests
in `tests/middleware/validateInput.test.js`.

Implementation notes (Source: `src/middleware/validateInput.js`):

- Validation uses Zod's `safeParse` (line 60), which returns
  `{ success, data, error }` rather than throwing — there is no
  hidden control-flow via exceptions.
- The middleware fails fast (line 77 `return res.status(400).json(...)`)
  on the first schema that fails. It does not aggregate failures
  across multiple schema keys to keep the response small and
  predictable.
- When no schemas are provided (`Object.keys(schemas).length === 0`,
  line 48), the middleware short-circuits to `next()` — a defensive
  default that makes `validateInput()` (with no argument) a safe
  no-op.

## Error Message Masking (CWE-209)

The centralized error handler in `src/middleware/errorHandler.js` is
the last middleware in the pipeline (Source: `src/app.js` line 183
`app.use(errorHandler)`). It implements **CWE-209: Generation of
Error Message Containing Sensitive Information** mitigation by
masking 5xx error messages in production environments.

### Production Behavior

Source: `src/middleware/errorHandler.js` lines 75–79:

```js
const isServerError = statusCode >= 500;
const isProduction = process.env.NODE_ENV === 'production';
const message = (isServerError && isProduction)
  ? 'Internal Server Error'
  : (err.message || 'Internal Server Error');
```

Behavior summary:

- `NODE_ENV=production` is set by `ecosystem.config.js` lines
  130–135 when PM2 starts the service with `--env production`. It can
  also be set via `.env` (Source: `.env.example` lines 15–17:
  `SECURITY: Set to 'production' in production to enable error
  masking (CWE-209)`).
- Only **5xx** errors are masked. The `isServerError && isProduction`
  short-circuit means either condition being false yields
  `err.message` unchanged.
- Client errors (4xx) **always** preserve `err.message`. This is
  intentional: 4xx messages tell the API consumer what they did wrong
  (e.g., `Validation failed: query: ...`), which is actionable
  feedback that does not disclose internal server state.
- When the condition is true, the literal string
  `'Internal Server Error'` replaces the raw message in the response
  body, suppressing any sensitive details that may have been included
  by the throwing module (file paths, internal module names,
  connection strings, library error text).

The full response envelope built in `src/middleware/errorHandler.js`
lines 81–85 (with the production masking applied) is:

```json
{
  "status": "error",
  "statusCode": 500,
  "message": "Internal Server Error"
}
```

### Non-Production Behavior

Source: `src/middleware/errorHandler.js` lines 92–94:

```js
if (process.env.NODE_ENV !== 'production') {
  response.stack = err.stack;
}
```

When `NODE_ENV !== 'production'` (the default,
`'development'`, or any other value such as `'test'`):

- The original `err.message` is returned to the client unchanged
  (subject only to the `|| 'Internal Server Error'` fallback if the
  error has no message at all).
- The error's `stack` property is appended to the response body as a
  `stack` field. This is a deliberate development aid that exposes
  call traces over the wire and **must not** be relied upon in
  production.

Implementation detail — the conditional uses `!==` against the
literal string `'production'` rather than checking `isProduction`
inverse. This is equivalent in behavior but is written close to the
log/response site for clarity. Source:
`src/middleware/errorHandler.js` lines 87–94 inline comment.

## Log Injection Prevention (CWE-117)

User-controlled fields on the request — most notably `req.originalUrl`
and `req.method` — must be sanitized before they are passed to the
Winston logger. Without sanitization, an attacker could craft a
request containing newline (`\n` or `\r\n`) or terminal-escape
sequences (`\x1b[...]`) inside the URL or method and either forge log
lines or manipulate terminal renderings of the log output. The
helper that mitigates **CWE-117: Improper Output Neutralization for
Logs** is `sanitizeLogInput`.

### `sanitizeLogInput`

Source: `src/utils/sanitizer.js` lines 97–125. The function performs
three transformations in order:

1. **Strip ANSI escape sequences.** The pattern
   `ANSI_ESCAPE_PATTERN = /\x1b\[[\d;]*[a-zA-Z]/g` (Source:
   `src/utils/sanitizer.js` line 68) matches sequences such as
   `\x1b[31m` (red text) and `\x1b[0m` (reset). Stripping these
   prevents an attacker from injecting color or cursor-movement
   sequences that would mislead an operator reading the log in a
   terminal viewer.
2. **Strip C0 control characters and DEL.** The pattern
   `CONTROL_CHAR_PATTERN = /[\x00-\x1f\x7f]/g` (Source:
   `src/utils/sanitizer.js` line 74) removes the entire C0 range
   (`\x00`–`\x1f`) plus `\x7f` (DEL). This eliminates the carriage
   return (`\r` / `\x0d`) and line feed (`\n` / `\x0a`) characters
   that an attacker would use to inject a fake log line.
3. **Truncate to `MAX_LOG_LENGTH = 1000` characters.** When the
   input is longer than 1000 characters, the output is truncated and
   the constant `TRUNCATION_INDICATOR = '...[truncated]'` is
   appended (Source: `src/utils/sanitizer.js` lines 45, 59,
   117–122). This cap prevents an attacker from bloating log files
   (a slow-burn disk-DoS) by sending megabyte-sized URLs.

The order matters: ANSI sequences must be stripped before
individual control characters because the ANSI pattern matches a
multi-character sequence whose first byte (`\x1b`) is itself a
control character. If the control-character strip ran first, the
remainder of the ANSI sequence (e.g., `[31m`) would survive in the
output as visible noise. Source: `src/utils/sanitizer.js` lines
106–115 inline comment.

The function is defensive about input types — `null` and
`undefined` return `''` (lines 99–101), and any non-string is
converted via `String(...)` (line 104) — so callers do not need to
guard against arbitrary `req` shapes.

### Where It Is Applied

`sanitizeLogInput` is applied at every site that logs user-controlled
data:

- `src/middleware/errorHandler.js` line 65 — wraps both
  `req.originalUrl` and `req.method` before they are interpolated
  into the `logger.error()` message string:

  ```js
  logger.error(
    `${statusCode} - ${err.message} - ` +
    `${sanitizeLogInput(req.originalUrl)} - ` +
    `${sanitizeLogInput(req.method)}`
  );
  ```

  This wraps the only error-emitting site in the codebase that
  includes request fields.

- `src/middleware/notFound.js` line 44 — wraps `req.originalUrl`
  before the 404 warning:

  ```js
  logger.warn(`404 - Not Found - ${sanitizeLogInput(req.originalUrl)}`);
  ```

  The 404 handler is the highest-volume logging site for unmatched
  paths and is therefore a likely target for log-injection probing.

The mapping is exhaustive — every place in the codebase that logs
either `req.originalUrl` or `req.method` passes the field through
`sanitizeLogInput` first.



## Reflected Content Prevention

The 404 handler echoes the unmatched URL back to the client inside the
response body. Reflected user input is a classic source of injection
risk: even though the response is JSON, downstream consumers that
mishandle the `Content-Type` could render it as HTML. The
`sanitizeUrl` helper encodes HTML-unsafe characters as a
defense-in-depth measure.

### `sanitizeUrl`

Source: `src/utils/sanitizer.js` lines 149–186. The function performs
four transformations:

1. **Strip ANSI escape sequences** (`ANSI_ESCAPE_PATTERN`). Source:
   `src/utils/sanitizer.js` line 161. Same rationale as
   `sanitizeLogInput`.
2. **Strip control characters** (`CONTROL_CHAR_PATTERN`). Source:
   `src/utils/sanitizer.js` line 162. Same rationale as
   `sanitizeLogInput`.
3. **HTML-entity-encode the five characters** that would otherwise
   permit HTML or attribute injection. Source:
   `src/utils/sanitizer.js` lines 172–177:

   ```js
   sanitized = sanitized
     .replace(/&/g, '&amp;')
     .replace(/</g, '&lt;')
     .replace(/>/g, '&gt;')
     .replace(/"/g, '&quot;')
     .replace(/'/g, '&#x27;');
   ```

   The order is significant: `&` is replaced **first** so that the
   subsequent insertions of `&amp;`, `&lt;`, etc., are not themselves
   double-encoded. Source: `src/utils/sanitizer.js` line 173 inline
   comment.

4. **Truncate to `MAX_URL_LENGTH = 2048` characters** with the
   `'...[truncated]'` indicator (Source: `src/utils/sanitizer.js`
   lines 53, 179–183). The 2048-character cap matches the de facto
   browser/server URL length limit and prevents unbounded reflected
   content in response bodies.

Same defensive input handling as `sanitizeLogInput` — `null` and
`undefined` return `''`, non-strings are coerced via `String(...)`
(Source: `src/utils/sanitizer.js` lines 150–156).

Why HTML encoding for a JSON response? The JSON envelope is served
with `Content-Type: application/json` (Express's default for
`res.json()`), and a conforming client will parse it as JSON. The
encoding is **defense-in-depth** for the (incorrect) case where a
downstream tool — a chat client, a logging dashboard, or a
copy-paste of the message into an HTML report — interprets the
message string as HTML. Source: `src/utils/sanitizer.js` lines
164–171 inline comment.

### Where It Is Applied

The single application site is the 404 message body:

- `src/middleware/notFound.js` line 50 — interpolates the sanitized
  URL into the response message:

  ```js
  res.status(404).json({
    status: 'error',
    statusCode: 404,
    message: `Not Found - ${sanitizeUrl(req.originalUrl)}`
  });
  ```

  This is the only place in the codebase where a user-controlled
  string is reflected into a JSON response body.

Demonstration of the encoding in action:

```bash
curl -i 'http://localhost:3000/<script>alert(1)</script>'
# HTTP/1.1 404 Not Found
# Content-Type: application/json; charset=utf-8
# {
#   "status": "error",
#   "statusCode": 404,
#   "message": "Not Found - /&lt;script&gt;alert(1)&lt;/script&gt;"
# }
```

The encoding contract is asserted directly by
`tests/middleware/notFound.test.js` lines 150–164, which constructs
a request with `originalUrl: '/<script>alert("xss")</script>'` and
asserts that the response message contains `&lt;script&gt;` and
`&lt;/script&gt;` rather than the raw tag form.

**A deliberate non-application** — `sanitizeUrl` is **not** applied
inside `src/middleware/errorHandler.js` to the response body's
`message` field. The error handler's `message` originates from
`err.message` (a server-side value), not from a reflected request
field, and is already subject to the production masking described in
[Error Message Masking (CWE-209)](#error-message-masking-cwe-209).
The error handler does, however, still apply `sanitizeLogInput` to
`req.originalUrl` and `req.method` for log safety (Source:
`src/middleware/errorHandler.js` line 65). The two helpers separate
concerns: `sanitizeLogInput` for things going **into the log**,
`sanitizeUrl` for things going **into a JSON response body**.

## HTTP Method Restriction (405 Method Not Allowed)

Every route file pairs a `router.get('/')` (or `router.get('/info')`)
declaration with a `router.all()` catch-all that returns
`405 Method Not Allowed` and an `Allow: GET, HEAD` header.
Application sites:

| Path        | GET handler                  | 405 catch-all                     |
|-------------|------------------------------|-----------------------------------|
| `/`         | `src/routes/index.js` L44    | `src/routes/index.js` L54–60      |
| `/health`   | `src/routes/health.js` L41   | `src/routes/health.js` L55–61     |
| `/api`      | `src/routes/api.js` L33      | `src/routes/api.js` L47–53        |
| `/api/info` | `src/routes/api.js` L71      | `src/routes/api.js` L85–91        |

The response contract returned by every 405 catch-all is identical:

```json
{
  "status": "error",
  "statusCode": 405,
  "message": "Method Not Allowed"
}
```

with the response header `Allow: GET, HEAD` (Source:
`src/routes/index.js` line 55, `src/routes/health.js` line 56,
`src/routes/api.js` lines 48 and 86).

Rationale (drawn verbatim-safe from the inline comments in
`src/routes/index.js` lines 49–53, with equivalent text in
`src/routes/health.js` lines 51–54 and `src/routes/api.js` lines
40–46 and 82–84):

- Express's `router.get('/')` only matches `GET` and `HEAD` requests.
  All other HTTP methods (`POST`, `PUT`, `DELETE`, `PATCH`,
  `OPTIONS`, custom verbs) bypass the GET route's middleware chain
  entirely — including the `validateInput` step — and would
  otherwise fall through to the `notFound` middleware with a
  misleading 404 status.
- The explicit `router.all('/')` (registered **after** the GET
  handler so it does not shadow it) catches every method that the
  GET handler did not. The 405 response with the `Allow` header
  satisfies the requirement of RFC 9110 §15.5.6 and gives API
  consumers actionable feedback.
- `OPTIONS` requests would also be matched by `router.all('/')` were
  it not for the fact that the `cors` middleware (registered
  earlier, at Step 2 of the pipeline — Source: `src/app.js` lines
  92–94) intercepts preflight requests and responds before they
  reach the route layer. The 405 catch-all therefore primarily
  handles unauthorized `POST`/`PUT`/`DELETE`/`PATCH` attempts.

The test suite asserts the 405 + `Allow` contract in
`tests/app.test.js` lines 139–144 (PUT request on the root path)
among other sites.

## Defense-in-Depth Summary

The table below maps every security control to the middleware-pipeline
layer in which it executes. "Layer" numbers correspond to the
nine-step pipeline documented in `src/app.js` lines 8–17 and in
[`./architecture.md`](./architecture.md).

| Control | Layer | File(s) |
|---|---|---|
| HTTP security headers (Helmet) | Middleware step 1 | `src/app.js` |
| API-hardened CSP (`default-src 'none'`, `frame-ancestors 'none'`) | Middleware step 1 | `src/app.js` |
| `X-Powered-By` removal | Middleware step 1 | `src/app.js` |
| CORS policy | Middleware step 2 | `src/app.js`, `src/config/index.js` |
| Body-size limit (CWE-400) | Middleware step 4 | `src/app.js`, `src/config/index.js` |
| HTTP access logging (Morgan → Winston `logger.stream`) | Middleware step 5 | `src/app.js`, `src/utils/logger.js` |
| Rate limiting | Middleware step 6 | `src/app.js`, `src/config/index.js` |
| Zod empty-body / empty-query validation | Route-level (step 7) | `src/routes/index.js`, `src/routes/health.js`, `src/routes/api.js`, `src/middleware/validateInput.js` |
| 405 method guards (`router.all()` after `router.get()`) | Route-level (step 7) | `src/routes/index.js`, `src/routes/health.js`, `src/routes/api.js` |
| 404 with sanitized URL reflection | Terminal middleware (step 8) | `src/middleware/notFound.js`, `src/utils/sanitizer.js` |
| 5xx error masking in production (CWE-209) | Error handler (step 9) | `src/middleware/errorHandler.js` |
| Log-injection sanitization in error paths (CWE-117) | `errorHandler` and `notFound` middleware | `src/middleware/errorHandler.js`, `src/middleware/notFound.js`, `src/utils/sanitizer.js` |

> Note: Response compression (`compression()`) is registered at middleware
> step 3 (Source: `src/app.js` line 100) **as performance middleware**, not
> as a security control. Compression of attacker-controlled input alongside
> secrets in the same response can theoretically enable BREACH-style oracle
> attacks; see the **Limitations** section below for the operator caveat.
> Note also that `sanitizeLogInput` is **only** applied in `errorHandler`
> and `notFound` (i.e., the error and 404 paths). Morgan-formatted access
> logs are forwarded through `logger.stream.write(message) =>
> logger.http(message.trim())` (Source: `src/utils/logger.js` lines
> 110–114), which only trims trailing whitespace and does **not** invoke
> `sanitizeLogInput`.

The layered approach means a single missing or bypassed control does
not collapse the entire posture — for example, even if the rate
limiter is bypassed (layer 6), the body-size limit (layer 4) still
caps the per-request cost, and the Zod validator (layer 7) still
rejects unexpected payloads.

## Limitations

- **No authentication or authorization.** Every endpoint is publicly
  reachable. `/health` is intentionally unauthenticated because it is
  designed to be probed by load balancers and the PM2 process
  manager (Source: `src/routes/health.js` lines 8–9 JSDoc; cross-link
  [`./api.md`](./api.md) for the endpoint reference).
- **No TLS termination in-app.** The service binds to plain HTTP via
  `app.listen(config.port, config.host, ...)` in `server.js` lines
  56–69. Operators **must** terminate TLS at an upstream reverse
  proxy (e.g., nginx, HAProxy, a cloud load balancer) before
  exposing the service to the public internet. The `Strict-Transport
  -Security` header emitted by Helmet (asserted by
  `tests/app.test.js` lines 71–76) only takes effect when the
  response is actually delivered over HTTPS.
- **Rate limiting is per-process and in-memory.** The
  `express-rate-limit` middleware (Source: `src/app.js` lines
  135–148) stores counters in the worker process's memory. In a PM2
  cluster (Source: `ecosystem.config.js` lines 46–47, `instances:
  'max'`, `exec_mode: 'cluster'`), each worker maintains its own
  counter — the effective per-IP limit across the cluster is
  approximately `RATE_LIMIT_MAX × number_of_workers`. Counters also
  reset when the worker restarts. Operators who require cluster-wide
  limits must add a shared store (Redis, Memcached) outside the
  scope of this service.
- **No `trust proxy` setting.** The Express app does not call
  `app.set('trust proxy', ...)` (Source: `src/app.js` — no
  `app.set('trust proxy', ...)` invocation exists anywhere in the
  file). Behind a reverse proxy, `req.ip` and `X-Forwarded-For` are
  not consulted, so the rate limiter sees every connection as
  coming from the proxy's IP. Operators **must** configure
  `app.set('trust proxy', ...)` (out of scope for this descriptive
  document — see `express` and `express-rate-limit` docs) if
  per-IP rate limiting is required across multiple workers behind a
  shared proxy.
- **No WAF integration.** No web-application-firewall product is
  bundled with the service. Pattern-based attack detection
  (e.g., SQL-injection rule sets, abusive User-Agents) is not
  implemented; operators must add this at the proxy or CDN layer
  if required.
- **Response compression is enabled by default.** `compression()` is
  registered at middleware step 3 (Source: `src/app.js` line 100).
  For services that include attacker-controlled input alongside
  secrets in the **same** response, this can theoretically enable
  BREACH-style oracle attacks. Because this service does not
  produce responses that mix user input with secrets, the risk is
  not applicable in practice — but operators forking this codebase
  for sensitive applications should evaluate disabling compression
  on a per-route basis.

## Source Citations

Every claim in this guide is supported by one or more of the
following source files. Line numbers cited inline refer to the
current revision of these files.

- `src/app.js` — middleware pipeline composition, Helmet
  configuration, CORS registration, body-parser limits, Morgan
  logging integration, rate limiter, route mounting, 404 handler
  registration, error handler registration.
- `src/config/index.js` — `corsOrigin` default, `bodyLimit` default,
  frozen `rateLimit.windowMs` and `rateLimit.max`, `parseIntSafe`
  helper, `Object.freeze` of the root config and the nested
  `rateLimit` object.
- `src/middleware/errorHandler.js` — 5xx production masking,
  conditional stack inclusion in non-production, sanitized error
  logging.
- `src/middleware/notFound.js` — 404 warning log via
  `sanitizeLogInput`, 404 response body via `sanitizeUrl`.
- `src/middleware/validateInput.js` — Zod `safeParse`-driven
  validation, 400 envelope shape, fail-fast on first failure.
- `src/routes/index.js` — `GET /` empty-body/empty-query schema,
  `router.all('/')` 405 catch-all with `Allow: GET, HEAD`.
- `src/routes/health.js` — `GET /health` empty-body/empty-query
  schema, `router.all('/')` 405 catch-all.
- `src/routes/api.js` — `GET /api` and `GET /api/info` schemas,
  paired `router.all()` 405 catch-alls.
- `src/utils/sanitizer.js` — `ANSI_ESCAPE_PATTERN`,
  `CONTROL_CHAR_PATTERN`, `MAX_LOG_LENGTH = 1000`,
  `MAX_URL_LENGTH = 2048`, `TRUNCATION_INDICATOR = '...[truncated]'`,
  HTML-entity encoding for `&`, `<`, `>`, `"`, `'`.
- `src/utils/logger.js` — Winston logger and `logger.stream` adapter
  through which Morgan emits HTTP access log lines at the `http` level.
  The stream's `write(message)` callback applies `message.trim()` only —
  it does **not** invoke `sanitizeLogInput`. Sanitization in this service
  is limited to `errorHandler` and `notFound`.
- `ecosystem.config.js` — `env_production.NODE_ENV = 'production'`
  triggers the error-masking path.
- `.env.example` — operator-facing security-relevant variables
  (`NODE_ENV`, `CORS_ORIGIN`, `BODY_LIMIT`, `RATE_LIMIT_WINDOW_MS`,
  `RATE_LIMIT_MAX`).
- `tests/app.test.js` — security-headers assertions (Helmet output,
  CSP directives, HSTS, `X-Powered-By` removal), CORS assertions,
  405 + Allow assertions.
- `tests/middleware/notFound.test.js` — sanitized URL reflection
  assertions, HTML-entity encoding assertions.
- `tests/middleware/errorHandler.test.js`,
  `tests/middleware/validateInput.test.js`,
  `tests/routes/index.test.js`, `tests/routes/health.test.js`,
  `tests/routes/api.test.js` — error-shape and validation-shape
  assertions referenced throughout this document.

## Related Documentation

- Module-level READMEs:
  [`../src/middleware/README.md`](../src/middleware/README.md) ·
  [`../src/utils/README.md`](../src/utils/README.md) ·
  [`../src/routes/README.md`](../src/routes/README.md) ·
  [`../src/config/README.md`](../src/config/README.md)
- Operator guides:
  [`./api.md`](./api.md) (full 400/404/405/429/500 contracts) ·
  [`./architecture.md`](./architecture.md) (middleware pipeline order
  and rationale) ·
  [`./observability.md`](./observability.md) (logging stack and log
  rotation) ·
  [`./deployment.md`](./deployment.md) (PM2, signals, environment
  switching) ·
  [`./testing.md`](./testing.md) (test suite that asserts the
  security contracts cited above)

---

[Back to README](../README.md) · [Architecture](./architecture.md) ·
[API Reference](./api.md) · [Observability](./observability.md) ·
[Deployment](./deployment.md) · [Testing](./testing.md)

