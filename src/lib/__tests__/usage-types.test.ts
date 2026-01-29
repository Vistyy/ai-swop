import { describe, expect, it } from "vitest";

import { USAGE_TYPES_VERSION } from "../usage-types";
import type { UsageSnapshotV1, UsageFreshness, UsageClientResult } from "../usage-types";

describe("usage-types", () => {
  it("keeps the usage snapshot contract stable", () => {
    expect(USAGE_TYPES_VERSION).toBe(1);
    const snapshot: UsageSnapshotV1 = {
      plan_type: "pro",
      rate_limit: {
        allowed: true,
        limit_reached: false,
        secondary_window: {
          used_percent: 42,
          reset_at: "2024-01-01T00:00:00.000Z",
        },
      },
    };

    expect(Object.keys(snapshot).sort()).toEqual(["plan_type", "rate_limit"]);
    expect(Object.keys(snapshot.rate_limit).sort()).toEqual([
      "allowed",
      "limit_reached",
      "secondary_window",
    ]);
    expect(Object.keys(snapshot.rate_limit.secondary_window).sort()).toEqual([
      "reset_at",
      "used_percent",
    ]);
  });

  it("keeps the usage result contract stable", () => {
    const freshness: UsageFreshness = {
      fetched_at: "2024-01-01T00:00:00.000Z",
      stale: false,
      age_seconds: 0,
    };

    const okResult: UsageClientResult = {
      ok: true,
      usage: {
        plan_type: "pro",
        rate_limit: {
          allowed: true,
          limit_reached: false,
          secondary_window: {
            used_percent: 10,
            reset_at: "2024-01-01T00:00:00.000Z",
          },
        },
      },
      freshness,
    };

    expect(okResult.ok).toBe(true);

    const errorResult: UsageClientResult = {
      ok: false,
      kind: "auth",
      message: "Missing auth token",
    };

    expect(errorResult.ok).toBe(false);
  });
});
