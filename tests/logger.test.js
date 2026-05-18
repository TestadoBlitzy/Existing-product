/**
 * Unit tests for src/utils/logger.js — the Winston multi-transport logger and
 * Morgan-compatible stream adapter.
 *
 * Verifies:
 *   - The logs/ directory is created on module load via fs.mkdirSync({ recursive: true })
 *     when fs.existsSync returns false (and is NOT created when it returns true)
 *   - The exported logger exposes info, error, http, warn, debug as functions
 *   - logger.stream.write strips ANSI escape sequences, trims trailing whitespace,
 *     and forwards the cleaned message via logger.http()
 *
 * Test isolation: each test uses jest.isolateModules to load a fresh logger
 * instance with stubbed fs primitives so no real disk I/O occurs and the
 * Winston instance's file-transport handles do not leak across tests.
 *
 * Authoritative blueprint: AAP §§ 0.4.2, 0.5.2, 0.7.1, 0.10.5, 0.4.5.
 */

// Node built-ins — required at the top so jest.spyOn(fs, ...) can intercept
// the module-load-time filesystem side-effects in src/utils/logger.js.
// We deliberately do NOT require the logger here; every test loads it inside
// its own jest.isolateModules sandbox to ensure spies are installed BEFORE
// the module's top-level fs calls execute.
const fs = require('fs');
// eslint-disable-next-line no-unused-vars
const path = require('path');

describe('src/utils/logger.js', () => {
  // Belt-and-braces spy restoration. jest.config.js already sets
  // restoreMocks: true and clearMocks: true, but explicit afterEach
  // restoration documents intent and protects against config drift.
  afterEach(() => {
    jest.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Logs directory creation — module-load-time fs side-effects.
  //
  // The production module performs:
  //   const logDir = path.join(__dirname, '../../logs');
  //   if (!fs.existsSync(logDir)) {
  //     fs.mkdirSync(logDir, { recursive: true });
  //   }
  //
  // The two tests below cover both branches of the if-statement.
  // -------------------------------------------------------------------------
  describe('logs directory creation (module load side-effect)', () => {
    it('calls fs.mkdirSync({ recursive: true }) when the logs directory does not exist', () => {
      jest.isolateModules(() => {
        const existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(false);
        const mkdirSyncSpy = jest
          .spyOn(fs, 'mkdirSync')
          .mockImplementation(() => undefined);

        // Loading the module inside the isolated sandbox triggers the
        // module-load-time fs.existsSync / fs.mkdirSync calls.
        require('../src/utils/logger');

        expect(existsSyncSpy).toHaveBeenCalled();
        expect(mkdirSyncSpy).toHaveBeenCalled();

        // The production code calls fs.mkdirSync at line 30 of logger.js,
        // BEFORE winston.createLogger is invoked at line 48. Winston's File
        // transports internally call fs.mkdirSync as a side-effect of their
        // own construction (one call per file transport). Therefore the
        // production code's call is always mkdirSyncSpy.mock.calls[0].
        // We inspect that first call explicitly rather than asserting an
        // exact total count (which would be brittle against the number of
        // Winston file transports configured in src/utils/logger.js).
        const firstCall = mkdirSyncSpy.mock.calls[0];
        // OS-independent assertion: the logDir path always ends in "logs".
        expect(firstCall[0]).toEqual(expect.stringContaining('logs'));
        expect(firstCall[1]).toEqual({ recursive: true });
      });
    });

    it('does not call fs.mkdirSync when the logs directory already exists', () => {
      jest.isolateModules(() => {
        jest.spyOn(fs, 'existsSync').mockReturnValue(true);
        const mkdirSyncSpy = jest
          .spyOn(fs, 'mkdirSync')
          .mockImplementation(() => undefined);

        require('../src/utils/logger');

        expect(mkdirSyncSpy).not.toHaveBeenCalled();
      });
    });
  });

  // -------------------------------------------------------------------------
  // withLogger helper — loads a fresh logger inside an isolated module
  // sandbox with stubbed fs primitives so each test gets a pristine Winston
  // instance with no real disk I/O.
  //
  // Stubbing fs.existsSync to return true skips the production module's
  // mkdirSync call entirely; stubbing fs.mkdirSync provides defence-in-depth
  // in case the production code's branch ever changes.
  // -------------------------------------------------------------------------
  const withLogger = (fn) => {
    jest.isolateModules(() => {
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined);
      const logger = require('../src/utils/logger');
      fn(logger);
    });
  };

  // -------------------------------------------------------------------------
  // Winston logger surface — verifies the five Winston npm levels actually
  // consumed by the codebase are exposed as functions on the logger.
  //
  // We deliberately do NOT assert on Winston's other built-in levels
  // ('verbose', 'silly') because they are not part of the documented
  // application surface (AAP § 0.4.2).
  // -------------------------------------------------------------------------
  describe('Winston logger surface', () => {
    it('exposes info as a function', () => {
      withLogger((logger) => {
        expect(typeof logger.info).toBe('function');
      });
    });

    it('exposes error as a function', () => {
      withLogger((logger) => {
        expect(typeof logger.error).toBe('function');
      });
    });

    it('exposes http as a function', () => {
      withLogger((logger) => {
        expect(typeof logger.http).toBe('function');
      });
    });

    it('exposes warn as a function', () => {
      withLogger((logger) => {
        expect(typeof logger.warn).toBe('function');
      });
    });

    it('exposes debug as a function', () => {
      withLogger((logger) => {
        expect(typeof logger.debug).toBe('function');
      });
    });
  });

  // -------------------------------------------------------------------------
  // Morgan-compatible logger.stream.write adapter — verifies the ANSI-strip
  // + outer-trim + logger.http forwarding pipeline.
  //
  // Production implementation:
  //   logger.stream = {
  //     write: (message) => {
  //       logger.http(message.replace(ANSI_REGEX, '').trim());
  //     },
  //   };
  //
  // where ANSI_REGEX = /\u001b\[[0-9;]*m/g.
  //
  // We spy on logger.http (NOT mock winston itself per AAP § 0.10.5) so we
  // can observe the final argument forwarded after transformation.
  // -------------------------------------------------------------------------
  describe('Morgan-compatible logger.stream.write adapter', () => {
    it('exposes a stream object with a write function', () => {
      withLogger((logger) => {
        expect(logger.stream).toBeDefined();
        expect(typeof logger.stream.write).toBe('function');
      });
    });

    it('forwards the trimmed message to logger.http on plain text', () => {
      withLogger((logger) => {
        const httpSpy = jest.spyOn(logger, 'http').mockImplementation(() => {});
        logger.stream.write('hello\n');
        expect(httpSpy).toHaveBeenCalledTimes(1);
        expect(httpSpy).toHaveBeenCalledWith('hello');
      });
    });

    it('strips ANSI escape codes before forwarding', () => {
      withLogger((logger) => {
        const httpSpy = jest.spyOn(logger, 'http').mockImplementation(() => {});
        // Green-coloured "hello" followed by reset and newline.
        logger.stream.write('\u001b[32mhello\u001b[0m\n');
        expect(httpSpy).toHaveBeenCalledWith('hello');
      });
    });

    it('handles multi-token ANSI sequences (Morgan dev format)', () => {
      withLogger((logger) => {
        const httpSpy = jest.spyOn(logger, 'http').mockImplementation(() => {});
        // Mimics a Morgan 'dev' format line with a coloured status code.
        logger.stream.write('GET /api \u001b[32m200\u001b[0m 5ms\n');
        expect(httpSpy).toHaveBeenCalledWith('GET /api 200 5ms');
      });
    });

    it('handles an empty input string', () => {
      withLogger((logger) => {
        const httpSpy = jest.spyOn(logger, 'http').mockImplementation(() => {});
        logger.stream.write('');
        expect(httpSpy).toHaveBeenCalledWith('');
      });
    });

    it('handles a whitespace-only input', () => {
      withLogger((logger) => {
        const httpSpy = jest.spyOn(logger, 'http').mockImplementation(() => {});
        logger.stream.write('   \n');
        // Outer trim collapses leading + trailing whitespace to '';
        // there is no ANSI content, so replace is a no-op.
        expect(httpSpy).toHaveBeenCalledWith('');
      });
    });

    it('trims interior whitespace correctly (only outer trim, not inner)', () => {
      withLogger((logger) => {
        const httpSpy = jest.spyOn(logger, 'http').mockImplementation(() => {});
        // String#trim() only removes leading/trailing whitespace;
        // interior whitespace must be preserved.
        logger.stream.write('  hello  world  \n');
        expect(httpSpy).toHaveBeenCalledWith('hello  world');
      });
    });
  });

  // -------------------------------------------------------------------------
  // Module export — verifies the CommonJS module.exports value is the
  // Winston logger instance with the expected basic shape.
  // -------------------------------------------------------------------------
  describe('module export', () => {
    it('exports a Winston logger instance', () => {
      withLogger((logger) => {
        expect(logger).toBeDefined();
        expect(typeof logger).toBe('object');
      });
    });

    it('exposes a level property derived from config.logLevel', () => {
      withLogger((logger) => {
        expect(typeof logger.level).toBe('string');
        // The default LOG_LEVEL is 'debug' per src/config/index.js but the
        // surrounding environment may legitimately override it. We assert
        // the level is one of the seven Winston-recognised npm levels.
        expect([
          'error',
          'warn',
          'info',
          'http',
          'verbose',
          'debug',
          'silly',
        ]).toContain(logger.level);
      });
    });
  });
});
