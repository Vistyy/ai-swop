# Work Item: session-auto-relogin

## Status

Planned

**Type:** interactive

## Parent

Feature: `swop/cli-wrapper` (see `docs-ai/docs/initiatives/swop/features/cli-wrapper/overview.md`)

## Goal

Recover from session expiry by prompting an interactive relogin and retrying once, without surprising behavior in non-interactive contexts.

## Scope

### In scope

- Usage API calls (HTTP status codes, error body structure) via `usage-client`.
- **Detection**:
  - **Usage API**: Detect `401 Unauthorized` with specific error body.
  - **CLI**: Rely on Usage API check as a gate; if Usage API says "Auth Error", we assume the session is dead for CLI too.
- **Interactive Recovery**: In an interactive terminal, prompt user to re-authenticate (via `codex login` in the sandbox), then retry the operation once.
- **Escape Hatch**: Provide an explicit `swop relogin <account>` command.
- **Non-Interactive**: Define fail-fast behavior for non-interactive contexts (e.g., return standard error with clear remediation instructions).

### Out of scope

- Automatic background relogin (headless).
- Infinite retries.
- Handling of non-auth failures (network, timeouts) beyond standard error reporting.

## Acceptance Criteria

- [ ] **Discovery**: Auth failure signatures (exit codes, stderr patterns, API error bodies) are empirically verified and documented in the runbook/findings.
- [ ] **Interactive Flow**: When a session is expired in an interactive terminal:
  - The user is prompted to login.
  - After successful login, the original command is retried exactly once.
  - If login fails, the operation fails without retry.
- [ ] **Non-Interactive**: When a session is expired in a non-interactive context, the command fails immediately with an actionable error message (e.g., "Run 'swop relogin <account>' to restore access").
- [ ] **Escape Hatch**: `swop relogin <account>` successfully triggers the login flow for a specific account.
- [ ] **Idempotency**: Retrying a successful operation does not trigger relogin; retrying a hard failure (non-auth) does not trigger relogin.

## Decisions

| Decision                   | Chosen option                                                                             | Source                 |
| -------------------------- | ----------------------------------------------------------------------------------------- | ---------------------- |
| **Auth Failure Detection** | **Discovery Required**: Empirically determine signatures first, then implement detection. | User Chat (2026-01-30) |
| **Execution Mode**         | **Interactive**: Discovery requires human validation; UX is interactive.                  | User Chat (2026-01-30) |
| **Detection Strategy**     | **Usage API Gate**: Rely on Usage API 401s; CLI errors are ambiguous in TTY.              | User Chat (2026-01-30) |

## Open Questions (non-blocking)

- None.

## Dependencies / References

- `swop/cli-wrapper/overview.md`: Feature overview.
- `swop/cli-wrapper/usage-client`: Usage API client to be instrumented.
- `swop/cli-wrapper/codex-wrapper-exec`: Codex wrapper to be instrumented.
- `swop/cli-wrapper/codex-auth-isolation-discovery`: Sandbox/Auth structure.
