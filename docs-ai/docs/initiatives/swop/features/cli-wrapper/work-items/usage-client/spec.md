# Work Item: usage-client

## Status

Planned

## Objective

Fetch per-account usage information from `GET /backend-api/wham/usage` and expose it to `swop status` and auto-pick logic.

## Scope

- Implement a client that authenticates using the account’s stored session/token material.
- Parse the response fields needed for v1:
  - `plan_type`
  - `rate_limit.allowed`
  - `rate_limit.limit_reached`
  - `rate_limit.secondary_window.used_percent`
  - `rate_limit.secondary_window.reset_at`
- Define caching/timeout behavior so `swop status` is fast and failure modes are clear.

## Acceptance Criteria

- For each account, `swop status` can display the required fields or an actionable error state.
- Failures are non-leaky (no token/session printed) and distinguish network/auth/5xx as feasible.
