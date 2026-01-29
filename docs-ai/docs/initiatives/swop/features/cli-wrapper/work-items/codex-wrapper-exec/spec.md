# Work Item: codex-wrapper-exec

## Status

Planned

## Objective

Provide a `swop codex ...` command that runs `codex` under the chosen account sandbox and supports concurrent invocations.

## Scope

- Determine the account (manual or auto-pick) at process start.
- Launch `codex` with the environment necessary to bind it to the account sandbox (per discovery outcome).
- Ensure concurrent invocations do not share mutable auth/config state.

## Acceptance Criteria

- Running `swop codex ...` uses the selected account and does not corrupt other running sessions.
- The wrapper does not leak secrets in logs or process arguments.
