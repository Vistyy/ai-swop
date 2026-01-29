# Work Item: codex-wrapper-exec

## Status

done

**Type:** autonomous

**Kind:** decision + implementation

## Parent

Feature: `swop/cli-wrapper` (see `docs-ai/docs/initiatives/swop/features/cli-wrapper/overview.md`)

## Goal

Provide a `swop codex ...` command that:

- selects an account (explicit or auto-pick) at process start
- executes `codex` under that account’s sandboxed environment (per the isolation findings)
- supports concurrent invocations without cross-account auth corruption

## Scope

### In scope

- Determine the account at process start:
  - `--account <label>` selects a specific account
  - otherwise default to `--auto` selection (per auto-pick policy)
- Execute `codex` with per-account sandbox environment overrides so `codex` reads the account’s `auth.json`.
- Pass all arguments after `--` through to `codex` verbatim.
- Concurrency safety for running `codex` under different accounts in parallel:
  - no cross-account auth corruption
  - no shared mutable per-account secrets

### Out of scope

- Creating/removing account sandboxes (`swop/cli-wrapper/account-sandbox-manager`)
- Running `codex login` / `codex logout` (`swop/cli-wrapper/login-logout-orchestration`)
- Session expiry detection / interactive relogin prompting (`swop/cli-wrapper/session-auto-relogin`)
- Re-defining the auto-pick selection policy (`swop/cli-wrapper/auto-pick-policy`)
- Windows-native execution (w1 targets WSL/mac only)

## CLI Contract (v1)

Command shape:

- `swop codex [--account <label> | --auto] -- <codex args...>`
- Default behavior when neither `--account` nor `--auto` is provided: behave as `--auto`.
- Non-interactive / no-TTY contexts are allowed; `swop` still selects an account and executes `codex` under the sandbox environment.

## Acceptance Criteria

- [x] `swop codex --account <label> -- <args...>` executes `codex` using the specified account sandbox, and prints which account was selected (no secrets).
- [x] `swop codex -- <args...>` defaults to auto-pick and prints which account was selected (no secrets).
- [x] Arguments after `--` are passed to `codex` verbatim (no re-parsing or mutation by `swop`).
- [x] If `--account <label>` does not exist, the command exits non-zero with an actionable message (e.g., “unknown account”; suggest `swop add <label>` / `swop status`).
- [x] If no accounts exist, the command exits non-zero with an actionable message (e.g., “no accounts configured”; suggest `swop add <label>`).
- [x] Concurrency safety: running `swop codex ...` concurrently for two different already-authenticated accounts does not corrupt either account’s `auth.json` and does not cause cross-account auth token overwrites.
- [x] The wrapper does not leak secrets in stdout/stderr logs or process arguments (no token/session material from `auth.json`).
- [x] Exit code is propagated: `swop codex ...` exits with the same exit status as the underlying `codex` process when `codex` is successfully started.

## Decisions

| Decision                             | Chosen option                                                                                                                     | Source                                                                                         |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| CLI contract for `swop codex`        | `swop codex [--account <label> \| --auto] -- <codex args...>`; default `--auto`; pass-through after `--`                          | user reply (A)                                                                                 |
| Non-interactive behavior             | Allow no-TTY execution; still select account + apply sandbox env; defer TTY handling to `codex`                                   | user reply (A)                                                                                 |
| `last_used_at` update timing         | Update at process start (just before exec)                                                                                        | user reply (A)                                                                                 |
| Auth isolation strategy used by exec | Use per-account sandbox env overrides so `codex` reads per-account `auth.json` (other `.codex` content shared per prior decision) | `swop/cli-wrapper/codex-auth-isolation-discovery` + `swop/cli-wrapper/account-sandbox-manager` |

## Open Questions (non-blocking)

- None.

## Dependencies / References

- Feature overview: `docs-ai/docs/initiatives/swop/features/cli-wrapper/overview.md`
- Wave brief (w1 DoD + scenarios): `docs-ai/docs/initiatives/waves/w1-cli-mvp.md`
- Sandbox model + root rules: `docs-ai/docs/initiatives/swop/features/cli-wrapper/work-items/account-sandbox-manager/spec.md`
- Auth isolation findings: `docs-ai/docs/initiatives/swop/features/cli-wrapper/work-items/codex-auth-isolation-discovery/spec.md`
- Auto-pick policy (when `--auto` / default): `docs-ai/docs/initiatives/swop/features/cli-wrapper/work-items/auto-pick-policy/spec.md`
- Session relogin behavior (dependency): `docs-ai/docs/initiatives/swop/features/cli-wrapper/work-items/session-auto-relogin/spec.md`
