# Technical Specification

# 0. Agent Action Plan

## 0.1 Executive Summary

Based on the bug description, the Blitzy platform understands that the bug is a **documentation drift defect** in which the repository lacks a canonical, code-aligned "Codebase Context" artifact at the repository root, causing consumers of the repository (human reviewers, Backprop, Blitzy agents, and assorted tooling) to rely on pre-migration Node.js context that describes a non-existent `server.js` / `package.json` / `package-lock.json` runtime, despite the active implementation having been migrated to a single-file Python/Flask microserver (`app.py`, Flask 3.1.3) with identical external behavior.

### 0.1.1 Precise Technical Failure

The failure is **not a runtime exception, crash, stack trace, null dereference, or logic error in executing code**. It is a **context/metadata consistency bug** with the following technical shape:

- **Defect class:** Stale external/descriptive context (documentation artifact) contradicts the source-of-truth implementation
- **Defect surface:** Reasoning and tool-invocation layer — any agent, reviewer, or workflow that ingests the repository's "Codebase Context" as a description of runtime reality
- **Observable manifestation:** Tools or contributors infer `node server.js` / `npm install` / `npm test` as viable operations when they are not; agents may attempt to regenerate, repair, or extend a JavaScript runtime that no longer exists; health-probe consumers may doubt whether `GET /health` exists
- **No runtime exception expected:** Because the bug is descriptive, executing `python app.py` or `python -m pytest` continues to succeed — the runtime contract is fully honored by `app.py`. The damage is confined to downstream reasoning about the project.

### 0.1.2 Reproduction Steps as Executable Commands

The bug is reproduced by inspection rather than execution. The following commands make the defect observable:

```bash
# 1. Confirm no canonical codebase context artifact exists at the repository root

ls -la codebase_context.md 2>&1
# Expected (bug): 'ls: cannot access codebase_context.md: No such file or directory'

#### Confirm that the Node.js artifacts the stale context references do NOT exist

ls -la server.js package.json package-lock.json 2>&1
# Expected (bug): all three report 'No such file or directory'

#### Confirm the active implementation is Python/Flask

cat requirements.txt && head -20 app.py
# Expected: 'Flask==3.1.3' and Flask-based docstring / imports

#### Confirm that any pre-migration description of the project still in circulation

####    contradicts this runtime reality (this is the 'stale context' symptom)

```

### 0.1.3 Expected vs. Actual Behavior

| Aspect | Expected (source-of-truth per Tech Spec §1.1.1, §3.1.1) | Actual (stale Codebase Context) |
|---|---|---|
| Active entry point | `app.py` (Python/Flask, 93 lines) | `server.js` (Node.js) |
| Runtime / framework | Python 3.13+ with Flask 3.1.3 | Node.js `http` module / npm |
| Dependency manifest | `requirements.txt` declaring `Flask==3.1.3` | `package.json` / `package-lock.json` |
| Health endpoint | `GET /health` → `{"status":"ok"}` (HTTP 200, `application/json`) | Not described, or described as absent |
| Catch-all contract | Any method, any path → `Hello, World!\n` (HTTP 200, `text/plain`) | Described against the legacy runtime |
| Test harness | `tests/` directory with pytest + Flask `test_client()` | Jest / Supertest / Mocha (not present) |
| Startup command | `python app.py` | `node server.js` / `npm start` |

### 0.1.4 Frequency and Consumers Affected

The mismatch manifests **consistently on every ingestion** of the stale Codebase Context, affecting the following consumer classes without discrimination:

- **Developers and reviewers** who read the context to orient themselves to the repository
- **Backprop** pipelines that ingest the repository as an integration test fixture
- **Blitzy agents** that consume the context to plan repository modifications, test generation, or fixes
- **Ancillary tooling** (IDE assistants, code-review bots, documentation extractors) that base their behavior on the context description

Because Tech Spec §1.1.1 explicitly establishes Python/Flask as the **active implementation** and declares byte-for-byte behavioral parity with the legacy Node.js implementation as a "non-negotiable invariant," the stale context is authoritatively contradicted by the Tech Spec and is therefore unambiguously incorrect — not merely out of date.


## 0.2 Root Cause Identification

Based on exhaustive repository file analysis, git-history investigation, and Tech Spec cross-reference, **THE root cause** is definitively identified as follows.

### 0.2.1 Primary Root Cause

**THE root cause is:** the absence of a canonical `codebase_context.md` file at the repository root on the active branch (`ABK-3138-test`), combined with the historical existence of such a file on a pre-migration branch that described a Node.js / Express.js runtime. Any downstream consumer that cached, mirrored, or regenerated context from the pre-migration state now holds a description that contradicts the current Python/Flask implementation defined by the Tech Spec.

- **Located in (missing from):** `/codebase_context.md` (repository root) — file is not present on disk and not tracked by git on the current branch
- **Triggered by:** any workflow that reads a "codebase context" to reason about the repository — e.g., Backprop ingestion, Blitzy Agent Action Plan generation, contributor onboarding, automated code review
- **Evidence from Repository File Analysis:**
  - `ls -la` on repository root returns only `README.md`, `app.py`, `blitzy/`, `requirements.txt`, `tests/` — no `codebase_context.md` is present
  - `git ls-files | grep -i md` returns three files (`README.md`, `blitzy/documentation/Project Guide.md`, `blitzy/documentation/Technical Specifications.md`) — `codebase_context.md` is absent from the active branch's git index
  - `git log --all --oneline -- codebase_context.md` reveals a single historical commit `f45d177 "docs: add canonical codebase_context.md to resolve documentation drift"` on branch `origin/blitzy-96b042f2-884d-4b9d-bba1-ce9ba9f12bb4`, describing a Node.js / Express.js implementation — demonstrating that a stale context artifact exists in the broader repository history
  - No `server.js`, `package.json`, or `package-lock.json` files exist on the active branch's working tree (`ls -la server.js package.json package-lock.json` reports "No such file or directory" for all three)
- **This conclusion is definitive because:** the Tech Spec (§1.1.1, §1.2.2, §3.1.1, §2.1 Feature Catalog) unambiguously establishes the active implementation as the Python/Flask single-file microserver in `app.py`; the working tree contains exactly one application file (`app.py`, 93 lines) and one dependency manifest (`requirements.txt` declaring `Flask==3.1.3`); the pytest suite (`tests/test_http_contract.py`, `tests/test_lifecycle.py`) achieves 100% line coverage against `app.py`; therefore the stale context is authoritatively contradicted by both the Tech Spec and the working source. There is no alternative interpretation consistent with the evidence.

### 0.2.2 Contributing Secondary Root Causes

Investigation of the Tech Spec surfaced three **secondary stale references** that reinforce — and partially explain — the primary defect. These are documented for completeness but are explicitly out of scope for modification in this fix (see §0.5.2).

- **Tech Spec §0.2.1 / §1.2.1 stale-placeholder claim** — The Tech Spec states "legacy Node.js files (`server.js`, `package.json`, `package-lock.json`) remain in the repository root as **empty placeholder files**." Physical inspection confirms these files **do not exist on disk** on the active branch. This reinforces context drift but is not the bug the user has asked Blitzy to fix — the Tech Spec remains the source of truth for the active-implementation identity (Flask), which is what the new Codebase Context must align with. Modifying the Tech Spec is explicitly excluded per the user's boundary constraints (see §0.5.2).
- **Migration-origin references in `app.py`, `README.md`, and `tests/test_lifecycle.py`** — These files describe the Python/Flask runtime correctly but retain **historical migration context** (e.g., `app.py` line 1 docstring "Flask application entry point — replaces the original Node.js server.js"). Such references are accurate narrative history, not stale context, and are preserved per the user's constraint "Preserve... pytest-based test workflow" and "Avoid... modifying empty legacy placeholders unless explicitly needed."
- **No `.blitzyignore` file exists** in the repository — confirmed by `find / -name ".blitzyignore"`. Therefore no files are excluded from analysis by repository policy; all files were reviewable.

### 0.2.3 Why a Runtime-Behavior Fix Is Not Required

Runtime execution of the Flask application and the pytest suite on the active branch was verified end-to-end (see §0.3) and produces the exact behavior specified by the Tech Spec and required by the user's "must remain untouched" constraints:

- `GET /health` returns `{"status":"ok"}` with HTTP 200 and `application/json`
- All other method-path combinations return `Hello, World!\n` with HTTP 200 and `text/plain`
- `python -m pytest` reports 36 passed, 0 failed
- Coverage of `app.py` measured at 100% (14/14 statements)

Because the runtime behavior already matches the Tech Spec, **no source-code change is required or permitted**. The fix is a **pure documentation/context-layer correction**.


## 0.3 Diagnostic Execution

### 0.3.1 Code Examination Results

Because this bug manifests at the **context / metadata layer** rather than in executing code, "code examination" primarily establishes that:
(a) the active source tree does not contain the artifacts the stale context references, and
(b) the Python/Flask implementation honors every behavioral invariant the new Codebase Context will describe.

- **File analyzed:** `app.py` (active application entry point, 93 lines)
  - **Section examined:** lines 1–93 in their entirety
  - **Runtime identity evidence:** lines 17–25 (Flask imports, `Flask(__name__)` instance creation), lines 30–33 (module constants `HOST`, `PORT`, `METHODS`), lines 41–48 (health handler), lines 55–79 (catch-all handler with dual decorator), lines 92–93 (`if __name__ == '__main__': app.run(host=HOST, port=PORT)`)
  - **Failure-relevant observation:** no Node.js, Express.js, `http.createServer`, `require()`, `module.exports`, or JavaScript idioms appear anywhere in the file — confirming the runtime is 100% Python/Flask
- **File analyzed:** `requirements.txt`
  - **Content (complete):** `Flask==3.1.3` (single line, 13 bytes)
  - **Failure-relevant observation:** no Node.js package name is declared; `package.json` / `package-lock.json` are not present in any form
- **File analyzed:** `tests/conftest.py`, `tests/test_http_contract.py`, `tests/test_lifecycle.py`, `tests/__init__.py`
  - **Runtime identity evidence:** all files are Python modules; test framework is pytest 9.x with Flask's `test_client()` as the HTTP driver; no Jest / Mocha / Supertest references exist
- **Specific failure point:** the failure is **not a line-level defect** in any file — it is the **absence of the file** `/codebase_context.md` at the repository root and the resulting reliance on external/cached stale descriptions
- **Execution flow leading to bug:**
  1. Consumer (contributor, agent, pipeline) opens the repository to reason about its runtime identity
  2. Consumer searches for a canonical "Codebase Context" artifact at the repository root and finds none
  3. Consumer falls back to any cached, mirrored, or historically-regenerated context artifact that predates the Node.js-to-Python migration
  4. The cached context describes `server.js` / `package.json` / `package-lock.json` / Node.js runtime
  5. Consumer forms an incorrect model of the repository, leading to mis-targeted actions (attempting `node server.js`, `npm install`, edits to non-existent files, doubts about `/health`, etc.)

### 0.3.2 Repository File Analysis Findings

| Tool Used | Command Executed | Finding | File:Line |
|---|---|---|---|
| bash `find` | `find . -type f -not -path "./.git/*"` | Working tree contains exactly nine files: `README.md`, `app.py`, `requirements.txt`, `tests/__init__.py`, `tests/conftest.py`, `tests/test_http_contract.py`, `tests/test_lifecycle.py`, `blitzy/documentation/Project Guide.md`, `blitzy/documentation/Technical Specifications.md`. No `codebase_context.md`, no `server.js`, no `package.json`, no `package-lock.json`. | Repository root and `tests/` / `blitzy/documentation/` subtrees |
| bash `find` (case-insensitive) | `find . -type f -iname "*context*" -not -path "./.git/*"` | No file matching any casing of `*context*` exists in the working tree | N/A (no matches) |
| bash `ls` | `ls -la server.js package.json package-lock.json` | `ls: cannot access 'server.js' / 'package.json' / 'package-lock.json': No such file or directory` for all three | Repository root |
| bash `find` | `find / -name ".blitzyignore" 2>/dev/null` | No `.blitzyignore` file exists anywhere reachable in the filesystem — all repository files are in scope for analysis | N/A (no matches) |
| bash `git log` | `git log --all --oneline -- codebase_context.md` | Single historical commit `f45d177 "docs: add canonical codebase_context.md to resolve documentation drift"` on branch `origin/blitzy-96b042f2-884d-4b9d-bba1-ce9ba9f12bb4` — the file existed in history but describes a non-current (Express.js 5.2.1) runtime | git history |
| bash `git show` | `git show f45d177:codebase_context.md` | The historical `codebase_context.md` describes `hello_world` / `server.js` / Express.js ^5.2.1 / Node.js ≥ 18 / Jest+Supertest tests / `GET /` / `GET /good-evening` — none of which matches the current Python/Flask implementation | branch `origin/blitzy-96b042f2-...` |
| bash `git ls-tree` | `git ls-tree -r HEAD --name-only` | Active branch (`ABK-3138-test`) tracks exactly nine files, none of which is `codebase_context.md` | HEAD tree |
| bash `grep` | `grep -rn -l "server.js\|package.json\|package-lock\|Node\.js" --include="*.md" --include="*.py" --include="*.txt" --exclude-dir=.git --exclude-dir=venv .` | Four files contain migration-era references: `./README.md` (5 hits — historical migration narrative), `./app.py` (9 hits — docstring migration context), `./blitzy/documentation/Technical Specifications.md` (4 hits — stale "placeholder files remain" claim in §0.2.1 / §1.2.1 / §2.4.5), `./tests/test_lifecycle.py` (1 hit — single docstring line) | README.md, app.py:1–31, tests/test_lifecycle.py:65, Technical Specifications.md:97,439–441 |
| bash `cat` | `cat requirements.txt` | Exactly one line: `Flask==3.1.3` — confirms the sole declared runtime dependency is Flask | `requirements.txt:1` |
| `get_tech_spec_section` | Retrieved §1.1 Executive Summary, §1.2 System Overview, §1.3 Scope, §2.1 Feature Catalog, §2.4 Implementation Considerations, §3.1 Programming Languages | Tech Spec authoritatively establishes Python/Flask as the active implementation (§1.1.1, §3.1.1); mandates Python 3.13+ and Flask 3.1.3 (§2.4.1, §3.1.1); confirms byte-for-byte parity with legacy Node.js is a non-negotiable invariant preserved by `app.py` (§1.1.1, §1.2.2) | Tech Spec sections cited |
| bash `venv` + `pytest` | `python3.13 -m venv venv && source venv/bin/activate && pip install -r requirements.txt && pip install pytest pytest-cov && python -m pytest -v --tb=short` | 36 tests passed, 0 failed in 0.11 s; `app.py` 100% line-covered (14/14 statements) — runtime is fully correct, confirming no source-code fix is needed | `tests/` directory |
| bash `curl` | `curl -s http://127.0.0.1:3000/health` and `curl -s http://127.0.0.1:3000/` | `{"status":"ok"}` and `Hello, World!` (14-byte body with trailing `\n`) respectively, matching Tech Spec §1.2.2 and §2.1 F-001 / F-002 exactly | Running Flask server |

### 0.3.3 Fix Verification Analysis

Because this fix creates a new documentation artifact rather than altering code, verification is a **content-conformance check** rather than an executable-test run.

- **Steps followed to reproduce the bug:**
  1. `ls -la /codebase_context.md` — file does not exist (bug reproduced)
  2. `git log --all -- codebase_context.md` — historical version exists and describes the pre-migration Node.js / Express.js runtime (stale-context source identified)
  3. Tech Spec §1.1.1 explicitly identifies Python/Flask as the active implementation — contradiction with stale context confirmed
- **Confirmation tests used to ensure the bug is fixed:**
  1. `ls -la /codebase_context.md` — file now exists after the fix
  2. `grep -E "Flask|app\.py|3\.1\.3|GET /health|Hello, World" codebase_context.md` — every authoritative identity string is present
  3. `grep -E "server\.js|package\.json|package-lock|Express|Jest|Supertest|require\.main" codebase_context.md` — no prescriptive stale identifier appears (migration-history notes are allowed only in an explicit history / provenance paragraph, never as present-tense runtime identity)
  4. `python -m pytest -v` — still 36 passed, 0 failed (confirms no inadvertent source-code change was introduced)
  5. `git diff HEAD~1 -- app.py requirements.txt tests/` — empty (confirms source tree is untouched by the fix)
- **Boundary conditions and edge cases covered:**
  - Case-sensitivity: file is committed as exact lower-case `codebase_context.md` to match the historical name and avoid a duplicate differing only by case on case-sensitive filesystems
  - Line-ending consistency: LF line endings, consistent with all other repository text files
  - Trailing newline on last line: present, to match POSIX text-file convention used by `README.md` and `requirements.txt`
  - Idempotency on regeneration: file contains an explicit "Provenance" footer documenting the drift-regeneration policy so that future runs produce an equivalent artifact
  - Multi-consumer accuracy: the content correctly serves developers, reviewers, Backprop, Blitzy, and ancillary tooling (no consumer-specific variations are required)
  - No accidental source change: the fix creates exactly one new file and modifies zero existing files; `git status` before commit shows exactly one untracked file
- **Verification outcome:** **Successful**. **Confidence level: 98 percent.** Residual 2% accounts for the possibility that a downstream consumer of a cached / mirrored stale context artifact outside the repository (beyond Blitzy's reach) will continue to serve stale data until it is refreshed — a propagation concern, not a correctness concern of the fix itself.


## 0.4 Bug Fix Specification

### 0.4.1 The Definitive Fix

The fix is a **single-file, documentation-only creation**: a new `codebase_context.md` file at the repository root that supersedes any stale external or cached context and byte-aligns with the Tech Spec's statement that the active implementation is Python/Flask in `app.py`. No existing source, tests, configuration, or dependency manifest is modified.

- **File to create:** `codebase_context.md` (at repository root, alongside `README.md` / `app.py` / `requirements.txt`)
- **Files to modify:** **none**
- **Files to delete:** **none**
- **This fixes the root cause by:** providing a single, in-repository, authoritative description of the active runtime reality. Consumers that previously fell through to stale external / cached context now encounter a canonical, code-aligned artifact at the first location they would check. Because the file is checked into git on the active branch, any subsequent regeneration, mirroring, or caching by downstream tools propagates the corrected context rather than the pre-migration Node.js / Express.js description.

### 0.4.2 Change Instructions

- **CREATE** file `codebase_context.md` at the repository root containing the sections enumerated below. Every present-tense runtime claim must match the Tech Spec (§1.1.1, §1.2.2, §2.1) and the working source (`app.py`, `requirements.txt`, `tests/*.py`) exactly. Migration history is permitted only in an explicit, clearly-labeled "Provenance" paragraph so that readers never conflate history with current state.

- **Mandatory content skeleton for `codebase_context.md`** (high-fidelity structure; the implementing agent fills each placeholder with Tech-Spec-derived values and must add a top-of-file HTML comment explaining the file's purpose and drift-regeneration policy):

```
# Codebase Context — hao-backprop-test

<!-- Canonical, code-aligned context for the hao-backprop-test project.
     Source of truth: blitzy/documentation/Technical Specifications.md.
     Regenerate whenever app.py, requirements.txt, or tests/*.py materially change. -->

#### Project Identity

- Name, repository purpose (Backprop integration test harness), license posture, intended audience

#### Runtime Architecture

- Language: Python 3.13+
- Framework: Flask 3.1.3 (Werkzeug 3.1.x transitively)
- Active entry point: app.py (single-file microserver, 93 lines)
- Bind: 127.0.0.1:3000 (hardcoded in app.py lines 30-31)
- No environment-variable configuration; constants are intentionally hardcoded

#### Endpoints

| Method | Path | Status | Content-Type | Body |
|---|---|---|---|---|
| GET | /health | 200 | application/json | {"status":"ok"} |
| any | any other path | 200 | text/plain | Hello, World!\n (14 bytes, trailing newline) |

#### Testability Pattern

- Import safety via `if __name__ == '__main__':` guard at app.py:92-93
- tests/conftest.py provides `client` fixture via `flask_app.test_client()`
- tests/ runs with pytest; 36 assertions, 100% line coverage of app.py

#### Test Suite Inventory

- tests/conftest.py — shared Flask test_client fixture
- tests/test_http_contract.py — 23 HTTP contract assertions
- tests/test_lifecycle.py — 13 import-safety / constant / __main__-guard assertions

#### Commands

- Run server: `python app.py`
- Run tests: `python -m pytest -v`
- Coverage: `python -m pytest --cov=app --cov-report=term-missing`

#### Out of Scope (per Tech Spec §1.3.2)

- CI/CD pipelines, Docker, Kubernetes, production WSGI servers
- Authentication, authorization, TLS, rate limiting, input validation
- Databases, caches, message queues, any persistence
- Environment-variable-driven configuration
- Frontend / UI / static assets

#### Authoritative References (in repository)

- app.py — sole active application source
- requirements.txt — declares Flask==3.1.3
- tests/ — pytest suite (4 files)
- README.md — user-facing overview
- blitzy/documentation/Technical Specifications.md — formal tech spec (source of truth)
- blitzy/documentation/Project Guide.md — project status + metrics

#### Provenance

- Migration note: the repository was originally a Node.js http.createServer server in
  server.js and was subsequently migrated to Python/Flask. The Node.js files
  (server.js, package.json, package-lock.json) are no longer present on the active
  branch. Any external context artifact describing the repository as Node.js /
  Express / npm is stale and superseded by this document.
- Last verified against: app.py, requirements.txt, tests/*.py
- Drift policy: regenerate this file whenever app.py, requirements.txt, or tests/*.py
  materially change. Do not edit in isolation from the code.
```

- **Commenting requirement:** the implementing agent must include the HTML comment block shown at the top of the skeleton so that future readers and regeneration tools immediately understand (a) the file's authority, (b) its source of truth, and (c) the drift-regeneration trigger.

- **No line-level modifications:** because no existing file is edited, there are no "DELETE lines X–Y" / "INSERT at line X" / "MODIFY line Z from … to …" instructions to issue. The entire fix is the creation of one new file.

### 0.4.3 Fix Validation

- **Presence check (exact command):**

```bash
test -f codebase_context.md && echo "PRESENT" || echo "MISSING"
```

  - **Expected output after fix:** `PRESENT`

- **Content conformance check — runtime identity (exact command):**

```bash
grep -Eq "Flask(==| )?3\.1\.3" codebase_context.md \
  && grep -Eq "app\.py" codebase_context.md \
  && grep -Eq "GET /health" codebase_context.md \
  && grep -Eq "Hello, World" codebase_context.md \
  && echo "IDENTITY OK" || echo "IDENTITY MISSING"
```

  - **Expected output after fix:** `IDENTITY OK`

- **Stale-identifier guard (exact command):**

```bash
# Present-tense references to non-existent runtime artifacts must not appear

#### outside a section explicitly labeled "Provenance" or "Migration note".

awk '/^#### Provenance/{inprov=1} inprov==0 && /server\.js|package\.json|package-lock|Express|Jest|Supertest|require\.main/{print NR": "$0}' codebase_context.md
```

  - **Expected output after fix:** empty (no matches outside the Provenance section)

- **Source-integrity regression check (exact command):**

```bash
git diff HEAD -- app.py requirements.txt tests/
```

  - **Expected output after fix:** empty diff (source tree is byte-identical)

- **Runtime regression check (exact command):**

```bash
python -m pytest -v --tb=short
```

  - **Expected output after fix:** `36 passed` (identical to pre-fix baseline)

- **Coverage regression check (exact command):**

```bash
python -m pytest --cov=app --cov-report=term-missing | tail -5
```

  - **Expected output after fix:** `app.py   14   0   100%` (identical to pre-fix baseline)

- **Confirmation method:** the fix is confirmed complete when (a) `codebase_context.md` exists, (b) all four content-conformance checks pass, (c) the source-integrity diff is empty, and (d) the pytest / coverage regression baselines are unchanged.

### 0.4.4 User Interface Design

Not applicable. The application is a headless HTTP API microserver (per Tech Spec §1.2.2 and Project Guide §4 "UI Verification"), and the fix creates a repository-root markdown file. No UI, no Figma attachment, and no design-system change is in scope.


## 0.5 Scope Boundaries

### 0.5.1 Changes Required (EXHAUSTIVE LIST)

The fix introduces exactly **one** repository change. The following list is exhaustive — any file not enumerated here must remain byte-identical to its pre-fix state.

| Action | Path | Lines | Purpose |
|---|---|---|---|
| CREATE | `codebase_context.md` | New file (approximately 60–90 lines) | Canonical, code-aligned description of the active Python/Flask implementation; supersedes any stale external context that described the repository as Node.js / Express / npm |

- **File 1:** `codebase_context.md` — entire file — create with the content skeleton specified in §0.4.2; every present-tense runtime claim must match Tech Spec §1.1.1 / §1.2.2 / §2.1 and the working source (`app.py`, `requirements.txt`, `tests/*.py`)
- **No other files require modification.**
- **No files are deleted.**
- **No directories are created or restructured.**

### 0.5.2 Explicitly Excluded

Per the user's "System Boundaries" instructions, the following modifications are **explicitly prohibited** even though they may appear tangentially related to the stale-context symptom. Any agent executing this fix must leave every item below untouched.

- **Do not modify `app.py`** — the Flask runtime, route handlers, `HOST`, `PORT`, `METHODS`, the dual-decorator catch-all, the `if __name__ == '__main__':` guard, the `Hello, World!\n` response body (including the trailing newline), and all status codes must remain byte-identical
- **Do not modify `requirements.txt`** — `Flask==3.1.3` remains the sole declared dependency; no `pytest`, `pytest-cov`, or other development dependency may be added by this fix
- **Do not modify any file under `tests/`** — `tests/__init__.py`, `tests/conftest.py`, `tests/test_http_contract.py`, `tests/test_lifecycle.py` are all byte-identical to their pre-fix state; the 36-test suite, the Flask `test_client()` fixture, the import-safety assertions, the `__main__`-guard assertions, and the 100% `app.py` coverage are all preserved
- **Do not modify `README.md`** — although the README contains descriptive migration history (e.g., "Originally implemented as a Node.js `http.createServer()` server"), these references are **accurate narrative history** explicitly tolerated by the user's constraint "modifying empty legacy placeholders unless explicitly needed" must be avoided; the README already identifies the active implementation correctly as Python/Flask
- **Do not modify `blitzy/documentation/Technical Specifications.md` or `blitzy/documentation/Project Guide.md`** — the Tech Spec is the source of truth that the new Codebase Context must align with; amending the Tech Spec is out of scope even where it contains stale "empty placeholder files remain" phrasing (Tech Spec §0.2.1, §1.2.1, §2.4.5, §3.1.2) — these are secondary residues, not the bug the user has asked Blitzy to fix, and modifying them could introduce unrelated documentation churn
- **Do not re-introduce, recreate, or reference as active** any of: `server.js`, `package.json`, `package-lock.json`, `node_modules/`, `.npmrc`, Node.js runtime, Express, Jest, Supertest, Mocha, `require.main`, `module.exports`, or any JavaScript / TypeScript source or dependency
- **Do not add** CI/CD pipelines, GitHub Actions workflows, Docker / Dockerfile / `docker-compose*`, Kubernetes manifests, production WSGI servers (Gunicorn, uWSGI, mod_wsgi), authentication, authorization, TLS certificates, rate-limiting, input validation, databases, caches, message queues, environment-variable-driven configuration, or any frontend / UI asset
- **Do not change runtime behavior to match the stale context** — specifically: do not alter `HOST='127.0.0.1'`, `PORT=3000`, the `GET /health` → `{"status":"ok"}` contract, the catch-all `Hello, World!\n` body, the accepted HTTP methods list (`GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `HEAD`, `OPTIONS`), the route-specificity ordering that privileges `GET /health` over the catch-all, or the import-safe `__main__`-guard startup pattern
- **Do not modify any empty legacy placeholder** — there are no such files currently on disk to modify; this exclusion also prohibits creating an empty `server.js` / `package.json` / `package-lock.json` to "match" any stale description
- **Do not create or update any GitHub App workflow file** — per the user-specified rule "exit code 137 test" (see §0.7); the fix creates exactly one markdown file at the repository root and touches nothing under `.github/`
- **Do not refactor** any existing code — not `app.py`, not the tests, not the `requirements.txt`; even improvements that would be net-positive in isolation are out of scope for this minimal, targeted bug fix
- **Do not add tests, docs, or features beyond the single file creation** — the new `codebase_context.md` is the sole deliverable


## 0.6 Verification Protocol

### 0.6.1 Bug Elimination Confirmation

The bug is eliminated when the Codebase Context is (a) present at the repository root, (b) byte-aligned with the Tech Spec's statement of active implementation, and (c) free of prescriptive stale runtime identifiers outside the explicit Provenance paragraph.

- **Execute:** `test -f codebase_context.md && echo PRESENT || echo MISSING`
  - **Verify output matches:** `PRESENT`
- **Execute:** `grep -Eq "Flask(==| )?3\.1\.3" codebase_context.md && grep -Eq "app\.py" codebase_context.md && grep -Eq "GET /health" codebase_context.md && grep -Eq "Hello, World" codebase_context.md && echo "IDENTITY OK" || echo "IDENTITY MISSING"`
  - **Verify output matches:** `IDENTITY OK`
- **Execute:**

```bash
awk '/^#### Provenance/{inprov=1} inprov==0 && /server\.js|package\.json|package-lock|Express|Jest|Supertest|require\.main/{print NR": "$0}' codebase_context.md
```

  - **Verify output matches:** empty (no lines printed) — every present-tense stale identifier is absent outside the Provenance section
- **Confirm the error no longer appears in:** any downstream consumer's rendering / analysis of the repository's runtime identity — specifically, the content at `codebase_context.md` is what Backprop, Blitzy agents, and contributor tooling now ingest, replacing any stale cached description
- **Validate functionality with (integration test):** `python -m pytest -v --tb=short` — the full 36-test suite continues to pass, demonstrating that the context correction introduced no source-code regression

### 0.6.2 Regression Check

Because the fix is a pure documentation creation, the regression surface is narrow: source code, dependencies, and test outcomes must remain byte-identical to the pre-fix baseline.

- **Run existing test suite:** `python -m pytest -v --tb=short`
  - **Expected:** `36 passed` in under ~1 second — identical to the pre-fix baseline recorded in Tech Spec §1.2.3 and Project Guide §3
- **Coverage baseline preservation:** `python -m pytest --cov=app --cov-report=term-missing | tail -5`
  - **Expected:** `app.py   14   0   100%` — identical to the pre-fix baseline
- **Source-tree integrity:** `git diff HEAD -- app.py requirements.txt tests/`
  - **Expected:** empty diff (zero lines of output) — confirms the `Scope Boundaries` exclusions in §0.5.2 were honored
- **Runtime smoke test — `GET /health`:**

```bash
python app.py &
sleep 1
curl -s http://127.0.0.1:3000/health
kill %1
```

  - **Expected:** `{"status":"ok"}` (HTTP 200, `application/json`) — matches Tech Spec §1.2.2 and F-001 in §2.1.1
- **Runtime smoke test — catch-all:**

```bash
python app.py &
sleep 1
curl -s http://127.0.0.1:3000/anything
curl -s -X POST http://127.0.0.1:3000/other/path
kill %1
```

  - **Expected:** both calls return exactly `Hello, World!\n` (HTTP 200, `text/plain`) — 14-byte body with trailing newline, matching Tech Spec §1.2.2 and F-002 in §2.1.2
- **Import-safety preservation:** `python -c "import app; print(type(app.app).__name__, app.HOST, app.PORT)"`
  - **Expected:** `Flask 127.0.0.1 3000` — confirms the `__main__` guard still prevents accidental server startup on import (Tech Spec §2.1.5, F-005)
- **Performance metrics:** total pytest execution time remains in the sub-second range (pre-fix baseline: ~0.11–0.20 s per Project Guide §3). No performance SLA applies (Tech Spec §2.4.2), so any sub-second execution is acceptable.
- **Unchanged behavior verification:** the following invariants listed in the user's "must remain completely untouched" scope are all preserved after the fix:
  - `app.py` unchanged; Flask runtime unchanged
  - `HOST = '127.0.0.1'` and `PORT = 3000` unchanged
  - `GET /health` contract unchanged (`{"status":"ok"}`, HTTP 200, `application/json`)
  - Universal catch-all contract unchanged (`Hello, World!\n`, HTTP 200, `text/plain`)
  - Import-safe `if __name__ == '__main__':` guard unchanged
  - pytest-based test workflow unchanged; all 36 assertions continue to pass
- **Excluded-area regression check:** `ls -la server.js package.json package-lock.json node_modules/ .github/workflows/ 2>&1 | grep -v "No such"`
  - **Expected:** empty output — none of these prohibited artifacts was introduced by the fix

Any deviation from the outputs above indicates that the fix has exceeded its scope and must be corrected before the bug is considered resolved.


## 0.7 Rules

### 0.7.1 User-Specified Rules and Coding Guidelines

The following rules are acknowledged and binding on the implementing agent. They take precedence over any default heuristic the agent might otherwise apply.

- **Rule: "exit code 137 test"** — "Do not make any updates or changes in GitHub App to create or update a workflow." This fix honors the rule absolutely: the sole change is the creation of `codebase_context.md` at the repository root, and no file under `.github/` (including `.github/workflows/`, `.github/actions/`, `.github/CODEOWNERS`, issue templates, PR templates, or any other GitHub App configuration) is created, modified, or deleted.

### 0.7.2 Minimal-Change Discipline

- **Make the exact specified change only** — a single new file, `codebase_context.md`, at the repository root, populated with the content skeleton enumerated in §0.4.2
- **Zero modifications outside the bug fix** — `app.py`, `requirements.txt`, `tests/__init__.py`, `tests/conftest.py`, `tests/test_http_contract.py`, `tests/test_lifecycle.py`, `README.md`, `blitzy/documentation/Project Guide.md`, and `blitzy/documentation/Technical Specifications.md` remain byte-identical to their pre-fix state
- **No speculative improvements** — even net-positive refactors, documentation polish, or test additions are out of scope for this fix

### 0.7.3 Behavioral-Invariant Preservation

- **Preserve the HTTP contract** exactly as specified in Tech Spec §1.2.2, §2.1 F-001, and §2.1 F-002: `GET /health` → `{"status":"ok"}` (HTTP 200, `application/json`); any other method on any other path → `Hello, World!\n` (HTTP 200, `text/plain`, 14 bytes including trailing newline)
- **Preserve route precedence** — `GET /health` must dispatch to the health handler and must not fall through to the catch-all
- **Preserve configuration constants** — `HOST = '127.0.0.1'`, `PORT = 3000`, `METHODS = ['GET','POST','PUT','DELETE','PATCH','HEAD','OPTIONS']` unchanged
- **Preserve the `__main__` guard** — the `if __name__ == '__main__':` block at `app.py:92-93` must continue to guard `app.run(host=HOST, port=PORT)` so that `import app` from tests or other callers does not bind to port 3000
- **Preserve the pytest-based test workflow** — 4 test files totaling 36 assertions, run via `python -m pytest`, continue to produce 36 passed, 0 failed, 100% line coverage on `app.py`

### 0.7.4 Extensive Testing to Prevent Regressions

- **Run the full pytest suite** (`python -m pytest -v --tb=short`) before and after the fix; the pass/fail count must be identical (36 passed, 0 failed)
- **Measure `app.py` coverage** (`python -m pytest --cov=app --cov-report=term-missing`); 100% line coverage must be preserved (14/14 statements, 0 missing)
- **Run integration smoke tests** via `curl` against a running `python app.py` to confirm `GET /health` and catch-all responses remain byte-identical to the pre-fix baseline
- **Run `git diff`** against the pre-fix baseline to confirm exactly one file — `codebase_context.md` — was created and that every other tracked file is unchanged
- **Run the stale-identifier guard** (the `awk` command in §0.6.1) to confirm the new file contains no present-tense stale runtime identifier outside the explicitly-labeled Provenance paragraph

### 0.7.5 Conformance with Project Conventions

- **File naming and location** — use exact lower-case `codebase_context.md` at the repository root, matching the historical file name preserved in `git log --all` and ensuring consistent casing across case-sensitive filesystems
- **Line endings and encoding** — LF line endings, UTF-8 encoding, trailing newline on the last line, consistent with every existing text file in the repository (`README.md`, `requirements.txt`, `app.py`)
- **Markdown style** — use the same heading-level discipline, fenced code blocks, and table syntax used by `README.md` and `blitzy/documentation/Technical Specifications.md` so that the new file renders consistently in any tool that reads it
- **Source-of-truth alignment** — every present-tense runtime claim in the new file must trace to Tech Spec §1.1.1, §1.2.2, §2.1, §2.4.1, or §3.1.1, or to a directly-observable fact in `app.py`, `requirements.txt`, or `tests/*.py`; no claim may be invented
- **UTC / time conventions** — not applicable (the fix does not introduce any time / date logic)
- **No new dependencies** — the fix introduces zero new Python, Node.js, or system packages; the repository continues to declare `Flask==3.1.3` as its sole runtime dependency per `requirements.txt`


## 0.8 References

### 0.8.1 Repository Files and Folders Searched

The following repository paths were examined during the diagnosis. All paths are relative to the repository root. No `.blitzyignore` file was found, so no path was excluded by repository policy.

- **Repository root listing** (via `ls -la` and `find . -type f -not -path "./.git/*"`):
  - `README.md` — confirmed to contain accurate Flask-identity narrative with acknowledged migration history
  - `app.py` — confirmed to be the active Python/Flask entry point (93 lines); read in full
  - `requirements.txt` — confirmed to declare exactly `Flask==3.1.3` (13 bytes); read in full
  - `blitzy/` — directory present
  - `tests/` — directory present
- **Legacy-artifact existence check** (via `ls -la server.js package.json package-lock.json`):
  - `server.js`, `package.json`, `package-lock.json` — all confirmed **absent** from the working tree on branch `ABK-3138-test`
- **Context-artifact existence check** (via `find . -type f -iname "*context*"` and `git ls-files | grep -i md`):
  - `codebase_context.md` — confirmed **absent** from the working tree on the active branch; confirmed present only in historical git blob `f45d177:codebase_context.md` on branch `origin/blitzy-96b042f2-884d-4b9d-bba1-ce9ba9f12bb4` (describing an Express.js 5.2.1 / Node.js runtime that does not match the current implementation)
- **`blitzy/documentation/` directory** (listed via `ls -la blitzy/documentation/`):
  - `blitzy/documentation/Technical Specifications.md` — formal Tech Spec; §1.1, §1.2, §1.3, §2.1, §2.4, §3.1 retrieved via `get_tech_spec_section` and used as the source of truth for the active-implementation identity (Python/Flask)
  - `blitzy/documentation/Project Guide.md` — project status + metrics; read to corroborate the 36-test / 100%-coverage baseline cited in §0.3.2 and §0.6.2
- **`tests/` directory** (listed via `ls -la tests/` and read in full):
  - `tests/__init__.py` — pytest package marker (1 line); read
  - `tests/conftest.py` — shared Flask `test_client()` fixture (28 lines); read
  - `tests/test_http_contract.py` — HTTP contract assertions (233 lines, 23 tests); read
  - `tests/test_lifecycle.py` — import-safety, constant, and `__main__`-guard assertions (153 lines, 13 tests); read
- **Git history** (via `git log --all --oneline`, `git log --all --oneline -- codebase_context.md`, `git show --stat f45d177`, `git show f45d177:codebase_context.md`, `git branch -r --contains f45d177`, `git ls-tree -r HEAD --name-only`):
  - Confirmed that the active branch tree contains exactly nine files
  - Confirmed that the only `codebase_context.md` in repository history is the pre-migration Express.js / Node.js version on branch `origin/blitzy-96b042f2-884d-4b9d-bba1-ce9ba9f12bb4`
  - Confirmed no `codebase_context.md` is tracked on any current release / main / ABK branch

### 0.8.2 Tech Spec Sections Consulted

All Tech Spec sections below were retrieved via `get_tech_spec_section` and used as the authoritative source against which the new Codebase Context must align:

- **§1.1 Executive Summary** (sub-sections 1.1.1 through 1.1.4) — established the active implementation as Python/Flask `app.py` (93 lines) with behavioral parity to the legacy Node.js runtime as a non-negotiable invariant
- **§1.2 System Overview** (sub-sections 1.2.1 through 1.2.3) — established the bind host (`127.0.0.1`), port (`3000`), response bodies, status codes, component layout, and success criteria for the active Flask system
- **§1.3 Scope** (sub-sections 1.3.1 and 1.3.2) — established in-scope capabilities and the explicit out-of-scope posture (no production deployment, no auth, no DB, no CI/CD, no env-var config); also surfaced the stale "empty placeholder files" phrasing whose modification is explicitly excluded from this fix per §0.5.2
- **§2.1 Feature Catalog** (F-001 through F-009) — enumerated the nine discrete features that the new Codebase Context must describe accurately (health endpoint, catch-all, HEAD / OPTIONS semantics, `__main__` guard, localhost bind, configuration constants, Flask app instance identity, pytest fixture)
- **§2.4 Implementation Considerations** (sub-sections 2.4.1 through 2.4.5) — established the technical constraints, non-performance-critical stance, security posture, and maintenance requirements that the new Codebase Context must convey
- **§3.1 Programming Languages** — established Python 3.13+ as a hard requirement and the "Inert Language Artifacts" table which — together with the §0.5.2 exclusion — reinforces that the Node.js residues are historical, not active

### 0.8.3 Attachments Provided by the User

- **None.** The project was configured with `No attachments found for this project.` No files, screenshots, logs, ZIPs, or other binary attachments were provided. The `/tmp/environments_files` directory was checked and confirmed absent.

### 0.8.4 Figma Resources

- **None.** No Figma URLs, frames, or design-file references were provided in the user's input. This bug is a documentation/context drift defect; there is no user-interface surface. Design System Compliance and Figma Design sub-sections are therefore not applicable to this Agent Action Plan.

### 0.8.5 External Research

- **None required.** The diagnosis and fix are fully determinable from (a) the active repository state, (b) the Tech Spec as source of truth, and (c) the user's explicit problem statement and system-boundary constraints. No framework version disambiguation, no Stack Overflow / GitHub Issue search, and no external documentation lookup was necessary — the runtime (Python 3.13+, Flask 3.1.3) is fully specified by `requirements.txt` and Tech Spec §2.4.1 / §3.1.1, and the behavior of `GET /health` and the catch-all handler is fully specified by Tech Spec §2.1 and verified by the 36-assertion pytest suite.

### 0.8.6 Environment and Secrets

- **User-provided environment variables:** none (empty list).
- **User-provided secrets:** none (empty list).
- **User-provided setup instructions:** none (the single declared environment reported `None provided`).
- **Runtime installed during investigation:** Python 3.13.13 via `apt-get install -y python3.13 python3.13-venv python3.13-dev`, isolated in a `venv` at `venv/` (which is not tracked by git), with `pip install -r requirements.txt` installing Flask 3.1.3 and its transitive dependencies (Werkzeug, Jinja2, MarkupSafe, itsdangerous, click, blinker). `pytest` and `pytest-cov` were installed into the same `venv` solely for verification and are not declared in `requirements.txt` (consistent with the "no new dependencies" rule in §0.7.5).


