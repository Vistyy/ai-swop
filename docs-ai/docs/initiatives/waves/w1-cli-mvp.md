# Wave: w1-cli-mvp

## Objective

Ship a WSL/mac CLI wrapper that can manage multiple Codex login sessions, select the best account based on 7‑day quota usage, and run `codex` concurrently under different accounts without credential corruption.

## Definition of Done

- Users can add 2+ accounts using a command that invokes `codex login` into isolated per-account sandboxes.
- Users can run `swop codex ...` and it:
  - selects the best account by lowest `rate_limit.secondary_window.used_percent` among accounts with `allowed=true` and `limit_reached=false`
  - prints which account was selected (without printing secrets)
  - runs `codex` under that account’s sandbox
  - supports concurrent invocations (multiple terminals) without auth/config collisions
- Users can run `swop status` to view, per account:
  - `plan_type`
  - 7‑day usage percent (`secondary_window.used_percent`)
  - 7‑day reset time (`secondary_window.reset_at`) in a human-readable form
- If a session appears invalid/expired during `swop codex ...`, the tool prompts for interactive relogin (via `codex login`) and retries once; also supports explicit relogin.
- Users can log out an account:
  - local sandbox is deleted
  - best-effort `codex logout` is attempted if available, but logout never fails solely due to remote/logout failure

## Scenarios

1) Add accounts:
   - User runs `swop add work`, completes `codex login`, then repeats `swop add personal`.
   - `swop status` lists both accounts with plan + 7‑day usage + reset time.

2) Auto-pick + concurrent runs:
   - User runs `swop codex "prompt A"` in one terminal and `swop codex "prompt B"` in another.
   - Each invocation selects an account at launch time and runs without corrupting the other’s session/config.

3) Usage unavailable / rate-limited:
   - Usage endpoint errors or returns blocked flags for some/all accounts.
   - `swop` warns clearly and either selects a viable fallback or fails with an actionable message (e.g., “all accounts blocked until <time>”).

4) Session refresh:
   - An account’s session expires.
   - `swop codex ...` detects auth failure, prompts interactive relogin, then retries once.

## Constraints / Non-goals

- No Windows tray / macOS menu-bar UI in this wave (explicitly deferred to `w2-tray-ui`).
- No guaranteed remote revoke; logout is local-delete + best-effort `codex logout`.
- No upstream changes to `codex`; this wave only orchestrates and isolates.
- Storage is local on disk with strict permissions; the tool must not print tokens/sessions.

## Notes / Open Questions (Discovery Targets)

- How to truly isolate `codex` auth/config per account/process when `codex` does not expose a config-dir override.
- Where/how to retrieve the bearer token needed to call `GET /backend-api/wham/usage` from the credentials `codex login` stores.
- Polling/caching policy for usage (refresh cadence, timeouts, stale reads).
