# Implementation Plan - Status Command

- **Execution mode**: autonomous

Add a `swop status` command that provides a high-density, visual overview of all managed accounts and their remaining quota using color-coded "inverse" usage bars.

## Proposed Changes

### [Component] Core Types & Fetching

Update the usage data structure to support both 5h (Primary) and 7d (Secondary) windows.

#### [MODIFY] [usage-types.ts](file:///home/syzom/projects/ai-swop/src/lib/usage-types.ts)

- Add `primary_window` to `UsageSnapshotV1` (mirrors `secondary_window` structure).

#### [MODIFY] [usage-fetch.ts](file:///home/syzom/projects/ai-swop/src/lib/usage-fetch.ts)

- Update `normalizeUsageSnapshot` to extract `primary_window` from the API response body.

#### [MODIFY] [usage-cache.ts](file:///home/syzom/projects/ai-swop/src/lib/usage-cache.ts)

- Update `isUsageSnapshotV1` validation logic to include the new `primary_window` field.

---

### [Component] CLI Command & Rendering

Implement the `status` command and its visual rendering logic.

#### [NEW] [status-command.ts](file:///home/syzom/projects/ai-swop/src/lib/status-command.ts)

- Implement `runSwopStatus`.
- Logic:
  1. List all accounts.
  2. Map accounts to usage results (parallel fetch).
  3. Render 1 card per account.
  4. Implement `renderInverseBar(usedPercent, colors)` function.
- Support `--refresh` / `-R` flag.

#### [MODIFY] [index.ts](file:///home/syzom/projects/ai-swop/src/index.ts)

- Import `runSwopStatus`.
- Add `status` command branch to `main`.
- Update `printUsage`.

---

### [Component] Tests

Update and add tests to verify the new functionality.

#### [MODIFY] [usage-fetch.test.ts](file:///home/syzom/projects/ai-swop/src/lib/__tests__/usage-fetch.test.ts)

- Update mock `okBody` and assertions to include `primary_window`.

#### [NEW] [status-command.test.ts](file:///home/syzom/projects/ai-swop/src/lib/__tests__/status-command.test.ts)

- Test rendering logic with various usage states (0%, 50%, 99%, Blocked).
- Test cache vs refresh behavior.

## Verification Plan

### Automated Tests

Run the following to verify all components and logic:

```bash
npm run test src/lib/__tests__/usage-fetch.test.ts
npm run test src/lib/__tests__/status-command.test.ts
npm run typecheck
```

### Manual Verification

1.  **Setup**: Add 2 accounts with `swop add <label>`.
2.  **Basic Status**: Run `swop status`.
    - Verify "Inverse Bar" behavior (Used 0% = Full bar).
    - Verify Stacked Card layout (Name, Plan, Primary row, Secondary row).
    - Verify timestamps are in local time.
3.  **Forced Refresh**: Run `swop status -R`.
    - Verify it bypasses the cache and hits the API.
4.  **Error Handling**: Temporarily invalidate a token or mock a failure for one account.
    - Verify `swop status` shows a warning for the failed account but renders the others correctly.
