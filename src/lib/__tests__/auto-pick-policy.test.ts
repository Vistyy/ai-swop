import { describe, expect, it } from "vitest";

import { selectAutoPickAccount } from "../auto-pick-policy";
import type { UsageSnapshotV1 } from "../usage-types";

type Candidate = { label: string; usage: UsageSnapshotV1 };

function futureIso(daysFromNow: number): string {
  return new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000).toISOString();
}

const baseUsage = (overrides?: Partial<UsageSnapshotV1>): UsageSnapshotV1 => ({
  plan_type: "pro",
  rate_limit: {
    allowed: true,
    limit_reached: false,
    primary_window: {
      used_percent: 10,
      reset_at: futureIso(0.2),
    },
    secondary_window: {
      used_percent: 0,
      reset_at: futureIso(3),
    },
  },
  ...overrides,
});

const withUsage = (label: string, overrides?: Partial<UsageSnapshotV1>): Candidate => ({
  label,
  usage: baseUsage(overrides),
});

describe("selectAutoPickAccount", () => {
  it("picks account with closest 7d reset by default", () => {
    const candidates = [
      withUsage("later-reset", {
        rate_limit: {
          allowed: true,
          limit_reached: false,
          primary_window: { used_percent: 10, reset_at: futureIso(0.2) },
          secondary_window: { used_percent: 10, reset_at: futureIso(3) },
        },
      }),
      withUsage("closest-reset", {
        rate_limit: {
          allowed: true,
          limit_reached: false,
          primary_window: { used_percent: 10, reset_at: futureIso(0.2) },
          secondary_window: { used_percent: 70, reset_at: futureIso(1) },
        },
      }),
    ];

    const result = selectAutoPickAccount(candidates);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.selected.label).toBe("closest-reset");
    }
  });

  it("switches to highest usage-left when closest-reset gap is over 40% and closest reset is more than 2 days away", () => {
    const candidates = [
      withUsage("closest-reset-low-left", {
        rate_limit: {
          allowed: true,
          limit_reached: false,
          primary_window: { used_percent: 10, reset_at: futureIso(0.2) },
          secondary_window: { used_percent: 95, reset_at: futureIso(3) },
        },
      }),
      withUsage("highest-left", {
        rate_limit: {
          allowed: true,
          limit_reached: false,
          primary_window: { used_percent: 10, reset_at: futureIso(0.2) },
          secondary_window: { used_percent: 40, reset_at: futureIso(6) },
        },
      }),
    ];

    const result = selectAutoPickAccount(candidates);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.selected.label).toBe("highest-left");
    }
  });

  it("does not switch on rule 2 when closest reset is within 2 days", () => {
    const candidates = [
      withUsage("closest-reset-low-left", {
        rate_limit: {
          allowed: true,
          limit_reached: false,
          primary_window: { used_percent: 10, reset_at: futureIso(0.2) },
          secondary_window: { used_percent: 95, reset_at: futureIso(1.5) },
        },
      }),
      withUsage("highest-left", {
        rate_limit: {
          allowed: true,
          limit_reached: false,
          primary_window: { used_percent: 10, reset_at: futureIso(0.2) },
          secondary_window: { used_percent: 40, reset_at: futureIso(6) },
        },
      }),
    ];

    const result = selectAutoPickAccount(candidates);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.selected.label).toBe("closest-reset-low-left");
    }
  });

  it("does not pick accounts below 5% 7d usage left when alternatives exist", () => {
    const candidates = [
      withUsage("below-5", {
        rate_limit: {
          allowed: true,
          limit_reached: false,
          primary_window: { used_percent: 10, reset_at: futureIso(0.2) },
          secondary_window: { used_percent: 96, reset_at: futureIso(1) },
        },
      }),
      withUsage("healthy", {
        rate_limit: {
          allowed: true,
          limit_reached: false,
          primary_window: { used_percent: 10, reset_at: futureIso(0.2) },
          secondary_window: { used_percent: 80, reset_at: futureIso(2) },
        },
      }),
    ];

    const result = selectAutoPickAccount(candidates);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.selected.label).toBe("healthy");
    }
  });

  it("when all are below 5% 7d left, picks closest 7d reset", () => {
    const candidates = [
      withUsage("closest-reset", {
        rate_limit: {
          allowed: true,
          limit_reached: false,
          primary_window: { used_percent: 10, reset_at: futureIso(0.2) },
          secondary_window: { used_percent: 99, reset_at: futureIso(1) },
        },
      }),
      withUsage("later-reset", {
        rate_limit: {
          allowed: true,
          limit_reached: false,
          primary_window: { used_percent: 10, reset_at: futureIso(0.2) },
          secondary_window: { used_percent: 97, reset_at: futureIso(2) },
        },
      }),
    ];

    const result = selectAutoPickAccount(candidates);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.selected.label).toBe("closest-reset");
    }
  });

  it("does not pick accounts below 20% 5h usage left when alternatives exist", () => {
    const candidates = [
      withUsage("low-5h-closest-7d", {
        rate_limit: {
          allowed: true,
          limit_reached: false,
          primary_window: { used_percent: 85, reset_at: futureIso(0.1) },
          secondary_window: { used_percent: 10, reset_at: futureIso(1) },
        },
      }),
      withUsage("ok-5h", {
        rate_limit: {
          allowed: true,
          limit_reached: false,
          primary_window: { used_percent: 70, reset_at: futureIso(0.2) },
          secondary_window: { used_percent: 80, reset_at: futureIso(2) },
        },
      }),
    ];

    const result = selectAutoPickAccount(candidates);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.selected.label).toBe("ok-5h");
    }
  });

  it("when none are over 20% 5h left, still picks closest 7d reset", () => {
    const candidates = [
      withUsage("closest-7d", {
        rate_limit: {
          allowed: true,
          limit_reached: false,
          primary_window: { used_percent: 90, reset_at: futureIso(0.1) },
          secondary_window: { used_percent: 80, reset_at: futureIso(1) },
        },
      }),
      withUsage("later-7d", {
        rate_limit: {
          allowed: true,
          limit_reached: false,
          primary_window: { used_percent: 88, reset_at: futureIso(0.2) },
          secondary_window: { used_percent: 60, reset_at: futureIso(2) },
        },
      }),
    ];

    const result = selectAutoPickAccount(candidates);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.selected.label).toBe("closest-7d");
    }
  });

  it("returns all-blocked when all accounts are blocked by allowed/limit flags", () => {
    const candidates = [
      withUsage("blocked-one", {
        rate_limit: {
          allowed: false,
          limit_reached: true,
          primary_window: { used_percent: 20, reset_at: futureIso(0.2) },
          secondary_window: { used_percent: 90, reset_at: futureIso(2) },
        },
      }),
      withUsage("blocked-two", {
        rate_limit: {
          allowed: true,
          limit_reached: true,
          primary_window: { used_percent: 20, reset_at: futureIso(0.2) },
          secondary_window: { used_percent: 80, reset_at: futureIso(1) },
        },
      }),
    ];

    const result = selectAutoPickAccount(candidates);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("all-blocked");
      expect(result.message).toContain("all accounts blocked");
    }
  });

  it("supports fractional 0..1 used_percent values for both windows", () => {
    const candidates = [
      withUsage("fraction-low-7d-left", {
        rate_limit: {
          allowed: true,
          limit_reached: false,
          primary_window: { used_percent: 0.85, reset_at: futureIso(0.2) },
          secondary_window: { used_percent: 0.97, reset_at: futureIso(1) },
        },
      }),
      withUsage("fraction-healthy", {
        rate_limit: {
          allowed: true,
          limit_reached: false,
          primary_window: { used_percent: 0.7, reset_at: futureIso(0.2) },
          secondary_window: { used_percent: 0.8, reset_at: futureIso(2) },
        },
      }),
    ];

    const result = selectAutoPickAccount(candidates);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.selected.label).toBe("fraction-healthy");
    }
  });
});
