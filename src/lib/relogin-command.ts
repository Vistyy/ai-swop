import type { CodexRunner } from "./codex-runner";
import { resolveSandboxPaths } from "./sandbox-paths";
import { buildSandboxCodexEnv } from "./codex-env";
import { lstatSafe } from "./fs";
import { routeCodexAuthToAccount } from "./auth-routing";
import { resolveIsolationMode } from "./isolation-mode";

export type ReloginResult = { ok: true } | { ok: false; message: string; exitCode: number };

export async function runSwopRelogin(
  args: string[],
  env: NodeJS.ProcessEnv,
  deps: {
    runCodex: CodexRunner;
    stdin: NodeJS.ReadStream;
    stdout: NodeJS.WriteStream;
    stderr: NodeJS.WriteStream;
  },
): Promise<ReloginResult> {
  const accountLabel = args[0];
  if (!accountLabel) {
    return { ok: false, message: "Usage: swop relogin <account>", exitCode: 2 };
  }

  // 1. Validate account
  const paths = resolveSandboxPaths(accountLabel, env);
  if (!lstatSafe(paths.sandboxRoot).isDirectory) {
    return { ok: false, message: `Unknown account: ${accountLabel}`, exitCode: 1 };
  }

  const sandboxEnv = buildSandboxCodexEnv(env, paths.sandboxHome, paths.sandboxRoot);
  if (resolveIsolationMode(env) === "relaxed") {
    const routeResult = routeCodexAuthToAccount(accountLabel, env);
    if (!routeResult.ok) {
      return { ok: false, message: routeResult.message, exitCode: 1 };
    }
  }

  // 2. Force interactive login flow (skipping "Session expired" message if we can, 
  // but ensureAuthInteractive has that prompt built-in.
  // Actually, runSwopRelogin is EXPLICIT. We should probably skip the "Session expired... Login? [Y/n]" prompt 
  // and just run `codex login`.
  // But reusing ensureAuthInteractive gives us the TTY check and common logic.
  // Let's call codex login directly since the user ASKED to login.
  
  if (!deps.stdin.isTTY || !deps.stdout.isTTY) {
    return { ok: false, message: "swop relogin requires an interactive terminal.", exitCode: 1 };
  }
  
  deps.stdout.write(`Logging in to account '${accountLabel}'...\n`);
  
  const run = deps.runCodex(["login"], {
    env: sandboxEnv,
    stdio: "inherit",
  });

  if (run.code === 0) {
    deps.stdout.write("Login successful.\n");
    return { ok: true };
  }

  return { ok: false, message: `Login failed (exit code ${run.code})`, exitCode: run.code ?? 1 };
}
