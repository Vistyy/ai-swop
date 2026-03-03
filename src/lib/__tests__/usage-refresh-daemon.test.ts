import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ensureUsageRefreshDaemon,
  getUsageRefreshDaemonPidPath,
  getUsageRefreshDaemonStatus,
  stopUsageRefreshDaemon,
} from "../usage-refresh-daemon";

function createEnvRoot(): { root: string; env: NodeJS.ProcessEnv } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "swop-daemon-"));
  return {
    root,
    env: {
      SWOP_ROOT: root,
      HOME: root,
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ensureUsageRefreshDaemon", () => {
  it("starts a detached daemon when no active pid is recorded", () => {
    const { env } = createEnvRoot();
    const spawn = vi.fn().mockReturnValue({ pid: 4321, unref: vi.fn() });
    const kill = vi.fn(() => {
      throw new Error("not running");
    });

    ensureUsageRefreshDaemon(env, {
      spawn,
      kill,
      execPath: "/usr/bin/node",
      entryPath: "/repo/dist/index.js",
    });

    expect(spawn).toHaveBeenCalledWith(
      "/usr/bin/node",
      ["/repo/dist/index.js", "__refresh-daemon"],
      expect.objectContaining({
        detached: true,
        stdio: "ignore",
      }),
    );
    const pidFile = JSON.parse(fs.readFileSync(getUsageRefreshDaemonPidPath(env), "utf8")) as { pid: number };
    expect(pidFile.pid).toBe(4321);
  });

  it("does not start a second daemon when the recorded pid is still alive", () => {
    const { root, env } = createEnvRoot();
    const spawn = vi.fn();
    const kill = vi.fn();
    const pidPath = getUsageRefreshDaemonPidPath(env);
    fs.mkdirSync(path.dirname(pidPath), { recursive: true });
    fs.writeFileSync(pidPath, JSON.stringify({ pid: 1234, started_at: "2026-03-03T10:00:00.000Z" }), "utf8");
    kill.mockImplementation(() => undefined);

    ensureUsageRefreshDaemon(env, {
      spawn,
      kill,
      execPath: "/usr/bin/node",
      entryPath: "/repo/dist/index.js",
    });

    expect(kill).toHaveBeenCalledWith(1234, 0);
    expect(spawn).not.toHaveBeenCalled();
  });

  it("reports running status when pid is alive", () => {
    const { env } = createEnvRoot();
    const pidPath = getUsageRefreshDaemonPidPath(env);
    fs.mkdirSync(path.dirname(pidPath), { recursive: true });
    fs.writeFileSync(pidPath, JSON.stringify({ pid: 777, started_at: "2026-03-03T10:00:00.000Z" }), "utf8");

    const status = getUsageRefreshDaemonStatus(env, {
      kill: vi.fn(() => undefined),
    });

    expect(status.running).toBe(true);
    expect(status.pid).toBe(777);
  });

  it("stops a running daemon and removes the pid file", () => {
    const { env } = createEnvRoot();
    const pidPath = getUsageRefreshDaemonPidPath(env);
    fs.mkdirSync(path.dirname(pidPath), { recursive: true });
    fs.writeFileSync(pidPath, JSON.stringify({ pid: 777, started_at: "2026-03-03T10:00:00.000Z" }), "utf8");
    const kill = vi.fn(() => undefined);

    const result = stopUsageRefreshDaemon(env, { kill });

    expect(result.stopped).toBe(true);
    expect(kill).toHaveBeenCalledWith(777, "SIGTERM");
    expect(fs.existsSync(pidPath)).toBe(false);
  });
});
