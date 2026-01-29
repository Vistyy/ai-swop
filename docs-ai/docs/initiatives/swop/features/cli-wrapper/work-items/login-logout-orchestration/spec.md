# Work Item: login-logout-orchestration

## Status

done

**Type:** interactive

## Parent

Feature: `swop/cli-wrapper` (see `docs-ai/docs/initiatives/swop/features/cli-wrapper/overview.md`)

## Goal

Make account lifecycle operations deterministic and safe by orchestrating `codex login` / `codex logout` inside an account sandbox, with clear local-vs-remote behavior and no secret leakage.

## Scope

### In scope

- `swop add <account>` (interactive):
  - creates the account sandbox
  - runs `codex login` within that sandbox
  - succeeds only if the sandbox ends in a usable “logged in” state for subsequent `codex` runs
- `swop add <account>` (non-interactive / no TTY):
  - fails fast with an actionable message
  - must not create or persist any sandbox directories/files
- `swop logout <account>`:
  - always deletes the local sandbox (local-only revoke)
  - best-effort attempts `codex logout` when available, before local deletion, but must not prevent local deletion from completing
  - treats missing/unsupported `codex logout` as a no-op (still deletes locally)

### Out of scope

- Guaranteed remote revoke (explicitly non-goal for w1; best-effort only).
- Session expiry detection + auto relogin prompting (owned by `swop/cli-wrapper/session-auto-relogin`).
- Concurrency hardening for overlapping `codex login` operations across accounts.
- Windows-native behavior (w1 targets WSL/mac only).

## Acceptance Criteria

- [x] `swop add <account>` (interactive) results in a sandbox with valid `codex` auth state for that account (per the isolation policy).
- [x] If `codex login` fails or is canceled, `swop add <account>` fails and the sandbox is rolled back (no lingering “half-added” account).
- [x] `swop add <account>` in a non-interactive context fails fast with a clear remediation message and does not create a sandbox.
- [x] `swop logout <account>` always deletes the local sandbox, even if remote/logout is unavailable or fails.
- [x] `swop logout <account>` behavior is explicit: local delete is authoritative; remote/logout is best-effort only (no guaranteed remote revoke).
- [x] No secrets are printed in normal operation or error output (including token/session material from the sandbox).

## Decisions

| Decision | Chosen option | Source |
|---|---|---|
| `swop add` atomicity on login failure/cancel | Roll back by deleting sandbox; no “half-added” account | user reply (A) |
| `swop add` in non-interactive contexts | Fail fast; make no filesystem changes | user reply (A) |
| Logout semantics | Local sandbox delete always; best-effort `codex logout` when available | `w1-cli-mvp` + this spec |
| Logout ordering | Attempt best-effort `codex logout` before local delete; always delete sandbox afterward | user reply (A) |

## Dependencies / References

- Feature overview: `docs-ai/docs/initiatives/swop/features/cli-wrapper/overview.md`
- Wave brief (w1 DoD + scenarios): `docs-ai/docs/initiatives/waves/w1-cli-mvp.md`
- Sandbox model + root rules: `docs-ai/docs/initiatives/swop/features/cli-wrapper/work-items/account-sandbox-manager/spec.md`
- Auth isolation policy: `docs-ai/docs/initiatives/swop/features/cli-wrapper/work-items/codex-auth-isolation-discovery/spec.md`
