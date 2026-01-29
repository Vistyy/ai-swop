import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createSandbox } from "../sandbox-manager";
import { resolveSandboxPaths } from "../sandbox-paths";
import { lstatSafe, mkdir0700, removeTree, writeFile0600Atomic } from "../fs";
import { readUsageAccessToken } from "../usage-auth";

function makeTempDir(): string {
  const base = process.env.VITEST_WORKER_ID
    ? `/tmp/swop-usage-auth-${process.env.VITEST_WORKER_ID}-${Date.now()}`
    : `/tmp/swop-usage-auth-${Date.now()}`;
  return base;
}

describe("usage-auth", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("reads tokens.access_token from auth.json", () => {
    const tempRoot = makeTempDir();
    process.env.SWOP_ROOT = tempRoot;

    const realHome = `${tempRoot}/real-home`;
    mkdir0700(path.join(realHome, ".codex"));

    createSandbox("Work", process.env, realHome);

    const { authPath } = resolveSandboxPaths("Work", process.env);
    writeFile0600Atomic(
      authPath,
      JSON.stringify({ tokens: { access_token: "token-123" } }, null, 2),
    );

    const result = readUsageAccessToken("Work", process.env);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.token).toBe("token-123");
    }

    removeTree(tempRoot);
  });

  it("returns an auth error when auth.json is missing", () => {
    const tempRoot = makeTempDir();
    process.env.SWOP_ROOT = tempRoot;

    const realHome = `${tempRoot}/real-home`;
    mkdir0700(path.join(realHome, ".codex"));

    createSandbox("Work", process.env, realHome);

    const { authPath } = resolveSandboxPaths("Work", process.env);
    const authStat = lstatSafe(authPath);
    expect(authStat.exists).toBe(false);

    const result = readUsageAccessToken("Work", process.env);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("auth");
      expect(result.message.toLowerCase()).toContain("auth");
    }

    removeTree(tempRoot);
  });

  it("returns an auth error when tokens.access_token is missing", () => {
    const tempRoot = makeTempDir();
    process.env.SWOP_ROOT = tempRoot;

    const realHome = `${tempRoot}/real-home`;
    mkdir0700(path.join(realHome, ".codex"));

    createSandbox("Work", process.env, realHome);

    const { authPath } = resolveSandboxPaths("Work", process.env);
    writeFile0600Atomic(authPath, JSON.stringify({ tokens: {} }, null, 2));

    const result = readUsageAccessToken("Work", process.env);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("auth");
      expect(result.message.toLowerCase()).toContain("token");
    }

    removeTree(tempRoot);
  });

  it("returns an auth error when tokens.access_token is empty", () => {
    const tempRoot = makeTempDir();
    process.env.SWOP_ROOT = tempRoot;

    const realHome = `${tempRoot}/real-home`;
    mkdir0700(path.join(realHome, ".codex"));

    createSandbox("Work", process.env, realHome);

    const { authPath } = resolveSandboxPaths("Work", process.env);
    writeFile0600Atomic(
      authPath,
      JSON.stringify({ tokens: { access_token: "" } }, null, 2),
    );

    const result = readUsageAccessToken("Work", process.env);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("auth");
      expect(result.message.toLowerCase()).toContain("token");
    }

    removeTree(tempRoot);
  });
});
