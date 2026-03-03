import fs from "node:fs";
import path from "node:path";
import { spawn as spawnChildProcess } from "node:child_process";

import { writeFile0600Atomic } from "./fs";
import { listSandboxes } from "./sandbox-manager";
import { getUsageForAccount } from "./usage-client";
import { resolveAccountsRoot } from "./swop-root";

const DEFAULT_REFRESH_INTERVAL_MS = 10 * 60 * 1000;

type DaemonPidFile = {
  pid: number;
  started_at: string;
};

export type UsageRefreshDaemonStatus = {
  running: boolean;
  pid_path: string;
  pid?: number;
  started_at?: string;
  stale_pid?: boolean;
};

export type StopUsageRefreshDaemonResult = {
  stopped: boolean;
  message: string;
  pid?: number;
};

export function ensureUsageRefreshDaemon(
  env: NodeJS.ProcessEnv,
  deps?: {
    spawn?: typeof spawnChildProcess;
    kill?: typeof process.kill;
    execPath?: string;
    entryPath?: string;
    now?: () => Date;
  },
): void {
  try {
    const pidPath = getUsageRefreshDaemonPidPath(env);
    const kill = deps?.kill ?? process.kill.bind(process);
    const existing = readDaemonPid(pidPath);
    if (existing && isProcessAlive(existing.pid, kill)) {
      return;
    }

    const spawn = deps?.spawn ?? spawnChildProcess;
    const execPath = deps?.execPath ?? process.execPath;
    const entryPath = deps?.entryPath ?? path.resolve(__dirname, "..", "index.js");
    const child = spawn(execPath, [entryPath, "__refresh-daemon"], {
      detached: true,
      stdio: "ignore",
      env: {
        ...env,
        SWOP_REFRESH_DAEMON: "1",
      },
    });
    child.unref();

    if (typeof child.pid === "number" && child.pid > 0) {
      writeDaemonPid(pidPath, {
        pid: child.pid,
        started_at: (deps?.now ?? (() => new Date()))().toISOString(),
      });
    }
  } catch {
    // Background refresh is best-effort and must not block foreground commands.
  }
}

export async function runUsageRefreshDaemon(
  env: NodeJS.ProcessEnv,
  deps?: {
    intervalMs?: number;
    listSandboxes?: typeof listSandboxes;
    getUsageForAccount?: typeof getUsageForAccount;
    now?: () => Date;
  },
): Promise<void> {
  const pidPath = getUsageRefreshDaemonPidPath(env);
  writeDaemonPid(pidPath, {
    pid: process.pid,
    started_at: (deps?.now ?? (() => new Date()))().toISOString(),
  });

  const cleanup = (): void => {
    const active = readDaemonPid(pidPath);
    if (active?.pid === process.pid) {
      try {
        fs.unlinkSync(pidPath);
      } catch {
        // Best-effort cleanup.
      }
    }
  };

  process.on("SIGINT", () => {
    cleanup();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    cleanup();
    process.exit(0);
  });
  process.on("exit", cleanup);

  const sandboxesFn = deps?.listSandboxes ?? listSandboxes;
  const usageFn = deps?.getUsageForAccount ?? getUsageForAccount;
  const refreshAll = async (): Promise<void> => {
    const sandboxes = sandboxesFn(env);
    await Promise.allSettled(
      sandboxes.map(async (sandbox) => {
        await usageFn(sandbox.label, env, { forceRefresh: true });
      }),
    );
  };

  await refreshAll();
  setInterval(() => {
    void refreshAll();
  }, deps?.intervalMs ?? DEFAULT_REFRESH_INTERVAL_MS);

  await new Promise<void>(() => {
    // Keep the daemon process alive until terminated.
  });
}

export function getUsageRefreshDaemonStatus(
  env: NodeJS.ProcessEnv,
  deps?: { kill?: typeof process.kill },
): UsageRefreshDaemonStatus {
  const pidPath = getUsageRefreshDaemonPidPath(env);
  const record = readDaemonPid(pidPath);
  if (!record) {
    return { running: false, pid_path: pidPath };
  }

  const alive = isProcessAlive(record.pid, deps?.kill ?? process.kill.bind(process));
  return {
    running: alive,
    stale_pid: !alive,
    pid_path: pidPath,
    pid: record.pid,
    started_at: record.started_at,
  };
}

export function stopUsageRefreshDaemon(
  env: NodeJS.ProcessEnv,
  deps?: { kill?: typeof process.kill },
): StopUsageRefreshDaemonResult {
  const status = getUsageRefreshDaemonStatus(env, deps);
  if (!status.pid) {
    return {
      stopped: false,
      message: "Usage refresh daemon is not running.",
    };
  }

  const pidPath = getUsageRefreshDaemonPidPath(env);
  if (status.running) {
    (deps?.kill ?? process.kill.bind(process))(status.pid, "SIGTERM");
  }

  try {
    fs.unlinkSync(pidPath);
  } catch {
    // Best-effort cleanup.
  }

  return {
    stopped: status.running,
    pid: status.pid,
    message: status.running
      ? `Stopped usage refresh daemon (pid ${status.pid}).`
      : `Removed stale usage refresh daemon pid file (pid ${status.pid}).`,
  };
}

export function getUsageRefreshDaemonPidPath(env: NodeJS.ProcessEnv): string {
  const accountsRoot = resolveAccountsRoot(env);
  return path.join(path.dirname(accountsRoot), "usage-refresh-daemon.json");
}

function readDaemonPid(pidPath: string): DaemonPidFile | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(pidPath, "utf8")) as Partial<DaemonPidFile>;
    if (typeof parsed.pid !== "number" || parsed.pid <= 0) {
      return null;
    }
    return {
      pid: parsed.pid,
      started_at: typeof parsed.started_at === "string" ? parsed.started_at : new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}

function writeDaemonPid(pidPath: string, payload: DaemonPidFile): void {
  writeFile0600Atomic(pidPath, JSON.stringify(payload, null, 2));
}

function isProcessAlive(pid: number, kill: typeof process.kill): boolean {
  try {
    kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
