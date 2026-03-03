import { describe, expect, it } from "vitest";

import { selectAutoPickAccount } from "../auto-pick-policy";
import type { UsageSnapshotV1 } from "../usage-types";

type Candidate = { label: string; usage: UsageSnapshotV1; last_used_at?: string };

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
      used_percent: 20,
      reset_at: futureIso(3),
    },
  },
  ...overrides,
});

const withUsage = (
  label: string,
  overrides?: Partial<UsageSnapshotV1>,
  extra?: { last_used_at?: string },
): Candidate => ({
  label,
  usage: baseUsage(overrides),
  last_used_at: extra?.last_used_at,
});

describe("selectAutoPickAccount", () => {
  it("avoids accounts below 50% primary remaining when healthier options exist", () => {
    const candidates = [
      withUsage("low-primary", {
        rate_limit: {
          allowed: true,
          limit_reached: false,
          primary_window: { used_percent: 60, reset_at: futureIso(0.1) },
          secondary_window: { used_percent: 15, reset_at: futureIso(2) },
        },
      }),
      withUsage("healthy-primary", {
        rate_limit: {
          allowed: true,
          limit_reached: false,
          primary_window: { used_percent: 30, reset_at: futureIso(0.2) },
          secondary_window: { used_percent: 30, reset_at: futureIso(3) },
        },
      }),
    ];

    const result = selectAutoPickAccount(candidates);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.selected.label).toBe("healthy-primary");
    }
  });

  it("keeps 7d selection within 20 points of the highest remaining account", () => {
    const candidates = [
      withUsage("too-drained", {
        rate_limit: {
          allowed: true,
          limit_reached: false,
          primary_window: { used_percent: 10, reset_at: futureIso(0.2) },
          secondary_window: { used_percent: 45, reset_at: futureIso(2) },
        },
      }),
      withUsage("balanced", {
        rate_limit: {
          allowed: true,
          limit_reached: false,
          primary_window: { used_percent: 10, reset_at: futureIso(0.2) },
          secondary_window: { used_percent: 25, reset_at: futureIso(2) },
        },
      }),
      withUsage("highest-left", {
        rate_limit: {
          allowed: true,
          limit_reached: false,
          primary_window: { used_percent: 10, reset_at: futureIso(0.2) },
          secondary_window: { used_percent: 5, reset_at: futureIso(2) },
        },
      }),
    ];

    const result = selectAutoPickAccount(candidates);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(["balanced", "highest-left"]).toContain(result.selected.label);
      expect(result.selected.label).not.toBe("too-drained");
    }
  });

  it("prefers the least recently used account among otherwise eligible choices", () => {
    const candidates = [
      withUsage(
        "recently-used",
        {
          rate_limit: {
            allowed: true,
            limit_reached: false,
            primary_window: { used_percent: 10, reset_at: futureIso(0.2) },
            secondary_window: { used_percent: 10, reset_at: futureIso(3) },
          },
        },
        { last_used_at: "2026-03-03T10:05:00.000Z" },
      ),
      withUsage(
        "older-use",
        {
          rate_limit: {
            allowed: true,
            limit_reached: false,
            primary_window: { used_percent: 12, reset_at: futureIso(0.2) },
            secondary_window: { used_percent: 12, reset_at: futureIso(3) },
          },
        },
        { last_used_at: "2026-03-03T10:00:00.000Z" },
      ),
    ];

    const result = selectAutoPickAccount(candidates);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.selected.label).toBe("older-use");
    }
  });

  it("treats never-used accounts as older than recently-used ones to spread new sessions", () => {
    const candidates = [
      withUsage(
        "just-used",
        {
          rate_limit: {
            allowed: true,
            limit_reached: false,
            primary_window: { used_percent: 10, reset_at: futureIso(0.2) },
            secondary_window: { used_percent: 15, reset_at: futureIso(3) },
          },
        },
        { last_used_at: "2026-03-03T10:05:00.000Z" },
      ),
      withUsage("never-used", {
        rate_limit: {
          allowed: true,
          limit_reached: false,
          primary_window: { used_percent: 10, reset_at: futureIso(0.2) },
          secondary_window: { used_percent: 10, reset_at: futureIso(3) },
        },
      }),
    ];

    const result = selectAutoPickAccount(candidates);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.selected.label).toBe("never-used");
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
      withUsage("fraction-low-primary", {
        rate_limit: {
          allowed: true,
          limit_reached: false,
          primary_window: { used_percent: 0.6, reset_at: futureIso(0.2) },
          secondary_window: { used_percent: 0.15, reset_at: futureIso(1) },
        },
      }),
      withUsage("fraction-healthy", {
        rate_limit: {
          allowed: true,
          limit_reached: false,
          primary_window: { used_percent: 0.3, reset_at: futureIso(0.2) },
          secondary_window: { used_percent: 0.25, reset_at: futureIso(2) },
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
