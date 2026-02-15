import { lstatSafe } from "./fs";
import { createSandbox, removeSandbox } from "./sandbox-manager";
import { resolveSandboxPaths } from "./sandbox-paths";
import { buildSandboxCodexEnv } from "./codex-env";
import type { CodexRunner } from "./codex-runner";
import { cleanupCodexAuthRouteForAccount, routeCodexAuthToAccount } from "./auth-routing";
import { resolveIsolationMode } from "./isolation-mode";

type AddAccountDeps = {
  isInteractive: boolean;
  runCodex: CodexRunner;
  realHome?: string;
};

type AddAccountResult = { ok: true } | { ok: false; message: string };

type LogoutAccountDeps = {
  runCodex: CodexRunner;
  timeoutMs?: number;
};

type LogoutAccountResult =
  | { ok: true; warning?: string }
  | { ok: false; message: string };

export function addAccount(
  label: string,
  env: NodeJS.ProcessEnv,
  deps: AddAccountDeps,
): AddAccountResult {
  if (!deps.isInteractive) {
    return {
      ok: false,
      message: "swop add requires an interactive terminal (TTY) to run codex login",
    };
  }

  try {
    createSandbox(label, env, deps.realHome);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create sandbox";
    return { ok: false, message };
  }

  const paths = resolveSandboxPaths(label, env);
  if (resolveIsolationMode(env) === "strict") {
    const sandboxEnv = buildSandboxCodexEnv(env, paths.sandboxHome, paths.sandboxRoot);
    const result = deps.runCodex(["login"], { env: sandboxEnv, stdio: "inherit" });

    if (result.code !== 0 || result.errorCode) {
      try {
        removeSandbox(label, env);
      } catch {
        // Ignore rollback failures for add; primary signal is login failure.
      }
      return { ok: false, message: "codex login failed" };
    }

    const authStat = lstatSafe(paths.authPath);
    if (!authStat.exists || !authStat.isFile || authStat.isSymbolicLink) {
      try {
        removeSandbox(label, env);
      } catch {
        // Ignore rollback failures for add; primary signal is missing auth state.
      }
      return { ok: false, message: "codex login did not create auth state" };
    }

    return { ok: true };
  }

  const routeResult = routeCodexAuthToAccount(label, env);
  if (!routeResult.ok) {
    try {
      removeSandbox(label, env);
    } catch {
      // Ignore rollback failures for add; primary signal is auth routing failure.
    }
    return { ok: false, message: routeResult.message };
  }

  const sandboxEnv = buildSandboxCodexEnv(env, paths.sandboxHome, paths.sandboxRoot);
  const result = deps.runCodex(["login"], { env: sandboxEnv, stdio: "inherit" });

  if (result.code !== 0 || result.errorCode) {
    try {
      removeSandbox(label, env);
    } catch {
      // Ignore rollback failures for add; primary signal is login failure.
    }
    return { ok: false, message: "codex login failed" };
  }

  const authStat = lstatSafe(paths.authPath);
  if (!authStat.exists || !authStat.isFile || authStat.isSymbolicLink) {
    try {
      removeSandbox(label, env);
    } catch {
      // Ignore rollback failures for add; primary signal is missing auth state.
    }
    return { ok: false, message: "codex login did not create auth state" };
  }

  return { ok: true };
}

export function logoutAccount(
  label: string,
  env: NodeJS.ProcessEnv,
  deps: LogoutAccountDeps,
): LogoutAccountResult {
  const paths = resolveSandboxPaths(label, env);
  const sandboxStat = lstatSafe(paths.sandboxRoot);
  if (!sandboxStat.exists) {
    return { ok: false, message: `Sandbox not found for label: ${label}` };
  }

  if (resolveIsolationMode(env) === "relaxed") {
    const routeResult = routeCodexAuthToAccount(label, env);
    if (!routeResult.ok) {
      return { ok: false, message: routeResult.message };
    }
  }

  const sandboxEnv = buildSandboxCodexEnv(env, paths.sandboxHome, paths.sandboxRoot);
  const timeoutMs = deps.timeoutMs ?? 30_000;
  const result = deps.runCodex(["logout"], {
    env: sandboxEnv,
    stdio: "pipe",
    timeoutMs,
  });

  let warning: string | undefined;
  if (result.errorCode) {
    warning = `codex logout failed: ${result.errorCode}`;
  } else if (result.code !== 0) {
    warning = "codex logout failed";
  }

  try {
    removeSandbox(label, env);
    if (resolveIsolationMode(env) === "relaxed") {
      cleanupCodexAuthRouteForAccount(label, env);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to remove sandbox";
    return { ok: false, message };
  }

  return warning ? { ok: true, warning } : { ok: true };
}
