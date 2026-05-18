/**
 * Jest Configuration for Test-3.1-ADO-NP-1
 *
 * Configures Jest 30.x for server-side JavaScript testing of the minimal
 * Node.js HTTP server (server.js). Uses V8 coverage reporting with enforced
 * coverage thresholds to ensure comprehensive test coverage.
 *
 * Module format: CommonJS (consistent with "type": "commonjs" in package.json)
 * Test environment: Node.js (no DOM/JSDOM — server-side only)
 */

/** @type {import('jest').Config} */
module.exports = {
  /**
   * Test environment — run tests in a Node.js environment rather than
   * the default jsdom browser simulation. This is required for server-side
   * JavaScript testing where DOM APIs are not available or needed.
   */
  testEnvironment: 'node',

  /**
   * Test file matching pattern — discovers all files ending in .test.js
   * anywhere in the project directory tree. This follows Jest's recommended
   * naming convention and will match server.test.js at the repository root.
   */
  testMatch: ['**/*.test.js'],

  /**
   * Coverage output directory — stores generated coverage reports (HTML, LCOV,
   * text) in the ./coverage/ folder. This directory is excluded from version
   * control via .gitignore.
   */
  coverageDirectory: 'coverage',

  /**
   * Coverage collection scope — limits coverage instrumentation to the single
   * source file under test (server.js). This prevents Jest from reporting
   * coverage on test files, configuration files, or node_modules.
   */
  collectCoverageFrom: ['server.js'],

  /**
   * Coverage enforcement thresholds — ensures minimum coverage levels are met
   * before tests are considered passing when run with --coverage flag.
   *
   * AAP §0.7.1 specifies targets of 90/80/90/90. These thresholds are met
   * by extracting the server startup logic into the exported `startServer()`
   * function, which is directly testable within Jest's V8 coverage context.
   * The `startServer()` function includes parameter-defaulting branches
   * (ternary operators) that are fully covered by explicit and default-
   * parameter tests. The only uncovered code is the single `startServer()`
   * call inside the `if (require.main === module)` true-branch, which is
   * verified behaviorally via child_process.fork() in the Auto-Start test.
   */
  coverageThreshold: {
    global: {
      statements: 90,
      branches: 80,
      functions: 90,
      lines: 90
    }
  },

  /**
   * Coverage report formats — generates multiple output formats:
   *   - 'text':         Inline table printed to stdout after test run
   *   - 'text-summary': Condensed one-line summary printed to stdout
   *   - 'lcov':         LCOV format for integration with coverage tooling
   *                     and HTML report generation in coverage/lcov-report/
   */
  coverageReporters: ['text', 'text-summary', 'lcov'],

  /**
   * Verbose output — displays individual test results with their describe
   * block hierarchy, showing pass/fail status for each test case rather
   * than just a summary. Useful for identifying which specific tests
   * pass or fail during development.
   */
  verbose: true,

  /**
   * Test timeout — maximum time (in milliseconds) that a single test case
   * is allowed to run before being automatically failed. Set to 5000ms
   * (5 seconds), which is Jest's default value specified explicitly for
   * clarity and documentation purposes. This is sufficient for server
   * startup, HTTP request/response round-trip, and cleanup operations.
   */
  testTimeout: 5000
};
