import { describe, expect, it } from "vitest";

import { formatCompactAccountSummary } from "../account-status-summary";
import type { UsageClientResult } from "../usage-types";

function stripAnsi(value: string): string {
  return value.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "");
}

describe("formatCompactAccountSummary", () => {
  const now = new Date("2026-03-03T10:00:00.000Z");

  it("renders an aligned compact line with plan, email, 5h and 7d remaining", () => {
    const result: UsageClientResult = {
      ok: true,
      usage: {
        email: "work@example.com",
        plan_type: "pro",
        rate_limit: {
          allowed: true,
          limit_reached: false,
          primary_window: { used_percent: 35, reset_at: "2026-03-03T12:00:00.000Z" },
          secondary_window: { used_percent: 55, reset_at: "2026-03-08T10:00:00.000Z" },
        },
      },
      freshness: {
        fetched_at: "2026-03-03T09:55:00.000Z",
        stale: false,
        age_seconds: 300,
      },
    };

    const summary = formatCompactAccountSummary("Work", undefined, result, now);
    const plain = stripAnsi(summary);

    expect(summary).toContain("\x1b[");
    expect(plain).toContain("Work");
    expect(plain).toContain("work@example.com");
    expect(plain).toContain("pro");
    expect(plain).toContain("5h 65% 2h");
    expect(plain).toContain("7d 45% 5d");
  });

  it("marks stale/error states tersely for interactive display", () => {
    const staleResult: UsageClientResult = {
      ok: true,
      usage: {
        plan_type: "pro",
        rate_limit: {
          allowed: true,
          limit_reached: false,
          primary_window: { used_percent: 10, reset_at: "2026-03-03T12:00:00.000Z" },
          secondary_window: { used_percent: 10, reset_at: "2026-03-08T10:00:00.000Z" },
        },
      },
      freshness: {
        fetched_at: "2026-03-03T09:40:00.000Z",
        stale: true,
        age_seconds: 1200,
      },
      warning: { kind: "timeout", message: "Using stale cache" },
    };

    const errorResult: UsageClientResult = {
      ok: false,
      kind: "auth",
      message: "Expired token",
    };

    expect(stripAnsi(formatCompactAccountSummary("Work", undefined, staleResult, now))).toContain("stale:1200s");
    expect(stripAnsi(formatCompactAccountSummary("Work", undefined, errorResult, now))).toContain("err:Expired token");
  });
});
