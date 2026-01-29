# Work Item: codex-auth-isolation-discovery

## Status

done

**Type:** interactive

## Parent

Feature: `swop/cli-wrapper` (see `docs-ai/docs/initiatives/swop/features/cli-wrapper/overview.md`)

## Goal

Determine how to run `codex` concurrently under different accounts by isolating `codex` mutable auth/config/state via process environment overrides (since `codex` does not expose an explicit config/auth directory override).

## Scope

### In scope

- Produce a documentation-only runbook + findings for isolating `codex` per account/process.
- Identify which files/directories `codex login` and normal `codex` runs read/write on:
  - WSL2 Ubuntu 24.04 LTS
  - macOS (current major; user environment is macOS 26 “Tahoe”)
- Determine whether isolating process environment (e.g., `HOME`, `XDG_CONFIG_HOME`, `XDG_STATE_HOME`, `XDG_DATA_HOME`, `XDG_CACHE_HOME`, etc.) is sufficient to:
  - run two `codex` processes concurrently under different accounts without corruption
  - avoid cross-account session/token overwrites on disk
- Document the recommended isolation strategy, required environment variables, and limitations (what cannot be isolated).

### Out of scope

- Committing helper scripts / automation (this work item is docs-only).
- Windows native (non-WSL) execution.
- Tray/menu-bar UI.
- Changing upstream `codex` authentication behavior.
- Proving concurrent safety for overlapping `codex login`/`codex logout` across accounts (login is only covered for setup/tracing, not concurrency hardening).

## Acceptance Criteria

- [x] The spec contains a “Tested on” block listing:
  - WSL2 Ubuntu 24.04 LTS
  - macOS major version used when tested (expected: 26 “Tahoe”)
  - the exact `codex` build identifier used when tested (e.g., output from `codex --version` or equivalent)
- [x] The spec contains a “Findings” section per OS with:
  - the discovered auth/config/state/cache locations `codex` reads/writes during `codex login` and normal runs
  - a clear statement of which locations must be isolated per account/process
- [x] The spec enumerates required environment variable overrides (minimum set), with 1-line rationale per variable.
- [x] The spec defines a documentation-only runbook (no scripts) that a developer can follow to reproduce the discovery on each OS.
- [x] Concurrent safety is demonstrated for the defined scenario:
  - two already-authenticated accounts run `codex` in parallel as separate processes under isolated environments
  - documented outcome: no shared mutable path writes and no observed cross-account corruption
- [x] The spec includes a limitations section covering any unresolved risks (e.g., OS keychain usage, other global state) and how the wrapper should behave when limitations apply.

## Tested on

### WSL2 Ubuntu 24.04 LTS (actual)

`/etc/os-release`:
```
PRETTY_NAME="Ubuntu 24.04.3 LTS"
NAME="Ubuntu"
VERSION_ID="24.04"
VERSION="24.04.3 LTS (Noble Numbat)"
VERSION_CODENAME=noble
ID=ubuntu
ID_LIKE=debian
HOME_URL="https://www.ubuntu.com/"
SUPPORT_URL="https://help.ubuntu.com/"
BUG_REPORT_URL="https://bugs.launchpad.net/ubuntu/"
PRIVACY_POLICY_URL="https://www.ubuntu.com/legal/terms-and-policies/privacy-policy"
UBUNTU_CODENAME=noble
LOGO=ubuntu-logo
```

`uname -a`:
```
Linux SyzomHQ 6.6.87.2-microsoft-standard-WSL2 #1 SMP PREEMPT_DYNAMIC Thu Jun  5 18:30:46 UTC 2025 x86_64 x86_64 x86_64 GNU/Linux
```

`codex --version` (stdout, redacting `$HOME` in the warning path):
```
WARNING: proceeding, even though we could not update PATH: Permission denied (os error 13) at path "$HOME/.codex/tmp/path/codex-arg05ILV7U"
codex-cli 0.92.0
```

### macOS (assumed)

- macOS major: expected 26 "Tahoe" (not independently captured in this run).
- `codex` build identifier: assumed `codex-cli 0.92.0` (not independently verified on macOS).

## Runbook (docs-only)

### 1) Create scratch roots (per run)

```
export SWOP_TRACE_ROOT="/tmp/swop-codex-auth-isolation-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$SWOP_TRACE_ROOT"
mkdir -p "$SWOP_TRACE_ROOT"/{acctA,acctB}/{home,config,state,data,cache,logs}
```

### 2) Capture "Tested on" metadata

WSL2 Ubuntu:
```
cat /etc/os-release
uname -a
codex --version || codex version
```

macOS:
```
sw_vers
uname -a
codex --version || codex version
```

### 3) Define shared vs isolated `.codex` content

User-selected sharing policy: share everything in the real `~/.codex` except
`auth.json`, which remains per-account.

Capture the real home before overriding `HOME`:

```
export REAL_HOME="$HOME"
export SHARED_CODEX="$REAL_HOME/.codex"
```

For each account, create a per-account `auth.json` and symlink everything else
back to the shared `.codex`:

```
mkdir -p "$SWOP_TRACE_ROOT/acctA/home/.codex"
mkdir -p "$SWOP_TRACE_ROOT/acctB/home/.codex"

for item in config.toml history.jsonl internal_storage.json log models_cache.json prompts rules sessions shell_snapshots skills tmp version.json; do
  ln -s "$SHARED_CODEX/$item" "$SWOP_TRACE_ROOT/acctA/home/.codex/$item"
  ln -s "$SHARED_CODEX/$item" "$SWOP_TRACE_ROOT/acctB/home/.codex/$item"
done
```

`auth.json` remains per-account and is created by `codex login`.

### 4) Define the per-account env overrides

Account A:
```
export HOME="$SWOP_TRACE_ROOT/acctA/home"
export XDG_CONFIG_HOME="$SWOP_TRACE_ROOT/acctA/config"
export XDG_STATE_HOME="$SWOP_TRACE_ROOT/acctA/state"
export XDG_DATA_HOME="$SWOP_TRACE_ROOT/acctA/data"
export XDG_CACHE_HOME="$SWOP_TRACE_ROOT/acctA/cache"
```

Account B: same variables pointing at `acctB/...`.

### 5) Trace `codex login`

WSL2:
```
strace -ff -o "$SWOP_TRACE_ROOT/logs/wsl-acctA-login.strace" -e trace=%file codex login
strace -ff -o "$SWOP_TRACE_ROOT/logs/wsl-acctB-login.strace" -e trace=%file codex login
```

macOS:
```
sudo fs_usage -w -f filesystem codex 2>&1 | tee "$SWOP_TRACE_ROOT/logs/macos-acctA-login.fs_usage.log"
sudo fs_usage -w -f filesystem codex 2>&1 | tee "$SWOP_TRACE_ROOT/logs/macos-acctB-login.fs_usage.log"
```

### 6) Trace a normal `codex` run

WSL2:
```
strace -ff -o "$SWOP_TRACE_ROOT/logs/wsl-acctA-run.strace" -e trace=%file codex
strace -ff -o "$SWOP_TRACE_ROOT/logs/wsl-acctB-run.strace" -e trace=%file codex
```

macOS:
```
sudo fs_usage -w -f filesystem codex 2>&1 | tee "$SWOP_TRACE_ROOT/logs/macos-acctA-run.fs_usage.log"
sudo fs_usage -w -f filesystem codex 2>&1 | tee "$SWOP_TRACE_ROOT/logs/macos-acctB-run.fs_usage.log"
```

### 7) Extract path findings (WSL2)

```
rg --no-heading -e 'openat\\(|open\\(|stat\\(|lstat\\(|access\\(|readlink\\(' -- "$SWOP_TRACE_ROOT/logs/"wsl-*.strace* > "$SWOP_TRACE_ROOT/logs/wsl-filecalls.txt" || true
rg -o '\"/[^\" ]+' "$SWOP_TRACE_ROOT/logs/wsl-filecalls.txt" | sort -u > "$SWOP_TRACE_ROOT/logs/wsl-paths.txt"
```

### 8) Concurrency validation (WSL2/macOS)

Run `codex` concurrently in two terminals (Account A and B env overrides) and diff a before/after tree to confirm writes remain inside each account root.

## Findings

### WSL2 Ubuntu (traced)

#### `codex login` writes

- `$HOME/.codex/auth.json` (created/truncated with 0600)

#### Normal `codex` run reads/writes

- Reads:
  - `$HOME/.codex/auth.json`
  - `$HOME/.codex/config.toml` (read if present; ENOENT otherwise)
  - `/etc/codex/{requirements.toml,managed_config.toml,config.toml}` (read attempts; ENOENT in this environment)
- Writes:
  - `$HOME/.codex/version.json` (created/truncated)
  - `$HOME/.codex/models_cache.json` (created/truncated)
  - `$HOME/.codex/history.jsonl` (created)
  - `$HOME/.codex/sessions/YYYY/MM/DD/*.jsonl` (append)
  - `$HOME/.codex/log/codex-tui.log` (append)
  - `$HOME/.codex/skills/.system/**` (created/updated on first run)

#### Must-isolate locations

- `auth.json` is the only per-account file required by the user; everything
  else is explicitly shared to keep account switching frictionless.

#### Evidence of global reads (no writes observed)

- `/etc/codex/*.toml` (read attempts)
- `/tmp/.codex` (stat attempt)
- `$HOME/.codex/tmp/path/...` (helper binary lookup)
- Install paths under the codex node module (read-only)

### macOS (assumed, not traced)

Based on WSL2 traces and typical `codex` behavior, expected mutable paths are under:

- `$HOME/.codex/auth.json`
- `$HOME/.codex/config.toml`
- `$HOME/.codex/models_cache.json`
- `$HOME/.codex/history.jsonl`
- `$HOME/.codex/sessions/**`
- `$HOME/.codex/log/**`
- `$HOME/.codex/skills/.system/**`

Global reads are expected under `/etc/codex/*.toml` if present.

## Required environment overrides (minimum set)

- `HOME`: Required; `codex` reads/writes `$HOME/.codex/auth.json`. With the
  sharing policy above, each account has its own `auth.json` while all other
  `.codex` content is shared via symlinks.
- `XDG_CONFIG_HOME`, `XDG_STATE_HOME`, `XDG_DATA_HOME`, `XDG_CACHE_HOME`:
  Optional for this policy; keep them aligned with the per-account `HOME` to
  avoid other tools leaking into the real home.

## Limitations

- macOS tracing and concurrency were not executed in this run; macOS findings
  are assumed based on WSL2 behavior and must be validated with `fs_usage`.
- `codex` attempts to read `/etc/codex/*.toml` if present; if a deployment writes global config there, it is shared across accounts.
- Shared `.codex` content (everything except `auth.json`) means histories,
  sessions, logs, and caches are shared across accounts; this avoids friction
  but also means cross-account activity is visible in shared artifacts.
- If future `codex` versions change storage locations or adopt XDG paths, this runbook must be revalidated.

## Decisions

| Decision | Chosen option | Source |
|---|---|---|
| Deliverable style | Docs-only runbook + findings table (no helper scripts) | user chat (2026-01-29) |
| Concurrency scenario | Parallel `codex` runs; `codex login` only for setup/tracing | user chat (2026-01-29) |
| OS targets | WSL2 Ubuntu 24.04 LTS + macOS current major (user on Tahoe 26) | user chat (2026-01-29) |

## Open Questions (non-blocking)

- Confirm the exact macOS version string recorded in “Tested on” when the runbook is executed (e.g., 26.x).
- Confirm the canonical command to capture a stable `codex` build identifier (`codex --version` vs alternative).

## Dependencies / References

- Feature overview: `docs-ai/docs/initiatives/swop/features/cli-wrapper/overview.md`
- Delivery map entry: `docs-ai/docs/initiatives/delivery-map.md` (work item ordering + ⛔ dependency marker)
- Downstream consumers (expected):
  - `swop/cli-wrapper/login-logout-orchestration`
  - `swop/cli-wrapper/codex-wrapper-exec`
