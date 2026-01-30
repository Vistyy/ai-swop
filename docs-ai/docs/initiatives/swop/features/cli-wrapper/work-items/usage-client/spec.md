# Work Item: usage-client

## Status

done

**Type:** autonomous

## Parent

Feature: `swop/cli-wrapper` (see `docs-ai/docs/initiatives/swop/features/cli-wrapper/overview.md`)

## Goal

Fetch per-account usage information from `GET /backend-api/wham/usage` and expose it to `swop status` and auto-pick logic.

## Scope

### In scope

- Implement a per-account usage fetcher for `GET /backend-api/wham/usage`.
- Authenticate using the account sandbox’s stored `codex` auth material (per-account `auth.json` per `codex-auth-isolation-discovery`).
- Parse and return the v1 fields needed by `w1-cli-mvp`:
  - `plan_type`
  - `rate_limit.allowed`
  - `rate_limit.limit_reached`
  - `rate_limit.primary_window.used_percent`
  - `rate_limit.primary_window.reset_at`
  - `rate_limit.secondary_window.used_percent`
  - `rate_limit.secondary_window.reset_at`
- Define caching + timeout behavior so:
  - `swop status` remains fast and usable during transient failures
  - consumers can reason about freshness and decide whether stale data is acceptable
- Define an actionable, non-leaky error contract (no secrets in output).

### Out of scope

- Selecting the “best” account (owned by `swop/cli-wrapper/auto-pick-policy`).
- Session expiry prompting / relogin orchestration (owned by `swop/cli-wrapper/session-auto-relogin` and `swop/cli-wrapper/login-logout-orchestration`).
- Concurrency semantics for running `codex` (owned by `swop/cli-wrapper/codex-wrapper-exec`).

## Freshness + caching (v1)

## Data normalization (v1)

- The usage payload is normalized into a canonical shape before caching.
- If the upstream response omits `primary_window`, the client falls back to `secondary_window` for primary values.
- Reset timestamps may be ISO strings or epoch-seconds and are normalized to ISO strings.

### Cache model

- Cache is **per account** and **persists across invocations**.
- Cache stores **only parsed, non-secret fields** listed in Scope (no tokens/session material; no full raw response).
- Cache file location (v1): `<sandboxRoot>/usage-cache.json` (0600, atomic writes).

### TTL (v1)

- Cache TTL is **15 minutes**.
- Data older than the TTL must be marked **stale**.

### Runtime behavior (Option A: stale-ok with explicit age)

When a caller requests usage for an account:

- If a cache entry exists and is **within the TTL**, return the cached fields as **not stale** (fast-path; no network call).
- Otherwise, attempt a live fetch:
  - If a **live fetch succeeds**, return the parsed fields plus freshness metadata, and update the per-account cache.
  - If a **live fetch fails** (timeout/network/5xx/parse/auth), and a cache entry exists:
    - return the cached fields
    - mark them as **stale**
    - include an actionable refresh error summary (non-leaky)
  - If a **live fetch fails** and **no cache exists**, return an error state (no fields).

### Freshness metadata contract (for consumers)

The usage-client output must include:

- `fetched_at` timestamp for the returned data
- `stale` boolean (true if returned from cache due to failure, or if older than the TTL below)
- `age_seconds` (or equivalent derivable value)

This enables `swop status` to display “last updated” information, and enables downstream policy (auto-pick) to define its own freshness requirements without re-implementing the client.

### Timeouts (v1)

- The client enforces a hard deadline per live fetch attempt: **2 seconds** total.
- No automatic retries in v1 (status/auto-pick should remain predictable and fast).

## Debugging

- Set `SWOP_DEBUG_USAGE=1` (or `SWOP_DEBUG=usage`) to log whether usage is served from cache (`cache-hit`) or fetched live (`fetch`).

## Acceptance Criteria

- [x] For each account, `swop status` can display the required fields **or** an actionable error state.
- [x] The response fields parsed and surfaced match the v1 list in Scope (no extra required fields).
- [x] A live fetch uses per-account sandbox auth material (no cross-account leakage).
- [x] Cache behavior matches “stale-ok with explicit age”:
  - [x] If live fetch fails and cache exists, cached data is returned marked as stale with “last updated” metadata.
  - [x] If live fetch fails and no cache exists, an error state is returned (no fields).
  - [x] If cache is within the 15-minute TTL, it is used as a fast-path (no network call required).
- [x] Timeout behavior is explicit and enforced: a live fetch attempt must not exceed **2 seconds** total.
- [x] Failures are non-leaky (no token/session printed) and are categorized as feasible (auth vs network/timeout vs 5xx vs parse).

## Decisions

| Decision | Chosen option | Source |
|---|---|---|
| Usage endpoint URL | `https://chatgpt.com/backend-api/wham/usage` | user reply |
| Auth source | Read token from sandbox `auth.json` | user reply |
| Bearer token field | `tokens.access_token` | user reply (A) |
| Request headers | `Authorization: Bearer …` + `Accept: application/json` only | user reply (A) |
| Cache strategy | Stale-ok with explicit age (Option A) | user reply (A) |
| Cache scope | Persistent, per-account cache; no secrets/raw payload stored | this spec (v1) |
| Cache path | `<sandboxRoot>/usage-cache.json` | user reply (A) |
| Cache TTL | 15 minutes | user reply |
| Read path | Cache-first within TTL; live fetch on miss/expired | this spec (v1) |
| Freshness contract | Always return `fetched_at` + `stale` + `age_seconds` (or equivalent) | this spec (v1) |
| Timeouts | 2s hard deadline per live fetch; no retries in v1 | this spec (v1) |

## Open Questions (non-blocking)

- None.

## Dependencies / References

- Feature overview: `docs-ai/docs/initiatives/swop/features/cli-wrapper/overview.md`
- Delivery map: `docs-ai/docs/initiatives/delivery-map.md`
- Wave brief (w1 DoD + scenarios): `docs-ai/docs/initiatives/waves/w1-cli-mvp.md`
- Sandbox model + root rules: `docs-ai/docs/initiatives/swop/features/cli-wrapper/work-items/account-sandbox-manager/spec.md`
- Auth isolation findings: `docs-ai/docs/initiatives/swop/features/cli-wrapper/work-items/codex-auth-isolation-discovery/spec.md`
- Auto-pick freshness policy (consumer contract): `docs-ai/docs/initiatives/swop/features/cli-wrapper/work-items/auto-pick-freshness-policy/spec.md`
