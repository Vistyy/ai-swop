# Plan: login-logout-orchestration

> Work item: `swop/cli-wrapper/login-logout-orchestration`  
> Spec: `docs-ai/docs/initiatives/swop/features/cli-wrapper/work-items/login-logout-orchestration/spec.md`

**Execution mode:** interactive

## Goal

Implement `swop add <account>` and `swop logout <account>` such that:

- `swop add` runs `codex login` inside the account sandbox and is atomic (no “half-added” accounts).
- `swop add` fails fast in non-interactive contexts (no sandbox created).
- `swop logout` always deletes the local sandbox, and best-effort runs `codex logout` first when available.
- The wrapper does not print token/session material.

## Decisions (locked)

| Decision | Chosen option |
|---|---|
| `swop add` login failure/cancel | Roll back by deleting sandbox |
| `swop add` non-interactive behavior | Fail fast; create nothing |
| `swop logout` ordering | Best-effort `codex logout` before local delete |
| `swop logout` remote revoke | Best-effort only; never blocks local delete |

## Assumptions / prerequisites

- Node.js + TypeScript environment is already set up (see existing `src/` + `vitest`).
- `account-sandbox-manager` implementation exists and is the source of truth for sandbox root + layout.
- Tests must not require a real `codex` binary; mock the process runner.

If any assumption is false, stop and resolve before continuing.

---

## Task 0: Add a small “codex runner” abstraction (mockable)

**Files:**
- Create: `src/lib/codex-runner.ts`
- Create: `src/lib/__tests__/codex-runner.test.ts` (minimal smoke coverage)

**Step 1: Define types**

Define:
- `CodexRun = { code: number | null; signal: NodeJS.Signals | null; stdout?: string; stderr?: string; errorCode?: string }`
- `CodexRunner = (args: string[], opts: { env: NodeJS.ProcessEnv; stdio: "inherit" | "pipe"; timeoutMs?: number }) => CodexRun`

**Step 2: Implement default runner**

Implement `runCodex(...)` using `node:child_process.spawnSync`:
- Command: `codex`
- Args: passed-through
- `stdio` behavior:
  - `"inherit"`: required for `codex login`
  - `"pipe"`: preferred for `codex logout` so we can detect “unsupported” without echoing output
- Include `timeoutMs` support (e.g. 30s default for logout; no timeout for login unless you want a generous one).
- On spawn error, set `errorCode` from `result.error?.code` (e.g. `ENOENT`) and set a safe `stderr` string (do not include stack traces).

**Step 3: Minimal test**

Mock `spawnSync` to return an error like `ENOENT` and assert the runner returns:
- `code = null`
- `errorCode = "ENOENT"`
- a safe `stderr` string (no stack traces, no env dumps)

Run: `npm run test`  
Expected: PASS.

---

## Task 1: Define sandbox path helpers needed by orchestration

**Files:**
- Create: `src/lib/sandbox-paths.ts`
- Create: `src/lib/__tests__/sandbox-paths.test.ts`

**Step 1: Write tests first**

In a temp `SWOP_ROOT`, after `createSandbox("Work", ...)`:
- `resolveSandboxPaths("Work", env)` returns:
  - `sandboxRoot` under accounts root (keyed by normalized label)
  - `sandboxHome` at `<sandboxRoot>/home`
  - `sandboxCodexDir` at `<sandboxHome>/.codex`
  - `authPath` at `<sandboxCodexDir>/auth.json`

Also test that `resolveSandboxPaths("Missing", env)` does not create directories and can be used for checks.

**Step 2: Implement path helper**

Create `resolveSandboxPaths(label, env)` that:
- reuses the existing label normalization + root logic (don’t duplicate rules)
- only computes paths (no filesystem writes)

**Step 3: Run tests**

Run: `npm run test`  
Expected: PASS.

---

## Task 2: Implement sandbox-scoped environment construction for `codex`

**Files:**
- Create: `src/lib/codex-env.ts`
- Create: `src/lib/__tests__/codex-env.test.ts`

**Step 1: Write tests first**

Given a base env with `HOME=/real/home` and a sandbox root:
- `buildSandboxCodexEnv(baseEnv, sandboxHome, sandboxRoot)` sets:
  - `HOME = sandboxHome`
  - `XDG_CONFIG_HOME`, `XDG_STATE_HOME`, `XDG_DATA_HOME`, `XDG_CACHE_HOME` to sandbox-local paths (under `sandboxRoot/xdg/...`)
- It must preserve unrelated env vars.

**Step 2: Implement**

Implement `buildSandboxCodexEnv(...)` as a pure function returning a new env object.

**Step 3: Run tests**

Run: `npm run test`  
Expected: PASS.

---

## Task 3: Implement `swop add` orchestration (atomic login)

**Files:**
- Create: `src/lib/login-logout-orchestration.ts`
- Create: `src/lib/__tests__/login-logout-orchestration.test.ts`

**Step 1: Define public functions**

Export:
- `addAccount(label, env, deps)` where `deps` includes:
  - `isInteractive: boolean` (derived from `process.stdin.isTTY && process.stdout.isTTY`)
  - `runCodex: CodexRunner`
  - `realHome?: string` (test-only override for sandbox sharing)

Return a result object like:
- `{ ok: true }` on success
- `{ ok: false; message: string }` on failure (message must not include secrets)

**Step 2: Write tests first**

Test cases:
1) Interactive success:
   - Use temp `SWOP_ROOT`
   - Provide a fake `runCodex` that simulates login success by writing a dummy `auth.json` at the expected `authPath`
   - Assert sandbox exists after and `auth.json` exists and is a file (not a symlink)
2) Interactive failure:
   - Fake `runCodex` returns non-zero
   - Assert sandbox directory is removed (atomic rollback)
3) Non-interactive:
   - `isInteractive=false`
   - Assert no sandbox directory is created

**Step 3: Implement minimal behavior**

Implementation rules:
- If non-interactive: return `{ ok: false; message: "swop add requires an interactive terminal (TTY) to run codex login" }`
- Otherwise:
  1) create sandbox via `createSandbox(...)`
  2) build sandbox env and call `runCodex(["login"], { stdio: "inherit", env: sandboxEnv })`
  3) treat non-zero exit / spawn error as failure and remove sandbox
  4) on “success”, verify `authPath` exists and is a file; if missing, treat as failure and remove sandbox

**Step 4: Run tests**

Run: `npm run test`  
Expected: PASS.

---

## Task 4: Implement `swop logout` orchestration (best-effort remote, always local delete)

**Files:**
- Modify: `src/lib/login-logout-orchestration.ts`
- Modify: `src/lib/__tests__/login-logout-orchestration.test.ts`

**Step 1: Extend public API**

Export:
- `logoutAccount(label, env, deps)` where `deps` includes:
  - `runCodex: CodexRunner`
  - `timeoutMs?: number` (use a default like 30_000)

Return result like:
- `{ ok: true; warning?: string }`
- `{ ok: false; message: string }` only if local delete fails or account missing (do not fail solely for remote logout failure)

**Step 2: Write tests first**

Test cases:
1) Remote logout succeeds:
   - create sandbox
   - fake `runCodex(["logout"], ...)` returns code 0
   - assert sandbox removed
2) Remote logout fails:
   - fake returns non-zero
   - assert sandbox still removed and result is ok with a warning
3) Remote logout missing `codex` binary:
   - fake returns `{ code: null, errorCode: "ENOENT" }`
   - assert sandbox removed and result is ok with a warning

**Step 3: Implement**

Implementation rules:
- Resolve sandbox paths and ensure it exists before attempting remote logout.
- Attempt `codex logout` first with `stdio: "pipe"` and a timeout.
- If remote logout errors/fails (including `ENOENT`): convert to a short non-secret warning.
- Always delete sandbox afterward via `removeSandbox(label, env)`.
- Never return a failure *only* due to remote logout failure.

**Step 4: Run tests**

Run: `npm run test`  
Expected: PASS.

---

## Task 5: Wire the CLI (`swop add`, `swop logout`)

**Files:**
- Modify: `src/index.ts`

**Step 1: Update usage**

Add:
- `swop add <label>`
- `swop logout <label>`

Keep existing `swop sandbox ...` commands (useful for debugging) unless you have a reason to remove them.

**Step 2: Implement command routing**

- For `swop add`:
  - derive `isInteractive` from `process.stdin.isTTY && process.stdout.isTTY`
  - call `addAccount(...)`
  - on failure, print only the returned `message` and exit code 1
- For `swop logout`:
  - call `logoutAccount(...)`
  - print a short success message; if warning exists, print it to stderr

**Step 3: Verify locally**

Run: `npm run typecheck`  
Expected: PASS.

Run: `npm run test`  
Expected: PASS.

---

## Task 6: Second-order shippability sweep (failure recovery + operability)

**Files:**
- Modify: `src/lib/login-logout-orchestration.ts` (if needed)
- Modify: `src/index.ts` (if needed)

Checklist:
- Ensure error messages do not include:
  - contents of `auth.json`
  - full env dumps
  - stack traces by default
- Ensure `swop logout` remains successful even if `codex` is missing or `codex logout` is unsupported.
- Ensure timeouts are bounded for non-interactive remote operations (`codex logout`).

Re-run:
- `npm run typecheck` (PASS)
- `npm run test` (PASS)

---

## Task 7: Mark work item done in docs (documentation-stewardship)

**Files:**
- Modify: `docs-ai/docs/initiatives/swop/features/cli-wrapper/work-items/login-logout-orchestration/spec.md`
- Modify: `docs-ai/docs/initiatives/swop/features/cli-wrapper/overview.md`
- Modify: `docs-ai/docs/initiatives/delivery-map.md`

**Step 1: Update spec**

- Set `## Status` to `done`.
- Check all acceptance criteria boxes.

**Step 2: Update feature overview**

- In the Work Items table, set status for this work item to `done`.

**Step 3: Update delivery map**

- Prefix the line with **DONE** (keep the ✅ symbol unchanged).

---

## Task 8: Final verification + one commit

**Step 1: Full verification**

Run:
- `npm run typecheck` (PASS)
- `npm run test` (PASS)

**Step 2: Commit**

```bash
git status
git add -A
git commit -m "feat(cli-wrapper): orchestrate codex login/logout per sandbox"
```
