# Plan: codex-auth-isolation-discovery

**Execution mode:** interactive

## Goal

Produce a documentation-only runbook + findings that specify how to isolate `codex` auth/config/state so two different accounts can run `codex` concurrently without cross-account corruption.

## Decision Confirmation Table

| Decision | Chosen option | Source |
|---|---|---|
| Execution mode | `interactive` | `spec.md` **Type:** + user chat (2026-01-29) |
| Tool installs | Allowed on both OSes | user chat (2026-01-29) |
| Privilege | Assume `sudo` on both OSes | user chat (2026-01-29) |
| macOS tracing tool | `fs_usage` | user chat (2026-01-29) |
| `codex` build identifier | `codex --version` (fallback `codex version`) | user chat (2026-01-29) |
| OS targets | WSL2 Ubuntu 24.04 LTS + macOS current major | `spec.md` + user chat (2026-01-29) |

## Safety / Redaction Rules (must-follow)

- Do not paste tokens, cookies, or auth headers into any repo file.
- Prefer storing raw traces under `/tmp/` and only summarize in `spec.md`.
- If a trace contains secrets, delete the raw trace file after extracting path info.
- Do not include paths that reveal personal usernames if avoidable; prefer `$HOME/...` form in findings.

## Context Read Ledger

- `docs-ai/docs/initiatives/swop/features/cli-wrapper/work-items/codex-auth-isolation-discovery/spec.md` — scope + acceptance criteria to satisfy.
- `docs-ai/docs/initiatives/swop/features/cli-wrapper/overview.md` — status table to update when complete.
- `docs-ai/docs/initiatives/delivery-map.md` — work queue line to prefix with **DONE** when complete.
- `docs-ai/docs/roadmap.md` — wave context (WSL/mac; CLI-only).

## Task 1: Create a local scratch area (both OSes)

**Goal:** Ensure all tracing output is kept out of git by default.

**Steps:**
1. Create a per-run scratch directory under `/tmp`:
   - Run: `export SWOP_TRACE_ROOT="/tmp/swop-codex-auth-isolation-$(date +%Y%m%d-%H%M%S)"`
   - Run: `mkdir -p "$SWOP_TRACE_ROOT"`
2. Create per-account roots (A/B) under the scratch directory:
   - Run: `mkdir -p "$SWOP_TRACE_ROOT"/{acctA,acctB}/{home,config,state,data,cache,logs}`

**Verify:**
- Run: `ls -la "$SWOP_TRACE_ROOT"`
- Expected: `acctA/` and `acctB/` directories exist.

## Task 2: Capture “Tested on” metadata (both OSes)

**Goal:** Fill `spec.md` “Tested on” block accurately and reproducibly.

**Steps (WSL2 Ubuntu):**
1. Run: `cat /etc/os-release`
2. Run: `uname -a`
3. Run: `codex --version || codex version`

**Steps (macOS):**
1. Run: `sw_vers`
2. Run: `uname -a`
3. Run: `codex --version || codex version`

**Verify:**
- You have the exact stdout for each command saved to notes in `$SWOP_TRACE_ROOT/logs/` (copy/paste to a local text file).

## Task 3: Install tracing tools (only if missing)

### 3A: WSL2 Ubuntu — `strace`

**Steps:**
1. Run: `command -v strace || (sudo apt-get update && sudo apt-get install -y strace)`

**Verify:**
- Run: `strace -V`
- Expected: Prints a version and exits 0.

### 3B: macOS — `fs_usage`

**Steps:**
1. Run: `command -v fs_usage`

**Verify:**
- Expected: A path is printed (typically `/usr/sbin/fs_usage`).

## Task 4: Define the candidate isolation environments (both OSes)

**Goal:** Establish the “candidate env var set” to test for per-account isolation.

**Steps:**
1. For Account A, define environment variables:
   - `export HOME="$SWOP_TRACE_ROOT/acctA/home"`
   - `export XDG_CONFIG_HOME="$SWOP_TRACE_ROOT/acctA/config"`
   - `export XDG_STATE_HOME="$SWOP_TRACE_ROOT/acctA/state"`
   - `export XDG_DATA_HOME="$SWOP_TRACE_ROOT/acctA/data"`
   - `export XDG_CACHE_HOME="$SWOP_TRACE_ROOT/acctA/cache"`
2. For Account B, define the same variables pointing at `acctB/...`.

**Verify:**
- Run (A shell): `env | rg '^HOME=|^XDG_(CONFIG|STATE|DATA|CACHE)_HOME='`
- Expected: All values point inside `$SWOP_TRACE_ROOT/acctA/...`.

## Task 5: Trace `codex login` file activity (WSL2 Ubuntu)

**Goal:** Identify file paths `codex login` reads/writes on WSL2.

**Steps:**
1. In a dedicated shell for Account A (env vars set), run:
   - `strace -ff -o "$SWOP_TRACE_ROOT/logs/wsl-acctA-login.strace" -e trace=%file codex login`
2. Complete interactive login as prompted, then exit.
3. Repeat for Account B:
   - `strace -ff -o "$SWOP_TRACE_ROOT/logs/wsl-acctB-login.strace" -e trace=%file codex login`

**Verify:**
- Run: `ls -la "$SWOP_TRACE_ROOT/logs/" | rg 'wsl-acct(A|B)-login\\.strace'`
- Expected: One or more `*.strace.<pid>` files exist for each account.

## Task 6: Trace a normal `codex` session (WSL2 Ubuntu)

**Goal:** Identify file paths touched during an actual `codex` run (not just login).

**Steps:**
1. In Account A shell, run:
   - `strace -ff -o "$SWOP_TRACE_ROOT/logs/wsl-acctA-run.strace" -e trace=%file codex`
2. In the `codex` UI, perform a minimal “real” action that requires auth (e.g., start a session/prompt) and then exit.
3. Repeat for Account B:
   - `strace -ff -o "$SWOP_TRACE_ROOT/logs/wsl-acctB-run.strace" -e trace=%file codex`

**Verify:**
- Both `wsl-acctA-run.strace.*` and `wsl-acctB-run.strace.*` exist.

## Task 7: Trace `codex login` file activity (macOS)

**Goal:** Identify file paths `codex login` reads/writes on macOS.

**Steps:**
1. Open two Terminal windows (or tabs):
   - Terminal 1: tracing
   - Terminal 2: run `codex`
2. In Terminal 2, set Account A env vars (from Task 4).
3. In Terminal 1, start tracing and save output:
   - Run: `sudo fs_usage -w -f filesystem codex 2>&1 | tee "$SWOP_TRACE_ROOT/logs/macos-acctA-login.fs_usage.log"`
4. In Terminal 2, run `codex login`, complete login, then exit.
5. Stop tracing in Terminal 1 (`Ctrl+C`).
6. Repeat steps 2–5 for Account B, writing to:
   - `"$SWOP_TRACE_ROOT/logs/macos-acctB-login.fs_usage.log"`

**Verify:**
- Run: `ls -la "$SWOP_TRACE_ROOT/logs/" | rg 'macos-acct(A|B)-login\\.fs_usage\\.log'`
- Expected: Both log files exist and are non-empty.

## Task 8: Trace a normal `codex` session (macOS)

**Goal:** Identify file paths touched during an actual `codex` run (not just login) on macOS.

**Steps:**
1. Repeat Task 7, but run `codex` (not `codex login`) for Account A and save to:
   - `"$SWOP_TRACE_ROOT/logs/macos-acctA-run.fs_usage.log"`
2. Repeat for Account B, save to:
   - `"$SWOP_TRACE_ROOT/logs/macos-acctB-run.fs_usage.log"`

**Verify:**
- All four macOS logs exist (`login` + `run` for A/B).

## Task 9: Extract path findings (WSL2 + macOS)

**Goal:** Build a concise list of paths and decide what must be isolated.

**Steps (WSL2):**
1. Extract candidate paths touched (best-effort) from strace logs:
   - Run: `rg -h 'openat\\(|open\\(|stat\\(|lstat\\(|access\\(|readlink\\(' "$SWOP_TRACE_ROOT/logs/"wsl-*.strace* > "$SWOP_TRACE_ROOT/logs/wsl-filecalls.txt" || true`
2. Extract quoted paths:
   - Run: `rg -o '\"/[^\" ]+' "$SWOP_TRACE_ROOT/logs/wsl-filecalls.txt" | sort -u > "$SWOP_TRACE_ROOT/logs/wsl-paths.txt"`
3. Manually review `wsl-paths.txt` and classify into:
   - Auth/config/state/cache that must be isolated
   - Read-only OS paths (ignore)
   - “Surprising” global writes (must call out in limitations)

**Steps (macOS):**
1. Grep likely filesystem-path lines:
   - Run: `rg -n '/(Users|var|private|tmp)/' "$SWOP_TRACE_ROOT/logs/"macos-*.fs_usage.log > "$SWOP_TRACE_ROOT/logs/macos-path-lines.txt" || true`
2. Manually review and classify similarly to WSL2.

**Verify:**
- You can point to a short list of “must isolate” locations per OS.
- You have at least one example line per location showing a read or write.

## Task 10: Concurrency validation (defined scenario)

**Goal:** Demonstrate two already-authenticated accounts can run `codex` concurrently without cross-account corruption.

**Steps (WSL2):**
1. Ensure Account A and B have completed login (Task 5).
2. In two separate terminals:
   - Terminal A: Account A env vars; run `codex`
   - Terminal B: Account B env vars; run `codex`
3. Use `ls -R` (or `find`) on `$SWOP_TRACE_ROOT/acctA` and `$SWOP_TRACE_ROOT/acctB` before and after to see which trees changed.

**Steps (macOS):**
1. Repeat the same two-terminal approach with A/B env vars.
2. If `fs_usage` output is too noisy, do the “before/after tree” check and document it as supporting evidence.

**Verify:**
- A/B runs only write inside their own sandbox roots, OR any unavoidable global writes are explicitly listed in “Limitations”.

## Task 11: Write the runbook + findings into `spec.md`

**Files:**
- Modify: `docs-ai/docs/initiatives/swop/features/cli-wrapper/work-items/codex-auth-isolation-discovery/spec.md`

**Steps:**
1. Add a “Tested on” section with the captured OS + `codex` version outputs.
2. Add a “Runbook” section with the final commands (cleaned up, minimal).
3. Add a “Findings” section with per-OS tables/lists:
   - Paths written during `codex login`
   - Paths written during normal `codex` runs
   - Required env vars (minimum set) + rationale
4. Add “Limitations” covering any global state that cannot be isolated.
5. Tick the acceptance criteria checkboxes that are now satisfied.

**Verify:**
- `spec.md` now contains enough detail that another engineer could reproduce the discovery.

## Task 12: Mark work item complete in docs (when appropriate)

**Files:**
- Modify: `docs-ai/docs/initiatives/swop/features/cli-wrapper/work-items/codex-auth-isolation-discovery/spec.md`
- Modify: `docs-ai/docs/initiatives/swop/features/cli-wrapper/overview.md`
- Modify: `docs-ai/docs/initiatives/delivery-map.md`

**Steps:**
1. Set `spec.md` status to `done`.
2. Update the row for `swop/cli-wrapper/codex-auth-isolation-discovery` in the feature work items table to `done`.
3. In `delivery-map.md`, prefix the matching line with `**DONE**` (leave ⛔ as-is).

**Verify:**
- `rg -n 'codex-auth-isolation-discovery' docs-ai/docs/initiatives/{delivery-map.md,swop/features/cli-wrapper/overview.md,swop/features/cli-wrapper/work-items/codex-auth-isolation-discovery/spec.md}` shows consistent status.

## Task 13: Final quality check + single commit

**Steps:**
1. Ensure no secrets are present in tracked files:
   - Run: `rg -n \"(sk-|sess-|Authorization:|bearer )\" docs-ai/docs || true`
2. Check git diff looks like docs only:
   - Run: `git diff --stat`
3. Commit once at the end:
   - Run: `git add docs-ai/docs/initiatives/swop/features/cli-wrapper/work-items/codex-auth-isolation-discovery/spec.md docs-ai/docs/initiatives/swop/features/cli-wrapper/overview.md docs-ai/docs/initiatives/delivery-map.md`
   - Run: `git commit -m \"docs(swop): complete codex auth isolation discovery\"`

**Verify:**
- `git status` is clean.
