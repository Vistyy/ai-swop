# Plan: auto-pick-policy

> **Execution mode:** autonomous
>
> **Note:** Prefer resilient assertions (substring/structure) over exact CLI text matching when writing tests for user-facing output.

## Goal

Implement the v1 deterministic account selection policy for `swop codex ...`:

- pick the viable account with lowest 7-day `used_percent`,
- tie-break deterministically by normalized account label (case-insensitive lexicographic, ascending),
- if all eligible accounts are blocked, fail with an actionable message that includes the earliest known reset time when available.

This plan implements the policy as a reusable library function; integration into a `swop codex ...` command belongs to `swop/cli-wrapper/codex-wrapper-exec`.

## References

- Work item spec (source of truth): `docs-ai/docs/initiatives/swop/features/cli-wrapper/work-items/auto-pick-policy/spec.md`
- Freshness policy (tiering + required fields): `docs-ai/docs/initiatives/swop/features/cli-wrapper/work-items/auto-pick-freshness-policy/spec.md`
- Usage types (snapshot shape): `src/lib/usage-types.ts`
- Label normalization helper: `src/lib/labels.ts`
- Feature overview status table: `docs-ai/docs/initiatives/swop/features/cli-wrapper/overview.md`
- Delivery work queue: `docs-ai/docs/initiatives/delivery-map.md`

## Tech / Commands

- Tests: `npm test` (Vitest)
- Typecheck: `npm run typecheck`
- Build: `npm run build`

---

## Task 1: Add a failing unit test scaffold for selection behavior

**Files**

- Create: `src/lib/__tests__/auto-pick-policy.test.ts`

**Step 1: Write the failing tests (no implementation yet)**

Create tests for the core cases:

1) Picks lowest `used_percent` among viable accounts
2) Excludes blocked accounts (`allowed=false` or `limit_reached=true`)
3) Tie-breaks by normalized label (case-insensitive lexicographic)
4) All blocked: returns a failure that includes earliest known reset time (parseable dates only)
5) All blocked with no parseable reset time: message contains “reset time unknown”

Use minimal, explicit fixtures like:

```ts
const candidates = [
  { label: "Work", usage: { /* ... */ } },
  { label: "personal", usage: { /* ... */ } },
];
```

Keep assertions resilient:

- Prefer `expect(result.ok).toBe(true)` / `false`
- Prefer `expect(result.message).toContain("blocked")` over exact strings
- Prefer structural checks (selected label) over exact console output

**Step 2: Run the tests to confirm failure**

Run: `npx vitest run src/lib/__tests__/auto-pick-policy.test.ts`
Expected: FAIL because `src/lib/auto-pick-policy.ts` (and exports) do not exist yet.

✅ **GREEN checkpoint:** failing tests exist for all acceptance-criteria behaviors.

---

## Task 2: Implement the selection policy as a pure library function

**Files**

- Create: `src/lib/auto-pick-policy.ts`

**Step 1: Implement minimal types for inputs/outputs**

Implement a function that can be called by future CLI orchestration code without depending on filesystem or network:

- Inputs: a list of candidates with `{ label: string; usage: UsageSnapshotV1 }`
- Output:
  - success: `{ ok: true; selected: { label: string }; message: string }`
  - failure: `{ ok: false; kind: "all-blocked"; message: string; earliest_reset_at?: string }`

Use `UsageSnapshotV1` from `src/lib/usage-types.ts` and `normalizeLabelKey` from `src/lib/labels.ts`.

**Step 2: Implement viability filter + selection**

- Viable: `allowed=true && limit_reached=false`
- Sort viable accounts by:
  1) `used_percent` ascending
  2) normalized label ascending
- Pick the first item.

**Step 3: Implement “all blocked” behavior**

When there are no viable candidates:

- Compute earliest known reset time across **blocked** candidates by:
  - parsing `Date.parse(usage.rate_limit.secondary_window.reset_at)`
  - ignoring values that parse to `NaN`
  - taking the minimum parseable timestamp (if any)
- Produce a failure message:
  - includes “all accounts blocked”
  - includes “until …” when an earliest reset time exists
  - otherwise includes “reset time unknown”

Keep messages non-leaky (no auth/session material; no raw payload dumps).

**Step 4: Run tests**

Run: `npx vitest run src/lib/__tests__/auto-pick-policy.test.ts`
Expected: PASS.

✅ **GREEN checkpoint:** selection logic is deterministic and fully unit-tested.

---

## Task 3: Add a small unit test for tie-break normalization

**Why:** Prevent accidental locale-dependent comparisons or case sensitivity regressions.

**Files**

- Modify: `src/lib/__tests__/auto-pick-policy.test.ts`

**Step 1: Add a test where `used_percent` ties**

Example idea:

- `label: "Work"` vs `label: "personal"`
- same `used_percent`
- expect `"personal"` wins (normalized `personal` < `work`)

Also add a case-insensitivity check:

- `label: "A"` vs `label: "a"`
- same `used_percent`
- expect deterministic behavior (e.g., stable sort by normalized label; if equal after normalization, fall back to original label as a stable secondary key)

If you need a secondary tie-break when the normalized keys are identical, implement it explicitly (e.g., original label lexicographic).

**Step 2: Run the test file**

Run: `npx vitest run src/lib/__tests__/auto-pick-policy.test.ts`
Expected: PASS.

✅ **GREEN checkpoint:** ties are deterministic even with case variants.

---

## Task 4: Repo-wide verification

**Step 1: Run full unit tests**

Run: `npm test`
Expected: PASS.

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS.

✅ **GREEN checkpoint:** no regressions across the repo.

---

## Task 5: Mark the work item done in docs (after implementation is complete)

> Apply documentation-stewardship: keep status consistent across spec, feature overview, and delivery map.

**Files**

- Modify: `docs-ai/docs/initiatives/swop/features/cli-wrapper/work-items/auto-pick-policy/spec.md`
- Modify: `docs-ai/docs/initiatives/swop/features/cli-wrapper/overview.md`
- Modify: `docs-ai/docs/initiatives/delivery-map.md`

**Steps**

1) `spec.md`: change `## Status` to `done`, and check all acceptance criteria boxes.
2) `overview.md`: set the work item row status to `done`.
3) `delivery-map.md`: prefix the work queue line with `**DONE**` (keep ✅).

**Verify**

- Run: `rg -n "auto-pick-policy" docs-ai/docs`
- Expected: status is consistent and there are no contradictory statuses.

✅ **GREEN checkpoint:** docs match the implementation state.

---

## Task 6: Commit (single commit at the end)

**Steps**

1) Review changes:
   - `git status`
   - `git diff`

2) Stage + commit:

```bash
git add src/lib/auto-pick-policy.ts src/lib/__tests__/auto-pick-policy.test.ts \
  docs-ai/docs/initiatives/swop/features/cli-wrapper/work-items/auto-pick-policy/spec.md \
  docs-ai/docs/initiatives/swop/features/cli-wrapper/overview.md \
  docs-ai/docs/initiatives/delivery-map.md
git commit -m "feat(swop): implement auto-pick policy"
```

**Verify**

- Run: `git status`
- Expected: clean working tree.

