# Work Item: auto-pick-policy

## Status

planned

**Type:** decision + implementation

## Objective

Define and implement the v1 account selection policy based on 7‑day usage.

## Scope

### In scope

- Define the deterministic selection rule among viable accounts.
- Define tie-breaking behavior.

### Out of scope

- Stale/missing usage handling for selection inputs (owned by `swop/cli-wrapper/auto-pick-freshness-policy`).

## Policy (v1)

- Consider only accounts where `rate_limit.allowed=true` and `rate_limit.limit_reached=false`.
- Select the account with the lowest `rate_limit.secondary_window.used_percent`.
- If all accounts are blocked, fail with an actionable message (include next reset time when available).

## Acceptance Criteria

- Selection behavior matches the policy above and is deterministic on ties.
- The chosen account is announced (by account label/id) when running `swop codex ...`.

## Dependencies / References

- Freshness policy (stale/missing usage handling): `docs-ai/docs/initiatives/swop/features/cli-wrapper/work-items/auto-pick-freshness-policy/spec.md`
- Usage client output contract: `docs-ai/docs/initiatives/swop/features/cli-wrapper/work-items/usage-client/spec.md`
- Wave brief (w1 DoD + scenarios): `docs-ai/docs/initiatives/waves/w1-cli-mvp.md`
