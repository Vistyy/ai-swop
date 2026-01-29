# Plan: auto-pick-freshness-policy

> **Execution mode:** interactive

## Goal

Mark `swop/cli-wrapper/auto-pick-freshness-policy` as **done** as a decision work item by:

- ensuring the decision is fully captured in `spec.md` (no TBDs),
- ensuring cross-references are correct and non-duplicative, and
- updating status trackers (`overview.md`, `delivery-map.md`) consistently.

## Non-goals

- No product code changes in this plan (implementation belongs to `swop/cli-wrapper/auto-pick-policy` and related work items).
- No new policy decisions beyond what is already decided in `spec.md`.

## References

- Work item spec (source of truth): `docs-ai/docs/initiatives/swop/features/cli-wrapper/work-items/auto-pick-freshness-policy/spec.md`
- Feature overview table: `docs-ai/docs/initiatives/swop/features/cli-wrapper/overview.md`
- Work queue tracker: `docs-ai/docs/initiatives/delivery-map.md`
- Roadmap decisions log (optional log entry): `docs-ai/docs/roadmap.md`

---

## Task 1: Doc stewardship preflight

**Why:** Docs under `docs-ai/docs/` must follow single-source-of-truth and status consistency.

**Steps**

1) Read the docs you are about to touch:
   - `docs-ai/docs/initiatives/swop/features/cli-wrapper/work-items/auto-pick-freshness-policy/spec.md`
   - `docs-ai/docs/initiatives/swop/features/cli-wrapper/overview.md`
   - `docs-ai/docs/initiatives/delivery-map.md`
   - `docs-ai/docs/roadmap.md`

2) Confirm the work item’s status vocabulary is one of: `planned`, `in-progress`, `done`, `deferred`.

**Verify**

- Run: `rg -n "auto-pick-freshness-policy" docs-ai/docs`
- Expected: hits in the work item spec + feature overview + delivery-map, and references from related work items.

✅ **GREEN checkpoint:** You understand which files will be updated and why.

---

## Task 2: Spec sanity check (no remaining TBDs)

**Files**

- Verify: `docs-ai/docs/initiatives/swop/features/cli-wrapper/work-items/auto-pick-freshness-policy/spec.md`

**Steps**

1) Confirm the spec contains concrete decisions for:
   - Tiering behavior (fresh preferred; stale fallback only if no fresh)
   - Max eligible staleness (<= 24h)
   - Failure behavior when all accounts are missing/too-stale
   - User-visible messaging (warn on stale; include age; non-leaky)

2) Confirm the spec does not conflict with:
   - `docs-ai/docs/initiatives/swop/features/cli-wrapper/work-items/usage-client/spec.md` cache contract (TTL 15 minutes, “stale-ok with explicit age”)
   - `docs-ai/docs/initiatives/swop/features/cli-wrapper/work-items/auto-pick-policy/spec.md` selection rule among “viable” accounts

**Verify**

- Run: `rg -n "TBD|pending decision" docs-ai/docs/initiatives/swop/features/cli-wrapper/work-items/auto-pick-freshness-policy/spec.md`
- Expected: no matches.

✅ **GREEN checkpoint:** `spec.md` is final and decision-complete.

---

## Task 3: (Optional) Record decision in the roadmap log

**Why:** This decision is product-significant and may merit a top-level log entry without duplicating the full spec.

**Files**

- Modify: `docs-ai/docs/roadmap.md`

**Steps**

1) Add a single new row to `## Decisions (Log)` capturing the essence of the policy:
   - “Auto-pick may use stale usage only as a fallback; max stale age 24h; warn with age.”
   - Use today’s date.
   - Keep the spec as the detailed source of truth; the roadmap entry should be a pointer-level summary.

**Verify**

- Run: `rg -n "24 hours|24h" docs-ai/docs/roadmap.md`
- Expected: a single entry (avoid duplication elsewhere).

✅ **GREEN checkpoint:** Decision is logged without duplicating the spec.

---

## Task 4: Mark the work item done in docs (spec + feature overview + delivery map)

### Task 4.1: Update the work item spec status

**Files**

- Modify: `docs-ai/docs/initiatives/swop/features/cli-wrapper/work-items/auto-pick-freshness-policy/spec.md`

**Steps**

1) Change `## Status` from `planned` → `done`.
2) Check all acceptance criteria boxes as satisfied (they are documentation-only for this work item).

**Verify**

- Run: `rg -n "## Status|\\[ \\]" docs-ai/docs/initiatives/swop/features/cli-wrapper/work-items/auto-pick-freshness-policy/spec.md`
- Expected: status shows `done`; no unchecked acceptance criteria remain.

### Task 4.2: Update the feature work items table

**Files**

- Modify: `docs-ai/docs/initiatives/swop/features/cli-wrapper/overview.md`

**Steps**

1) In the Work Items table row for `swop/cli-wrapper/auto-pick-freshness-policy`, change status `planned` → `done`.

**Verify**

- Run: `rg -n "\\| \\[`swop/cli-wrapper/auto-pick-freshness-policy`\\].*\\|" docs-ai/docs/initiatives/swop/features/cli-wrapper/overview.md`
- Expected: the row exists and ends with `| done |`.

### Task 4.3: Update delivery-map work queue line

**Files**

- Modify: `docs-ai/docs/initiatives/delivery-map.md`

**Steps**

1) In the `### swop / cli-wrapper (w1)` section, prefix the `auto-pick-freshness-policy` line with `**DONE**` (keep the ✅ symbol).

**Verify**

- Run: `rg -n "auto-pick-freshness-policy" docs-ai/docs/initiatives/delivery-map.md`
- Expected: the line begins with `- **DONE** ✅`.

✅ **GREEN checkpoint:** Status is consistent in spec + overview + delivery-map.

---

## Task 5: Final cross-reference + consistency sweep

**Steps**

1) Confirm references still resolve and no duplicate policy text was introduced:
   - The detailed policy lives only in the work item spec.
   - Other docs reference/link to it rather than copying the policy.

**Verify**

- Run: `rg -n "auto-pick-freshness-policy" docs-ai/docs`
- Expected: references exist (overview, delivery-map, related work items) and no “competing” policy definitions appear elsewhere.

- Run: `rg -n "Tier 1|Tier 2|Stale-but-bounded" docs-ai/docs`
- Expected: matches primarily in the work item spec (and not duplicated across multiple docs).

✅ **GREEN checkpoint:** Single source of truth is maintained.

---

## Task 6: Commit (single commit at the end)

**Steps**

1) Review changes:
   - `git status`
   - `git diff`

2) Stage and commit:
   - `git add docs-ai/docs/roadmap.md docs-ai/docs/initiatives/delivery-map.md docs-ai/docs/initiatives/swop/features/cli-wrapper/overview.md docs-ai/docs/initiatives/swop/features/cli-wrapper/work-items/auto-pick-freshness-policy/spec.md`
   - `git commit -m "docs(swop): finalize auto-pick freshness policy"`

**Verify**

- Run: `git status`
- Expected: clean working tree.

