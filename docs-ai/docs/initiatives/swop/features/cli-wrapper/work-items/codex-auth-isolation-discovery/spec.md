# Work Item: codex-auth-isolation-discovery

## Status

planned

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

- [ ] The spec contains a “Tested on” block listing:
  - WSL2 Ubuntu 24.04 LTS
  - macOS major version used when tested (expected: 26 “Tahoe”)
  - the exact `codex` build identifier used when tested (e.g., output from `codex --version` or equivalent)
- [ ] The spec contains a “Findings” section per OS with:
  - the discovered auth/config/state/cache locations `codex` reads/writes during `codex login` and normal runs
  - a clear statement of which locations must be isolated per account/process
- [ ] The spec enumerates required environment variable overrides (minimum set), with 1-line rationale per variable.
- [ ] The spec defines a documentation-only runbook (no scripts) that a developer can follow to reproduce the discovery on each OS.
- [ ] Concurrent safety is demonstrated for the defined scenario:
  - two already-authenticated accounts run `codex` in parallel as separate processes under isolated environments
  - documented outcome: no shared mutable path writes and no observed cross-account corruption
- [ ] The spec includes a limitations section covering any unresolved risks (e.g., OS keychain usage, other global state) and how the wrapper should behave when limitations apply.

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
