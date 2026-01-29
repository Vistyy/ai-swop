# Plan: account-sandbox-manager

> Work item: `swop/cli-wrapper/account-sandbox-manager`  
> Spec: `docs-ai/docs/initiatives/swop/features/cli-wrapper/work-items/account-sandbox-manager/spec.md`

**Execution mode:** interactive

## Goal

Create the initial TypeScript implementation of the “account sandbox manager” in `src/` that:

- Resolves the sandbox root consistently (WSL/mac friendly).
- Normalizes account labels into safe keys.
- Creates/list/removes sandboxes safely.
- Implements the `.codex` sharing policy: per-account `auth.json`, symlink all other existing `~/.codex/*` entries.
- Enforces safe permissions defaults and never prints secrets.

## Non-goals (owned by other work items)

- Running `codex login`/`codex logout` (`swop/cli-wrapper/login-logout-orchestration`)
- Running `codex` (`swop/cli-wrapper/codex-wrapper-exec`)
- Usage fetching (`swop/cli-wrapper/usage-client`)
- Auto-pick policy (`swop/cli-wrapper/auto-pick-policy`)

## Assumptions / prerequisites

- This repo will host the v1 CLI code under `src/` (no product code exists yet).
- Node.js + TypeScript stack is acceptable for v1.
- Plan is executed on WSL2 Ubuntu and/or macOS. On either OS, local file permissions should support owner-only modes.

If any assumption is false, stop and resolve before continuing.

---

## Task 0: Create minimal project scaffolding (TS + tests)

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `src/index.ts`
- Create: `src/lib/errors.ts`
- Create: `src/lib/fs.ts`
- Create: `src/lib/labels.ts`
- Create: `src/lib/swop-root.ts`
- Create: `src/lib/sandbox-manager.ts`
- Create: `src/lib/sandbox-model.ts`
- Create: `src/lib/codex-sharing.ts`
- Create: `src/lib/__tests__/labels.test.ts`
- Create: `src/lib/__tests__/swop-root.test.ts`
- Create: `src/lib/__tests__/sandbox-manager.test.ts`

**Step 1: Initialize Node project**

Run: `npm init -y`  
Expected: `package.json` created.

**Step 2: Add dependencies**

Run: `npm i -D typescript vitest @types/node tsx`  
Expected: dev deps installed.

**Step 3: Add basic scripts**

Edit `package.json` to include:
- `test`: `vitest run`
- `test:watch`: `vitest`
- `typecheck`: `tsc -p tsconfig.json --noEmit`

**Step 4: Create TS config**

Create `tsconfig.json` with:
- `target` reasonable for Node LTS
- `module` / `moduleResolution` for Node
- `rootDir`: `src`
- `outDir`: `dist`
- `strict`: `true`

**Step 5: Sanity check**

Run: `npm run typecheck`  
Expected: PASS (no TS files yet may require at least `src/index.ts` to exist).

**Interactive checkpoint (GREEN):** confirm you can run `npm run test` locally.

---

## Task 1: Encode the spec as types and helpers (no filesystem writes yet)

**Files:**
- Create: `src/lib/sandbox-model.ts`
- Create: `src/lib/errors.ts`

**Step 1: Define the metadata type**

Implement `SandboxMetaV1` with fields from the spec:
- `schema_version: 1`
- `label: string`
- `label_key: string`
- `created_at: string`
- `last_used_at?: string`

**Step 2: Add typed errors**

Create small error classes (or tagged error objects) for:
- invalid label
- sandbox already exists
- sandbox not found
- unsafe path / attempted escape

**Step 3: Tests**

Add a minimal test that `schema_version` is always `1` when constructing new metadata.

Run: `npm run test`  
Expected: PASS.

---

## Task 2: Implement label normalization (`label` → `label_key`)

**Files:**
- Create: `src/lib/labels.ts`
- Create: `src/lib/__tests__/labels.test.ts`

**Step 1: Write tests first**

Test cases (add more if you think of edge cases):
- `"Work"` → `work`
- `"work account"` → `work-account`
- `"work_account"` → `work-account`
- `"work---account"` → `work-account` (collapse)
- `"../work"` → error
- `"work/evil"` → error
- `"   "` → error

**Step 2: Implement `normalizeLabelKey(label: string): string`**

Rules must match spec:
- lower-case
- spaces and `_` become `-`
- final key only `[a-z0-9-]`
- collapse consecutive `-`
- reject empty and reject path traversal / separators

**Step 3: Run tests**

Run: `npm run test`  
Expected: PASS.

---

## Task 3: Implement sandbox root resolution

**Files:**
- Create: `src/lib/swop-root.ts`
- Create: `src/lib/__tests__/swop-root.test.ts`

**Step 1: Write tests first**

Cover precedence:
1) `SWOP_ROOT` set → `${SWOP_ROOT}/accounts`
2) else `XDG_STATE_HOME` set → `${XDG_STATE_HOME}/swop/accounts`
3) else `${HOME}/.swop/accounts`

In tests, set env vars explicitly and restore them after each test.

**Step 2: Implement `resolveAccountsRoot(env: NodeJS.ProcessEnv): string`**

Return an absolute path. Do not touch the filesystem in this function.

**Step 3: Run tests**

Run: `npm run test`  
Expected: PASS.

---

## Task 4: Add safe filesystem utilities (mkdir, chmod, atomic write)

**Files:**
- Create: `src/lib/fs.ts`
- Create: `src/lib/__tests__/sandbox-manager.test.ts` (start file, fill later)

**Step 1: Define minimal fs helpers**

Implement helpers (sync or async; pick one style and stick with it):
- `mkdir0700(path)`
- `writeFile0600Atomic(path, content)` (write temp then rename)
- `readJson(path)`
- `removeTree(path)` (recursive remove)
- `lstatSafe(path)` / existence checks

**Step 2: Permissions**

On POSIX, enforce:
- directories `0700`
- files `0600`

If running on a platform where chmod behaves differently, document expected behavior in error messages but do not leak paths that include secrets.

**Step 3: Add one test**

Use `SWOP_ROOT` pointing at a temp directory under the test runner’s temp space; ensure helper creates directories/files.

Run: `npm run test`  
Expected: PASS.

---

## Task 5: Implement `.codex` sharing logic (symlink all except `auth.json`)

**Files:**
- Create: `src/lib/codex-sharing.ts`
- Modify: `src/lib/__tests__/sandbox-manager.test.ts`

**Step 1: Write tests first**

In a temp directory:
- create a fake `REAL_HOME/.codex/` with a few entries:
  - `config.toml` (file)
  - `history.jsonl` (file)
  - `sessions/` (dir)
  - `auth.json` (file) (must NOT be symlinked)
- create a sandbox `home/.codex/`

Expected outcomes:
- `home/.codex/auth.json` does not exist after “share” step (it will be created by login later)
- other entries are symlinks pointing back to `REAL_HOME/.codex/*`

**Step 2: Implement `populateSharedCodexEntries(...)`**

Inputs should include:
- `realHomeCodexDir` (e.g., `${REAL_HOME}/.codex`)
- `sandboxHomeCodexDir` (e.g., `${sandboxHome}/.codex`)

Behavior:
- ensure sandbox `.codex` directory exists (0700)
- enumerate entries in `realHomeCodexDir` at runtime
- for each entry except `auth.json`, create a symlink in sandbox pointing to the real entry
- if an entry already exists in sandbox, either:
  - verify it already points to the correct target, or
  - error with an actionable message

**Step 3: Run tests**

Run: `npm run test`  
Expected: PASS.

**Interactive checkpoint (GREEN):** confirm symlink behavior works on your OS (WSL/mac) and note any OS-specific symlink restrictions.

---

## Task 6: Implement sandbox manager (create/list/remove)

**Files:**
- Create: `src/lib/sandbox-manager.ts`
- Modify: `src/lib/__tests__/sandbox-manager.test.ts`

**Step 1: Write tests first**

Create tests using a temp `SWOP_ROOT`:

Create:
- `createSandbox({ label })` creates:
  - `<accounts_root>/<key>/meta.json` (0600) with schema_version 1
  - `<accounts_root>/<key>/home/.codex/` (0700)
  - symlinks for shared `.codex` entries (excluding `auth.json`)
- When sandbox exists (same label, case-insensitive), create must throw “already exists” error.

List:
- `listSandboxes()` returns one entry with:
  - `label`, `label_key`, `created_at`, `last_used_at?`
- list must not read or return any secrets (no auth contents).

Remove:
- removing existing sandbox deletes only `<accounts_root>/<key>/...`
- cannot delete outside accounts root (guardrail test: attempt to remove label that would escape if normalization were buggy)
- removing non-existent sandbox yields a clear “not found” error

**Step 2: Implement minimal API**

Implement a class or functions:
- `createSandbox(label, env, realHome?)`
- `listSandboxes(env)`
- `removeSandbox(label, env)`

Plan for future dependencies by accepting `env` and `realHome` as parameters rather than capturing globals in module scope.

**Step 3: Run tests + typecheck**

Run: `npm run test`  
Expected: PASS.  
Run: `npm run typecheck`  
Expected: PASS.

---

## Task 7: Add a minimal CLI surface (non-production, for smoke tests)

**Files:**
- Modify: `src/index.ts`

**Step 1: Minimal command parsing**

Add a very small CLI parser (no external dependency) supporting:
- `swop sandbox create <label>`
- `swop sandbox list`
- `swop sandbox remove <label>`

Ensure errors:
- do not print secrets
- are actionable (include label and next steps)

**Step 2: Smoke test locally**

Run:
- `SWOP_ROOT=/tmp/swop-dev npm run -s typecheck`
- `SWOP_ROOT=/tmp/swop-dev node --import tsx src/index.ts sandbox create work`
- `SWOP_ROOT=/tmp/swop-dev node --import tsx src/index.ts sandbox list`
- `SWOP_ROOT=/tmp/swop-dev node --import tsx src/index.ts sandbox remove work`

Expected:
- create succeeds
- list shows `work`
- remove succeeds and deletes only sandbox paths

**Interactive checkpoint (GREEN):** confirm output contains no token/session material.

---

## Task 8: Documentation updates for completion (when implementation is done)

> Apply `documentation-stewardship` workflow before making these edits.

**Files:**
- Modify: `docs-ai/docs/initiatives/swop/features/cli-wrapper/work-items/account-sandbox-manager/spec.md`
- Modify: `docs-ai/docs/initiatives/swop/features/cli-wrapper/overview.md`
- Modify: `docs-ai/docs/initiatives/delivery-map.md`

**Step 1: Mark work item as done**

- In the work item spec: set `Status` to `done` and check acceptance criteria.
- In the feature overview Work Items table: set this work item status to `done`.
- In delivery-map: prefix this work item line with `**DONE**` (keep ✅ symbol).

**Step 2: Cross-reference check**

Run: `rg -n \"swop/cli-wrapper/account-sandbox-manager\" docs-ai/docs`  
Expected: all references still resolve; no broken relative links.

---

## Final verification (required)

Run:
- `npm run test`
- `npm run typecheck`

Expected: PASS.

## Final commit (single commit at end)

Run:
```bash
git add package.json tsconfig.json vitest.config.ts src docs-ai/docs/initiatives/swop/features/cli-wrapper/work-items/account-sandbox-manager/spec.md docs-ai/docs/initiatives/swop/features/cli-wrapper/overview.md docs-ai/docs/initiatives/delivery-map.md
git commit -m "feat(cli-wrapper): add account sandbox manager"
```
