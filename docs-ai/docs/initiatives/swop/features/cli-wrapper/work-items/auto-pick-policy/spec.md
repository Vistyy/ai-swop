# Work Item: auto-pick-policy

## Status

Planned

## Objective

Define and implement the v1 account selection policy based on 7‑day usage.

## Policy (v1)

- Consider only accounts where `rate_limit.allowed=true` and `rate_limit.limit_reached=false`.
- Select the account with the lowest `rate_limit.secondary_window.used_percent`.
- If all accounts are blocked, fail with an actionable message (include next reset time when available).

## Acceptance Criteria

- Selection behavior matches the policy above and is deterministic on ties.
- The chosen account is announced (by account label/id) when running `swop codex ...`.
