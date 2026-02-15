import fs from "node:fs";
import path from "node:path";

import { lstatSafe, mkdir0700 } from "./fs";
import { resolveSandboxPaths } from "./sandbox-paths";

const BACKUP_FILE_NAME = "auth.json.swop-backup";

type AuthRouteResult = { ok: true } | { ok: false; message: string };

function resolveRealHome(env: NodeJS.ProcessEnv): string | undefined {
  return env.HOME ?? process.env.HOME;
}

function resolveSymlinkTarget(linkPath: string): string {
  const linkValue = fs.readlinkSync(linkPath);
  if (path.isAbsolute(linkValue)) {
    return path.normalize(linkValue);
  }
  return path.normalize(path.resolve(path.dirname(linkPath), linkValue));
}

export function routeCodexAuthToAccount(
  label: string,
  env: NodeJS.ProcessEnv,
): AuthRouteResult {
  const realHome = resolveRealHome(env);
  if (!realHome) {
    return {
      ok: false,
      message: "Cannot resolve real HOME for relaxed auth routing.",
    };
  }

  const realCodexDir = path.join(realHome, ".codex");
  const realAuthPath = path.join(realCodexDir, "auth.json");
  const backupPath = path.join(realCodexDir, BACKUP_FILE_NAME);
  const { authPath: accountAuthPath } = resolveSandboxPaths(label, env);

  try {
    mkdir0700(realCodexDir);
    mkdir0700(path.dirname(accountAuthPath));

    const realAuthStat = lstatSafe(realAuthPath);
    if (realAuthStat.exists) {
      if (realAuthStat.isSymbolicLink) {
        const currentTarget = resolveSymlinkTarget(realAuthPath);
        if (currentTarget === path.normalize(accountAuthPath)) {
          return { ok: true };
        }
        fs.rmSync(realAuthPath, { force: true });
      } else {
        const backupExists = lstatSafe(backupPath).exists;
        if (!backupExists) {
          fs.renameSync(realAuthPath, backupPath);
        } else {
          fs.rmSync(realAuthPath, { force: true });
        }
      }
    }

    fs.symlinkSync(accountAuthPath, realAuthPath);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to route codex auth";
    return { ok: false, message };
  }
}

export function cleanupCodexAuthRouteForAccount(
  label: string,
  env: NodeJS.ProcessEnv,
): void {
  const realHome = resolveRealHome(env);
  if (!realHome) {
    return;
  }

  const realCodexDir = path.join(realHome, ".codex");
  const realAuthPath = path.join(realCodexDir, "auth.json");
  const backupPath = path.join(realCodexDir, BACKUP_FILE_NAME);
  const { authPath: accountAuthPath } = resolveSandboxPaths(label, env);
  const authStat = lstatSafe(realAuthPath);

  if (!authStat.exists || !authStat.isSymbolicLink) {
    return;
  }

  try {
    const currentTarget = resolveSymlinkTarget(realAuthPath);
    if (currentTarget !== path.normalize(accountAuthPath)) {
      return;
    }

    fs.rmSync(realAuthPath, { force: true });
    if (lstatSafe(backupPath).exists) {
      fs.renameSync(backupPath, realAuthPath);
    }
  } catch {
    // Best-effort cleanup only; logout should still complete.
  }
}

