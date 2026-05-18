/**
 * Static configuration shape validation for ecosystem.config.js (PM2 settings).
 *
 * No PM2 process is spawned; no listener is bound.  The test loads the module
 * via require() and asserts the documented field values for apps[0] and the
 * two environment profiles (env / env_production) per AAP section 0.4.2.
 *
 * Coverage scope: this file guards against silent drift in the PM2 application
 * declaration that powers `npm run start:pm2`.  Because ecosystem.config.js is
 * a pure-literal module with no I/O, no mocks, env-mutation, or module-cache
 * resets are needed — every assertion is a deterministic property check.
 *
 * Authoritative blueprint: AAP §§ 0.4.2, 0.5.2, 0.7.1, 0.10.5.
 */

const eco = require('../ecosystem.config');

describe('ecosystem.config.js', () => {
  describe('apps array structure', () => {
    it('exports an apps array', () => {
      expect(Array.isArray(eco.apps)).toBe(true);
    });

    it('contains at least one app definition', () => {
      expect(eco.apps.length).toBeGreaterThanOrEqual(1);
    });

    it('defines exactly one app (the hello-world server)', () => {
      expect(eco.apps.length).toBe(1);
    });
  });

  describe('apps[0] PM2 configuration', () => {
    it('has name "hello-world"', () => {
      expect(eco.apps[0].name).toBe('hello-world');
    });

    it('uses server.js as the entry script', () => {
      expect(eco.apps[0].script).toBe('server.js');
    });

    it('runs with maximum CPU-bound instances', () => {
      expect(eco.apps[0].instances).toBe('max');
    });

    it('uses cluster exec mode', () => {
      expect(eco.apps[0].exec_mode).toBe('cluster');
    });

    it('enables auto-restart on crash', () => {
      expect(eco.apps[0].autorestart).toBe(true);
    });

    it('disables file-system watching', () => {
      expect(eco.apps[0].watch).toBe(false);
    });

    it('restarts the worker at 1G memory threshold', () => {
      expect(eco.apps[0].max_memory_restart).toBe('1G');
    });

    it('merges cluster worker logs into a single file', () => {
      expect(eco.apps[0].merge_logs).toBe(true);
    });
  });

  describe('apps[0].env (default environment)', () => {
    it('defines NODE_ENV = "development" for the default profile', () => {
      expect(eco.apps[0].env.NODE_ENV).toBe('development');
    });

    it('defines PORT = 3000 for the default profile', () => {
      expect(eco.apps[0].env.PORT).toBe(3000);
    });

    it('defines HOST = "0.0.0.0" for the default profile', () => {
      expect(eco.apps[0].env.HOST).toBe('0.0.0.0');
    });

    it('defines LOG_LEVEL = "debug" for the default profile', () => {
      expect(eco.apps[0].env.LOG_LEVEL).toBe('debug');
    });

    it('defines CORS_ORIGIN = "*" for the default profile', () => {
      expect(eco.apps[0].env.CORS_ORIGIN).toBe('*');
    });
  });

  describe('apps[0].env_production (production environment)', () => {
    it('defines NODE_ENV = "production" for the production profile', () => {
      expect(eco.apps[0].env_production.NODE_ENV).toBe('production');
    });

    it('defines PORT = 3000 for the production profile', () => {
      expect(eco.apps[0].env_production.PORT).toBe(3000);
    });

    it('defines HOST = "0.0.0.0" for the production profile', () => {
      expect(eco.apps[0].env_production.HOST).toBe('0.0.0.0');
    });

    it('defines LOG_LEVEL = "info" for the production profile', () => {
      expect(eco.apps[0].env_production.LOG_LEVEL).toBe('info');
    });

    it('defines CORS_ORIGIN = "*" for the production profile', () => {
      expect(eco.apps[0].env_production.CORS_ORIGIN).toBe('*');
    });
  });
});
