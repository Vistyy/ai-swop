# Work Item: auto-pick-freshness-policy

## Status

done

**Type:** decision

## Parent

Feature: `swop/cli-wrapper` (see `docs-ai/docs/initiatives/swop/features/cli-wrapper/overview.md`)

## Goal

Define whether `swop/cli-wrapper/auto-pick-policy` is allowed to use **stale cached usage data** (from `swop/cli-wrapper/usage-client`) when selecting an account for `swop codex ...`, and what the user-visible behavior is when usage is missing or stale.

## Scope

### In scope

- Specify the freshness requirement for auto-pick input data:
  - “fresh within TTL only” vs “stale allowed with warning” vs “stale allowed only as last resort”, etc.
- Specify what auto-pick does when:
  - usage data is missing for some accounts
  - usage data is stale for some/all accounts
  - usage data indicates blocked (`allowed=false` or `limit_reached=true`) but reset time is missing
- Specify what the CLI prints in these cases (actionable, non-leaky, minimal).

### Out of scope

- How to fetch/cache usage (owned by `swop/cli-wrapper/usage-client`).
- The core selection rule among viable accounts (owned by `swop/cli-wrapper/auto-pick-policy`).
- Session refresh / relogin prompting (owned by `swop/cli-wrapper/session-auto-relogin`).

## Policy (v1)

### Definitions

- **Fresh usage**: `usage-client` returns a usage payload with `stale=false`.
- **Stale usage**: `usage-client` returns a usage payload with `stale=true` and freshness metadata (`fetched_at` and/or `age_seconds`).
- **Missing usage**: `usage-client` returns an error state (no usable fields) or freshness metadata is missing such that age cannot be determined.

### Eligibility tiers (inputs to `auto-pick-policy`)

Auto-pick MUST run `auto-pick-policy` over exactly one of the following tiers:

1) **Tier 1 (preferred): Fresh** — all accounts with fresh usage.
2) **Tier 2 (fallback): Stale-but-bounded** — only if Tier 1 is empty:
   - Include accounts with stale usage where `age_seconds <= 24h`.
   - Exclude accounts with missing usage, or stale usage older than 24h.
3) **Tier 3: None** — if Tier 2 is also empty, auto-pick fails (see “Failure behavior”).

### Required fields for eligibility

For an account to be eligible (Tier 1 or Tier 2), the usage payload MUST include the minimum fields required by `auto-pick-policy`:

- `rate_limit.allowed`
- `rate_limit.limit_reached`
- `rate_limit.secondary_window.used_percent`

If any of these are missing/unknown, treat the account as **ineligible** (do not guess).

### Failure behavior (all accounts missing/too-stale)

If no accounts are eligible in Tier 1 or Tier 2, `swop codex ...` MUST fail with an actionable, non-leaky message that:

- states that usage could not be determined for any account (live fetch failed and no recent cache is available), and
- suggests the user retry (later) and/or run `swop status` to inspect account health.

## User-visible output contract

### When proceeding with Tier 1 (fresh)

- Print the selected account identifier/label (per `auto-pick-policy` acceptance criteria).
- Do not print usage payloads, auth/session material, or request details.

### When proceeding with Tier 2 (stale-but-bounded)

- Print a warning that stale cached usage is being used for selection, and include the cache age (e.g., “last updated X minutes ago”).
- Print the selected account identifier/label.
- The warning MUST be non-leaky and MUST NOT include secrets, bearer tokens, raw headers, or raw response bodies.

### When skipping accounts due to missing/too-stale usage

- Output MAY mention counts (e.g., “skipped N accounts due to unavailable usage”), but MUST NOT print secrets or raw payloads.

### Blocked accounts with missing reset time

- If blocked status is present but reset time is missing, error/warning output MUST NOT fabricate a reset time.
- When printing an “all accounts blocked” failure (owned by `auto-pick-policy`), reset time may be included when available; otherwise, say “reset time unknown”.

## Acceptance Criteria

- [x] The spec chooses one policy for stale/missing usage handling (no unresolved placeholders in Decisions).
- [x] The spec defines behavior for the three cases:
  - [x] some accounts missing/stale
  - [x] all accounts missing/stale
  - [x] mixed blocked + missing/stale
- [x] The spec defines the user-facing output contract (what is printed and what is never printed).
- [x] The spec explicitly states whether auto-pick is allowed to proceed using stale data, and under what constraints.
- [x] The spec defines a bounded maximum age for stale usage eligibility in v1.

## Decisions

| Decision | Chosen option | Source |
|---|---|---|
| Auto-pick allowed to use stale cached usage | Yes, Tier 2 fallback only | user reply (B) |
| Max stale age eligible for selection (Tier 2) | 24 hours | this spec (v1) |
| Tiering behavior | Prefer fresh (Tier 1); stale only if no fresh (Tier 2) | this spec (v1) |
| Missing/unknown required fields | Ineligible (do not guess) | this spec (v1) |
| “All accounts missing/too-stale” behavior | Fail actionable, non-leaky; suggest retry + `swop status` | this spec (v1) |
| Stale/missing user-facing messaging | Warn on stale (include age); minimal skipping notice allowed | this spec (v1) |

## Open Questions (non-blocking)

- None.

## Dependencies / References

- Feature overview: `docs-ai/docs/initiatives/swop/features/cli-wrapper/overview.md`
- Usage client (freshness + cache contract): `docs-ai/docs/initiatives/swop/features/cli-wrapper/work-items/usage-client/spec.md`
- Auto-pick policy: `docs-ai/docs/initiatives/swop/features/cli-wrapper/work-items/auto-pick-policy/spec.md`
- Wave brief (w1 DoD + scenarios): `docs-ai/docs/initiatives/waves/w1-cli-mvp.md`
