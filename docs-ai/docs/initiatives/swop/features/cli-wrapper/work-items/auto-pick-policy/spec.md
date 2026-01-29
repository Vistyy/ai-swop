# Work Item: auto-pick-policy

## Status

done

**Type:** decision + implementation

## Parent

Feature: `swop/cli-wrapper` (see `docs-ai/docs/initiatives/swop/features/cli-wrapper/overview.md`)

## Goal

Define and implement the v1 deterministic account selection policy for `swop codex ...` based on 7‑day usage among **eligible** accounts (eligibility/tiering owned by `swop/cli-wrapper/auto-pick-freshness-policy`).

## Scope

### In scope

- Define the deterministic selection rule among viable accounts.
- Define tie-breaking behavior.
- Define “all accounts blocked” behavior and user-facing messaging (actionable, non-leaky).

### Out of scope

- Stale/missing usage handling for selection inputs (owned by `swop/cli-wrapper/auto-pick-freshness-policy`).
- How to fetch/cache usage (owned by `swop/cli-wrapper/usage-client`).
- Session refresh / relogin prompting (owned by `swop/cli-wrapper/session-auto-relogin`).
- How `codex` is executed under the selected account (owned by `swop/cli-wrapper/codex-wrapper-exec`).

## Policy (v1)

### Inputs

This policy is applied to a set of accounts that are already deemed **eligible** by the freshness policy:

- Tier 1 (preferred): fresh usage only, or
- Tier 2 (fallback): stale-but-bounded usage only (<= 24h), only if Tier 1 is empty.

Required fields for eligibility are specified by `swop/cli-wrapper/auto-pick-freshness-policy`.

### Viable vs blocked

- **Viable** accounts are those with:
  - `rate_limit.allowed=true` and
  - `rate_limit.limit_reached=false`
- **Blocked** accounts are all other eligible accounts (including `allowed=false` or `limit_reached=true`).

### Selection rule

1) Consider only **viable** accounts.
2) Select the account with the lowest `rate_limit.secondary_window.used_percent`.
3) If there is a tie on `used_percent`, break ties by **normalized account label** (case-insensitive lexicographic, ascending).

### “All accounts blocked” behavior

If there are zero viable accounts after filtering (i.e., all eligible accounts are blocked):

- Fail with an actionable, non-leaky message.
- If any blocked account provides a parseable `rate_limit.secondary_window.reset_at`, include **the earliest known reset time** in the message.
- If no reset time is available, say “reset time unknown” (do not fabricate).

### User-visible output contract (v1)

- On success: print the selected account identifier/label (and nothing secret).
- On failure: print an actionable message; do not print secrets, raw payloads, or request details.

## Acceptance Criteria

- [x] Selection behavior matches the policy above and is deterministic on ties.
- [x] Tie-break is by normalized account label (case-insensitive lexicographic, ascending).
- [x] If all eligible accounts are blocked, `swop codex ...` fails with an actionable, non-leaky message.
- [x] When failing due to all accounts blocked, the message includes the earliest known `reset_at` when available; otherwise “reset time unknown” (no fabricated timestamps).
- [x] The chosen account is announced (by account label/id) when running `swop codex ...` (no secrets printed).

## Decisions

| Decision | Chosen option | Source |
|---|---|---|
| Tie-break rule when `used_percent` ties | Normalized account label (case-insensitive lexicographic, ascending) | user reply (A) |
| “All blocked” reset time messaging | Earliest known `reset_at`; else “reset time unknown” | user reply (A) |

## Open Questions (non-blocking)

- None.

## Dependencies / References

- Freshness policy (stale/missing usage handling): `docs-ai/docs/initiatives/swop/features/cli-wrapper/work-items/auto-pick-freshness-policy/spec.md`
- Usage client output contract: `docs-ai/docs/initiatives/swop/features/cli-wrapper/work-items/usage-client/spec.md`
- Session auto-relogin behavior: `docs-ai/docs/initiatives/swop/features/cli-wrapper/work-items/session-auto-relogin/spec.md`
- Wave brief (w1 DoD + scenarios): `docs-ai/docs/initiatives/waves/w1-cli-mvp.md`
