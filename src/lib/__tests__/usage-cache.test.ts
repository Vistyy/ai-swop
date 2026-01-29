import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createSandbox } from "../sandbox-manager";
import { resolveSandboxPaths } from "../sandbox-paths";
import { lstatSafe, mkdir0700, readJson, removeTree } from "../fs";
import {
  getUsageCachePath,
  isWithinTtl,
  readUsageCache,
  writeUsageCache,
} from "../usage-cache";
import type { UsageSnapshotV1 } from "../usage-types";

function makeTempDir(): string {
  const base = process.env.VITEST_WORKER_ID
    ? `/tmp/swop-usage-cache-${process.env.VITEST_WORKER_ID}-${Date.now()}`
    : `/tmp/swop-usage-cache-${Date.now()}`;
  return base;
}

describe("usage-cache", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("uses <sandboxRoot>/usage-cache.json", () => {
    const tempRoot = makeTempDir();
    process.env.SWOP_ROOT = tempRoot;

    const realHome = `${tempRoot}/real-home`;
    mkdir0700(path.join(realHome, ".codex"));
    createSandbox("Work", process.env, realHome);

    const { sandboxRoot } = resolveSandboxPaths("Work", process.env);
    const cachePath = getUsageCachePath("Work", process.env);

    expect(cachePath).toBe(path.join(sandboxRoot, "usage-cache.json"));

    removeTree(tempRoot);
  });

  it("writes cache and reads it back", () => {
    const tempRoot = makeTempDir();
    process.env.SWOP_ROOT = tempRoot;

    const realHome = `${tempRoot}/real-home`;
    mkdir0700(path.join(realHome, ".codex"));
    createSandbox("Work", process.env, realHome);

    const usage: UsageSnapshotV1 = {
      plan_type: "pro",
      rate_limit: {
        allowed: true,
        limit_reached: false,
        secondary_window: {
          used_percent: 25,
          reset_at: "2024-01-01T00:00:00.000Z",
        },
      },
    };

    writeUsageCache("Work", process.env, {
      fetched_at: "2024-01-01T00:00:00.000Z",
      usage,
    });

    const readResult = readUsageCache("Work", process.env);

    expect(readResult.ok).toBe(true);
    if (readResult.ok) {
      expect(readResult.fetched_at).toBe("2024-01-01T00:00:00.000Z");
      expect(readResult.usage.plan_type).toBe("pro");
    }

    removeTree(tempRoot);
  });

  it("treats older-than-15m cache as expired", () => {
    const now = new Date("2024-01-01T00:20:00.000Z");
    const within = isWithinTtl("2024-01-01T00:10:30.000Z", now, 15 * 60 * 1000);
    const expired = isWithinTtl("2024-01-01T00:00:00.000Z", now, 15 * 60 * 1000);

    expect(within).toBe(true);
    expect(expired).toBe(false);
  });

  it("writes valid JSON atomically", () => {
    const tempRoot = makeTempDir();
    process.env.SWOP_ROOT = tempRoot;

    const realHome = `${tempRoot}/real-home`;
    mkdir0700(path.join(realHome, ".codex"));
    createSandbox("Work", process.env, realHome);

    writeUsageCache("Work", process.env, {
      fetched_at: "2024-01-01T00:00:00.000Z",
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
    });

    const cachePath = getUsageCachePath("Work", process.env);
    const stat = lstatSafe(cachePath);
    expect(stat.exists).toBe(true);

    const parsed = readJson<{ fetched_at: string }>(cachePath);
    expect(parsed.fetched_at).toBe("2024-01-01T00:00:00.000Z");

    removeTree(tempRoot);
  });
});
