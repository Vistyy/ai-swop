import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createSandbox } from "../sandbox-manager";
import { resolveSandboxPaths } from "../sandbox-paths";
import { mkdir0700, removeTree, writeFile0600Atomic } from "../fs";
import { readUsageCache, writeUsageCache } from "../usage-cache";
import { getUsageForAccount } from "../usage-client";
import type { UsageSnapshotV1 } from "../usage-types";
import type { UsageFetchResult } from "../usage-fetch";

function makeTempDir(): string {
  const base = process.env.VITEST_WORKER_ID
    ? `/tmp/swop-usage-client-${process.env.VITEST_WORKER_ID}-${Date.now()}`
    : `/tmp/swop-usage-client-${Date.now()}`;
  return base;
}

const sampleUsage: UsageSnapshotV1 = {
  plan_type: "pro",
  rate_limit: {
    allowed: true,
    limit_reached: false,
    secondary_window: {
      used_percent: 10,
      reset_at: "2024-01-01T00:00:00.000Z",
    },
  },
};

describe("usage-client", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns cached data within TTL without fetching", async () => {
    const tempRoot = makeTempDir();
    process.env.SWOP_ROOT = tempRoot;

    const realHome = `${tempRoot}/real-home`;
    mkdir0700(path.join(realHome, ".codex"));
    createSandbox("Work", process.env, realHome);

    writeUsageCache("Work", process.env, {
      fetched_at: "2024-01-01T00:10:00.000Z",
      usage: sampleUsage,
    });

    let calls = 0;
    const fetcher = async (): Promise<UsageFetchResult> => {
      calls += 1;
      return { ok: true, usage: sampleUsage };
    };

    const result = await getUsageForAccount("Work", process.env, {
      now: () => new Date("2024-01-01T00:20:00.000Z"),
      fetcher,
    });

    expect(calls).toBe(0);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.freshness.stale).toBe(false);
    }

    removeTree(tempRoot);
  });

  it("fetches live on cache miss and writes cache", async () => {
    const tempRoot = makeTempDir();
    process.env.SWOP_ROOT = tempRoot;

    const realHome = `${tempRoot}/real-home`;
    mkdir0700(path.join(realHome, ".codex"));
    createSandbox("Work", process.env, realHome);
    const { authPath } = resolveSandboxPaths("Work", process.env);
    writeFile0600Atomic(authPath, JSON.stringify({ tokens: { access_token: "token" } }, null, 2));

    const result = await getUsageForAccount("Work", process.env, {
      now: () => new Date("2024-01-01T00:00:00.000Z"),
      fetcher: async () => ({ ok: true, usage: sampleUsage }),
    });

    expect(result.ok).toBe(true);
    const cached = readUsageCache("Work", process.env);
    expect(cached.ok).toBe(true);

    removeTree(tempRoot);
  });

  it("returns stale cache with warning when live fetch fails", async () => {
    const tempRoot = makeTempDir();
    process.env.SWOP_ROOT = tempRoot;

    const realHome = `${tempRoot}/real-home`;
    mkdir0700(path.join(realHome, ".codex"));
    createSandbox("Work", process.env, realHome);
    const { authPath } = resolveSandboxPaths("Work", process.env);
    writeFile0600Atomic(authPath, JSON.stringify({ tokens: { access_token: "token" } }, null, 2));

    writeUsageCache("Work", process.env, {
      fetched_at: "2024-01-01T00:00:00.000Z",
      usage: sampleUsage,
    });

    const result = await getUsageForAccount("Work", process.env, {
      now: () => new Date("2024-01-01T00:20:00.000Z"),
      fetcher: async () => ({ ok: false, kind: "network", message: "offline" }),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.freshness.stale).toBe(true);
      expect(result.warning?.kind).toBe("network");
    }

    removeTree(tempRoot);
  });

  it("returns error when no cache and live fetch fails", async () => {
    const tempRoot = makeTempDir();
    process.env.SWOP_ROOT = tempRoot;

    const realHome = `${tempRoot}/real-home`;
    mkdir0700(path.join(realHome, ".codex"));
    createSandbox("Work", process.env, realHome);
    const { authPath } = resolveSandboxPaths("Work", process.env);
    writeFile0600Atomic(authPath, JSON.stringify({ tokens: { access_token: "token" } }, null, 2));

    const result = await getUsageForAccount("Work", process.env, {
      now: () => new Date("2024-01-01T00:00:00.000Z"),
      fetcher: async () => ({ ok: false, kind: "timeout", message: "timeout" }),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("timeout");
    }

    removeTree(tempRoot);
  });
});
