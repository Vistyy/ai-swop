import fs from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { lstatSafe, mkdir0700, removeTree } from "../fs";
import { resolveSandboxPaths } from "../sandbox-paths";
import { createSandbox } from "../sandbox-manager";
import { addAccount, logoutAccount } from "../login-logout-orchestration";
import type { CodexRunner } from "../codex-runner";

function makeTempDir(): string {
  const base = process.env.VITEST_WORKER_ID
    ? `/tmp/swop-test-${process.env.VITEST_WORKER_ID}-${Date.now()}`
    : `/tmp/swop-test-${Date.now()}`;
  return base;
}

describe("login/logout orchestration", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("adds account in interactive mode and requires auth.json", () => {
    const tempRoot = makeTempDir();
    process.env.SWOP_ROOT = tempRoot;
    const realHome = `${tempRoot}/real-home`;
    process.env.HOME = realHome;
    mkdir0700(`${realHome}/.codex`);

    const runCodex: CodexRunner = (_args, opts) => {
      const authPath = path.join(opts.env.HOME ?? "", ".codex", "auth.json");
      fs.writeFileSync(authPath, "token");
      return { code: 0, signal: null };
    };

    const result = addAccount("Work", process.env, {
      isInteractive: true,
      runCodex,
      realHome,
    });

    const paths = resolveSandboxPaths("Work", process.env);
    const authStat = lstatSafe(paths.authPath);

    expect(result.ok).toBe(true);
    expect(lstatSafe(paths.sandboxRoot).exists).toBe(true);
    expect(authStat.exists).toBe(true);
    expect(authStat.isFile).toBe(true);
    expect(authStat.isSymbolicLink).toBe(false);

    removeTree(tempRoot);
  });

  it("rolls back sandbox on login failure", () => {
    const tempRoot = makeTempDir();
    process.env.SWOP_ROOT = tempRoot;
    const realHome = `${tempRoot}/real-home`;
    process.env.HOME = realHome;
    mkdir0700(`${realHome}/.codex`);

    const runCodex: CodexRunner = () => ({ code: 1, signal: null });

    const result = addAccount("Work", process.env, {
      isInteractive: true,
      runCodex,
      realHome,
    });

    const paths = resolveSandboxPaths("Work", process.env);

    expect(result.ok).toBe(false);
    expect(lstatSafe(paths.sandboxRoot).exists).toBe(false);

    removeTree(tempRoot);
  });

  it("fails fast without a TTY and does not create sandbox", () => {
    const tempRoot = makeTempDir();
    process.env.SWOP_ROOT = tempRoot;
    process.env.HOME = `${tempRoot}/real-home`;

    const runCodex: CodexRunner = () => ({ code: 0, signal: null });

    const result = addAccount("Work", process.env, {
      isInteractive: false,
      runCodex,
    });

    const paths = resolveSandboxPaths("Work", process.env);

    expect(result.ok).toBe(false);
    expect(lstatSafe(paths.sandboxRoot).exists).toBe(false);

    removeTree(tempRoot);
  });

  it("removes sandbox after successful remote logout", () => {
    const tempRoot = makeTempDir();
    process.env.SWOP_ROOT = tempRoot;
    const realHome = `${tempRoot}/real-home`;
    process.env.HOME = realHome;
    mkdir0700(`${realHome}/.codex`);

    createSandbox("Work", process.env, realHome);

    const runCodex: CodexRunner = () => ({ code: 0, signal: null });

    const result = logoutAccount("Work", process.env, { runCodex });
    const paths = resolveSandboxPaths("Work", process.env);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected logout to succeed");
    }
    expect(result.warning).toBeUndefined();
    expect(lstatSafe(paths.sandboxRoot).exists).toBe(false);

    removeTree(tempRoot);
  });

  it("removes sandbox and returns warning on remote logout failure", () => {
    const tempRoot = makeTempDir();
    process.env.SWOP_ROOT = tempRoot;
    const realHome = `${tempRoot}/real-home`;
    process.env.HOME = realHome;
    mkdir0700(`${realHome}/.codex`);

    createSandbox("Work", process.env, realHome);

    const runCodex: CodexRunner = () => ({ code: 1, signal: null });

    const result = logoutAccount("Work", process.env, { runCodex });
    const paths = resolveSandboxPaths("Work", process.env);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected logout to succeed");
    }
    expect(result.warning).toBeDefined();
    expect(lstatSafe(paths.sandboxRoot).exists).toBe(false);

    removeTree(tempRoot);
  });

  it("removes sandbox and returns warning when codex is missing", () => {
    const tempRoot = makeTempDir();
    process.env.SWOP_ROOT = tempRoot;
    const realHome = `${tempRoot}/real-home`;
    process.env.HOME = realHome;
    mkdir0700(`${realHome}/.codex`);

    createSandbox("Work", process.env, realHome);

    const runCodex: CodexRunner = () => ({ code: null, signal: null, errorCode: "ENOENT" });

    const result = logoutAccount("Work", process.env, { runCodex });
    const paths = resolveSandboxPaths("Work", process.env);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected logout to succeed");
    }
    expect(result.warning).toBeDefined();
    expect(lstatSafe(paths.sandboxRoot).exists).toBe(false);

    removeTree(tempRoot);
  });
});
