'use strict';

/**
 * Jest Configuration
 *
 * Configures Jest 30.3.0 for the hello_world Express.js application test suite.
 * CommonJS format matching the project's module system.
 *
 * Usage:
 *   npm test              — Run all tests with coverage
 *   npm run test:watch    — Watch mode for development
 *   npm run test:ci       — CI-safe execution
 *   npx jest tests/path   — Run specific test file or directory
 *
 * @module jest.config
 */

module.exports = {
  // Node.js environment (not jsdom) since this is a server-side application
  testEnvironment: 'node',

  // Test file discovery pattern — finds all *.test.js files in the tests/ directory
  testMatch: ['**/tests/**/*.test.js'],

  // Coverage collection targets — all source files under src/ and the server entry point
  collectCoverageFrom: [
    'src/**/*.js',
    'server.js',
    '!**/node_modules/**',
  ],

  // Directories excluded from coverage reporting
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/tests/',
  ],

  // Coverage output directory
  coverageDirectory: 'coverage',

  // Coverage reporters — text for terminal, lcov for CI/tooling, json-summary for scripts
  coverageReporters: ['text', 'lcov', 'json-summary'],

  // Coverage thresholds — enforce ≥90% line and function coverage overall
  // Per AAP Section 0.7.1: "At least 90% line/function coverage overall"
  coverageThreshold: {
    global: {
      lines: 90,
      functions: 90,
      branches: 80,
      statements: 90,
    },
  },

  // Verbose output for detailed test result reporting
  verbose: true,

  // Clear mock state between tests to prevent assertion pollution
  clearMocks: true,

  // Restore mock implementations between tests
  restoreMocks: true,
};
