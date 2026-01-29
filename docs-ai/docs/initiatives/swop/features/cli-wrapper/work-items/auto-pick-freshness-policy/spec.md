# Work Item: auto-pick-freshness-policy

## Status

planned

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

## Acceptance Criteria

- [ ] The spec chooses one policy for stale/missing usage handling (no “TBD” in Decisions).
- [ ] The spec defines behavior for the three cases:
  - [ ] some accounts missing/stale
  - [ ] all accounts missing/stale
  - [ ] mixed blocked + missing/stale
- [ ] The spec defines the user-facing output contract (what is printed and what is never printed).
- [ ] The spec explicitly states whether auto-pick is allowed to proceed using stale data, and under what constraints.

## Decisions

| Decision | Chosen option | Source |
|---|---|---|
| Auto-pick allowed to use stale cached usage | TBD | pending decision |
| “All accounts stale/missing” behavior | TBD | pending decision |
| User-facing messaging for stale/missing usage | TBD | pending decision |

## Open Questions (non-blocking)

- Should “stale allowed” be gated on “not blocked” fields being present, or is “usage percent only” sufficient?

## Dependencies / References

- Feature overview: `docs-ai/docs/initiatives/swop/features/cli-wrapper/overview.md`
- Usage client (freshness + cache contract): `docs-ai/docs/initiatives/swop/features/cli-wrapper/work-items/usage-client/spec.md`
- Auto-pick policy: `docs-ai/docs/initiatives/swop/features/cli-wrapper/work-items/auto-pick-policy/spec.md`
- Wave brief (w1 DoD + scenarios): `docs-ai/docs/initiatives/waves/w1-cli-mvp.md`
