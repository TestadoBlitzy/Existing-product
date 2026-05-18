/**
 * Jest `setupFiles` entry — runs ONCE per test file BEFORE the Jest test
 * framework is installed and BEFORE any test module (test file or its
 * transitive `require` graph) is loaded into the worker.
 *
 * Purpose
 * -------
 * Prevent the two filesystem side-effects that otherwise leak the `logs/`
 * directory and the 0-byte `logs/combined.log` / `logs/error.log` empty
 * files into the workspace whenever a test transitively requires
 * `src/utils/logger.js`:
 *
 *   1. `fs.mkdirSync(logDir, { recursive: true })` is called by
 *      `src/utils/logger.js` (line 30) at module load when `logs/` does
 *      not already exist — this creates the directory.
 *   2. Winston's `transports.File` constructor independently calls
 *      `fs.mkdirSync(this.dirname, { recursive: true })` via
 *      `_createLogDirIfNotExist` (winston/lib/winston/transports/file.js
 *      line 791) AND, because `lazy` is not set, eagerly invokes
 *      `fs.createWriteStream(fullpath, { flags: 'a' })` via `_createStream`
 *      (line 613) — this opens the file handle and creates the empty
 *      `logs/combined.log` and `logs/error.log` on disk.
 *
 * Strategy
 * --------
 * We monkey-patch the two responsible `fs` functions at the property level
 * so that any call whose target path includes a `logs` segment becomes a
 * no-op (or returns a no-op writable stream).  Every other `fs` operation
 * on every other path passes straight through to the original
 * implementation, byte-for-byte unchanged.
 *
 * Why setupFiles (not setupFilesAfterEach, not globalSetup)
 * ---------------------------------------------------------
 * - `globalSetup` runs in a separate Node process and cannot patch the
 *   `fs` module instance used by the test workers.
 * - `setupFilesAfterEach` (if it existed) would run AFTER the test module
 *   is already loaded — the side-effects would have already occurred.
 * - `setupFiles` runs BEFORE the test framework is installed, in the same
 *   Node process and module registry as the tests themselves.  This is
 *   exactly when we need the patch to be active.
 *
 * Compatibility with tests/logger.test.js
 * ---------------------------------------
 * That test file installs `jest.spyOn(fs, 'mkdirSync').mockImplementation(...)`
 * before requiring `src/utils/logger`.  `jest.spyOn` reads the CURRENT value
 * of `fs.mkdirSync` (our patched version), replaces it with a Jest spy, and
 * then `jest.restoreAllMocks()` restores it back to our patched version after
 * the test.  The spy fully intercepts the call before our patch sees it, so
 * the test's call-argument assertions remain accurate.  The same logic
 * applies to `fs.existsSync` (which we do NOT patch) — that helper module
 * stays available unchanged for `tests/logger.test.js` to spy on.
 *
 * Compatibility with the no-op Writable returned for log files
 * ------------------------------------------------------------
 * Winston's File transport calls `.pipe(this._setupStream(...))` on a
 * `PassThrough` and binds error/close listeners on the destination stream.
 * Our no-op Writable exposes the minimum surface Winston interacts with
 * (`path`, `bytesWritten`, `fd`, `flags`) and a `write()` that simply
 * invokes the callback, so Winston's internal state machine transitions
 * cleanly without any disk I/O.
 *
 * AAP references
 * --------------
 *   - §0.7.3 "no filesystem touching beyond jest.spyOn(fs, 'mkdirSync')"
 *   - §0.10.6 "No test file writes to a shared on-disk artefact"
 *   - §0.10.5 mocking discipline — `fs.mkdirSync` is the only fs surface
 *     the AAP authorises for mocking inside test bodies; we additionally
 *     short-circuit the Winston write-stream that the production File
 *     transports open because the AAP's intent ("no shared filesystem
 *     writes during tests") cannot be honoured with `fs.mkdirSync` alone.
 *   - §0.10.1 Minimal-Change Clause — no production source file is edited.
 *   - §0.10.3 "should a later phase identify an unavoidable testability-
 *     motivated change..." — the patch is test-infrastructure-only.
 *
 * @see https://jestjs.io/docs/configuration#setupfiles-array
 */

'use strict';

const fs = require('fs');
const { Writable } = require('stream');

// ---------------------------------------------------------------------------
// Path classification — does a filesystem target point at our `logs/` dir?
// ---------------------------------------------------------------------------

// The application's logs/ directory is always exactly the segment "logs".
// Other directories (e.g. a hypothetical "logsArchive" or "old_logs") are
// distinct directory names and must NOT be intercepted.  We split on both
// path separators (`/` and `\`) because tests may run on Windows or POSIX.
const LOGS_DIR_SEGMENT = 'logs';
const PATH_SEPARATOR_REGEX = /[\\/]/;

/**
 * Determine whether a filesystem target points at the application's `logs/`
 * directory or one of its contents.
 *
 * Accepts every input type `fs.mkdirSync` and `fs.createWriteStream` accept:
 *   - string paths (the vast majority of real-world use)
 *   - Buffer paths (legacy / binary path support)
 *   - URL paths (the file:// URL form)
 *
 * Returns false for any other input so the original `fs` function is used
 * (Node will then perform its own validation and throw the appropriate
 * TypeError).
 *
 * @param {*} target Anything `fs.mkdirSync` / `fs.createWriteStream` accepts.
 * @returns {boolean} true when the target's path segments include `logs`.
 */
function isLogsPath(target) {
  let pathString;
  if (typeof target === 'string') {
    pathString = target;
  } else if (target && typeof target === 'object' && typeof target.pathname === 'string') {
    // URL or URL-like
    pathString = target.pathname;
  } else if (Buffer.isBuffer(target)) {
    pathString = target.toString('utf8');
  } else {
    return false;
  }
  // Match exact directory segments only — substring matches like "logsArchive"
  // do NOT classify as logs/ because they have no "logs" segment after split.
  return pathString.split(PATH_SEPARATOR_REGEX).includes(LOGS_DIR_SEGMENT);
}

// ---------------------------------------------------------------------------
// fs.mkdirSync patch — short-circuit logs/ directory creation.
// ---------------------------------------------------------------------------
// Both the production module (src/utils/logger.js:30) and the Winston File
// transport (winston/lib/winston/transports/file.js:791) call fs.mkdirSync
// against the same logs/ target during module load of src/utils/logger.js.
// All three call sites are intercepted by this patch.
const originalMkdirSync = fs.mkdirSync;
fs.mkdirSync = function patchedMkdirSync(target, options) {
  if (isLogsPath(target)) {
    // Return value matches Node's behaviour when { recursive: true } is set
    // and the directory already exists: `undefined`.
    return undefined;
  }
  // Use the original `arguments` so calls with unusual signatures (e.g. a
  // single string argument) reach the underlying implementation exactly.
  // eslint-disable-next-line prefer-rest-params
  return originalMkdirSync.apply(fs, arguments);
};

// ---------------------------------------------------------------------------
// fs.createWriteStream patch — return a no-op Writable for logs/ files.
// ---------------------------------------------------------------------------
// Winston's File transport (file.js:613) eagerly opens its target file via
// `fs.createWriteStream(fullpath, { flags: 'a' })` in its constructor.  We
// substitute a no-op Writable so Winston has a functional `pipe()`-compatible
// sink (its internal state machine transitions correctly) but no file handle
// is ever opened against disk.
const originalCreateWriteStream = fs.createWriteStream;
fs.createWriteStream = function patchedCreateWriteStream(target, options) {
  if (isLogsPath(target)) {
    // Build a minimal Writable that swallows all writes.  Winston pipes a
    // PassThrough into this stream and binds 'error' / 'close' listeners.
    const noopStream = new Writable({
      // _write is the only abstract method Writable requires.  Invoking the
      // callback signals "write completed successfully" so the upstream
      // PassThrough drains and Winston's internal `_drain` flag stays false.
      write(_chunk, _encoding, callback) {
        callback();
      },
    });
    // Winston inspects a handful of properties on the destination stream
    // during bookkeeping (notably during file rotation).  Provide the
    // minimal compatible surface so no `undefined` propagates into
    // Winston's `_size` or `_drain` logic.
    noopStream.path = typeof target === 'string' ? target : String(target);
    noopStream.bytesWritten = 0;
    noopStream.fd = null;
    noopStream.pending = false;
    noopStream.flags = (options && typeof options === 'object' && options.flags) || 'a';
    return noopStream;
  }
  // eslint-disable-next-line prefer-rest-params
  return originalCreateWriteStream.apply(fs, arguments);
};
