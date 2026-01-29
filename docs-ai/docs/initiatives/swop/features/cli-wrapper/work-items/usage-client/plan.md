# Work Item: usage-client — Implementation Plan

> **Execution mode:** autonomous

## Goal

Implement a per-account client for `GET https://chatgpt.com/backend-api/wham/usage` that:

- authenticates using `Authorization: Bearer <tokens.access_token>` from the account sandbox `auth.json`
- parses the v1 fields required by `w1-cli-mvp`
- persists a per-account cache at `<sandboxRoot>/usage-cache.json` with TTL=15m
- enforces a 2s hard deadline per live fetch attempt
- returns actionable, non-leaky failure states

## Architecture (high level)

- New library module `usage-client` reads token from sandbox `auth.json`, performs a single HTTPS GET, parses only required fields, and returns a typed result that includes freshness metadata (`fetched_at`, `stale`, `age_seconds`).
- Cache is per-account and stored under sandbox root as JSON; read path is cache-first within TTL; live fetch on miss/expired; stale fallback on fetch failures.

## Tech stack / tools

- TypeScript (CommonJS project)
- Node built-ins: `https`, `fs`, `path`
- Tests: Vitest (`npm test`)

## Context (docs)

- Spec: `docs-ai/docs/initiatives/swop/features/cli-wrapper/work-items/usage-client/spec.md`
- Wave DoD: `docs-ai/docs/initiatives/waves/w1-cli-mvp.md`
- Sandbox paths: `src/lib/sandbox-paths.ts`
- Login orchestration uses sandbox auth state: `src/lib/login-logout-orchestration.ts`

---

## Task 1: Create types for parsed usage + result contract

**Files:**
- Create: `src/lib/usage-types.ts`
- Test: `src/lib/__tests__/usage-types.test.ts`

**Step 1: Write the failing test**

- Create a test that imports the types (or helper validation function if you add one) and asserts the shape you intend to use is stable.
- Keep it minimal: the goal is to pin down the contract used by `swop status` and auto-pick.

Run: `npm test`
Expected: FAIL because the new files do not exist yet.

**Step 2: Write minimal types**

Define (names can vary, but keep the semantics):

- `UsageSnapshotV1` with fields:
  - `plan_type: string`
  - `rate_limit: { allowed: boolean; limit_reached: boolean; secondary_window: { used_percent: number; reset_at: string } }`
- `UsageFreshness`:
  - `fetched_at: string` (ISO)
  - `stale: boolean`
  - `age_seconds: number`
- `UsageClientResult` union:
  - `{ ok: true; usage: UsageSnapshotV1; freshness: UsageFreshness }`
  - `{ ok: false; message: string; kind: "auth" | "network" | "timeout" | "server" | "parse"; freshness?: UsageFreshness }`

**Step 3: Run tests**

Run: `npm test`
Expected: PASS for this test file.

---

## Task 2: Implement sandbox token reader (auth.json)

**Files:**
- Create: `src/lib/usage-auth.ts`
- Test: `src/lib/__tests__/usage-auth.test.ts`

**Step 1: Write failing tests**

Add tests covering:

1) Reads `tokens.access_token` from a temp sandbox `auth.json` and returns it.
2) Missing file → returns an `{ ok: false, kind: "auth" }`-style error (or throws a typed error you catch later; pick one and stay consistent).
3) Missing `tokens.access_token` / empty string → returns an auth error (actionable, no secrets).

Use `SWOP_ROOT` + `createSandbox(...)` + write a test `auth.json` at `resolveSandboxPaths(...).authPath`.

Run: `npm test`
Expected: FAIL.

**Step 2: Implement token reader**

Implementation requirements:

- Read JSON from the sandbox `auth.json` path (`resolveSandboxPaths(label, env).authPath`).
- Extract `tokens.access_token`.
- Never log/print the token; errors must not include token contents.

**Step 3: Run tests**

Run: `npm test`
Expected: PASS.

---

## Task 3: Implement cache read/write helpers

**Files:**
- Create: `src/lib/usage-cache.ts`
- Test: `src/lib/__tests__/usage-cache.test.ts`

**Step 1: Write failing tests**

Cover:

1) Cache path is `<sandboxRoot>/usage-cache.json` (use `resolveSandboxPaths(...).sandboxRoot`).
2) Write cache (0600) and read back.
3) TTL logic: within 15m → cache hit; older than 15m → treated as expired/stale-required (your helper should return “expired”).
4) Atomic write behavior: verify file contents are valid JSON after write (you can reuse `writeFile0600Atomic` from `src/lib/fs.ts`).

Run: `npm test`
Expected: FAIL.

**Step 2: Implement helpers**

Suggested surface:

- `getUsageCachePath(label, env): string`
- `readUsageCache(label, env): { ok: true; usage: UsageSnapshotV1; fetched_at: string } | { ok: false; reason: "missing" | "invalid" }`
- `writeUsageCache(label, env, payload): void` (0600, atomic)
- `isWithinTtl(fetched_at_iso: string, now: Date, ttlMs: number): boolean`

Keep the cache schema minimal; do not store secrets or raw responses.

**Step 3: Run tests**

Run: `npm test`
Expected: PASS.

---

## Task 4: Implement live fetcher for `wham/usage`

**Files:**
- Create: `src/lib/usage-fetch.ts`
- Test: `src/lib/__tests__/usage-fetch.test.ts`

**Step 1: Write failing tests**

Do not hit the real network in unit tests.

- Provide a way to inject a request function (dependency injection) so tests can simulate:
  1) 200 with a JSON body containing required fields → parse success
  2) non-200 (401/403) → classify as `auth`
  3) 5xx → classify as `server`
  4) invalid JSON / missing fields → classify as `parse`
  5) timeout → classify as `timeout`

Run: `npm test`
Expected: FAIL.

**Step 2: Implement fetcher**

Requirements:

- URL: `https://chatgpt.com/backend-api/wham/usage`
- Method: GET
- Headers:
  - `Authorization: Bearer <access_token>`
  - `Accept: application/json`
- Enforce a hard 2s deadline per attempt (use `AbortController` with `https.request` if available in your Node version; otherwise implement a request timeout that destroys the request).

**Step 3: Run tests**

Run: `npm test`
Expected: PASS.

---

## Task 5: Build the `usage-client` orchestrator (cache-first, stale fallback)

**Files:**
- Create: `src/lib/usage-client.ts`
- Test: `src/lib/__tests__/usage-client.test.ts`

**Step 1: Write failing tests**

Cover these cases end-to-end with injected clock + injected fetcher:

1) Cache hit within TTL → returns `{ ok: true }`, `stale=false`, no network call.
2) Cache miss → live fetch succeeds → returns `{ ok: true }`, writes cache.
3) Cache expired + live fetch fails → returns cached usage with `stale=true` and an error summary (non-leaky).
4) No cache + live fetch fails → returns `{ ok: false }` with actionable message and correct `kind`.

Run: `npm test`
Expected: FAIL.

**Step 2: Implement orchestrator**

- Reads cache first; if within TTL, returns cached.
- On miss/expired, reads token, attempts live fetch (2s deadline).
- On live success, writes cache and returns fresh result.
- On live failure:
  - if cache exists, return cached marked stale + include failure message/kind
  - if no cache, return error state

**Step 3: Run tests**

Run: `npm test`
Expected: PASS.

---

## Task 6: Wire minimal CLI exposure (optional for this work item)

**Files:**
- Modify: `src/index.ts`
- Test: `src/__tests__/index.test.ts`

**Step 1: Decide if this belongs in this work item**

If the repo already has `swop status` implemented elsewhere, skip this task.

If not implemented yet, add a minimal internal command (even if hidden) to exercise usage-client for manual verification, e.g.:

- `swop usage <label>`: prints either parsed fields or an error state (no secrets).

Run: `npm test`
Expected: depends on existing CLI tests; keep changes minimal.

---

## Task 7: Manual verification (required by product intent, outside unit tests)

Prerequisites:

- You have a working `codex` binary installed.
- You have at least one sandbox created via `swop add <label>` (requires TTY and successful `codex login`).

**Step 1: Create a sandbox + login**

Run (TTY): `SWOP_ROOT=/tmp/swop-dev swop add work`
Expected: prints `Added account: work`

**Step 2: Run the usage command**

If you implemented `swop usage <label>` in Task 6:

Run: `SWOP_ROOT=/tmp/swop-dev swop usage work`
Expected:
- prints `plan_type`, `used_percent`, `reset_at` (human-readable can be done by status work item; here raw is acceptable)
- does not print tokens or auth.json contents

If you did not implement Task 6:

- Add a tiny one-off Node script under `/tmp` that calls the exported usage-client in-process (do not commit it), or run via `node -e` to invoke it.

**Step 3: Confirm cache file exists**

Check: `/tmp/swop-dev/accounts/work/usage-cache.json`
Expected: exists, is readable by you only, contains only parsed fields + fetched_at.

**Step 4: Confirm TTL behavior**

- Re-run the usage command; it should return quickly (cache hit).
- Optionally, edit `fetched_at` in the cache file to an old timestamp and re-run to force live fetch.

---

## GREEN checkpoint: full verification

Run:

- `npm run -s typecheck`
- `npm test`
- `npm run -s build`

Expected: all commands succeed.

---

## Docs update (mark done) — do last

Follow `documentation-stewardship` rules when changing status.

1) Update `docs-ai/docs/initiatives/swop/features/cli-wrapper/work-items/usage-client/spec.md`:
   - Status → `done`
   - Check acceptance criteria boxes
2) Update feature table status in `docs-ai/docs/initiatives/swop/features/cli-wrapper/overview.md`
3) Prefix the delivery-map line in `docs-ai/docs/initiatives/delivery-map.md` with `**DONE**` (keep ✅)

---

## Final commit

Commit once at the end:

```bash
git add -A
git commit -m "feat(cli-wrapper): add usage client with cache and timeouts"
```
