import { describe, expect, it } from "vitest";

import { fetchUsageSnapshot } from "../usage-fetch";

const okBody = JSON.stringify({
  plan_type: "pro",
  rate_limit: {
    allowed: true,
    limit_reached: false,
    primary_window: {
      used_percent: 5,
      reset_at: "2024-01-01T00:00:00.000Z",
    },
    secondary_window: {
      used_percent: 12,
      reset_at: "2024-01-01T00:00:00.000Z",
    },
  },
});

describe("usage-fetch", () => {
  it("parses a 200 response", async () => {
    const result = await fetchUsageSnapshot("token", {
      request: async () => ({ status: 200, body: okBody }),
    });

    expect(result.ok).toBe(true);
    if (result.ok && result.usage.rate_limit) {
      expect(result.usage.plan_type).toBe("pro");
      expect(result.usage.rate_limit.secondary_window.used_percent).toBe(12);
    }
  });

  it("classifies auth failures", async () => {
    const result = await fetchUsageSnapshot("token", {
      request: async () => ({ status: 401, body: "" }),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("auth");
    }
  });

  it("classifies server failures", async () => {
    const result = await fetchUsageSnapshot("token", {
      request: async () => ({ status: 503, body: "" }),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("server");
    }
  });

  it("classifies parse failures", async () => {
    const result = await fetchUsageSnapshot("token", {
      request: async () => ({ status: 200, body: "not-json" }),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("parse");
    }
  });

  it("normalizes numeric reset_at to iso string", async () => {
    const body = JSON.stringify({
      plan_type: "pro",
      rate_limit: {
        allowed: true,
        limit_reached: false,
        primary_window: {
          used_percent: 50,
          reset_at: 1769815730,
        },
        secondary_window: {
          used_percent: 98,
          reset_at: 1769815730,
        },
      },
    });

    const result = await fetchUsageSnapshot("token", {
      request: async () => ({ status: 200, body }),
    });

    expect(result.ok).toBe(true);
    if (result.ok && result.usage.rate_limit) {
      expect(result.usage.rate_limit.secondary_window.reset_at).toBe(
        "2026-01-30T23:28:50.000Z",
      );
    }
  });

  it("accepts free-plan schema when secondary_window is null", async () => {
    const body = JSON.stringify({
      plan_type: "free",
      rate_limit: {
        allowed: true,
        limit_reached: false,
        primary_window: {
          used_percent: 1,
          limit_window_seconds: 604800,
          reset_after_seconds: 604746,
          reset_at: 1770924744,
        },
        secondary_window: null,
      },
    });

    const result = await fetchUsageSnapshot("token", {
      request: async () => ({ status: 200, body }),
    });

    expect(result.ok).toBe(true);
    if (result.ok && result.usage.rate_limit) {
      expect(result.usage.plan_type).toBe("free");
      expect(result.usage.rate_limit.primary_window.used_percent).toBe(1);
      expect(result.usage.rate_limit.secondary_window.used_percent).toBe(1);
      expect(result.usage.rate_limit.secondary_window.reset_at).toBe(
        "2026-02-12T19:32:24.000Z",
      );
    }
  });

  it("classifies timeouts", async () => {
    const result = await fetchUsageSnapshot("token", {
      timeoutMs: 5,
      request: ({ signal }) =>
        new Promise((_, reject) => {
          if (!signal) {
            reject(new Error("missing signal"));
            return;
          }
          signal.addEventListener("abort", () => {
            const err = new Error("aborted");
            (err as Error & { name?: string }).name = "AbortError";
            reject(err);
          });
        }),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("timeout");
    }
  });
});
