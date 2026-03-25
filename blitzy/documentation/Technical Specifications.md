# Technical Specification

# Technical Specification

# 0. Agent Action Plan

## 0.1 Executive Summary

Based on the bug description, the Blitzy platform understands that the bug is a **package metadata mismatch** in `package.json` where the `"main"` field on line 5 declares `"index.js"` as the package entrypoint, but no file named `index.js` exists anywhere in the repository. The actual server entrypoint is `server.js`. This causes a `MODULE_NOT_FOUND` error whenever any consumer, tooling pipeline, or integration workflow attempts to load the package via its declared default entry — for example, by calling `require('.')` or `require('hello_world')` from within or against this package directory.

**Precise Technical Failure:** The Node.js CommonJS module resolution algorithm reads the `"main"` field from `package.json` to determine which file to load when a package is required by name or by directory path. When the `"main"` field points to `index.js` and that file does not exist, Node.js throws:

```
Error: Cannot find module '/path/to/exit-code-137-test-7_c3cedb/index.js'
```

**Error Classification:** This is a static metadata configuration error — not a runtime logic error, race condition, or null reference. The bug is deterministic and 100% reproducible on every invocation that relies on the `main` field for entrypoint resolution.

**Reproduction Steps (as executable commands):**

```bash
node -e "require('.')"
```

This command, executed from the repository root, immediately throws `MODULE_NOT_FOUND` because Node.js resolves `require('.')` → reads `package.json` → finds `"main": "index.js"` → attempts to load `./index.js` → file not found.

**Pre-existing Acknowledgment:** The project's own technical specification in Section 1.4 (Known Risks and Issues) explicitly documents this as a known issue with status "Accepted" and severity "Low," described as: `main` field in `package.json` → non-existent `index.js` — Pre-existing issue, out of scope. This bug fix elevates the issue from "accepted" to "resolved."

**Impact Scope:** The fix is a single-field, single-file change — modifying the `"main"` value in `package.json` from `"index.js"` to `"server.js"`. No runtime behavior, HTTP response contract, test suite, or dependency graph is affected.

## 0.2 Root Cause Identification

Based on comprehensive repository analysis, **THE root cause is**: the `"main"` field in `package.json` (line 5) is set to `"index.js"`, a file that has never existed in the repository. The actual and only server entrypoint file is `server.js`.

**Located in:** `package.json`, line 5

**Problematic code:**

```json
"main": "index.js",
```

**Triggered by:** Any operation that relies on the Node.js module resolution algorithm to determine the package's default entrypoint. Specifically, when `require('.')`, `require('./')`, or `require('hello_world')` (if installed as a dependency) is executed, Node.js:

- Reads `package.json` from the package directory
- Extracts the `"main"` field value: `"index.js"`
- Attempts to resolve `./index.js` relative to the package root
- Fails with `MODULE_NOT_FOUND` because the file does not exist

**Evidence from repository file analysis:**

- `package.json` line 5 declares `"main": "index.js"` — confirmed via `read_file`
- The repository contains exactly two `.js` files: `server.js` and `tests/server.test.js` — confirmed via `find . -name "*.js" -not -path "*/node_modules/*"`
- No `index.js` file exists anywhere in the repository — confirmed via `ls -la index.js` returning "No such file or directory"
- `server.js` is the sole runtime entrypoint, containing the HTTP server created with `http.createServer` and exported via `module.exports = server` on line 16
- The test file `tests/server.test.js` correctly requires the server using `require('../server')` on line 20, bypassing the broken `main` field entirely
- The technical specification Section 1.4 explicitly lists this as a known issue: "`main` field in `package.json` → non-existent `index.js` | Low | Accepted | Pre-existing issue, out of scope"

**This conclusion is definitive because:**

- The `"main"` field unambiguously points to `index.js`
- The file `index.js` provably does not exist in the repository
- The file `server.js` provably does exist and is the correct entrypoint (it creates the HTTP server, binds to `127.0.0.1:3000`, and exports the server instance)
- Node.js module resolution documentation confirms that the `"main"` field defines the default module loaded when requiring a package
- Direct reproduction via `node -e "require('.')"` produces the exact error `Cannot find module '.../index.js'`
- There are no other configuration files (`exports` field, `.npmrc`, etc.) that override or supplement the `main` field

## 0.3 Diagnostic Execution

### 0.3.1 Code Examination Results

- **File analyzed:** `package.json`
- **Problematic code block:** Line 5
- **Specific failure point:** Line 5, the value `"index.js"` in the `"main"` field
- **Execution flow leading to bug:**
  - Step 1: Consumer or tooling calls `require('.')` or `require('hello_world')`
  - Step 2: Node.js locates `package.json` in the target directory
  - Step 3: Node.js reads `"main": "index.js"` from the manifest
  - Step 4: Node.js attempts to resolve `./index.js` relative to the package root
  - Step 5: File system lookup fails — `index.js` does not exist
  - Step 6: Node.js throws `Error [MODULE_NOT_FOUND]: Cannot find module '.../index.js'`

**Secondary file analyzed:** `server.js`
- Lines 1–16 confirm this is the actual entrypoint: it imports `http`, creates a server, binds to `127.0.0.1:3000`, and exports the server instance via `module.exports = server`

**Secondary file analyzed:** `tests/server.test.js`
- Line 20: `const server = require('../server');` — the test suite correctly references `server.js` by explicit path, not via the package `main` field, which is why the existing 15 tests all pass despite the broken metadata

### 0.3.2 Repository File Analysis Findings

| Tool Used | Command Executed | Finding | File:Line |
|-----------|-----------------|---------|-----------|
| read_file | `read_file package.json [1, -1]` | `"main": "index.js"` declared — points to non-existent file | `package.json:5` |
| read_file | `read_file server.js [1, -1]` | Actual entrypoint with `http.createServer` and `module.exports = server` | `server.js:1-16` |
| bash (find) | `find . -name "*.js" -not -path "*/node_modules/*"` | Only two JS files exist: `./server.js` and `./tests/server.test.js` | Repository root |
| bash (ls) | `ls -la index.js` | `index.js` confirmed non-existent | Repository root |
| bash (node) | `node -e "require('.')"` | `MODULE_NOT_FOUND: Cannot find module '.../index.js'` | Runtime error |
| bash (node) | `node -e "require('./server')"` | Server loads successfully, `server.listening` confirms operational | `server.js` |
| bash (node) | `node -e "const p=require('./package.json'); console.log(p.main); const fs=require('fs'); console.log(fs.existsSync(p.main));"` | Outputs `index.js` then `false` — confirms metadata/filesystem mismatch | `package.json:5` |
| bash (grep) | `grep -n "require" tests/server.test.js` | Test uses `require('../server')` on line 20, bypasses `main` field | `tests/server.test.js:20` |
| bash (grep) | `grep -rn "index.js\|index" tests/` | No references to `index.js` in test files | `tests/` |
| bash (npm test) | `CI=true npx jest --forceExit --detectOpenHandles --watchAll=false` | All 15 tests pass — tests are unaffected because they do not use the `main` field | `tests/server.test.js` |
| get_tech_spec_section | Section 1.4: Known Risks and Issues | Explicitly lists `main` → non-existent `index.js` as "Accepted" known issue | Tech spec |

### 0.3.3 Fix Verification Analysis

- **Steps followed to reproduce bug:**
  - Executed `node -e "require('.')"` from the repository root — received `MODULE_NOT_FOUND` error referencing `index.js`
  - Validated that `index.js` does not exist via filesystem check
  - Confirmed `server.js` is the correct entrypoint by successfully loading it with `require('./server')`
  - Ran full test suite (`npm test`) — all 15 tests pass, confirming that tests use `require('../server')` directly and are not affected by the broken `main` field

- **Confirmation tests to ensure the bug is fixed:**
  - After changing `"main"` to `"server.js"`, execute `node -e "require('.')"` — should load `server.js` without error
  - Run `CI=true npx jest --forceExit --detectOpenHandles --watchAll=false` — all 15 tests must continue to pass
  - Validate with `node -e "const p=require('./package.json'); const fs=require('fs'); console.log(fs.existsSync(p.main));"` — should output `true`

- **Boundary conditions and edge cases covered:**
  - CommonJS `require('.')` resolution
  - Package validation tools that inspect the `main` field
  - External consumers that might `require('hello_world')` after installing this package
  - The `package-lock.json` does not store a `main` field for the root package — no lockfile update needed

- **Verification confidence level:** 98% — the fix is a single-field metadata correction with no behavioral side effects; the only residual uncertainty is whether any external Backprop integration pipeline caches the old `main` value

## 0.4 Bug Fix Specification

### 0.4.1 The Definitive Fix

- **File to modify:** `package.json`
- **Current implementation at line 5:**

```json
"main": "index.js",
```

- **Required change at line 5:**

```json
"main": "server.js",
```

- **This fixes the root cause by:** Correcting the `"main"` field to point to `server.js`, which is the actual and only server entrypoint file in the repository. After this change, Node.js module resolution will successfully locate and load `server.js` when the package is required by directory path (`require('.')`) or by package name (`require('hello_world')`). The exported value will be the `http.Server` instance created in `server.js` at line 6 and exported at line 16 via `module.exports = server`.

### 0.4.2 Change Instructions

- **MODIFY** line 5 of `package.json` from:

```json
"main": "index.js",
```

to:

```json
"main": "server.js",
```

**Rationale comment:** The `"main"` field must point to the actual server entrypoint file (`server.js`), which creates the HTTP server using Node.js built-in `http` module and exports the server instance. The previous value `"index.js"` referenced a file that has never existed in this repository, causing `MODULE_NOT_FOUND` errors during package-level module resolution. This is the minimal, targeted correction that aligns package metadata with the actual filesystem layout.

No lines are deleted. No lines are inserted. No other files are modified. The complete corrected `package.json` will be:

```json
{
    "name": "hello_world",
    "version": "1.0.0",
    "description": "Hello world in Node.js",
    "main": "server.js",
    "scripts": {
        "test": "jest --forceExit --detectOpenHandles",
        "test:coverage": "jest --coverage --forceExit --detectOpenHandles"
    },
    "author": "hxu",
    "license": "MIT",
    "devDependencies": {
        "jest": "^29.7.0",
        "supertest": "^7.2.2"
    }
}
```

### 0.4.3 Fix Validation

- **Test command to verify fix:**

```bash
node -e "const s = require('.'); console.log('Type:', typeof s); console.log('Listening:', s.listening !== undefined);"
```

- **Expected output after fix:**

```
Type: object
Listening: true
```

- **Full regression test command:**

```bash
CI=true npx jest --forceExit --detectOpenHandles --watchAll=false
```

- **Expected test output:** All 15 tests pass with 0 failures

- **Metadata consistency verification:**

```bash
node -e "const p=require('./package.json'); const fs=require('fs'); console.log('main:', p.main, '| exists:', fs.existsSync(p.main));"
```

- **Expected output:** `main: server.js | exists: true`

## 0.5 Scope Boundaries

### 0.5.1 Changes Required (Exhaustive List)

| Action | File Path | Line(s) | Specific Change |
|--------|-----------|---------|-----------------|
| MODIFIED | `package.json` | 5 | Change `"main": "index.js"` to `"main": "server.js"` |

No other files require modification. This is a single-line, single-field metadata correction.

**Files NOT created:** No new files are created.

**Files NOT deleted:** No files are deleted.

### 0.5.2 Explicitly Excluded

- **Do not modify:** `server.js` — the runtime server behavior must remain completely unchanged. The HTTP server continues to bind to `127.0.0.1:3000`, respond with `200 OK`, `text/plain`, `Hello, World!\n` for all requests, and export the server instance via `module.exports`
- **Do not modify:** `tests/server.test.js` — the test suite already uses `require('../server')` to load the server module directly. This path-based import is independent of the `"main"` field and requires no update. All 15 tests pass before and after the fix
- **Do not modify:** `package-lock.json` — the lockfile does not store the root package's `main` field. No regeneration or update is needed for this metadata-only change
- **Do not modify:** `README.md` — the minimal README does not reference the entrypoint or `main` field. No documentation update is required
- **Do not modify:** `blitzy/` — the documentation folder contains tech spec and project guide artifacts. While Section 1.4 of the tech spec lists this bug as an "Accepted" known issue, updating that documentation is outside the scope of this bug fix
- **Do not refactor:** The `server.js` implementation — while the server is intentionally minimal (16 lines), no code quality improvements or refactoring are included in this fix
- **Do not add:** New test cases — the existing 15 tests provide 100% coverage of `server.js`. Adding a test that exercises `require('.')` is not required because the `main` field is npm manifest metadata, not application logic
- **Do not change:** The `name`, `version`, `description`, `author`, `license`, `scripts`, or `devDependencies` fields in `package.json`
- **Do not add:** An `exports` field to `package.json` — while `"exports"` is the modern alternative to `"main"`, adding it would expand scope beyond the minimal bug fix

## 0.6 Verification Protocol

### 0.6.1 Bug Elimination Confirmation

- **Execute entrypoint resolution test:**

```bash
node -e "const s = require('.'); console.log('Loaded:', typeof s === 'object' && s.listening !== undefined ? 'SUCCESS' : 'FAIL'); s.close();"
```

- **Verify output matches:** `Loaded: SUCCESS` — confirms that `require('.')` now resolves to `server.js` and returns the exported `http.Server` instance
- **Confirm error no longer appears:** The `MODULE_NOT_FOUND: Cannot find module '.../index.js'` error must not occur when running `node -e "require('.')"`
- **Validate metadata consistency:**

```bash
node -e "const p = require('./package.json'); const fs = require('fs'); console.assert(p.main === 'server.js', 'main field incorrect'); console.assert(fs.existsSync(p.main), 'main file missing'); console.log('Metadata: VALID');"
```

- **Expected output:** `Metadata: VALID`

### 0.6.2 Regression Check

- **Run existing test suite:**

```bash
CI=true npx jest --forceExit --detectOpenHandles --watchAll=false
```

- **Expected result:** 15 passed, 0 failed, 1 test suite passed
- **Verify unchanged behavior in:**
  - HTTP response contract: `200 OK`, `Content-Type: text/plain`, body `Hello, World!\n` (14 bytes)
  - All HTTP methods: GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD
  - All URL paths: `/`, `/test`, `/nonexistent`, `/a/b/c/d`, `/path?query=value`
  - Server binding: `127.0.0.1:3000`
  - Startup log message: `Server running at http://127.0.0.1:3000/`
  - Consecutive request determinism
  - Server export via `module.exports`
- **Run coverage verification:**

```bash
CI=true npx jest --coverage --forceExit --detectOpenHandles --watchAll=false
```

- **Expected result:** 100% coverage across statements, branches, functions, and lines for `server.js` — unchanged from baseline
- **Confirm startup behavior:**

```bash
timeout 5 node server.js &
sleep 2
curl -s http://127.0.0.1:3000/
kill %1 2>/dev/null
```

- **Expected output:** `Hello, World!` — confirms the server starts and responds identically after the metadata fix

## 0.7 Rules

### 0.7.1 User-Specified Rules

- **"exit code 137 test" rule:** Do not make any updates or changes in GitHub App to create or update a workflow. This rule is acknowledged and will be strictly followed — no GitHub Actions workflow files will be created, modified, or deleted as part of this fix.

### 0.7.2 Bug Fix Discipline

- Make the exact specified change only — modify the `"main"` field value in `package.json` from `"index.js"` to `"server.js"`
- Zero modifications outside the bug fix — no refactoring, no feature additions, no dependency changes
- Preserve all existing contracts:
  - HTTP response: `200`, `text/plain`, `Hello, World!\n`
  - Server binding: `127.0.0.1:3000`
  - Zero production dependencies
  - `module.exports = server` export contract
  - Jest test suite: 15 tests, 100% coverage
  - DevDependencies: `jest ^29.7.0`, `supertest ^7.2.2`
  - Package identity: `hello_world` version `1.0.0`

### 0.7.3 Development Standards Compliance

- **CommonJS module system:** The project uses `require()` / `module.exports` exclusively. No ES Module syntax (`import`/`export`) is used or introduced
- **Node.js v20.x compatibility:** The fix is a `package.json` metadata change that is fully compatible with Node.js v20.x (the project's documented runtime)
- **Minimal change principle:** The smallest possible change is applied — a single string value modification in a single JSON field — consistent with the user's directive to "prefer the smallest possible fix that restores correct package entrypoint behavior"
- **No workflow modifications:** Per the user-specified rule, no CI/CD, GitHub Actions, or workflow files are created or modified

## 0.8 References

### 0.8.1 Repository Files Searched

| File Path | Purpose | Key Finding |
|-----------|---------|-------------|
| `package.json` | npm package manifest | Line 5: `"main": "index.js"` — incorrect entrypoint declaration (root cause) |
| `server.js` | HTTP server entrypoint (16 lines) | Actual entrypoint; creates server with `http.createServer`, binds to `127.0.0.1:3000`, exports via `module.exports = server` |
| `tests/server.test.js` | Jest test suite (163 lines, 15 tests) | Uses `require('../server')` on line 20 — bypasses `main` field; all tests pass |
| `README.md` | Project documentation (2 lines) | Minimal; no entrypoint references; no update needed |
| `package-lock.json` | Dependency lockfile (v3) | Does not store root `main` field; no update needed |
| `blitzy/` | Documentation folder | Contains tech spec and project guide; Section 1.4 lists the bug as "Accepted" known issue |
| `blitzy/documentation/` | Technical specification and project guide artifacts | Forward-looking spec and backward-looking execution report for the test suite implementation |

### 0.8.2 Repository Folders Searched

| Folder Path | Purpose | Relevance |
|-------------|---------|-----------|
| `/` (root) | Repository root | Contains all project files; confirmed only 2 `.js` files exist |
| `tests/` | Test directory | Single test file `server.test.js`; confirmed no references to `index.js` |
| `blitzy/` | Documentation hub | Confirmed known issue documentation in tech spec |
| `blitzy/documentation/` | Spec and guide documents | Provided context on project constraints and known risks |

### 0.8.3 External References

| Source | URL | Relevance |
|--------|-----|-----------|
| Node.js Packages Documentation | https://nodejs.org/api/packages.html | Confirms `"main"` field defines the default module when loading the package; supported in all versions of Node.js |
| npm CLI package.json Documentation | https://docs.npmjs.com/cli/v11/configuring-npm/package-json/ | Confirms that if `main` is not set, it defaults to `index.js` in the package root folder |
| npm Creating package.json | https://docs.npmjs.com/creating-a-package-json-file/ | General `package.json` field reference |

### 0.8.4 Technical Specification Sections Referenced

| Section | Title | Relevance |
|---------|-------|-----------|
| 1.1 | Executive Summary | Project overview, package identity (`hello_world` v1.0.0), and purpose as Backprop test harness |
| 1.4 | Known Risks and Issues | Explicitly lists `main` field → non-existent `index.js` as "Accepted" known issue |
| 3.1 | Programming Languages | Confirms Node.js v20.x, CommonJS module system, and no TypeScript or ES Modules |
| 5.2 | Component Details | Confirms `server.js` as sole production artifact; documents `module.exports = server` export interface |

### 0.8.5 Attachments

No attachments were provided for this project.

