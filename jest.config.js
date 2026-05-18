/**
 * Jest Configuration — Test Runner & Coverage Settings
 *
 * Configures Jest to run all CommonJS test files under `tests/`, measure
 * coverage of the application source (`src/**`/`*`.js and `server.js`),
 * and enforce per-file and global coverage thresholds aligned with AAP
 * section 0.7.1.
 *
 * Coverage output is written to `./coverage/` (gitignored) in text,
 * text-summary, lcov, and html formats; open `./coverage/index.html` to
 * inspect per-file results.
 *
 * @see https://jestjs.io/docs/configuration
 */
module.exports = {
  // Node test environment — this is a Node.js server with no DOM surface.
  testEnvironment: 'node',

  // Test discovery — only files matching tests/**/*.test.js are executed.
  testMatch: ['<rootDir>/tests/**/*.test.js'],

  // Coverage source set — measure src/ and the root-level server.js only.
  collectCoverageFrom: ['src/**/*.js', 'server.js'],

  // Exclude node_modules and test files themselves from coverage measurement.
  coveragePathIgnorePatterns: ['/node_modules/', '/tests/'],

  // Use V8's native coverage (no additional dev dependency required).
  coverageProvider: 'v8',

  // Coverage output directory (matches the entry in .gitignore).
  coverageDirectory: 'coverage',

  // Coverage reporters — text + text-summary for terminal, lcov for CI,
  // html for ./coverage/index.html (referenced in README.md).
  coverageReporters: ['text', 'text-summary', 'lcov', 'html'],

  // Per-file and global coverage thresholds enforced by AAP section 0.7.1.
  // A drop below any threshold fails the Jest run.
  coverageThreshold: {
    global: {
      lines: 90,
      functions: 90,
      branches: 80,
      statements: 90,
    },
    './src/routes/api.js': {
      lines: 100,
      functions: 100,
      branches: 100,
      statements: 100,
    },
    './src/routes/health.js': {
      lines: 100,
      functions: 100,
      branches: 100,
      statements: 100,
    },
    './src/routes/index.js': {
      lines: 100,
      functions: 100,
      branches: 100,
      statements: 100,
    },
    './src/middleware/notFound.js': {
      lines: 100,
      functions: 100,
      branches: 100,
      statements: 100,
    },
    './src/middleware/errorHandler.js': {
      lines: 100,
      functions: 100,
      branches: 95,
      statements: 100,
    },
    './src/config/index.js': {
      lines: 100,
      functions: 100,
      branches: 100,
      statements: 100,
    },
    './src/utils/logger.js': {
      lines: 90,
      functions: 100,
      branches: 80,
      statements: 90,
    },
    './src/app.js': {
      lines: 95,
      functions: 100,
      branches: 90,
      statements: 95,
    },
    './server.js': {
      lines: 90,
      functions: 100,
      branches: 85,
      statements: 90,
    },
  },

  // Verbose test output — produces per-test pass/fail lines (useful in CI).
  verbose: true,

  // Auto-clear jest.fn() mock state between tests (reinforces isolation).
  clearMocks: true,

  // Auto-restore jest.spyOn spies between tests (reinforces isolation).
  restoreMocks: true,

  // Setup files — run ONCE per test file BEFORE the test framework is
  // installed and BEFORE any test module is loaded.  Used here to monkey-
  // patch `fs.mkdirSync` and `fs.createWriteStream` so the application's
  // `logs/` directory and its log files are never created on disk during
  // test execution.  See tests/helpers/setup.js for the full rationale.
  //
  // AAP references: §0.7.3 "no filesystem touching beyond jest.spyOn(fs,
  // 'mkdirSync')" and §0.10.6 "No test file writes to a shared on-disk
  // artefact".
  setupFiles: ['<rootDir>/tests/helpers/setup.js'],
};
