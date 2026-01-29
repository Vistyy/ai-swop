# Work Item: session-auto-relogin

## Status

Planned

## Objective

Recover from session expiry by prompting an interactive relogin and retrying once, without surprising behavior in non-interactive contexts.

## Scope

- Detect likely auth/session failures during:
  - usage fetch
  - `codex` execution
- In an interactive terminal, prompt user to re-authenticate (via `codex login` in the sandbox), then retry the operation once.
- Provide an explicit `swop relogin <account>` escape hatch.
- Define behavior for non-interactive contexts (e.g., fail fast with instructions).

## Acceptance Criteria

- Interactive relogin flow works and does not deadlock/hang.
- Non-interactive usage fails with clear remediation steps.
