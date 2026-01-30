import { describe, expect, it } from "vitest";

import { selectAutoPickAccount } from "../auto-pick-policy";
import type { UsageSnapshotV1 } from "../usage-types";

type Candidate = { label: string; usage: UsageSnapshotV1 };

const baseUsage = (overrides?: Partial<UsageSnapshotV1>): UsageSnapshotV1 => ({
  plan_type: "pro",
  rate_limit: {
    allowed: true,
    limit_reached: false,
    secondary_window: {
      used_percent: 0,
      reset_at: "2026-01-01T00:00:00Z",
    },
  },
  ...overrides,
});

const withUsage = (
  label: string,
  overrides?: Partial<UsageSnapshotV1>
): Candidate => ({
  label,
  usage: baseUsage(overrides),
});

describe("selectAutoPickAccount", () => {
  it("picks the lowest used_percent among viable accounts", () => {
    const candidates = [
      withUsage("Work", {
        rate_limit: {
          allowed: true,
          limit_reached: false,
          secondary_window: { used_percent: 0.7, reset_at: "2026-01-01T00:00:00Z" },
        },
      }),
      withUsage("personal", {
        rate_limit: {
          allowed: true,
          limit_reached: false,
          secondary_window: { used_percent: 0.2, reset_at: "2026-01-01T00:00:00Z" },
        },
      }),
    ];

    const result = selectAutoPickAccount(candidates);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.selected.label).toBe("personal");
    }
  });

  it("excludes blocked accounts from selection", () => {
    const candidates = [
      withUsage("blocked", {
        rate_limit: {
          allowed: false,
          limit_reached: false,
          secondary_window: { used_percent: 0.1, reset_at: "2026-01-03T00:00:00Z" },
        },
      }),
      withUsage("viable", {
        rate_limit: {
          allowed: true,
          limit_reached: false,
          secondary_window: { used_percent: 0.5, reset_at: "2026-01-02T00:00:00Z" },
        },
      }),
    ];

    const result = selectAutoPickAccount(candidates);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.selected.label).toBe("viable");
    }
  });

  it("tie-breaks by normalized label", () => {
    const candidates = [
      withUsage("Work", {
        rate_limit: {
          allowed: true,
          limit_reached: false,
          secondary_window: { used_percent: 0.3, reset_at: "2026-01-01T00:00:00Z" },
        },
      }),
      withUsage("personal", {
        rate_limit: {
          allowed: true,
          limit_reached: false,
          secondary_window: { used_percent: 0.3, reset_at: "2026-01-01T00:00:00Z" },
        },
      }),
    ];

    const result = selectAutoPickAccount(candidates);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.selected.label).toBe("personal");
    }
  });

  it("uses a deterministic fallback when normalized labels match", () => {
    const candidates = [
      withUsage("a", {
        rate_limit: {
          allowed: true,
          limit_reached: false,
          secondary_window: { used_percent: 0.4, reset_at: "2026-01-01T00:00:00Z" },
        },
      }),
      withUsage("A", {
        rate_limit: {
          allowed: true,
          limit_reached: false,
          secondary_window: { used_percent: 0.4, reset_at: "2026-01-01T00:00:00Z" },
        },
      }),
    ];

    const result = selectAutoPickAccount(candidates);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.selected.label).toBe("A");
    }
  });

  it("returns earliest reset time when all accounts are blocked", () => {
    const candidates = [
      withUsage("blocked-one", {
        rate_limit: {
          allowed: false,
          limit_reached: true,
          secondary_window: { used_percent: 0.9, reset_at: "2026-01-02T00:00:00Z" },
        },
      }),
      withUsage("blocked-two", {
        rate_limit: {
          allowed: true,
          limit_reached: true,
          secondary_window: { used_percent: 0.8, reset_at: "2026-01-01T00:00:00Z" },
        },
      }),
    ];

    const result = selectAutoPickAccount(candidates);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("all-blocked");
      expect(result.message).toContain("all accounts blocked");
      expect(result.message).toContain("2026-01-01");
      expect(result.earliest_reset_at).toBe("2026-01-01T00:00:00Z");
    }
  });

  it("reports reset time unknown when no parseable reset time exists", () => {
    const candidates = [
      withUsage("blocked-one", {
        rate_limit: {
          allowed: false,
          limit_reached: true,
          secondary_window: { used_percent: 0.9, reset_at: "unknown" },
        },
      }),
      withUsage("blocked-two", {
        rate_limit: {
          allowed: true,
          limit_reached: true,
          secondary_window: { used_percent: 0.8, reset_at: "" },
        },
      }),
    ];

    const result = selectAutoPickAccount(candidates);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("all-blocked");
      expect(result.message).toContain("reset time unknown");
      expect(result.earliest_reset_at).toBeUndefined();
    }
  });

  it("excludes free/expired plans (null rate_limit) from selection", () => {
    const candidates = [
      withUsage("free-plan", {
        plan_type: "free",
        rate_limit: null,
      }),
      withUsage("pro-plan", {
        rate_limit: {
          allowed: true,
          limit_reached: false,
          secondary_window: { used_percent: 0.5, reset_at: "2026-01-02T00:00:00Z" },
        },
      }),
    ];

    const result = selectAutoPickAccount(candidates);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.selected.label).toBe("pro-plan");
    }
  });

  it("treats free/expired plans as blocked if no other options exist", () => {
    const candidates = [
      withUsage("free-plan-1", {
        plan_type: "free",
        rate_limit: null,
      }),
      withUsage("free-plan-2", {
        plan_type: "free",
        rate_limit: null,
      }),
    ];

    const result = selectAutoPickAccount(candidates);

    expect(result.ok).toBe(false);
    // Since free plans have no reset time, we expect the generic blocked message
    if (!result.ok) {
      expect(result.kind).toBe("all-blocked");
      expect(result.message).toContain("reset time unknown");
    }
  });
});
