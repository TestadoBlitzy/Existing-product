/**
 * Unit tests for src/config/index.js — the centralised application configuration
 * loader that reads environment variables (with sensible defaults) at module load
 * and exports a frozen configuration object consumed by every other application
 * module.
 *
 * Verifies:
 *   - The five documented defaults are emitted when no environment variables are
 *     set (nodeEnv='development', port=3000, host='0.0.0.0', logLevel='debug',
 *     corsOrigin='*').
 *   - Each environment variable (NODE_ENV, PORT, HOST, LOG_LEVEL, CORS_ORIGIN)
 *     is honoured when set.
 *   - The `parseInt(PORT, 10) || 3000` fallback documented in src/config/index.js
 *     line 36 returns 3000 for non-numeric, empty-string, and "0" inputs, while
 *     accepting numeric strings with leading zeros and trailing non-numeric
 *     characters per the standard JavaScript `parseInt` semantics.
 *   - The exported config object is frozen (`Object.isFrozen(config) === true`)
 *     and silently ignores property mutation, addition, and deletion attempts in
 *     CommonJS sloppy mode (the default for .js files without 'use strict').
 *
 * Test isolation strategy:
 *   - Every test starts with a freshly snapshotted process.env via the
 *     `snapshotEnv()` helper from tests/helpers/env.js.
 *   - `jest.resetModules()` is invoked in beforeEach so the require() inside each
 *     test reloads src/config/index.js under the current process.env (the config
 *     module reads env vars at module load and caches the frozen object in
 *     Node's require cache, so module-cache invalidation is mandatory for
 *     env-sensitive coverage).
 *   - All five tracked env vars (NODE_ENV, PORT, HOST, LOG_LEVEL, CORS_ORIGIN)
 *     are deleted in beforeEach to neutralise any values the host shell or Jest
 *     itself may have injected (Jest sets NODE_ENV='test' by default), giving
 *     every test a pristine baseline before it sets its own overrides.
 *   - `restoreEnv(envSnap)` runs in afterEach to put back exactly what was
 *     present before the test ran, preventing leakage across test files when
 *     Jest runs them in the same worker.
 *
 * Mirrors the house style established by tests/routes/api.test.js (PATTERN
 * SEED): CommonJS require, 2-space indentation, single quotes, semicolons,
 * top-level describe(<source-path>), nested describe per behaviour family.
 *
 * Authoritative blueprint: AAP §§ 0.1.1, 0.4.2, 0.4.5, 0.5.2, 0.7.1, 0.10.4,
 * 0.10.5, 0.10.9.
 */

const { snapshotEnv, restoreEnv } = require('./helpers/env');

describe('src/config/index.js', () => {
  // Snapshot holder reset by beforeEach and consumed by afterEach. Declared at
  // the describe scope so every nested describe block inherits the same
  // setup/teardown lifecycle without re-declaring helpers.
  let envSnap;

  // ---------------------------------------------------------------------------
  // Test isolation lifecycle
  // ---------------------------------------------------------------------------
  // The config module reads process.env exactly once at module load (line 18
  // of src/config/index.js invokes dotenv, then lines 27-54 read env vars
  // synchronously into the const `config`) and the frozen result is cached in
  // Node's require cache. To exercise different environment-variable inputs
  // we therefore MUST:
  //   1. Snapshot the pre-test process.env so it can be restored after the test
  //      (per AAP § 0.4.5 isolation rules).
  //   2. Call jest.resetModules() so the next require('../src/config') re-runs
  //      the module body under the current environment.
  //   3. Delete the five tracked env vars so the test starts from a known-empty
  //      baseline; Jest itself sets NODE_ENV='test' by default, and host shells
  //      sometimes inject PORT/HOST values, both of which would silently mask
  //      the default-value assertions if left in place.
  //
  // The deletions must happen AFTER jest.resetModules() because resetModules
  // affects only the module cache, not process.env. Doing them in this order
  // is purely conventional — either order is functionally equivalent — but
  // matches the order documented in AAP § 0.4.5.
  // ---------------------------------------------------------------------------
  beforeEach(() => {
    envSnap = snapshotEnv();
    jest.resetModules();
    delete process.env.NODE_ENV;
    delete process.env.PORT;
    delete process.env.HOST;
    delete process.env.LOG_LEVEL;
    delete process.env.CORS_ORIGIN;
  });

  afterEach(() => {
    // Restore the pre-test process.env (deletes any keys the test added,
    // re-adds any keys the test deleted, overwrites any keys the test mutated).
    // jest.config.js sets restoreMocks: true which restores jest.spyOn spies;
    // this test file does not install spies so no jest.restoreAllMocks() call
    // is required.
    restoreEnv(envSnap);
  });

  // ===========================================================================
  // Default values — verifies the five defaults emitted when no env vars set
  // ===========================================================================
  // Each test deletes all five tracked env vars in beforeEach, then requires
  // the freshly reset config module and asserts on a single field. Splitting
  // the defaults into per-field tests (rather than one omnibus deep-equality
  // assertion) gives clearer per-field failure messages when a single default
  // drifts in src/config/index.js.
  // ===========================================================================
  describe('default values', () => {
    it('defaults nodeEnv to "development"', () => {
      const config = require('../src/config');
      expect(config.nodeEnv).toBe('development');
    });

    it('defaults port to 3000', () => {
      const config = require('../src/config');
      // Numeric equality (toBe) is exact — `port` must be the number 3000,
      // not the string '3000'. The `parseInt(undefined, 10) || 3000`
      // expression in src/config/index.js line 36 evaluates to NaN || 3000 =
      // 3000 (NaN is falsy), so the fallback path is the one exercised here.
      expect(config.port).toBe(3000);
    });

    it('defaults host to "0.0.0.0"', () => {
      const config = require('../src/config');
      // '0.0.0.0' binds to all interfaces (per src/config/index.js comment
      // block lines 38-42); this is required for Docker / PM2 cluster mode.
      expect(config.host).toBe('0.0.0.0');
    });

    it('defaults logLevel to "debug"', () => {
      const config = require('../src/config');
      // 'debug' is the most verbose Winston level emitted by src/utils/logger.js;
      // production deployments override via LOG_LEVEL=info (or higher).
      expect(config.logLevel).toBe('debug');
    });

    it('defaults corsOrigin to "*"', () => {
      const config = require('../src/config');
      // '*' permits all origins — appropriate for development; production
      // deployments override via CORS_ORIGIN to restrict to trusted domains.
      expect(config.corsOrigin).toBe('*');
    });

    it('exposes exactly the five documented keys', () => {
      const config = require('../src/config');
      // Sorted-keys equality is the strictest shape check that does not
      // require ordering assumptions on object key enumeration. It rejects
      // both missing keys AND accidental extra fields — a looser
      // toMatchObject assertion would silently allow a superset and let
      // configuration drift through. The expected array is alphabetised to
      // match Object.keys(...).sort() output.
      expect(Object.keys(config).sort()).toEqual([
        'corsOrigin',
        'host',
        'logLevel',
        'nodeEnv',
        'port',
      ]);
    });
  });

  // ===========================================================================
  // Environment variable overrides — each env var honoured when set
  // ===========================================================================
  // Each test sets the relevant env var AFTER beforeEach has deleted the
  // baseline value and reset the module cache, then requires the config
  // module so the fresh module body reads the just-set env var. Per-field
  // tests keep the diagnostic output precise: a regression that swaps the
  // PORT/HOST mapping in src/config/index.js would fail two tests with
  // distinct names rather than one ambiguous omnibus failure.
  // ===========================================================================
  describe('environment variable overrides', () => {
    it('honours NODE_ENV when set', () => {
      process.env.NODE_ENV = 'production';
      const config = require('../src/config');
      expect(config.nodeEnv).toBe('production');
    });

    it('honours NODE_ENV = "test"', () => {
      // Jest's default NODE_ENV is 'test'; this test verifies that the
      // config module honours the explicit value rather than silently
      // falling back to 'development' in environments where Jest has
      // already set NODE_ENV.
      process.env.NODE_ENV = 'test';
      const config = require('../src/config');
      expect(config.nodeEnv).toBe('test');
    });

    it('honours PORT when set to a valid numeric string', () => {
      // Note: process.env values are always strings; the config module
      // calls parseInt(..., 10) to convert. parseInt('4242', 10) === 4242,
      // and 4242 is truthy so the `|| 3000` fallback is NOT exercised.
      process.env.PORT = '4242';
      const config = require('../src/config');
      // Strict-equals against the number 4242 (not the string '4242') —
      // the parseInt conversion is part of the contract under test.
      expect(config.port).toBe(4242);
    });

    it('honours HOST when set', () => {
      process.env.HOST = '127.0.0.1';
      const config = require('../src/config');
      // '127.0.0.1' is the original server.js localhost-only bind. The
      // config module preserves the raw string verbatim; no parsing or
      // normalisation occurs.
      expect(config.host).toBe('127.0.0.1');
    });

    it('honours LOG_LEVEL when set', () => {
      process.env.LOG_LEVEL = 'info';
      const config = require('../src/config');
      // 'info' is the recommended production log level per the Winston
      // documentation referenced in src/utils/logger.js.
      expect(config.logLevel).toBe('info');
    });

    it('honours CORS_ORIGIN when set', () => {
      process.env.CORS_ORIGIN = 'https://example.com';
      const config = require('../src/config');
      // The config module passes CORS_ORIGIN through as a raw string; the
      // CORS middleware in src/app.js consumes it directly. URL parsing
      // is intentionally NOT performed at this layer.
      expect(config.corsOrigin).toBe('https://example.com');
    });

    it('honours multiple env vars simultaneously', () => {
      // End-to-end override of every documented env var. The deep-equality
      // assertion (toEqual) guarantees BOTH that each override took effect
      // AND that no extra keys leaked into the config object — providing
      // a stricter check than the per-field tests above. Together the
      // per-field tests pin individual mappings (so a swap is detected
      // with precise diagnostics) while this omnibus test pins the
      // whole-object shape under override conditions.
      process.env.NODE_ENV = 'production';
      process.env.PORT = '8080';
      process.env.HOST = 'example.local';
      process.env.LOG_LEVEL = 'warn';
      process.env.CORS_ORIGIN = 'https://app.example.com';
      const config = require('../src/config');
      expect(config).toEqual({
        nodeEnv: 'production',
        port: 8080,
        host: 'example.local',
        logLevel: 'warn',
        corsOrigin: 'https://app.example.com',
      });
    });
  });

  // ===========================================================================
  // PORT parsing edge cases — parseInt + ||-fallback behaviour
  // ===========================================================================
  // The expression `parseInt(process.env.PORT, 10) || 3000` in
  // src/config/index.js line 36 has three observable behaviours that
  // must be pinned to prevent silent regression:
  //
  //   1. Non-numeric strings → parseInt returns NaN (falsy) → fallback to 3000.
  //   2. Empty string         → parseInt returns NaN (falsy) → fallback to 3000.
  //   3. Numeric "0"          → parseInt returns 0 (falsy)   → fallback to 3000.
  //   4. Leading zeros        → parseInt strips them, returns the numeric value.
  //   5. Trailing non-digits  → parseInt stops at the first non-digit char.
  //
  // The "0" case (3) is a documented idiosyncrasy of the `|| 3000` fallback;
  // a stricter implementation would use `Number.isFinite` instead, but per
  // AAP § 0.10.1 production-code changes are forbidden — the tests pin the
  // actual behaviour so regressions are caught while keeping the source
  // file untouched.
  // ===========================================================================
  describe('PORT parsing edge cases', () => {
    it('falls back to 3000 when PORT is non-numeric', () => {
      process.env.PORT = 'not-a-number';
      const config = require('../src/config');
      // parseInt('not-a-number', 10) === NaN; NaN || 3000 === 3000.
      expect(config.port).toBe(3000);
    });

    it('falls back to 3000 when PORT is an empty string', () => {
      process.env.PORT = '';
      const config = require('../src/config');
      // parseInt('', 10) === NaN; NaN || 3000 === 3000.
      expect(config.port).toBe(3000);
    });

    it('falls back to 3000 when PORT is "0"', () => {
      // Documented idiosyncrasy of the `|| 3000` fallback: parseInt('0', 10)
      // === 0, and 0 is falsy in JavaScript, so the fallback fires even
      // though '0' is technically a valid numeric string. A future
      // implementation that swaps `||` for `??` or for Number.isFinite
      // would change this behaviour — that intentional change must be
      // accompanied by an update to this test.
      process.env.PORT = '0';
      const config = require('../src/config');
      expect(config.port).toBe(3000);
    });

    it('parses numeric strings with leading zeros to their decimal value', () => {
      // parseInt('08080', 10) === 8080. The base-10 radix passed explicitly
      // in src/config/index.js line 36 prevents the legacy octal
      // interpretation of leading-zero strings (parseInt('08080') without
      // a radix is implementation-defined but in modern V8 also returns
      // 8080; the explicit 10 makes the behaviour deterministic).
      process.env.PORT = '08080';
      const config = require('../src/config');
      expect(config.port).toBe(8080);
    });

    it('parses numeric strings with trailing non-numeric characters', () => {
      // parseInt('4242abc', 10) === 4242 — parseInt stops at the first
      // non-numeric character rather than rejecting the input. This is
      // a documented behaviour of JavaScript's parseInt and is preserved
      // verbatim by the config module.
      process.env.PORT = '4242abc';
      const config = require('../src/config');
      expect(config.port).toBe(4242);
    });
  });

  // ===========================================================================
  // Frozen object invariant — immutability of the exported config
  // ===========================================================================
  // src/config/index.js line 57 exports `Object.freeze(config)`. The frozen
  // state is observable at the API surface via Object.isFrozen (which must
  // return true) and via the runtime behaviour of mutation attempts.
  //
  // Sloppy vs strict mode: CommonJS .js files without an explicit
  // 'use strict' directive load in sloppy mode, where mutations on a
  // frozen object FAIL SILENTLY rather than throwing TypeError. Jest
  // itself runs test files in module-scoped non-strict mode by default,
  // but some Node configurations (or future Jest releases) may treat
  // CommonJS module scopes as strict — to remain forward-compatible the
  // mutation-attempt tests wrap the mutating expression in try/catch and
  // assert on the post-mutation value, so the assertion passes whether
  // the runtime threw silently or via TypeError.
  // ===========================================================================
  describe('frozen object invariant', () => {
    it('exports a frozen object', () => {
      const config = require('../src/config');
      // Object.isFrozen is the canonical reflection-level check for the
      // frozen state. It returns true iff the object is non-extensible
      // AND every own property is non-configurable AND non-writable —
      // which is exactly the state Object.freeze installs.
      expect(Object.isFrozen(config)).toBe(true);
    });

    it('silently ignores property mutation attempts', () => {
      const config = require('../src/config');
      const originalPort = config.port;
      // try/catch wraps the mutation to tolerate strict-mode environments
      // where the frozen assignment throws TypeError; sloppy mode (the
      // default for CommonJS .js files without 'use strict') swallows the
      // operation silently. The post-mutation assertion is the source of
      // truth for the invariant either way.
      try {
        config.port = 9999;
      } catch (e) {
        /* Strict-mode TypeError swallowed — the invariant we care about
           is observable on the post-mutation value, asserted below. */
      }
      // Reading the same property after the mutation attempt: the value
      // must be unchanged. This is the only observable behaviour we can
      // assert on without coupling to the runtime mode (strict vs sloppy).
      expect(config.port).toBe(originalPort);
    });

    it('silently ignores new-property addition attempts', () => {
      const config = require('../src/config');
      try {
        config.newField = 'should not stick';
      } catch (e) {
        /* Strict-mode TypeError swallowed — the invariant we care about
           is that the new property does not appear, asserted below. */
      }
      // Object.freeze makes the target non-extensible — new property
      // additions are silently dropped (sloppy mode) or throw (strict
      // mode). Either way, accessing the added key after the attempt
      // returns undefined.
      expect(config.newField).toBeUndefined();
    });

    it('silently ignores property deletion attempts', () => {
      const config = require('../src/config');
      try {
        delete config.port;
      } catch (e) {
        /* Strict-mode TypeError swallowed — the invariant we care about
           is that the property remains, asserted below. */
      }
      // Object.freeze makes own properties non-configurable, so delete
      // is silently dropped (sloppy mode) or throws (strict mode).
      // Either way, the property remains accessible after the attempt.
      expect(config.port).toBeDefined();
    });
  });
});
