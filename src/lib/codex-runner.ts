import { spawnSync } from "node:child_process";

export type CodexRun = {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout?: string;
  stderr?: string;
  errorCode?: string;
};

export type CodexRunner = (
  args: string[],
  opts: { env: NodeJS.ProcessEnv; stdio: "inherit" | "pipe"; timeoutMs?: number },
) => CodexRun;

export const runCodex: CodexRunner = (args, opts) => {
  const result = spawnSync("codex", args, {
    env: opts.env,
    stdio: opts.stdio,
    encoding: "utf8",
    timeout: opts.timeoutMs,
  });

  const run: CodexRun = {
    code: result.status,
    signal: result.signal,
    stdout: typeof result.stdout === "string" ? result.stdout : undefined,
    stderr: typeof result.stderr === "string" ? result.stderr : undefined,
  };

  if (result.error) {
    const errorCode = (result.error as NodeJS.ErrnoException).code;
    run.errorCode = errorCode;
    run.stderr = `codex failed: ${errorCode ?? "unknown error"}`;
  }

  return run;
};
