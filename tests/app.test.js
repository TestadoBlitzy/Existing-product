/**
 * Supertest integration tests for src/app.js — the assembled Express application.
 *
 * Verifies the externally observable middleware behaviour and route-mounting
 * contract documented in AAP §§ 0.4.2, 0.5.2, 0.7.1 against the in-process
 * Express app exported by src/app.js. The middleware chain under test is:
 *
 *   helmet() → cors({ origin: config.corsOrigin })
 *           → compression()
 *           → express.json() → express.urlencoded({ extended: true })
 *           → morgan(format, { stream: logger.stream })
 *           → routes → notFound → errorHandler
 *
 * Coverage focus per AAP § 0.7.1:
 *   - lines      ≥ 95 %
 *   - functions  = 100 %
 *   - branches   ≥ 90 %  (Morgan format dev/combined branch covered below)
 *   - statements ≥ 95 %
 *
 * Test organisation (21 tests / 6 nested describe blocks):
 *   1. Helmet security headers (7) — x-content-type-options, x-frame-options,
 *      strict-transport-security, referrer-policy, x-dns-prefetch-control,
 *      content-security-policy, x-powered-by suppression.
 *   2. CORS headers (2) — access-control-allow-origin default, OPTIONS preflight.
 *   3. Compression middleware (1) — Vary: Accept-Encoding presence.
 *   4. Body parsers (3) — application/json, application/x-www-form-urlencoded,
 *      empty JSON body.
 *   5. Route mounting and notFound delegation (4) — /health, /api, /api/info
 *      reachable; 404 shape on unknown paths; JSON content type; nested paths.
 *   6. Morgan logging integration (4) — logger.http invoked in default env,
 *      dev-format shape (default env), combined-format shape (production env),
 *      and 'test' env (no crash). The dev/combined format-shape assertions
 *      verify the actual logged string (not merely the call count) so that
 *      a regression which still calls logger.http with the wrong format is
 *      caught loudly per the AAP § 0.1.1 / § 0.4.2 mandate.
 *
 * Test isolation strategy (AAP § 0.4.5):
 *   - jest.resetModules() in beforeEach so each test loads src/app.js fresh and
 *     Morgan re-evaluates the dev-vs-combined format from the current NODE_ENV.
 *   - jest.spyOn on logger.{info,http,error,warn} BEFORE the app require so that
 *     all Winston output is silenced for the duration of the test (Winston file
 *     transports still create logs/combined.log + logs/error.log at module load
 *     because the spies replace the level methods but not the transport
 *     constructors — that side-effect is acceptable and gitignored).
 *   - process.env snapshot/restore via tests/helpers/env.js so NODE_ENV
 *     mutations performed by the Morgan tests do not leak into sibling tests.
 *   - jest.config.js sets restoreMocks: true; the explicit jest.restoreAllMocks()
 *     in afterEach documents the intent and protects against config drift.
 *
 * Tests run against the in-process Express app via Supertest. No real socket
 * is bound (Supertest uses an ephemeral port that is allocated and released
 * within a single request/response lifecycle) and no real disk write happens
 * beyond Winston's transport initialisation, which is benign.
 *
 * Authoritative blueprint: AAP §§ 0.4.2, 0.4.5, 0.5.2, 0.7.1, 0.10.5.
 *
 * Mirrors the house style established by tests/routes/api.test.js (PATTERN
 * SEED): CommonJS require, 2-space indentation, single quotes, semicolons,
 * top-level describe(<source-path>), nested describe per behaviour family,
 * async/await for Supertest, file-level JSDoc.
 */

const request = require('supertest');
const { snapshotEnv, restoreEnv } = require('./helpers/env');

describe('src/app.js', () => {
  // Per-test state — repopulated by beforeEach. Declared at describe scope so
  // every nested describe and it() inherits access to the fresh app/logger.
  let app;
  let logger;
  let envSnap;

  beforeEach(() => {
    // 1. Snapshot the current process.env so any NODE_ENV mutation performed
    //    by an it() body (notably the Morgan production-format test) can be
    //    reverted in afterEach without leaking into the next test.
    envSnap = snapshotEnv();

    // 2. Wipe Node's require cache so the next require('../src/utils/logger')
    //    and require('../src/app') re-evaluate their module-level code under
    //    the env vars active at test-start time. This is the mechanism that
    //    lets the Morgan format branch (dev vs combined) be exercised under
    //    different NODE_ENV settings within the same Jest worker.
    jest.resetModules();

    // 3. Load the logger module FIRST so we can install spies before the app
    //    middleware chain is wired up. require('../src/app') below will reach
    //    Node's module cache and reuse this same logger instance, so the
    //    spies installed here capture every logger.http call Morgan emits
    //    (via the stream.write closure defined in src/utils/logger.js).
    logger = require('../src/utils/logger');
    jest.spyOn(logger, 'info').mockImplementation(() => {});
    jest.spyOn(logger, 'error').mockImplementation(() => {});
    jest.spyOn(logger, 'http').mockImplementation(() => {});
    jest.spyOn(logger, 'warn').mockImplementation(() => {});

    // 4. Load the assembled Express app fresh so Morgan picks up the current
    //    NODE_ENV when evaluating the format string at app-construction time
    //    (src/app.js line ~80: `config.nodeEnv === 'production' ? 'combined'
    //    : 'dev'`).
    app = require('../src/app');
  });

  afterEach(() => {
    // Restore process.env so subsequent tests see the env state they expect.
    restoreEnv(envSnap);
    // jest.config.js sets restoreMocks: true, which auto-restores spies
    // between tests; the explicit call documents intent per AAP § 0.10.5.
    jest.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Helmet security headers
  // ---------------------------------------------------------------------------
  // Helmet 8.x sets a documented set of security-hardening headers on every
  // response. The exact value of some headers (HSTS max-age, CSP directives,
  // X-Frame-Options policy) can shift across patch releases, so per AAP § 0.5.2
  // we use toHaveProperty(...) for presence-only checks where the value is
  // version-sensitive, and toHaveProperty(name, value) only for stable values
  // (e.g. nosniff). The X-Powered-By suppression is the inverse contract:
  // Helmet removes the default 'X-Powered-By: Express' header for security.
  // ---------------------------------------------------------------------------
  describe('Helmet security headers', () => {
    it('sets x-content-type-options: nosniff', async () => {
      const response = await request(app).get('/api');
      // Stable value across Helmet 4.x through 8.x — strict equality is safe.
      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
    });

    it('sets x-frame-options to deny or sameorigin', async () => {
      const response = await request(app).get('/api');
      // Value (DENY vs SAMEORIGIN) varies by Helmet major version; presence
      // alone is the durable contract. Asserting on a specific value would
      // make the test brittle to a Helmet patch bump.
      expect(response.headers).toHaveProperty('x-frame-options');
    });

    it('sets strict-transport-security (HSTS)', async () => {
      const response = await request(app).get('/api');
      // Helmet sets HSTS in all environments (not only production). The
      // max-age value can shift across Helmet versions, so we assert
      // presence only per AAP § 0.5.2.
      expect(response.headers).toHaveProperty('strict-transport-security');
    });

    it('sets referrer-policy', async () => {
      const response = await request(app).get('/api');
      // Value (no-referrer vs strict-origin-when-cross-origin) is Helmet-
      // version sensitive; presence is the durable contract.
      expect(response.headers).toHaveProperty('referrer-policy');
    });

    it('sets x-dns-prefetch-control', async () => {
      const response = await request(app).get('/api');
      // Helmet's dnsPrefetchControl middleware sets this header to 'off'
      // by default; presence-only assertion tolerates future default
      // changes without losing the regression detection.
      expect(response.headers).toHaveProperty('x-dns-prefetch-control');
    });

    it('sets content-security-policy', async () => {
      const response = await request(app).get('/api');
      // The CSP directive string is Helmet's default policy which can shift
      // across minor versions (e.g. addition of new sources). Presence-only
      // assertion is the durable contract.
      expect(response.headers).toHaveProperty('content-security-policy');
    });

    it('removes the x-powered-by header for security', async () => {
      const response = await request(app).get('/api');
      // Helmet's hidePoweredBy middleware removes the default 'X-Powered-By:
      // Express' header so attackers cannot trivially fingerprint the stack.
      // The inverse contract — presence WOULD be a regression — is asserted
      // here with toBeUndefined.
      expect(response.headers['x-powered-by']).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // CORS headers
  // ---------------------------------------------------------------------------
  // config.corsOrigin defaults to '*' (per src/config/index.js). The cors()
  // middleware configured with `{ origin: '*' }` sets Access-Control-Allow-
  // Origin: * on every response and handles OPTIONS preflight requests by
  // responding with the appropriate headers. Both contracts are observable
  // from outside the app and pinned here.
  // ---------------------------------------------------------------------------
  describe('CORS headers', () => {
    it('sets access-control-allow-origin to "*" (config.corsOrigin default)', async () => {
      const response = await request(app).get('/api');
      // Exact-value assertion: the default corsOrigin is the string '*' and
      // any drift (e.g. accidental restriction to a specific domain) MUST
      // fail this test loudly per the immutable Backprop integration
      // contract referenced in AAP § 0.1.1.
      expect(response.headers).toHaveProperty('access-control-allow-origin', '*');
    });

    it('handles OPTIONS preflight requests', async () => {
      const response = await request(app)
        .options('/api')
        .set('Origin', 'https://example.com')
        .set('Access-Control-Request-Method', 'GET');
      // The cors middleware responds to preflight with HTTP 204 by default
      // (no body), but some configurations / versions return 200. Both are
      // valid completions of the preflight contract; we accept either to
      // avoid coupling the test to a cors patch-version detail.
      expect([200, 204]).toContain(response.status);
      // The preflight response MUST advertise the allowed origin so the
      // browser permits the subsequent actual request.
      expect(response.headers).toHaveProperty('access-control-allow-origin', '*');
    });
  });

  // ---------------------------------------------------------------------------
  // Compression middleware
  // ---------------------------------------------------------------------------
  // The compression middleware sets Vary: Accept-Encoding on every response
  // regardless of payload size so that intermediate caches differentiate
  // responses based on the client's Accept-Encoding header. The actual gzip
  // encoding only kicks in for payloads ≥ 1KB (the default threshold), and
  // every built-in route here returns a small JSON body. Per AAP § 0.5.2
  // we assert on the Vary header (always set) rather than Content-Encoding
  // (only set on large payloads) to avoid the need for a test-only route
  // returning padded data — which AAP § 0.10.3 explicitly forbids.
  // ---------------------------------------------------------------------------
  describe('Compression middleware', () => {
    it('advertises encoding negotiation via the Vary header', async () => {
      const response = await request(app).get('/api');
      expect(response.headers).toHaveProperty('vary');
      // The compression middleware appends 'Accept-Encoding' to the Vary
      // header. Other middleware may add additional Vary values (e.g.
      // cors adds 'Origin' in some configurations), so we check for
      // containment rather than strict equality. Lower-cased comparison
      // tolerates header-value casing differences across HTTP libraries.
      expect(response.headers.vary.toLowerCase()).toEqual(
        expect.stringContaining('accept-encoding')
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Body parsers (express.json / express.urlencoded)
  // ---------------------------------------------------------------------------
  // src/app.js registers both express.json() and express.urlencoded({
  // extended: true }) BEFORE the route layer. The parsers must accept their
  // respective content types without throwing 415 / 400; if they did, the
  // request would never reach the route or notFound layers. We prove the
  // parsers ran cleanly by POSTing a body to an unknown path and asserting
  // the notFound middleware produced the documented 404 envelope — that
  // outcome is only reachable if the parser middleware completed without
  // raising an error.
  // ---------------------------------------------------------------------------
  describe('Body parsers', () => {
    it('accepts JSON request bodies without throwing 415/400', async () => {
      const response = await request(app)
        .post('/this/route/does/not/exist')
        .set('Content-Type', 'application/json')
        .send({ test: 'data', nested: { value: 42 } });
      // 404 = parser accepted the body, no route matched, notFound fired.
      // 415 / 400 would mean express.json() rejected the payload, which
      // would be a regression in middleware wiring.
      expect(response.status).toBe(404);
      // Body shape proves it was the notFound handler that responded
      // (not Express's default 404 HTML page).
      expect(response.body).toEqual({
        status: 404,
        message: 'Not Found',
        path: '/this/route/does/not/exist',
      });
    });

    it('accepts URL-encoded request bodies without throwing 415/400', async () => {
      const response = await request(app)
        .post('/another/missing/route')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send('field=value&another=thing');
      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        status: 404,
        message: 'Not Found',
        path: '/another/missing/route',
      });
    });

    it('accepts an empty JSON body', async () => {
      const response = await request(app)
        .post('/nope')
        .set('Content-Type', 'application/json')
        .send({});
      // An empty JSON object is the minimal valid JSON body; express.json()
      // must accept it without raising a body-parser error. The 404 result
      // proves the parser succeeded and the request reached notFound.
      expect(response.status).toBe(404);
    });
  });

  // ---------------------------------------------------------------------------
  // Route mounting and notFound delegation
  // ---------------------------------------------------------------------------
  // src/app.js mounts the route aggregator at '/' (src/routes/index.js)
  // which in turn mounts /health and /api sub-routers. The notFound
  // middleware is registered AFTER all routes and produces the structured
  // 404 envelope documented in src/middleware/notFound.js. These tests
  // verify the mounting contract and the 404 fall-through path. The
  // body-shape verification for the 404 envelope is covered in greater
  // depth by tests/middleware/notFound.test.js — here we own the
  // integration-level assertion that app.js wires the middleware chain
  // such that unknown paths reach notFound.
  // ---------------------------------------------------------------------------
  describe('Route mounting and notFound delegation', () => {
    it('mounts /health and /api routes (reachable via Supertest)', async () => {
      // GET /health → src/routes/health.js handler → 200
      const healthRes = await request(app).get('/health');
      expect(healthRes.status).toBe(200);
      // GET /api → src/routes/api.js root handler → 200 (Backprop contract)
      const apiRes = await request(app).get('/api');
      expect(apiRes.status).toBe(200);
      // GET /api/info → src/routes/api.js info handler → 200
      const infoRes = await request(app).get('/api/info');
      expect(infoRes.status).toBe(200);
    });

    it('returns 404 with the documented shape for unknown paths', async () => {
      const response = await request(app).get('/this/does/not/exist');
      expect(response.status).toBe(404);
      // toEqual performs deep equality so missing OR extra fields fail the
      // test. This pins the notFound envelope shape from
      // src/middleware/notFound.js at the integration level.
      expect(response.body).toEqual({
        status: 404,
        message: 'Not Found',
        path: '/this/does/not/exist',
      });
    });

    it('returns JSON Content-Type on every response', async () => {
      const response = await request(app).get('/api');
      // stringContaining tolerates trivial Express patch-version variations
      // in casing or whitespace around the charset parameter (e.g.
      // 'application/json; charset=utf-8' vs 'application/json;charset=UTF-8').
      expect(response.headers['content-type']).toEqual(
        expect.stringContaining('application/json')
      );
    });

    it('handles deeply nested unknown paths', async () => {
      const response = await request(app).get('/a/b/c/d/e');
      expect(response.status).toBe(404);
      // Verify the original nested path is echoed back in the 404 envelope.
      // This catches regressions where path normalisation or middleware
      // truncation drops nested segments.
      expect(response.body.path).toBe('/a/b/c/d/e');
    });
  });

  // ---------------------------------------------------------------------------
  // Morgan logging integration
  // ---------------------------------------------------------------------------
  // src/app.js registers morgan(morganFormat, { stream: logger.stream })
  // where morganFormat is 'combined' under NODE_ENV=production and 'dev'
  // otherwise. Morgan calls stream.write(message) once per request, and
  // logger.stream.write forwards through logger.http(...) per the closure
  // in src/utils/logger.js. We therefore prove Morgan is wired in by
  // observing the logger.http spy being called at least once after a
  // single HTTP request.
  //
  // Branch coverage for the ternary at src/app.js:80 is achieved by
  // exercising the test twice — once with the default NODE_ENV (taking the
  // 'dev' branch) and once with NODE_ENV='production' (taking the
  // 'combined' branch). The third 'test' env test confirms the app does
  // not crash under an arbitrary NODE_ENV that is neither development nor
  // production, satisfying the AAP § 0.4.2 happy-path and edge-case
  // requirements for Morgan format selection.
  //
  // Format-shape assertions (AAP §§ 0.1.1, 0.4.2 — environment-sensitive
  // Morgan format selection must be semantically verified, not merely
  // observed via logger invocation count). The two formats produce
  // distinct, machine-detectable signatures:
  //
  //   dev      → ':method :url :status :response-time ms - :res[content-length]'
  //              Example: 'GET /api 200 1.992 ms - 27'
  //              - DOES contain a millisecond response-time segment ('ms')
  //              - DOES NOT contain the quoted HTTP-version request line
  //
  //   combined → ':remote-addr - :remote-user [:date[clf]] ":method :url
  //               HTTP/:http-version" :status :res[content-length]
  //               ":referer" ":user-agent"'
  //              Example: '::ffff:127.0.0.1 - - [18/May/2026:14:07:38 +0000]
  //              "GET /api HTTP/1.1" 200 27 "-" "-"'
  //              - DOES contain the quoted HTTP-version request line
  //                ('"GET /api HTTP/1.1"')
  //              - DOES contain a bracketed CLF date stamp
  //              - DOES contain quoted referer/user-agent segments
  //
  // The format-shape assertions below inspect the actual string passed to
  // logger.http (via logger.stream.write, which strips ANSI escapes and
  // trims trailing newlines per src/utils/logger.js). They would catch a
  // regression such as `const morganFormat = 'dev'` (incorrect production
  // format) or an inverted ternary, both of which would silently pass an
  // invocation-only assertion.
  // ---------------------------------------------------------------------------
  describe('Morgan logging integration', () => {
    it('invokes logger.http (via Morgan stream) on each request in default env', async () => {
      // The beforeEach already installed the spy on logger.http and loaded
      // the app under the default NODE_ENV (which is undefined in the Jest
      // worker, so src/config/index.js falls back to 'development' and
      // Morgan picks the 'dev' format). A single GET /api is sufficient to
      // observe one stream.write -> logger.http call.
      await request(app).get('/api');
      expect(logger.http).toHaveBeenCalled();
    });

    it('uses Morgan "dev" format in non-production env (asserts format shape)', async () => {
      // Under default NODE_ENV (undefined → 'development' fallback in
      // src/config/index.js), src/app.js takes the 'dev' branch of the
      // morganFormat ternary. The dev format embeds the response-time
      // segment (' ms ') and the response-content-length suffix
      // (' - <bytes>'), but does NOT emit the quoted HTTP request line
      // that uniquely identifies the combined format.
      await request(app).get('/api');

      expect(logger.http).toHaveBeenCalled();
      // The Morgan stream invokes logger.http exactly once per request.
      // Grab the most recent call's first argument and inspect its shape.
      const lastCallArgs = logger.http.mock.calls[logger.http.mock.calls.length - 1];
      const logged = lastCallArgs[0];

      // Robust dev-format signature: contains the method + path + status
      // and the response-time ' ms ' segment that is unique to 'dev'.
      // A regression that swapped 'dev' for 'combined' would emit the
      // quoted HTTP/1.1 request line and lack the bare 'GET /api 200'
      // prefix — both differences are detected by these assertions.
      expect(logged).toMatch(/GET \/api 200/);
      expect(logged).toMatch(/\bms\b/);

      // Negative assertion: the combined-format quoted HTTP request line
      // MUST NOT appear in dev-format output. This is the assertion that
      // catches an inverted ternary or accidental 'combined' default.
      expect(logged).not.toMatch(/"GET \/api HTTP\/\d\.\d"/);
    });

    it('uses Morgan "combined" format when NODE_ENV=production (asserts format shape)', async () => {
      // Switch NODE_ENV before re-loading the modules so config.nodeEnv
      // reads 'production' at module-load time and src/app.js takes the
      // 'combined' branch of the morganFormat ternary.
      process.env.NODE_ENV = 'production';

      // Wipe the module cache so src/config/index.js, src/utils/logger.js,
      // and src/app.js all re-evaluate their top-level code under the new
      // NODE_ENV. The previous (development) logger/app instances created
      // by beforeEach remain in memory but are not referenced from here on
      // in this test, so the spy assertions can only be triggered by the
      // freshly loaded production-mode pair.
      jest.resetModules();

      const prodLogger = require('../src/utils/logger');
      jest.spyOn(prodLogger, 'info').mockImplementation(() => {});
      jest.spyOn(prodLogger, 'error').mockImplementation(() => {});
      jest.spyOn(prodLogger, 'http').mockImplementation(() => {});
      jest.spyOn(prodLogger, 'warn').mockImplementation(() => {});

      // Loading the app AFTER the prodLogger spies are installed guarantees
      // morgan's stream reference reaches the same prodLogger object whose
      // http method we just spied. The morgan middleware then invokes the
      // spy via logger.stream.write during the request below.
      const prodApp = require('../src/app');

      await request(prodApp).get('/api');
      expect(prodLogger.http).toHaveBeenCalled();

      // Inspect the actual string Morgan produced. The combined format
      // includes the quoted HTTP request line "<METHOD> <URL> HTTP/<ver>"
      // which is the most distinctive signature of the format. A
      // regression that left morganFormat at 'dev' would call logger.http
      // (passing an invocation-only assertion) but emit 'GET /api 200 …
      // ms - 27' instead, lacking the quoted HTTP-version segment. The
      // assertions below would then fail loudly.
      const lastCallArgs = prodLogger.http.mock.calls[prodLogger.http.mock.calls.length - 1];
      const logged = lastCallArgs[0];

      // Primary combined-format signature: the quoted HTTP request line
      // is emitted only by the combined format (per Morgan's
      // documentation and the empirical output captured during test
      // development).
      expect(logged).toMatch(/"GET \/api HTTP\/\d\.\d"/);

      // Secondary combined-format signature: the bracketed CLF date stamp
      // ([dd/Mon/yyyy:HH:MM:SS +ZZZZ]) is unique to the combined format.
      // Together with the request-line signature, the two assertions make
      // it effectively impossible for a dev-format log line to pass.
      expect(logged).toMatch(/\[\d{2}\/\w{3}\/\d{4}:\d{2}:\d{2}:\d{2} [+-]\d{4}\]/);

      // Negative assertion: the dev-format response-time millisecond
      // segment (' ms ') MUST NOT appear in the combined output. Morgan's
      // combined format does NOT include response-time at all.
      expect(logged).not.toMatch(/\d+(\.\d+)? ms\b/);
    });

    it('does not crash when NODE_ENV is "test"', async () => {
      // An arbitrary NODE_ENV value (anything other than 'production')
      // should fall through to the 'dev' branch of the Morgan format
      // ternary without crashing. This test exercises the safe-default
      // path of the format ternary.
      process.env.NODE_ENV = 'test';
      jest.resetModules();
      const testLogger = require('../src/utils/logger');
      jest.spyOn(testLogger, 'info').mockImplementation(() => {});
      jest.spyOn(testLogger, 'error').mockImplementation(() => {});
      jest.spyOn(testLogger, 'http').mockImplementation(() => {});
      jest.spyOn(testLogger, 'warn').mockImplementation(() => {});
      const testApp = require('../src/app');
      const response = await request(testApp).get('/api');
      // Successful 200 proves the entire middleware chain (including
      // Morgan) completed without raising under NODE_ENV='test'.
      expect(response.status).toBe(200);
    });
  });
});
