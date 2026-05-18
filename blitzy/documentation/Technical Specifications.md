# Technical Specification

# 0. Agent Action Plan

## 0.1 Executive Summary

Based on the bug description, the Blitzy platform understands that the bug is **a documentation/context contract defect**: the repository's human-facing `README.md` endpoint table and the externally-observed "Codebase Context" summary describe the project as a trivial Node.js `Hello, World!` HTTP server, while the on-disk authoritative implementation is a Python/Flask application in `server.py` exposing **five** route handlers (`GET /`, `GET /evening`, `POST /evening`, `GET /morning`, `POST /morning`). The defect is a stale-documentation inconsistency, not a runtime failure. No exception, stack trace, or HTTP error is emitted — the divergence surfaces whenever a developer, reviewer, Backprop workflow, or Blitzy agent reads the documentation and consequently plans work against the wrong runtime, wrong entrypoint, wrong dependency system, or wrong endpoint set.

### 0.1.1 Precise Technical Failure

Translating the user-reported symptom into exact technical language, two distinct context-contract defects coexist in the repository, both pointing to the same class of "stale pre-migration documentation":

- **Endpoint catalog drift in `README.md`** — The "Available Endpoints" Markdown table in `README.md` (lines 28–32) lists only `GET /`, `GET /evening`, and `POST /evening`, omitting both `GET /morning` and `POST /morning` that are implemented and tested in source. This gap is already formally recorded in the authoritative Technical Specification as constraint **C-008** ("`README.md` documents only 3 of 5 endpoints (both `/morning` routes are absent) — this known inconsistency is acknowledged and out-of-scope for current implementation effort").
- **Phantom Node.js artifact references** — External codebase-indexing summaries and any downstream "Codebase Context" text continue to list `server.js`, `package.json`, and `package-lock.json` as repository children and to characterize the project as a Node.js `Hello, World!` server. These three files do **not** exist on the filesystem; they were deleted during the Node.js → Express.js → Python/Flask migration (confirmed via `git log --all --diff-filter=D --name-only`). The Technical Specification formally records them as phantom entries under constraint **C-007**.

### 0.1.2 Error Type Classification

| Classification Dimension | Value |
|--------------------------|-------|
| Bug category | Documentation/context contract defect — stale post-migration artifacts |
| Runtime error class | None (no exception, no stack trace, no HTTP error) |
| Failure mode | Silent — manifests only when stale context is consumed by a reader or automated agent |
| Fault locus | Primary: `README.md` lines 28–32; Secondary: external index description of phantom Node.js files |
| Trigger condition | Any read/consumption of the stale documentation or indexed codebase summary |
| Reproducibility | Deterministic — the mismatch is present on every inspection of the affected surfaces |
| Severity on runtime behavior | Zero — `server.py` and all 29 pytest tests are unaffected |
| Severity on downstream agents | High — agents may plan fixes against the wrong runtime, entrypoint, or endpoint set |

### 0.1.3 Reproduction Steps as Executable Commands

The defect can be observed — not executed, since it has no runtime — by running the following inspection commands from the repository root:

```bash
# Confirm on-disk files are Python/Flask only (no Node.js artifacts exist)

ls -la server.py server.js package.json package-lock.json 2>&1
# Expected: server.py found; server.js, package.json, package-lock.json NOT found

#### Confirm that server.py implements all five routes

grep -n "@app.route" server.py
# Expected: 5 decorators on /, /evening (x2), /morning (x2)

#### Confirm that the README endpoint table omits /morning

grep -n "/morning\|/evening\|| GET\|| POST" README.md
# Expected: /evening rows present, /morning rows absent

#### Confirm pytest suite passes, validating the Python/Flask reality

python3 -m pytest -v
# Expected: 29 passed, 100% coverage of server.py

```

### 0.1.4 What "Fixed" Looks Like

The defect is resolved when every in-repository documentation surface truthfully describes the on-disk Python/Flask implementation with all five routes, and when no context source continues to portray the project as a Node.js `Hello, World!` server. Concretely, the only stale on-disk surface is the `README.md` endpoint table, which must list all five `(method, path, body, status)` tuples. The already-authoritative `blitzy/documentation/Technical Specifications.md` and `blitzy/documentation/Project Guide.md` are verified accurate for the current Python/Flask implementation and require no changes. The runtime (`server.py`), dependency manifest (`requirements.txt`), test configuration (`pytest.ini`), and test suite (`tests/`) must remain byte-for-byte unchanged, per the user-declared scope boundaries.


## 0.2 Root Cause Identification

Based on exhaustive repository and documentation inspection, **the root cause is a single class of defect with two visible manifestations**: post-migration documentation failed to fully track the Node.js → Python/Flask source-code migration, leaving a partially-updated `README.md` endpoint table and an externally-observed Codebase Context description that still characterizes the project by its pre-migration Node.js form.

### 0.2.1 The Root Cause(s)

- **RC-1 — Incomplete README migration:** The `README.md` endpoint table was updated when the project migrated from Node.js to Python/Flask (commit `acece8e` — "Update README.md for Python/Flask migration") and was correctly re-pointed at `server.py` and `requirements.txt`. However, when `/morning` routes were later added in commit `dc9a2f0` ("feat: add `/morning` GET and POST route handlers"), the `README.md` endpoint table was **not** extended to list the new rows. The result is a table that documents 3 of 5 routes (`/`, `GET /evening`, `POST /evening`) while the application, the test suite, and the Technical Specification all describe 5 routes.
- **RC-2 — Stale external index / Codebase Context characterization:** The Node.js artifacts `server.js`, `package.json`, and `package-lock.json` were deleted on disk across multiple commits during the migration (confirmed by `git log --all --diff-filter=D --name-only`: commits `7813379`, `be2f509`, `a8bf8c0`, `220d211`, `cb33694`, `461c614`, `1db5401`, `51c23e0`). The authoritative Technical Specification explicitly acknowledges these files as phantom entries (Constraint **C-007** in §2.6.2). Nevertheless, external index summaries and any derived Codebase Context text still enumerate these phantom files as repository children and still use them to describe the project as a Node.js `Hello, World!` server. This is a documentation/contextual drift that can only be closed by making the in-repo Python/Flask documentation so complete and authoritative that any downstream consumer is unambiguously corrected.

### 0.2.2 Exact Locations

| Root Cause | File | Line Range | Line-Level Evidence |
|-----------|------|------------|---------------------|
| RC-1 (missing `/morning` rows) | `README.md` | 26–34 | Table heading at line 26; separator at line 29; three data rows at lines 30–32 (`/`, `GET /evening`, `POST /evening`); no `/morning` rows; note at line 34 |
| RC-2 (phantom Node artifact characterization) | External index summary (no single file) | — | Actual disk state: `ls -la server.js package.json package-lock.json` returns "No such file or directory" for all three |

Corroborating authoritative-implementation evidence lives in:

| Authoritative File | Line Range | Evidence |
|--------------------|------------|----------|
| `server.py` | 1–35 | `Flask` import (line 1); `app = Flask(__name__)` (line 3); five `@app.route` decorators at lines 6, 11, 16, 21, 26; `__main__` guard at line 31 with `app.run(host="127.0.0.1", port=3000)` at line 35 |
| `requirements.txt` | 1 | `Flask>=3.0` — sole runtime dependency, no Node equivalents |
| `pytest.ini` | 1–3 | `[pytest]` section with `testpaths = tests` and `addopts = --cov=server --cov-report=term-missing` |
| `tests/conftest.py` | 1–7 | `from server import app` and `client` fixture built from `app.test_client()` |
| `tests/test_server.py` | 1–144 | 24 tests covering all five route contracts plus 404/405 error handling and import safety |
| `tests/test_startup.py` | 1–52 | 5 tests validating `__main__` block: `app.run(host="127.0.0.1", port=3000)`, Werkzeug version suppression, import safety |
| `blitzy/documentation/Technical Specifications.md` | §1.1.1, §1.2.2, §2.1.1–2.1.10, §2.6.2 (C-007, C-008) | Canonical Python/Flask description; explicit phantom-artifact acknowledgment; feature catalog covering F-001 through F-010 |
| `blitzy/documentation/Project Guide.md` | §1.1, §4, §10.C | Project overview of Python/Flask; full endpoint verification list; key-file-locations table listing only Python artifacts |

### 0.2.3 Triggering Conditions

- **RC-1** is triggered every time a reader opens `README.md` and consults the "Available Endpoints" table to learn what HTTP contracts the server honors. Because the table is the only concise endpoint reference in `README.md`, readers who rely solely on it will miss `GET /morning` and `POST /morning` entirely, even though `curl http://127.0.0.1:3000/morning` and `curl -X POST http://127.0.0.1:3000/morning` both succeed at runtime.
- **RC-2** is triggered every time any consumer of the external codebase index — including Blitzy agents planning changes — encounters a summary that still lists Node.js files or characterizes the project by its pre-migration form. Because the phantom files do not exist on disk, any plan that treats them as authoritative will collide with reality at the first file-read.

### 0.2.4 Evidence From Repository File Analysis

The following direct-inspection findings establish the root causes beyond reasonable doubt:

- `find . -type f -not -path './.git/*' | sort` returned exactly these ten files: `README.md`, `blitzy/documentation/Project Guide.md`, `blitzy/documentation/Technical Specifications.md`, `pytest.ini`, `requirements.txt`, `server.py`, `tests/__init__.py`, `tests/conftest.py`, `tests/test_server.py`, `tests/test_startup.py`. Zero Node.js source or manifest files are present.
- `ls -la server.js package.json package-lock.json` returned "No such file or directory" for each of the three phantoms.
- `grep -n "@app.route" server.py` returned exactly five matches at lines 6, 11, 16, 21, and 26 — matching the five-endpoint surface documented in the Technical Specification.
- `awk 'NR>=26 && NR<=34' README.md` confirmed that the endpoint table contains only three data rows and no `/morning` entries.
- `python3 -m pytest -v` produced "29 passed in 0.23s" with `server.py` at 100% line coverage (21/21 statements), validating that the Python/Flask runtime matches the Tech Spec description exactly.
- `curl http://127.0.0.1:3000/morning` returned `Good morning` with HTTP 200 and `Content-Type: text/plain; charset=utf-8`; `curl -X POST http://127.0.0.1:3000/morning` returned `Good morning` with HTTP 201. Both confirm that the `/morning` routes are live at runtime and that the README omission is purely documentation drift, not a missing feature.
- `git log --all --diff-filter=D --name-only --oneline` enumerated commits that removed `server.js`, `package.json`, `package-lock.json`, `jest.config.js`, and the legacy `__tests__/` directory — establishing that these artifacts were deliberately deleted during the Node.js → Python/Flask migration and are correctly absent from the current working tree.

### 0.2.5 Conclusion — Definitive and Irrefutable

The root cause is definitive: the Python/Flask implementation in `server.py` is the sole authoritative runtime, and the documented stale surfaces are (a) the three-row `README.md` endpoint table missing the two `/morning` rows, and (b) an external Codebase Context description that continues to use the pre-migration Node.js framing. The Technical Specification (C-007, C-008) already records both of these as known discrepancies. This conclusion is irrefutable because:

- The on-disk file inventory contains zero Node.js files, yet the indexed summary still lists them.
- The live server responds successfully to both `/morning` endpoints, yet the README table omits them.
- Every authoritative source-of-truth file (`server.py`, `tests/test_server.py`, `tests/test_startup.py`, the Tech Spec) agrees that the current implementation is Python/Flask with five routes. Only the README endpoint table and externally-derived context characterizations diverge.


## 0.3 Diagnostic Execution

This sub-section records the code examination, repository-file analysis, and fix verification performed to diagnose the stale-documentation defect without executing any runtime test that asserts against the stale text.

### 0.3.1 Code Examination Results

The primary stale-documentation block under `README.md` is the "Available Endpoints" Markdown table. The examined block, reproduced from lines 26–34 exactly as it exists on disk, is:

```
## Available Endpoints

| Method | Path       | Response Body    | Status Code     |
| ------ | ---------- | ---------------- | --------------- |
| GET    | `/`        | `Hello, World!`  | `200 OK`        |
| GET    | `/evening` | `Good evening`   | `200 OK`        |
| POST   | `/evening` | `Good evening`   | `201 Created`   |

> **Note:** POST requests return a `201 Created` status code.
```

- **File analyzed:** `README.md`
- **Problematic code block:** lines 26–34 (the `## Available Endpoints` section)
- **Specific failure point:** line 32 is the last data row (`POST /evening`), immediately followed by a blank line at line 33. The two missing rows that should follow line 32 are `GET /morning` → `Good morning` → `200 OK` and `POST /morning` → `Good morning` → `201 Created`.
- **Execution flow leading to bug:** A reader opens `README.md` → scrolls to the "Available Endpoints" section → consults the three-row table → forms an incomplete mental model of the HTTP surface → plans work or verification against only 3 endpoints, even though `server.py` implements 5 and `tests/test_server.py` verifies 5.

The authoritative source truth for the five-endpoint surface lives in `server.py` and is reproduced below exactly as the runtime registers it at import time:

```python
@app.route("/", methods=["GET"])           # line 6  → Hello, World! + 200
@app.route("/evening", methods=["GET"])    # line 11 → Good evening + 200
@app.route("/evening", methods=["POST"])   # line 16 → Good evening + 201
@app.route("/morning", methods=["GET"])    # line 21 → Good morning + 200
@app.route("/morning", methods=["POST"])   # line 26 → Good morning + 201
```

### 0.3.2 Repository File Analysis Findings

| Tool Used | Command Executed | Finding | File:Line |
|-----------|------------------|---------|-----------|
| bash / find | `find . -type f -not -path './.git/*' \| sort` | Returned exactly 10 files: `README.md`, `blitzy/documentation/Project Guide.md`, `blitzy/documentation/Technical Specifications.md`, `pytest.ini`, `requirements.txt`, `server.py`, `tests/__init__.py`, `tests/conftest.py`, `tests/test_server.py`, `tests/test_startup.py`. Zero Node.js files present. | Repository root (absolute inventory) |
| bash / ls | `ls -la server.js package.json package-lock.json 2>&1` | Output: three "cannot access … No such file or directory" lines — phantoms confirmed absent. | `./server.js`, `./package.json`, `./package-lock.json` (all non-existent) |
| bash / grep | `grep -n "@app.route" server.py` | Five matches at lines 6, 11, 16, 21, 26 — confirming five registered routes. | `server.py:6,11,16,21,26` |
| bash / grep | `grep -n "/morning\|/evening\|\| GET\|\| POST" README.md` | Matches only on lines 31 and 32 (the two `/evening` rows); zero matches on `/morning`. | `README.md:31–32` (positive); `README.md:/morning` (negative) |
| bash / awk | `awk 'NR>=26 && NR<=38 {printf "%2d: %s\\n", NR, $0}' README.md` | Dumps lines 26–38 of README verbatim, showing the three-row table terminates at line 32 followed by a blank line at line 33 and the `> **Note:**` annotation at line 34. | `README.md:26–34` |
| bash / cat | `cat server.py` | Confirms `from flask import Flask` (line 1), `app = Flask(__name__)` (line 3), five `@app.route` blocks at lines 6–28, and a `__main__` guard at lines 31–35 invoking `app.run(host="127.0.0.1", port=3000)`. | `server.py:1–35` |
| bash / cat | `cat requirements.txt` | Single line content: `Flask>=3.0`. Confirms sole runtime dependency. | `requirements.txt:1` |
| bash / cat | `cat pytest.ini` | Two configuration lines: `testpaths = tests` and `addopts = --cov=server --cov-report=term-missing`. | `pytest.ini:1–3` |
| bash / cat | `cat tests/conftest.py` | Imports `pytest` and `from server import app`; defines `client` fixture returning `app.test_client()`. | `tests/conftest.py:1–7` |
| bash / cat | `cat tests/test_server.py` | 144-line file with 24 tests covering all five endpoints' status/body/content-type contracts, GET-vs-POST differentiation for `/evening` and `/morning`, 404/405 error handling, and importability. | `tests/test_server.py:1–144` |
| bash / cat | `cat tests/test_startup.py` | 52-line file with 5 tests for `__main__` block via `runpy.run_module(..., run_name="__main__")` plus `monkeypatch` of `flask.Flask.run`. | `tests/test_startup.py:1–52` |
| bash / git | `git log --all --oneline \| head -30` | Shows migration history: original Node.js → Express.js (commits `4b7db05`, `0fbbfcc`, `baafc3d`, `160c1d5`) → Flask (commits `35d9973`, `7813379`, `acece8e`) → `/morning` added (`dc9a2f0`) → startup tests added (`c15b16c`). | Repository git history |
| bash / git | `git log --all --diff-filter=D --name-only --oneline` | Enumerates deletions of `server.js`, `package.json`, `package-lock.json`, `jest.config.js`, `__tests__/server.lifecycle.test.js`, `__tests__/server.test.js` across multiple cleanup commits — establishing intentional removal during migration. | Repository git history |
| get_tech_spec_section | `get_tech_spec_section("1.1 EXECUTIVE SUMMARY")` | Confirms Tech Spec §1.1.1 states: "the current authoritative implementation on disk is Python/Flask. Historical Node.js artifacts (`server.js`, `package.json`, `package-lock.json`) appear in stale folder listings but do not exist on the filesystem and are treated throughout this document as phantom entries superseded by the Flask port." | Tech Spec §1.1.1 |
| get_tech_spec_section | `get_tech_spec_section("2.6 ASSUMPTIONS AND CONSTRAINTS")` | Confirms constraint **C-007** (phantom Node.js artifacts) and **C-008** (README documents only 3 of 5 endpoints). | Tech Spec §2.6.2 |
| get_tech_spec_section | `get_tech_spec_section("9.5 FILES EXAMINED (CONSOLIDATED)")` | Confirms §9.5.3 explicitly lists `server.js`, `package.json`, `package-lock.json` as "Phantom (Non-Existent) Files — Recorded per C-007". | Tech Spec §9.5.3 |
| bash / python | `python3 -m pytest -v` | Output: "29 passed in 0.23s" — complete test pass; `server.py` at 100% line coverage (21/21 statements, 0 missed). Confirms runtime parity with Tech Spec. | Test suite execution |
| bash / curl | `curl -X {GET,POST} http://127.0.0.1:3000/{evening,morning}` and `curl http://127.0.0.1:3000/` (with `python3 server.py` backgrounded) | All five expected tuples returned: `GET /` → `Hello, World!`/200, `GET /evening` → `Good evening`/200, `POST /evening` → `Good evening`/201, `GET /morning` → `Good morning`/200, `POST /morning` → `Good morning`/201. `Content-Type: text/plain; charset=utf-8` on every response. | Live endpoint verification |

### 0.3.3 Fix Verification Analysis

Because the defect is a documentation/context contract rather than a runtime failure, the "reproduction" is a content-level inspection (not an executable test), and the "verification" consists of confirming that stale text is replaced with accurate text while every runtime contract remains byte-for-byte unchanged.

- **Steps followed to reproduce the bug:**
  - Open `README.md` at lines 26–34 and observe the three-row table omits both `/morning` rows.
  - Run `python3 -m pytest -v` and observe 29 passing tests across 5 endpoints, demonstrating the omission is documentation-only.
  - Run `grep -n "@app.route" server.py` and count five decorators, confirming five routes are registered.
  - Run `ls -la server.js package.json package-lock.json` and observe "No such file or directory" for all three, confirming the Node.js phantom characterization in the Codebase Context does not reflect disk reality.
- **Confirmation tests used to ensure the bug is fixed** (to be executed after the fix is applied):
  - `grep -c '/morning' README.md` must return a value ≥ 2 (one match for each new row, plus any additional contextual mention).
  - `grep -c '/evening' README.md` must remain ≥ 2 (existing rows preserved).
  - `grep -n '| GET' README.md` and `grep -n '| POST' README.md` together must show five HTTP-method rows within the endpoint table.
  - `python3 -m pytest -v` must still produce "29 passed" with 100% coverage of `server.py` — proving the runtime and test contracts are undisturbed.
  - `git diff --stat` must show only `README.md` has changed; all other files unchanged.
  - `git diff -- server.py requirements.txt pytest.ini tests/` must produce zero output (no modifications to production or test artifacts).
- **Boundary conditions and edge cases covered:**
  - **Table formatting preservation:** The two new rows must use the same pipe-delimited format and equal column-separator widths as the existing three rows so the rendered Markdown remains a well-formed table.
  - **Content-type note preservation:** The `> **Note:** POST requests return a `201 Created` status code.` annotation at line 34 applies to both `/evening` and `/morning` POST and must remain intact.
  - **Non-introduction of Node.js content:** The fix must not reference `server.js`, `package.json`, `package-lock.json`, `npm`, or `node` — those are explicitly prohibited by the user's scope boundaries and by constraint **C-007**.
  - **Single source of truth preservation:** `server.py` is the authoritative endpoint catalog — the README must be updated to match it, never the reverse.
  - **Downstream doc consistency:** `blitzy/documentation/Project Guide.md` (§4 and §10.C) and `blitzy/documentation/Technical Specifications.md` (§1.2.2, §2.1, §9.5) already list five endpoints and must continue to agree with the fixed `README.md`.
  - **No new prerequisite creep:** No new sections, no new prerequisites, no new installation steps. Only the two missing table rows are added.
- **Verification success and confidence level:** Verification will be successful. Confidence level is **98%**. The 2% residual accounts for downstream Codebase Context indexers that are outside the repository and can only be nudged toward truth by in-repo documentation updates; the in-repo portion of the fix is wholly deterministic and covered by the test-and-grep checks above.


## 0.4 Bug Fix Specification

The fix is minimal, targeted, and scoped entirely to human-readable documentation. It inserts the two missing `/morning` rows into the "Available Endpoints" table in `README.md` so that the on-disk documentation exhaustively matches the Python/Flask runtime surface. **No runtime code, no test, no configuration file, and no dependency manifest is modified.** No Node.js file is reintroduced.

### 0.4.1 The Definitive Fix

- **File to modify:** `README.md` (at the repository root, exact path `README.md` relative to repository root)
- **Files that must NOT be modified:** `server.py`, `requirements.txt`, `pytest.ini`, `tests/__init__.py`, `tests/conftest.py`, `tests/test_server.py`, `tests/test_startup.py`, `blitzy/documentation/Project Guide.md`, `blitzy/documentation/Technical Specifications.md`

The current implementation at `README.md` lines 28–32 is:

```
| Method | Path       | Response Body    | Status Code     |
| ------ | ---------- | ---------------- | --------------- |
| GET    | `/`        | `Hello, World!`  | `200 OK`        |
| GET    | `/evening` | `Good evening`   | `200 OK`        |
| POST   | `/evening` | `Good evening`   | `201 Created`   |
```

The required replacement at the same location is the five-row table:

```
| Method | Path       | Response Body    | Status Code     |
| ------ | ---------- | ---------------- | --------------- |
| GET    | `/`        | `Hello, World!`  | `200 OK`        |
| GET    | `/evening` | `Good evening`   | `200 OK`        |
| POST   | `/evening` | `Good evening`   | `201 Created`   |
| GET    | `/morning` | `Good morning`   | `200 OK`        |
| POST   | `/morning` | `Good morning`   | `201 Created`   |
```

This fixes the root cause RC-1 (incomplete README migration) by bringing the README endpoint table into exact agreement with:

- `server.py` route registrations at lines 6, 11, 16, 21, 26 (five decorators)
- `tests/test_server.py` endpoint assertions for all five `(method, path, body, status)` tuples
- Tech Spec §1.2.2 "Primary System Capabilities" five-row endpoint table
- Tech Spec §2.1 feature catalog F-001 through F-005 (all five route handlers)
- Project Guide §4 "Endpoint Verification" (all five `curl` checks)

RC-2 (stale Codebase Context / phantom Node.js characterization) is addressed by the **act itself** of making `README.md` unambiguously enumerate all five Python/Flask endpoints: any downstream Codebase Context consumer that re-reads the repository after the fix will receive a README that cannot be reconciled with "Node.js `Hello, World!` for any request", thereby driving the external index toward truth on its next refresh. No in-repo action can directly modify an external index; the only in-repo lever is making the authoritative documentation complete and self-consistent, which this fix accomplishes.

### 0.4.2 Change Instructions

The change is an **insertion** of two new Markdown table rows, placed immediately after the existing `POST /evening` row and before the blank line at `README.md:33`. The two `/evening` rows and the `GET /` row are preserved exactly as-is.

- **INSERT at line 33 of `README.md`** (pushing the pre-existing blank line and subsequent content down by two lines):

```
| GET    | `/morning` | `Good morning`   | `200 OK`        |
| POST   | `/morning` | `Good morning`   | `201 Created`   |
```

- **DELETE no lines.** The pre-existing rows for `/` and `/evening` are not removed, reordered, or rewritten.
- **MODIFY no lines.** The table heading at line 28, the separator row at line 29, the three existing data rows at lines 30–32, the blank line (currently at line 33, pushed to line 35 after insertion), and the `> **Note:**` annotation at line 34 (pushed to line 36) are unchanged in content.
- **Column alignment rule:** The two new rows use the exact same `|` column delimiters, the same internal whitespace padding, and the same backtick-fenced `Path`, `Response Body`, and `Status Code` values as the existing rows. Specifically: `Method` column is 6 characters wide (`GET   ` / `POST  ` with trailing spaces); `Path` column uses backticks around the literal path; `Response Body` column uses backticks around the literal body string; `Status Code` column uses backticks around the canonical HTTP status phrase (`200 OK` or `201 Created`).
- **Rationale comment in the change description (not in the file itself):** "README.md endpoint table was last updated during the Node.js → Flask migration (commit `acece8e`) but was not extended when `/morning` GET and POST routes were added in commit `dc9a2f0`. This insertion brings the README into exact alignment with `server.py` and the Technical Specification §1.2.2 five-endpoint table, closing constraint C-008."

**Why a comment is not added inside `README.md`:** the file is user-facing documentation, not code; embedding a fix-motive comment would leak development metadata into a reader-facing surface. The motive is instead recorded in this Agent Action Plan (sub-section 0.2) and will live in the commit message and pull-request description.

### 0.4.3 Fix Validation

- **Test command to verify the fix:** `python3 -m pytest -v`
- **Expected output after the fix:**

```text
============================== 29 passed in <1s ==============================
server.py      21      0   100%
```

(Exact number of seconds varies by machine; the invariant is "29 passed" and "server.py 100%".) The test suite is untouched by this fix, so its passing status proves the runtime contract is undisturbed.

- **Documentation-level confirmation commands:**

```bash
# 1. Confirm all five rows are now in the README endpoint table

grep -E '^\| (GET|POST) +\| `/' README.md | wc -l   # must print 5

#### Confirm both /morning rows are present

grep -c '/morning' README.md                         # must print ≥ 2

#### Confirm scope: only README.md changed

git diff --stat                                       # must list only README.md

#### Confirm no other file changed

git diff -- server.py requirements.txt pytest.ini tests/  # must be empty
```

- **Confirmation method:**
  - Visual Markdown rendering: open `README.md` in a Markdown viewer and confirm the table renders as a 5-row HTML table with aligned columns.
  - Byte-diff invariant: `git diff --stat` must show `README.md | 2 ++` (two lines added, zero removed).
  - Runtime parity invariant: the pytest suite must pass 29/29 with 100% `server.py` coverage, unchanged from the pre-fix baseline.
  - Cross-document agreement: `grep -c '/morning' blitzy/documentation/Technical\ Specifications.md` and `grep -c '/morning' blitzy/documentation/Project\ Guide.md` must remain at their pre-fix values (no changes to those files).

### 0.4.4 User Interface Design

Not applicable. This project exposes no GUI, no HTML templates, no static assets, and no Figma design attachments were supplied by the user. The only user interface under consideration is the Markdown-rendered `README.md` endpoint table, whose presentation requirement is solely that the two added rows use the same pipe-delimited format as the existing three rows so that the rendered HTML table is uniform and well-formed.


## 0.5 Scope Boundaries

This sub-section enumerates every file that is modified, created, or deleted by the fix, and every file or behavior that must remain untouched. The list is exhaustive — if a file is not named here, it is out of scope.

### 0.5.1 Changes Required (EXHAUSTIVE LIST)

| # | File Path (relative to repo root) | Operation | Lines Affected | Specific Change |
|---|------------------------------------|-----------|----------------|-----------------|
| 1 | `README.md` | MODIFY | Insertion at line 33 (between the existing `POST /evening` row at line 32 and the blank line currently at line 33) | Add two new table rows: `\| GET    \| \`/morning\` \| \`Good morning\`   \| \`200 OK\`        \|` and `\| POST   \| \`/morning\` \| \`Good morning\`   \| \`201 Created\`   \|`. No other lines in `README.md` are modified. |

**Files Created:** None.

**Files Deleted:** None.

**No other files require modification.** The two `blitzy/documentation/*` files, the runtime module `server.py`, the dependency manifest `requirements.txt`, the test configuration `pytest.ini`, and all four files under `tests/` are explicitly preserved byte-for-byte.

### 0.5.2 Explicitly Excluded

The following are explicitly out of scope and must NOT be touched by this fix:

- **Do NOT modify `server.py`** — route handlers, the `__main__` guard, the Werkzeug version suppression at line 34, and the `app.run(host="127.0.0.1", port=3000)` call at line 35 must remain byte-for-byte identical.
- **Do NOT modify `requirements.txt`** — the single-line `Flask>=3.0` runtime manifest must remain exactly as-is.
- **Do NOT modify `pytest.ini`** — both `testpaths = tests` and `addopts = --cov=server --cov-report=term-missing` must remain exactly as-is.
- **Do NOT modify any file under `tests/`** — `tests/__init__.py`, `tests/conftest.py`, `tests/test_server.py`, and `tests/test_startup.py` must remain byte-for-byte identical. In particular, tests must not be altered "to match stale documentation"; the README is the surface being corrected, not the tests.
- **Do NOT modify `blitzy/documentation/Technical Specifications.md`** — the Tech Spec already describes the Python/Flask implementation with all five endpoints, acknowledges the phantom Node.js artifacts (C-007), and records the README gap (C-008). It is authoritative and accurate; no changes needed.
- **Do NOT modify `blitzy/documentation/Project Guide.md`** — the Project Guide already documents all five endpoints, the 100% test-coverage status, and the Python/Flask stack. It is authoritative and accurate; no changes needed.
- **Do NOT reintroduce Node.js files** — `server.js`, `package.json`, `package-lock.json`, `jest.config.js`, `node_modules/`, and any `__tests__/` directory were deliberately deleted during the Node.js → Python/Flask migration and must remain absent. Re-adding any of them would re-create the phantom-artifact problem the Tech Spec already closed out (C-007).
- **Do NOT add new endpoints** — the runtime exposes exactly five routes (`GET /`, `GET /evening`, `POST /evening`, `GET /morning`, `POST /morning`) and the fix does not add, rename, or reorder any of them.
- **Do NOT add authentication, sessions, databases, or persistence** — these are explicitly out of scope per Tech Spec §1.3.2 and user constraints C-002, C-003.
- **Do NOT add environment variables or `.env` files** — host `127.0.0.1` and port `3000` must remain literal values in source per Tech Spec §2.6.2 constraint C-004.
- **Do NOT add TLS, HTTPS, or external network binding** — binding must remain to loopback only per Tech Spec §2.6.2 constraint C-006.
- **Do NOT add Docker, docker-compose, Kubernetes, or any container definition** — no production deployment infrastructure per Tech Spec §1.3.2 and constraint C-001.
- **Do NOT create or modify any GitHub Actions workflow** — per the user-supplied implementation rule "exit code 137 test": *Do not make any updates or changes in GitHub App to create or update a workflow.* No `.github/workflows/*.yml` file may be created, modified, or deleted.
- **Do NOT add CI/CD pipelines of any kind** — no Jenkinsfile, no GitLab CI, no CircleCI, no pre-commit hooks, no tox configuration.
- **Do NOT refactor working code** — `server.py` uses Flask's 3-tuple `(body, status, headers)` return form; this style must be preserved. Do not convert to `jsonify`, `Response(...)`, `make_response(...)`, or any other form "for consistency" or "modernization".
- **Do NOT add new runtime dependencies** — `requirements.txt` must continue to list only `Flask>=3.0` per feature F-010 (dev/runtime dependency separation).
- **Do NOT add dev dependencies to `requirements.txt`** — `pytest` and `pytest-cov` are intentionally excluded from `requirements.txt` (feature F-010) and installed separately by contributors.
- **Do NOT add features or documentation beyond the bug fix** — no new sections in `README.md` (no "Testing" section, no "Contributing" section, no "Architecture" section), no new prose explaining the migration history, no new badges or diagrams. Only the two missing table rows are added.
- **Do NOT change the `Content-Type` header** — all responses must continue to send `text/plain; charset=utf-8` exactly as encoded in `server.py` lines 8, 13, 18, 23, 28.
- **Do NOT change status codes** — `GET /` remains 200, `GET /evening` remains 200, `POST /evening` remains 201, `GET /morning` remains 200, `POST /morning` remains 201. The existing `> **Note:** POST requests return a `201 Created` status code.` annotation on `README.md:34` remains unchanged.
- **Do NOT alter the pytest test client fixture** — `tests/conftest.py` `client` fixture returning `app.test_client()` must remain unchanged; it is consumed by 24 tests in `test_server.py`.
- **Do NOT change the Werkzeug version suppression lambda** — `WSGIRequestHandler.version_string = lambda self: ""` at `server.py:34` must remain literal (feature F-008).
- **Do NOT change the host/port binding** — `app.run(host="127.0.0.1", port=3000)` at `server.py:35` must remain literal (feature F-009).


## 0.6 Verification Protocol

Verification has two mandatory halves: (a) confirming the stale documentation has been corrected, and (b) confirming nothing outside the stale-documentation boundary was touched. Both halves must pass before the fix is considered complete.

### 0.6.1 Bug Elimination Confirmation

- **Primary command:** `grep -c '/morning' README.md`
- **Verify output matches:** a value of `2` or greater (two new rows introduce at minimum two matches; higher counts are acceptable if other legitimate `/morning` prose exists). Before the fix, this command returns `0`.
- **Primary command:** `grep -E '^\| (GET|POST) +\| \`/' README.md | wc -l`
- **Verify output matches:** exactly `5` (one line per route, matching the five routes registered in `server.py`). Before the fix, this command returns `3`.
- **Secondary command:** `awk 'NR>=26 && NR<=38' README.md`
- **Verify output matches:** the "Available Endpoints" heading, table header, separator, and five data rows (`/`, `GET /evening`, `POST /evening`, `GET /morning`, `POST /morning`) followed by a blank line and the `> **Note:** POST requests return a 201 Created status code.` annotation.
- **Rendering confirmation:** Open `README.md` in any Markdown renderer (GitHub, `glow`, `mdcat`, VS Code preview). Confirm the "Available Endpoints" section renders as a 5-row HTML table with aligned columns and no broken pipes.
- **Runtime parity confirmation:** Start the server with `python3 server.py &` and issue `curl` for each of the five documented endpoints. Each response must match the README row exactly:

```text
curl http://127.0.0.1:3000/              → "Hello, World!" | 200
curl http://127.0.0.1:3000/evening       → "Good evening"  | 200
curl -X POST http://127.0.0.1:3000/evening → "Good evening" | 201
curl http://127.0.0.1:3000/morning       → "Good morning"  | 200
curl -X POST http://127.0.0.1:3000/morning → "Good morning" | 201
```

- **Error no longer appears:** There is no runtime error log to monitor — this defect is a documentation/contract defect with zero runtime manifestation. The equivalent "error no longer appears" signal is: running the above `grep` checks returns the expected counts, and any consumer reading the README can correctly enumerate all five endpoints.
- **Integration verification:** `python3 -m pytest -v` must produce "29 passed" with 100% `server.py` coverage, identical to the pre-fix baseline. This proves the fix introduced no regression in the test-validated runtime contract.

### 0.6.2 Regression Check

- **Run existing test suite:** `python3 -m pytest -v`
- **Expected result:** 29 tests pass in under 1 second; `server.py` reports 100% line coverage (21/21 statements, 0 missed). This is byte-identical to the pre-fix baseline captured during diagnostic execution (sub-section 0.3).
- **Verify unchanged behavior in specific features:**

| Feature ID | Invariant to Confirm | Verification Command |
|------------|----------------------|----------------------|
| F-001 | `GET /` → `Hello, World!` / 200 / `text/plain; charset=utf-8` | `python3 -m pytest tests/test_server.py::test_get_root_status_code tests/test_server.py::test_get_root_response_body tests/test_server.py::test_get_root_content_type -v` |
| F-002, F-003 | `GET /evening` → 200, `POST /evening` → 201, body `Good evening`, content-type `text/plain; charset=utf-8` | `python3 -m pytest -v -k "evening"` |
| F-004 | Shared-path status differentiation: GET vs POST status codes differ on both `/evening` and `/morning` | `python3 -m pytest -v -k "differentiation"` |
| F-005 | `GET /morning` → 200, `POST /morning` → 201, body `Good morning`, content-type `text/plain; charset=utf-8` | `python3 -m pytest -v -k "morning"` |
| F-006 | 404 on unknown paths; 405 on unsupported methods | `python3 -m pytest -v -k "404 or 405 or unknown or not_allowed or unsupported"` |
| F-007 | `import server` registers routes but does not call `app.run()` | `python3 -m pytest tests/test_server.py::test_app_is_flask_instance tests/test_server.py::test_app_import_does_not_start_server tests/test_startup.py::test_import_does_not_call_app_run -v` |
| F-008 | Werkzeug `WSGIRequestHandler.version_string` returns empty string after `__main__` execution | `python3 -m pytest tests/test_startup.py::test_main_suppresses_werkzeug_version -v` |
| F-009 | `app.run(host="127.0.0.1", port=3000)` called exactly once under `__main__` | `python3 -m pytest tests/test_startup.py::test_main_calls_app_run tests/test_startup.py::test_main_binds_to_localhost tests/test_startup.py::test_main_binds_to_port_3000 -v` |
| F-010 | `requirements.txt` remains single-line `Flask>=3.0` with no dev dependencies | `cat requirements.txt` must match exactly `Flask>=3.0` on a single line |

- **Scope-limit invariants (must all hold after the fix):**

```bash
# Only README.md must appear in the diff

git diff --name-only                              # must print exactly: README.md

#### Number of files changed by the fix must equal 1

git diff --name-only | wc -l                      # must print: 1

#### Every non-README source file must be byte-for-byte identical to pre-fix

git diff -- server.py requirements.txt pytest.ini tests/ blitzy/  # must be empty

#### No Node.js files must have been reintroduced

ls server.js package.json package-lock.json 2>&1 | \
  grep -c 'No such file'                          # must print: 3

#### No GitHub workflow must have been created, modified, or deleted

git diff --name-only -- .github/                  # must be empty
```

- **Performance metrics (informational, not gating):** Test execution time must remain sub-second (pre-fix baseline was 0.17–0.23s across runs). Slower execution would indicate unintended instrumentation side-effects and should be investigated before accepting the fix. Run with `python3 -m pytest --durations=0 -v` to emit per-test timings if deeper performance confirmation is desired.

- **Idempotency confirmation:** Running the verification commands a second time against a clean checkout must produce the same outputs. The fix is deterministic: the two inserted rows are identical on every application, and the test suite is stateless.


## 0.7 Rules

The following rules govern this fix and are acknowledged in full. Every user-specified directive, implementation rule, and Tech-Spec-level constraint is recorded below for compliance verification.

### 0.7.1 User-Specified Implementation Rules (Acknowledged Verbatim)

The user supplied one explicit implementation rule via the project input form, reproduced exactly:

- **Rule name:** `exit code 137 test`
- **Rule content:** *"Do not make any updates or changes in GitHub App to create or update a workflow."*

**Compliance statement:** This fix does not create, modify, or delete any file under `.github/`. It touches no GitHub App configuration, no GitHub Actions workflow, no branch-protection setting, and no repository metadata. The verification protocol (sub-section 0.6.2) includes an explicit check `git diff --name-only -- .github/` that must produce empty output after the fix.

### 0.7.2 User-Specified Scope Boundaries (from the Bug Report)

The user's problem statement declared the following boundaries, which are adopted verbatim as binding rules on this fix:

- **Limit changes to documentation/context updates** unless tests reveal an actual code mismatch. Compliance: the diagnostic execution (sub-section 0.3) confirmed all 29 pytest tests pass with 100% coverage — no code mismatch exists — so changes are strictly confined to documentation.
- **First verify the current implementation from source and tests, then update stale docs to match it.** Compliance: `server.py`, `tests/test_server.py`, and `tests/test_startup.py` were treated as authoritative and read first; `README.md` is then updated to match their five-route surface. The direction of truth is source-and-tests → documentation, never the reverse.
- **Do not change runtime behavior.** Specifically preserved: Flask app structure, route paths, status codes, response bodies, `Content-Type: text/plain; charset=utf-8`, localhost binding to `127.0.0.1:3000`, pytest coverage setup, and import-safe `if __name__ == "__main__"` startup. Compliance: `server.py`, `requirements.txt`, `pytest.ini`, and all files under `tests/` are byte-for-byte unchanged by this fix.
- **Preserve unchanged interfaces, APIs, and contracts:** `python server.py` startup workflow, `pip install -r requirements.txt`, `pytest` / coverage workflow, five implemented HTTP route contracts, Flask as the runtime framework, Backprop test-harness purpose of the repo. Compliance: none of these are touched.
- **Avoid:** reintroducing Node.js files or npm tooling; adding new endpoints; changing tests just to match stale documentation; adding CI/CD, Docker, environment variables, auth, databases, or production infrastructure; broad refactors unrelated to correcting stale project context and endpoint documentation. Compliance: the fix adds exactly two Markdown table rows to `README.md` — no Node.js file, no new endpoint, no test change, no infrastructure of any kind.

### 0.7.3 Tech-Spec-Level Constraints Honored

From `blitzy/documentation/Technical Specifications.md` §2.6.2, the following constraints apply and are honored:

| Constraint ID | Summary | How This Fix Complies |
|---------------|---------|----------------------|
| **C-001** | No production deployment infrastructure (Dockerfile, Kubernetes, CI/CD) | No infrastructure files created or modified |
| **C-002** | No authentication, authorization, sessions, or API keys | No auth logic introduced |
| **C-003** | No databases, persistence, or caching layers | No persistence introduced |
| **C-004** | No environment variables or config files; host and port remain literal | No config files touched; `server.py:35` unchanged |
| **C-005** | No HTML templates, static assets, or JavaScript frontend | No frontend code introduced |
| **C-006** | Server binds only to `127.0.0.1`; no external network exposure | Binding unchanged at `server.py:35` |
| **C-007** | Phantom Node.js artifacts (`server.js`, `package.json`, `package-lock.json`) must not be referenced as implementation sources | No Node.js files reintroduced; none referenced in the updated `README.md` |
| **C-008** | `README.md` documents only 3 of 5 endpoints — known out-of-scope at Tech Spec authoring time | This fix explicitly closes C-008 by extending the table to all 5 endpoints |

### 0.7.4 Coding and Development Guidelines

Although this is a documentation-only fix, the repository's coding and documentation conventions are acknowledged and followed:

- **Markdown table conventions:** The two new rows use the exact pipe-delimited column format, same column order (`Method | Path | Response Body | Status Code`), same whitespace alignment, and same backtick fencing as the existing three rows. No new columns are introduced.
- **Five-endpoint listing order:** Rows are presented in the order `/` → `/evening` (GET) → `/evening` (POST) → `/morning` (GET) → `/morning` (POST) — matching the `@app.route` declaration order in `server.py` lines 6, 11, 16, 21, 26 and the Tech Spec §1.2.2 table.
- **HTTP status phrasing:** Follows the existing README convention of `200 OK` and `201 Created` rather than bare numeric codes.
- **Response body literals:** Enclosed in backticks and written exactly as `server.py` returns them: `Hello, World!`, `Good evening`, `Good morning`.
- **Deterministic, minimal-diff principle:** The fix is the smallest possible change that closes the documentation gap. No related content (e.g., the `Note:` annotation, the "License" section, the Prerequisites, Setup) is altered.
- **No defensive or speculative additions:** No "TODO" comments, no disclaimers about the migration history, no version badges, no architecture diagrams — only the two missing table rows.
- **Zero regressions mandate:** Per the user's bug report, "Extensive testing to prevent regressions." Compliance: the full 29-test pytest suite must continue to pass at 100% and `server.py` coverage must remain at 100%. These checks are explicit in sub-section 0.6.2.
- **Preserve Backprop test-harness purpose:** The repository's canonical use as a minimal HTTP target for Backprop integration verification is preserved — the fix does not expand the repository's purpose or introduce any non-test-harness semantics.


## 0.8 References

This sub-section comprehensively records every file examined, every Tech Spec section consulted, every command executed, and every attachment or URL supplied by the user during the diagnosis. No external Figma URLs, design assets, or attachments were provided by the user.

### 0.8.1 Files Examined (in the Repository)

All paths are relative to the repository root.

| Path | Role in Diagnosis | Outcome |
|------|-------------------|---------|
| `README.md` | Primary stale-documentation surface under investigation | Confirmed "Available Endpoints" table at lines 28–32 documents only 3 of 5 routes — the stale content to be fixed |
| `server.py` | Authoritative runtime — the truth that documentation must match | Confirmed five `@app.route` decorators at lines 6, 11, 16, 21, 26, registering `GET /`, `GET /evening`, `POST /evening`, `GET /morning`, `POST /morning` with bodies `Hello, World!`, `Good evening`, `Good morning` and statuses 200/200/201/200/201 |
| `requirements.txt` | Runtime dependency manifest — sanity check against phantom Node.js `package.json` | Single line `Flask>=3.0`; no Node dependencies present |
| `pytest.ini` | Test configuration — confirms coverage tooling integration | Contains `[pytest]` with `testpaths = tests` and `addopts = --cov=server --cov-report=term-missing` |
| `tests/__init__.py` | Package marker for pytest discovery | Empty file (1 byte after newline); serves only as a package marker |
| `tests/conftest.py` | Shared pytest fixture source | Defines `client` fixture via `app.test_client()`; confirms runtime import target is `server.app` (the Python/Flask module), not any Node.js module |
| `tests/test_server.py` | 24-test suite validating all five route handlers, status differentiation, 404/405 behavior, importability | All 24 tests passing against the Python/Flask runtime; content matches Tech Spec feature catalog F-001 through F-007 |
| `tests/test_startup.py` | 5-test suite validating the `__main__` guard block (F-008, F-009) | All 5 tests passing; uses `runpy.run_module(..., run_name="__main__")` with `monkeypatch` on `flask.Flask.run` |
| `blitzy/documentation/Technical Specifications.md` | Canonical, authoritative specification already describing the Python/Flask reality | Confirmed accurate throughout; explicitly records constraints C-007 (phantom Node.js artifacts) and C-008 (README endpoint gap); requires no modification by this fix |
| `blitzy/documentation/Project Guide.md` | Project completion and verification summary | Confirmed accurate; §4 lists all five endpoint verifications; §10.C lists only Python artifacts in key-file-locations; requires no modification by this fix |
| `.git/` (via `git log`) | Migration provenance | `git log --all --oneline` confirmed the Node.js → Express.js → Flask migration path; `git log --all --diff-filter=D` confirmed deletions of `server.js`, `package.json`, `package-lock.json`, `jest.config.js`, and `__tests__/` |

### 0.8.2 Folders Explored

| Folder Path | Contents Observed | Relevance |
|-------------|-------------------|-----------|
| `` (repository root) | 4 files and 2 directories on disk: `README.md`, `pytest.ini`, `requirements.txt`, `server.py`, `tests/`, `blitzy/`; no Node.js artifacts on filesystem | Confirms runtime is Python/Flask; phantom Node.js files listed in external indexes are not present on disk |
| `tests/` | `__init__.py`, `conftest.py`, `test_server.py` (144 lines, 24 tests), `test_startup.py` (52 lines, 5 tests) | Confirms comprehensive coverage of the five-endpoint surface and of the `__main__` startup path |
| `blitzy/` | Contains only `documentation/` sub-folder | Used purely for authoritative and project-guide documentation |
| `blitzy/documentation/` | `Project Guide.md` (427 lines), `Technical Specifications.md` (545 lines) | Both confirmed accurate for the current Python/Flask implementation; neither requires modification |

### 0.8.3 Technical Specification Sections Consulted

The following sections of `blitzy/documentation/Technical Specifications.md` were retrieved in full via `get_tech_spec_section` to cross-validate the diagnosis and scope:

| Section Heading | Purpose of Consultation |
|-----------------|--------------------------|
| 1.1 EXECUTIVE SUMMARY | Confirms Python/Flask is authoritative; Node.js artifacts are phantom (§1.1.1) |
| 1.2 SYSTEM OVERVIEW | Confirms the five-endpoint table (§1.2.2) and the acknowledged README documentation gap (§1.2.1) |
| 1.3 SCOPE | Confirms in-scope features (F-001–F-010) and out-of-scope items (no CI/CD, no Docker, no auth, etc.) |
| 2.1 FEATURE CATALOG | Confirms full list of features F-001 through F-010 and per-feature line references into `server.py` |
| 2.4 IMPLEMENTATION CONSIDERATIONS | Confirms technical constraints, security posture, and maintenance requirements including documented README inconsistency (§2.4.5) |
| 2.6 ASSUMPTIONS AND CONSTRAINTS | Source of constraints C-001 through C-008 — directly governs this fix's scope boundaries |
| 3.1 TECHNOLOGY STACK OVERVIEW | Confirms current stack: CPython 3.10+, Flask `>=3.0`, Werkzeug 3.1.7, pytest 9.0.2, pytest-cov 7.1.0, coverage 7.13.5 |
| 9.5 FILES EXAMINED (CONSOLIDATED) | Source §9.5.3 explicitly lists `server.js`, `package.json`, `package-lock.json` as phantom non-existent files per C-007 |

### 0.8.4 Commands Executed During Diagnosis

For reproducibility, the following bash and Python commands were executed during the diagnostic phase and are recorded here verbatim:

```bash
# Inventory on-disk files

find . -type f -not -path './.git/*' | sort

#### Confirm phantom Node.js files are absent

ls -la server.js package.json package-lock.json 2>&1

#### Count registered routes in the Python source

grep -n "@app.route" server.py

#### Inspect the stale README table

awk 'NR>=26 && NR<=38 {printf "%2d: %s\n", NR, $0}' README.md

#### Read authoritative files

cat server.py requirements.txt pytest.ini
cat tests/__init__.py tests/conftest.py tests/test_server.py tests/test_startup.py

#### Runtime verification against a live server

python3 server.py &              # start on 127.0.0.1:3000
curl http://127.0.0.1:3000/
curl http://127.0.0.1:3000/evening
curl -X POST http://127.0.0.1:3000/evening
curl http://127.0.0.1:3000/morning
curl -X POST http://127.0.0.1:3000/morning

#### Run the full pytest suite with coverage (configured via pytest.ini)

python3 -m pytest -v

#### Migration history

git log --all --oneline | head -30
git log --all --diff-filter=D --name-only --oneline | head -20
```

### 0.8.5 User-Provided Attachments and Metadata

- **Attachments provided by the user:** None. The project input form explicitly states "No attachments found for this project."
- **Figma URLs provided by the user:** None. No Figma design files, frames, or URLs were referenced in the bug report or any supplementary material. There is no UI component to this repository (no HTML templates, no static assets, no JavaScript frontend — all responses are `text/plain`), and no Figma design artifacts were supplied.
- **Environment variables provided by the user:** None. The problem-input lists an empty array for environment-variable names.
- **Secrets provided by the user:** None. The problem-input lists an empty array for secret names.
- **Environment setup instructions provided by the user:** None. The problem-input lists `Environment 1 instructions: None provided`.
- **Implementation rules provided by the user:** Exactly one, titled `exit code 137 test`, with content *"Do not make any updates or changes in GitHub App to create or update a workflow."* — acknowledged and honored in sub-section 0.7.1.
- **Files supplied in `/tmp/environments_files`:** The folder was inspected and contains no files relevant to this bug fix (empty output from `ls -la /tmp/environments_files/`).

### 0.8.6 External Web Research

No external web research was required for this fix. All diagnostic evidence is internal to the repository and the already-authoritative Tech Spec. The defect is a stale-documentation contract issue, not a library-version bug, a framework-behavior question, or a known CVE; there is no upstream issue, Stack Overflow thread, or GitHub issue to consult. Target version compatibility is already established: Python 3.10+ and Flask 3.1.3 (installed), with no version-sensitive behavior involved in editing a Markdown file.

### 0.8.7 Cross-Reference Summary

The following table maps each line-item change in this fix back to its authoritative evidence and to the user-supplied constraint that permits or requires it:

| Change | Source of Truth | Constraint/Rule Supporting the Change |
|--------|-----------------|---------------------------------------|
| Insert `\| GET    \| \`/morning\` \| \`Good morning\`   \| \`200 OK\`        \|` at `README.md:33` | `server.py:21–23` (morning_get handler); Tech Spec §1.2.2 row 4; `tests/test_server.py::test_get_morning_*` (3 tests) | User scope: "update stale docs to match [source]"; Tech Spec C-008 ("README documents only 3 of 5 endpoints") |
| Insert `\| POST   \| \`/morning\` \| \`Good morning\`   \| \`201 Created\`   \|` at `README.md:34` | `server.py:26–28` (morning_post handler); Tech Spec §1.2.2 row 5; `tests/test_server.py::test_post_morning_*` (3 tests) | User scope: "update stale docs to match [source]"; Tech Spec C-008 |
| Do NOT modify any other file | The entire "In Scope" list is restricted to stale documentation by the user's bug report | User scope: "Limit changes to documentation/context updates unless tests reveal an actual code mismatch"; tests reveal no mismatch |
| Do NOT create/modify GitHub workflows | User-supplied implementation rule `exit code 137 test` | Rule: "Do not make any updates or changes in GitHub App to create or update a workflow." |


