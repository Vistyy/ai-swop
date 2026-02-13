import { describe, expect, it, vi } from "vitest";
import { runSwopStatus } from "../status-command";
import type { UsageClientResult } from "../usage-types";

describe("status-command", () => {
  const mockNow = new Date("2024-01-01T12:00:00Z");

  const baseUsage: UsageClientResult = {
    ok: true,
    usage: {
      plan_type: "pro",
      rate_limit: {
        allowed: true,
        limit_reached: false,
        primary_window: { used_percent: 10, reset_at: "2024-01-01T13:00:00Z" },
        secondary_window: { used_percent: 20, reset_at: "2024-01-02T12:00:00Z" },
      },
    },
    freshness: { fetched_at: "2024-01-01T12:00:00Z", stale: false, age_seconds: 0 },
  };

  it("renders multiple account cards", async () => {
    const listSandboxes = vi.fn().mockReturnValue([{ label: "work" }, { label: "personal" }]);
    const getUsageForAccount = vi.fn().mockResolvedValue(baseUsage);
    const log = vi.fn();

    const result = await runSwopStatus([], {}, {
      listSandboxes,
      getUsageForAccount,
      stdout: { log },
      now: () => mockNow,
    });

    expect(result.ok).toBe(true);
    // Each account has: Header, Plan, Primary, Secondary, empty line = 5 logs per account
    expect(log).toHaveBeenCalledTimes(10);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("Account: work"));
    expect(log).toHaveBeenCalledWith(expect.stringContaining("Account: personal"));
  });

  it("handles empty state", async () => {
    const listSandboxes = vi.fn().mockReturnValue([]);
    const getUsageForAccount = vi.fn();
    const log = vi.fn();

    const result = await runSwopStatus([], {}, {
      listSandboxes,
      getUsageForAccount,
      stdout: { log },
    });

    expect(result.ok).toBe(true);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("No accounts configured"));
  });

  it("renders bars correctly based on usage (Inverse logic)", async () => {
    const listSandboxes = vi.fn().mockReturnValue([{ label: "test" }]);
    const log = vi.fn();
    
    // 0% used = Full bar (20 chars)
    const usage0: UsageClientResult = {
      ...baseUsage,
      usage: {
        ...baseUsage.usage!,
        rate_limit: {
          ...baseUsage.usage!.rate_limit!,
          primary_window: { used_percent: 0, reset_at: "2024-01-01T13:00:00Z" },
        }
      }
    };

    await runSwopStatus([], {}, {
      listSandboxes,
      getUsageForAccount: vi.fn().mockResolvedValue(usage0),
      stdout: { log },
      now: () => mockNow,
    });

    // Filled bar should have 20 '█'
    const fullBar = "█".repeat(20);
    expect(log).toHaveBeenCalledWith(expect.stringContaining(fullBar));
    expect(log).toHaveBeenCalledWith(expect.stringContaining("100% remains"));
  });

  it("renders empty bars for 100% usage", async () => {
    const listSandboxes = vi.fn().mockReturnValue([{ label: "test" }]);
    const log = vi.fn();
    
    const usage100: UsageClientResult = {
      ...baseUsage,
      usage: {
        ...baseUsage.usage!,
        rate_limit: {
          ...baseUsage.usage!.rate_limit!,
          primary_window: { used_percent: 100, reset_at: "2024-01-01T13:00:00Z" },
        }
      }
    };

    await runSwopStatus([], {}, {
      listSandboxes,
      getUsageForAccount: vi.fn().mockResolvedValue(usage100),
      stdout: { log },
      now: () => mockNow,
    });

    // Empty bar should have 20 '░'
    const emptyBar = "░".repeat(20);
    expect(log).toHaveBeenCalledWith(expect.stringContaining(emptyBar));
    expect(log).toHaveBeenCalledWith(expect.stringContaining("0% remains"));
  });

  it("flags blocked accounts", async () => {
    const listSandboxes = vi.fn().mockReturnValue([{ label: "test" }]);
    const log = vi.fn();
    
    const blockedUsage: UsageClientResult = {
      ...baseUsage,
      usage: {
        ...baseUsage.usage!,
        rate_limit: {
          ...baseUsage.usage!.rate_limit!,
          limit_reached: true,
        }
      }
    };

    await runSwopStatus([], {}, {
      listSandboxes,
      getUsageForAccount: vi.fn().mockResolvedValue(blockedUsage),
      stdout: { log },
      now: () => mockNow,
    });

    expect(log).toHaveBeenCalledWith(expect.stringContaining("BLOCKED"));
  });

  it("handles account failures gracefully", async () => {
    const listSandboxes = vi.fn().mockReturnValue([{ label: "fail" }]);
    const log = vi.fn();
    
    const failUsage: UsageClientResult = {
      ok: false,
      kind: "auth",
      message: "Expired token",
    };

    await runSwopStatus([], {}, {
      listSandboxes,
      getUsageForAccount: vi.fn().mockResolvedValue(failUsage),
      stdout: { log },
    });

    expect(log).toHaveBeenCalledWith(expect.stringContaining("Error: Expired token"));
  });

  it("renders one quota bar for free plans when windows are equivalent", async () => {
    const listSandboxes = vi.fn().mockReturnValue([{ label: "free" }]);
    const log = vi.fn();

    const freeUsage: UsageClientResult = {
      ok: true,
      usage: {
        plan_type: "free",
        rate_limit: {
          allowed: true,
          limit_reached: false,
          primary_window: { used_percent: 1, reset_at: "2026-02-12T19:32:24.000Z" },
          secondary_window: { used_percent: 1, reset_at: "2026-02-12T19:32:24.000Z" },
        },
      },
      freshness: { fetched_at: "2024-01-01T12:00:00Z", stale: false, age_seconds: 0 },
    };

    await runSwopStatus([], {}, {
      listSandboxes,
      getUsageForAccount: vi.fn().mockResolvedValue(freeUsage),
      stdout: { log },
      now: () => mockNow,
    });

    const output = log.mock.calls.map((call) => String(call[0])).join("\n");
    expect(output).toContain("Quota (7d)");
    expect(output).not.toContain("Secondary (7d)");
    expect(output).not.toContain("Primary (5h)");
  });

  it("prints usage warning messages when stale fallback is used", async () => {
    const listSandboxes = vi.fn().mockReturnValue([{ label: "work" }]);
    const log = vi.fn();

    const staleWithWarning: UsageClientResult = {
      ok: true,
      usage: baseUsage.usage,
      freshness: { fetched_at: "2024-01-01T11:50:00Z", stale: true, age_seconds: 600 },
      warning: { kind: "timeout", message: "Usage request timed out" },
    };

    await runSwopStatus([], {}, {
      listSandboxes,
      getUsageForAccount: vi.fn().mockResolvedValue(staleWithWarning),
      stdout: { log },
      now: () => mockNow,
    });

    const output = log.mock.calls.map((call) => String(call[0])).join("\n");
    expect(output).toContain("Warning: data is 600s old");
    expect(output).toContain("Usage request timed out");
  });
});
