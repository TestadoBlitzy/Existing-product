'use strict';

// Jest configuration for the hello_world Express.js application.
// Configures Jest 30.x with Node.js test environment, coverage settings,
// and test file matching patterns for the __tests__/ directory.

module.exports = {
  // Use Node.js environment (not jsdom) — this is a server-side Express.js application
  testEnvironment: 'node',

  // Output coverage reports to the coverage/ directory at the project root
  coverageDirectory: 'coverage',

  // Only collect code coverage from server.js — the sole application source file
  collectCoverageFrom: ['server.js'],

  // Explicitly exclude node_modules/ from coverage analysis
  coveragePathIgnorePatterns: ['/node_modules/'],

  // Match test files in the __tests__/ directory with .test.js suffix
  testMatch: ['**/__tests__/**/*.test.js'],
};
