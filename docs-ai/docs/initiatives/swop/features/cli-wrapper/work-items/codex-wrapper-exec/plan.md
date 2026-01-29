# Plan: codex-wrapper-exec

> **Execution mode:** autonomous
>
> **Note:** Prefer resilient assertions (substring/structure) over exact CLI text matching when writing tests for user-facing output.

## Goal

Implement `swop codex ...` so it:

- selects an account at process start (explicit `--account` or default `--auto`)
- runs `codex` under the selected account’s sandbox environment (per isolation policy)
- supports concurrent invocations without cross-account auth corruption
- updates `meta.json:last_used_at` at process start (just before exec)

## References

- Work item spec (source of truth): `docs-ai/docs/initiatives/swop/features/cli-wrapper/work-items/codex-wrapper-exec/spec.md`
- Feature overview status table: `docs-ai/docs/initiatives/swop/features/cli-wrapper/overview.md`
- Delivery work queue: `docs-ai/docs/initiatives/delivery-map.md`
- Wave brief (w1 DoD + scenarios): `docs-ai/docs/initiatives/waves/w1-cli-mvp.md`
- Sandbox model + paths: `src/lib/sandbox-manager.ts`, `src/lib/sandbox-paths.ts`, `src/lib/sandbox-model.ts`
- Codex env isolation helper: `src/lib/codex-env.ts`
- Usage client: `src/lib/usage-client.ts`
- Auto-pick selection: `src/lib/auto-pick-policy.ts`

## Tech / Commands

- Tests: `npm test` (Vitest)
- Typecheck: `npm run typecheck`
- Build: `npm run build`
- Optional “quality” shortcut:
  - If a `Justfile` exists: `just quality`
  - Otherwise: `npm test && npm run typecheck && npm run build`

---

## Task 1: Add failing tests for `swop codex` CLI parsing + pass-through

**Files**

- Modify: `src/__tests__/index.test.ts`

**Step 1: Write failing tests (no implementation yet)**

Add tests that define the CLI contract at the `main()` level:

1) Default is auto-pick:
   - `await main(["node", "swop", "codex", "--", "--version"])`
   - expects the codex execution path to be invoked (we’ll mock a new helper module in later tasks).

2) Reject ambiguous args without `--`:
   - `await main(["node", "swop", "codex", "--version"])`
   - expects non-zero exit and a message that instructs the user to use `--` for pass-through.

3) Accept empty pass-through:
   - `await main(["node", "swop", "codex"])`
   - expects it to attempt to run `codex` with no args (interactive TUI behavior is owned by `codex`).

Keep assertions resilient: check `process.exitCode` and that `console.error` contains a clear hint (“use `--`”).

**Step 2: Run tests to confirm failure**

Run: `npx vitest run src/__tests__/index.test.ts`
Expected: FAIL until the `codex` command is added and wired.

✅ **GREEN checkpoint:** failing tests exist that pin down argument parsing behavior.

---

## Task 2: Add failing unit tests for the `swop codex` orchestration logic

**Files**

- Create: `src/lib/__tests__/codex-wrapper-exec.test.ts`

**Step 1: Define a testable orchestration function API**

Write tests assuming a new function like:

```ts
export async function runSwopCodexCommand(
  args: string[],
  env: NodeJS.ProcessEnv,
  deps: {
    runCodex: CodexRunner;
    listSandboxes: typeof listSandboxes;
    getUsageForAccount: typeof getUsageForAccount;
    touchLastUsedAt: (label: string, env: NodeJS.ProcessEnv, now: Date) => void;
    now?: () => Date;
    stdout?: Pick<Console, "log">;
    stderr?: Pick<Console, "error">;
  },
): Promise<{ ok: true; exitCode: number } | { ok: false; message: string; exitCode: number }>;
```

**Step 2: Write failing tests for core cases**

Cover at minimum:

1) `--account <label>`:
   - verifies it checks existence (sandbox root/meta) and uses that label without auto-pick.
   - verifies it calls `touchLastUsedAt(label, ...)` **before** running `codex`.

2) Default auto-pick:
   - stubs `listSandboxes()` to return 2+ labels
   - stubs `getUsageForAccount()` to return “fresh” and “stale” results so Tier 1 wins when present
   - verifies it calls `selectAutoPickAccount()` over Tier 1 candidates.

3) Tier 2 fallback:
   - make Tier 1 empty (all stale), Tier 2 has at least one account with `age_seconds <= 24h`
   - verifies it prints a warning about stale selection including `age_seconds`.

4) No eligible accounts:
   - all accounts have missing usage (client returns `ok:false`) OR stale too old
   - verifies it fails with an actionable message (suggest retry and inspecting account health).

5) “All accounts blocked”:
   - candidates exist but all have `allowed=false` or `limit_reached=true`
   - verifies failure message contains “blocked” and includes a reset time when available (as provided by `auto-pick-policy`).

6) Pass-through:
   - args after `--` are passed to `runCodex()` verbatim.

**Step 3: Run tests to confirm failure**

Run: `npx vitest run src/lib/__tests__/codex-wrapper-exec.test.ts`
Expected: FAIL until the new module exists.

✅ **GREEN checkpoint:** failing tests cover selection tiering + pass-through + failure modes.

---

## Task 3: Implement `touchLastUsedAt` (sandbox meta update) + unit tests

**Files**

- Modify: `src/lib/sandbox-manager.ts`
- Modify: `src/lib/sandbox-model.ts` (only if needed)
- Create/Modify: `src/lib/__tests__/sandbox-manager.test.ts`

**Step 1: Add a small helper to update `last_used_at`**

Implement an exported function (name is flexible, but keep it explicit), e.g.:

- `export function touchSandboxLastUsedAt(label: string, env: NodeJS.ProcessEnv, now: Date): void`

Implementation requirements:

- Reads `<accountsRoot>/<label_key>/meta.json`
- Validates it parses as `SandboxMetaV1` (at least `schema_version`, `label`, `label_key`, `created_at`)
- Writes back the same JSON with `last_used_at = now.toISOString()`
- Uses `writeFile0600Atomic(...)` so updates are atomic and permissions remain strict.

**Step 2: Write/extend unit tests**

Add tests that:

- create a temp sandbox root in `/tmp` via `SWOP_ROOT`
- create a sandbox via `createSandbox("Work", env, realHome)`
- call `touchSandboxLastUsedAt(...)`
- re-read meta.json and assert:
  - `last_used_at` exists and is parseable
  - other fields remain unchanged

**Step 3: Run tests**

Run: `npx vitest run src/lib/__tests__/sandbox-manager.test.ts`
Expected: PASS.

✅ **GREEN checkpoint:** meta update behavior is atomic and deterministic.

---

## Task 4: Implement `codex-wrapper-exec` orchestration module (no CLI wiring yet)

**Files**

- Create: `src/lib/codex-wrapper-exec.ts`

**Step 1: Implement argument parsing**

Implement parsing for:

- `--account <label>`
- `--auto`
- optional `--` delimiter:
  - if `--` is present: everything after is `codexArgs`
  - if `--` is absent:
    - if there are extra args beyond flags, fail with a “use `--`” hint
    - otherwise `codexArgs = []`

**Step 2: Implement selection**

- Explicit: verify sandbox exists (use `resolveSandboxPaths` + `lstatSafe` checks); error if missing.
- Auto:
  - list accounts via `listSandboxes(env)` (use `.label`)
  - for each label, call `getUsageForAccount(label, env)`
  - apply freshness tiering per `auto-pick-freshness-policy`:
    - Tier 1: `ok=true` and `freshness.stale=false`
    - Tier 2: only if Tier 1 empty; `ok=true`, `freshness.stale=true`, and `age_seconds <= 24h`
    - otherwise ineligible
  - if Tier 2 is used: print a warning mentioning stale selection and age
  - run `selectAutoPickAccount()` over the selected tier’s candidates

**Step 3: Implement codex execution**

- Before calling `runCodex`, call `touchLastUsedAt(selectedLabel, env, now)`
- Build sandbox env via `buildSandboxCodexEnv(env, paths.sandboxHome, paths.sandboxRoot)`
- Execute `runCodex(codexArgs, { env: sandboxEnv, stdio: "inherit" })`
- Return an exit code that propagates the underlying `codex` status:
  - if `runCodex` returns `code === null`, treat as non-zero (e.g., `1`)

**Step 4: Run unit tests**

Run: `npx vitest run src/lib/__tests__/codex-wrapper-exec.test.ts`
Expected: PASS.

✅ **GREEN checkpoint:** orchestration logic is fully unit-tested without touching the real network or `codex`.

---

## Task 5: Wire `swop codex` into the CLI entrypoint

**Files**

- Modify: `src/index.ts`
- Modify: `src/__tests__/index.test.ts`

**Step 1: Add `codex` to usage output**

Update `printUsage()` to include:

- `swop codex [--account <label> | --auto] -- <codex args...>`

**Step 2: Add a `command === "codex"` branch**

In `main(argv)`, add a new branch that:

- passes `args.slice(1)` to `runSwopCodexCommand(...)`
- sets `process.exitCode` from the returned `exitCode`
- prints the returned failure `message` when `ok=false`

Use real dependencies:

- `listSandboxes` from `src/lib/sandbox-manager.ts`
- `getUsageForAccount` from `src/lib/usage-client.ts`
- `runCodex` from `src/lib/codex-runner.ts`
- `touchSandboxLastUsedAt` from `src/lib/sandbox-manager.ts`

**Step 3: Update tests**

Update the Task 1 tests to:

- mock the new orchestration module for parsing-only tests, or
- keep it “real” but fully mocked via module mocks for the dependent libs.

Run: `npx vitest run src/__tests__/index.test.ts`
Expected: PASS.

✅ **GREEN checkpoint:** CLI supports the new command and doesn’t break existing commands.

---

## Task 6: Repo-wide verification

1) Full tests:
   - Run: `npm test`
   - Expected: PASS

2) Typecheck:
   - Run: `npm run typecheck`
   - Expected: PASS

3) Build:
   - Run: `npm run build`
   - Expected: PASS

4) If available:
   - Run: `just quality`

✅ **GREEN checkpoint:** repo is green across tests/typecheck/build.

---

## Task 7: Mark the work item done in docs (after implementation is complete)

> Apply documentation-stewardship: keep status consistent across spec, feature overview, and delivery map.

**Files**

- Modify: `docs-ai/docs/initiatives/swop/features/cli-wrapper/work-items/codex-wrapper-exec/spec.md`
- Modify: `docs-ai/docs/initiatives/swop/features/cli-wrapper/overview.md`
- Modify: `docs-ai/docs/initiatives/delivery-map.md`

**Steps**

1) `spec.md`: set `## Status` to `done` and check all acceptance criteria boxes.
2) `overview.md`: set the work item row status to `done`.
3) `delivery-map.md`: prefix the work queue line with `**DONE**` (keep ✅).

**Verify**

- Run: `rg -n "codex-wrapper-exec" docs-ai/docs`
- Expected: statuses are consistent; no contradictory statuses remain.

✅ **GREEN checkpoint:** docs match the implementation state.

---

## Task 8: Commit (single commit at the end)

1) Review:
   - `git status`
   - `git diff`

2) Stage + commit:

```bash
git add \
  src/index.ts \
  src/__tests__/index.test.ts \
  src/lib/codex-wrapper-exec.ts \
  src/lib/sandbox-manager.ts \
  src/lib/__tests__/codex-wrapper-exec.test.ts \
  src/lib/__tests__/sandbox-manager.test.ts \
  docs-ai/docs/initiatives/swop/features/cli-wrapper/work-items/codex-wrapper-exec/spec.md \
  docs-ai/docs/initiatives/swop/features/cli-wrapper/overview.md \
  docs-ai/docs/initiatives/delivery-map.md
git commit -m "feat(swop): add swop codex sandboxed execution"
```

3) Verify:
   - `git status` (expected: clean)
