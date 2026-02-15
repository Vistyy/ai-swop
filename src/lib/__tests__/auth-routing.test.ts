import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { cleanupCodexAuthRouteForAccount, routeCodexAuthToAccount } from "../auth-routing";
import { createSandbox } from "../sandbox-manager";

describe("auth routing", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("routes real ~/.codex/auth.json to account auth and restores backup on cleanup", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "swop-auth-routing-"));
    const realHome = path.join(root, "real-home");
    const realCodex = path.join(realHome, ".codex");
    fs.mkdirSync(realCodex, { recursive: true });
    fs.writeFileSync(path.join(realCodex, "auth.json"), "original-auth");

    process.env.SWOP_ROOT = root;
    process.env.HOME = realHome;

    createSandbox("Work", process.env, realHome);

    const route = routeCodexAuthToAccount("Work", process.env);
    expect(route.ok).toBe(true);

    const authPath = path.join(realCodex, "auth.json");
    const backupPath = path.join(realCodex, "auth.json.swop-backup");

    expect(fs.lstatSync(authPath).isSymbolicLink()).toBe(true);
    expect(fs.existsSync(backupPath)).toBe(true);

    cleanupCodexAuthRouteForAccount("Work", process.env);

    expect(fs.lstatSync(authPath).isFile()).toBe(true);
    expect(fs.readFileSync(authPath, "utf8")).toBe("original-auth");
    expect(fs.existsSync(backupPath)).toBe(false);

    fs.rmSync(root, { recursive: true, force: true });
  });
});

