import * as readline from "node:readline";
import type { CodexRunner } from "./codex-runner";

export type AuthFlowDeps = {
  runCodex: CodexRunner;
  stdin: NodeJS.ReadStream;
  stdout: NodeJS.WriteStream | Pick<Console, "log">;
  stderr: NodeJS.WriteStream | Pick<Console, "error">;
};

export async function ensureAuthInteractive(
  label: string,
  sandboxEnv: NodeJS.ProcessEnv,
  deps: AuthFlowDeps,
): Promise<{ ok: true } | { ok: false; message: string }> {
  // 1. Check if interactive
  const stdoutIsTTY = "isTTY" in deps.stdout && deps.stdout.isTTY;
  const stdinIsTTY = "isTTY" in deps.stdin && deps.stdin.isTTY;

  if (!stdinIsTTY || !stdoutIsTTY) {
    return {
      ok: false,
      message: `Session expired for account '${label}'. Run 'swop relogin ${label}' to restore access.`,
    };
  }

  // Cast safely since we verified TTY
  const stdout = deps.stdout as NodeJS.WriteStream;
  const stdin = deps.stdin;

  // 2. Prompt user
  const confirmed = await promptYesNo(
    `Session expired for account '${label}'. Login now? [Y/n] `,
    stdin,
    stdout,
  );

  if (!confirmed) {
    return { ok: false, message: "Login aborted by user." };
  }

  // 3. Run codex login
  stdout.write(`running 'codex login' for ${label}...\n`);
  
  const run = deps.runCodex(["login"], {
    env: sandboxEnv,
    stdio: "inherit",
  });

  if (run.code === 0) {
    stdout.write("\nLogin successful.\n");
    return { ok: true };
  }

  return {
    ok: false,
    message: `Login failed (exit code ${run.code}).`,
  };
}

function promptYesNo(
  question: string,
  stdin: NodeJS.ReadStream,
  stdout: NodeJS.WriteStream,
): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: stdin,
      output: stdout,
    });

    rl.question(question, (answer) => {
      rl.close();
      const normalized = answer.trim().toLowerCase();
      // Default to Yes if empty, otherwise strictly 'y' or 'yes'
      if (normalized === "" || normalized === "y" || normalized === "yes") {
        resolve(true);
      } else {
        resolve(false);
      }
    });
  });
}
