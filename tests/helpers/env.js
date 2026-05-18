/**
 * Test helper — snapshot and restore process.env between tests.
 *
 * Pairs with jest.resetModules() so that env-sensitive modules (notably
 * src/config/index.js and src/utils/logger.js) can be re-loaded under
 * controlled environment variable conditions without leaking state into
 * subsequent tests.
 *
 * Consumer paths:
 *   - tests/config.test.js              -> require('./helpers/env')
 *   - tests/app.test.js                 -> require('./helpers/env')
 *   - tests/server.test.js              -> require('./helpers/env')
 *   - tests/logger.test.js              -> require('./helpers/env')
 *   - tests/middleware/errorHandler.test.js -> require('../helpers/env')
 *   - tests/middleware/notFound.test.js     -> require('../helpers/env')
 *
 * Design notes:
 *   - Zero runtime dependencies — no require() calls of any package or built-in.
 *   - No module-level state — every call to snapshotEnv() returns a FRESH Map
 *     reflecting process.env at that moment, and restoreEnv(snapshot) operates
 *     solely on the parameter and process.env. Helper is therefore parallel-safe
 *     across Jest worker processes.
 *   - Map (not plain object) makes intent explicit ("environment-variable
 *     snapshot, not a config object") and avoids accidental prototype-chain
 *     interference per AAP §0.4.4.
 *   - Node coerces every process.env value to a string, so the Map<string,string>
 *     type signature is exact.
 *
 * @see Agent Action Plan §0.4.4 Test Data and Fixtures Design
 * @see Agent Action Plan §0.4.5 Test Isolation and Ordering
 * @see Agent Action Plan §0.5.5 Cross-File Test Dependencies
 */

/**
 * Snapshot the current process.env into a Map so it can be restored later.
 *
 * Object.entries(process.env) returns the [key, value] pairs of every env var
 * currently set on the process. The new Map() wraps those pairs in an iteration-
 * preserving container so subsequent restoreEnv(snapshot) calls can both check
 * key membership (snapshot.has(key)) and iterate ordered pairs efficiently.
 *
 * Typical usage in a beforeEach hook:
 *   const snapshot = snapshotEnv();
 *
 * @returns {Map<string,string>} A copy of process.env as a Map.
 */
function snapshotEnv() {
  return new Map(Object.entries(process.env));
}

/**
 * Restore process.env to the state captured in the snapshot.
 *
 * Handles every possible delta between the snapshot and the current
 * process.env:
 *   - Adds back any keys that were deleted since the snapshot.
 *   - Removes any keys that were added since the snapshot.
 *   - Overwrites any keys whose values were mutated since the snapshot.
 *
 * Sequencing rationale (delete-additions first, then restore-from-snapshot):
 *   If we iterated the snapshot first and then iterated Object.keys(process.env),
 *   the second loop would delete the keys we just restored. The current order
 *   (delete keys-not-in-snapshot first, then write snapshot values) is correct
 *   for all three deltas above.
 *
 * Typical usage in an afterEach hook:
 *   restoreEnv(snapshot);
 *
 * @param {Map<string,string>} snapshot - The snapshot produced by snapshotEnv().
 */
function restoreEnv(snapshot) {
  // Remove keys that didn't exist in the snapshot (i.e. keys added by the test).
  for (const key of Object.keys(process.env)) {
    if (!snapshot.has(key)) {
      delete process.env[key];
    }
  }
  // Restore each snapshot entry — writes original values back for both deleted
  // keys (the assignment recreates them) and mutated keys (the assignment
  // overwrites the test-modified value).
  for (const [key, value] of snapshot) {
    process.env[key] = value;
  }
}

module.exports = { snapshotEnv, restoreEnv };
