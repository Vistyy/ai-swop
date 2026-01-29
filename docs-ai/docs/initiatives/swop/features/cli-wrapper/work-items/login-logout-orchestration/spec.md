# Work Item: login-logout-orchestration

## Status

Planned

## Objective

Use `codex login`/`codex logout` as the account lifecycle mechanism within each account sandbox.

## Scope

- `swop add <account>` runs `codex login` in that account sandbox.
- `swop logout <account>`:
  - deletes the local sandbox
  - best-effort runs `codex logout` if available (must not block logout on remote failure)

## Acceptance Criteria

- Adding an account results in a sandbox with valid `codex` auth state.
- Logout behavior is explicit: local-delete always happens; remote/logout is best-effort.
- No secrets are printed in normal operation or error messages.
