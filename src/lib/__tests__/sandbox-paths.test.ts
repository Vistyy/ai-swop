import { afterEach, describe, expect, it } from "vitest";

import { lstatSafe, mkdir0700, removeTree } from "../fs";
import { resolveAccountsRoot } from "../swop-root";
import { createSandbox } from "../sandbox-manager";
import { resolveSandboxPaths } from "../sandbox-paths";

function makeTempDir(): string {
  const base = process.env.VITEST_WORKER_ID
    ? `/tmp/swop-test-${process.env.VITEST_WORKER_ID}-${Date.now()}`
    : `/tmp/swop-test-${Date.now()}`;
  return base;
}

describe("sandbox paths", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("resolves paths for an existing sandbox", () => {
    const tempRoot = makeTempDir();
    process.env.SWOP_ROOT = tempRoot;
    const realHome = `${tempRoot}/real-home`;
    mkdir0700(`${realHome}/.codex`);

    createSandbox("Work", process.env, realHome);

    const paths = resolveSandboxPaths("Work", process.env);
    const accountsRoot = resolveAccountsRoot(process.env);

    expect(paths.sandboxRoot).toBe(`${accountsRoot}/work`);
    expect(paths.sandboxHome).toBe(`${accountsRoot}/work/home`);
    expect(paths.sandboxCodexDir).toBe(`${accountsRoot}/work/home/.codex`);
    expect(paths.authPath).toBe(`${accountsRoot}/work/home/.codex/auth.json`);

    removeTree(tempRoot);
  });

  it("does not create directories for missing sandbox", () => {
    const tempRoot = makeTempDir();
    process.env.SWOP_ROOT = tempRoot;

    const paths = resolveSandboxPaths("Missing", process.env);

    expect(lstatSafe(paths.sandboxRoot).exists).toBe(false);
    expect(lstatSafe(paths.sandboxHome).exists).toBe(false);
    expect(lstatSafe(paths.sandboxCodexDir).exists).toBe(false);

    removeTree(tempRoot);
  });
});
