import path from "node:path";

import { ensureAuthInteractive } from "./auth-flow";

import { selectAutoPickAccount } from "./auto-pick-policy";
import type { CodexRunner } from "./codex-runner";
import { buildSandboxCodexEnv } from "./codex-env";
import { lstatSafe } from "./fs";
import { resolveSandboxPaths } from "./sandbox-paths";
import type { UsageClientResult } from "./usage-types";

const STALE_MAX_AGE_SECONDS = 24 * 60 * 60;

type ResultOk = { ok: true; exitCode: number };

type ResultError = { ok: false; message: string; exitCode: number };

export async function runSwopCodexCommand(
  args: string[],
  env: NodeJS.ProcessEnv,
  deps: {
    runCodex: CodexRunner;
    listSandboxes: (env: NodeJS.ProcessEnv) => { label: string }[];
    getUsageForAccount: (
      label: string,
      env: NodeJS.ProcessEnv,
      options?: { forceRefresh?: boolean },
    ) => Promise<UsageClientResult>;
    touchLastUsedAt: (label: string, env: NodeJS.ProcessEnv, now: Date) => void;
    now?: () => Date;
    stdout?: Pick<Console, "log">;
    stderr?: Pick<Console, "error">;
    stdin?: NodeJS.ReadStream;
  },
): Promise<ResultOk | ResultError> {
  const { codexArgs, accountLabel, useAuto, error } = parseArgs(args);
  if (error) {
    return { ok: false, message: error, exitCode: 2 };
  }

  const now = deps.now?.() ?? new Date();
  const stdout = deps.stdout ?? console;
  const stderr = deps.stderr ?? console;

  const selection = useAuto
    ? await selectAutoAccount(env, deps)
    : selectExplicitAccount(accountLabel, env);

  if (!selection.ok) {
    return selection;
  }

  const { label, warning } = selection;
  if (warning) {
    stderr.error(warning);
  }

  stdout.log(`Selected account: ${label}`);

  const paths = resolveSandboxPaths(label, env);
  const sandboxEnv = buildSandboxCodexEnv(env, paths.sandboxHome, paths.sandboxRoot);

  deps.touchLastUsedAt(label, env, now);

  let exitCode = await executeCodex(deps.runCodex, codexArgs, sandboxEnv);

  // If failure, check if it's an auth issue via Usage API Gate
  // If failure, check if it's an auth issue via Usage API Gate
  if (exitCode !== 0) {
    // Force a fresh check to confirm if it's an auth error (401)
    const usageResult = await deps.getUsageForAccount(label, env, { forceRefresh: true });

    if (!usageResult.ok && usageResult.kind === "auth") {
      const authRes = await ensureAuthInteractive(label, sandboxEnv, {
        runCodex: deps.runCodex,
        stdin: deps.stdin ?? process.stdin,
        stdout: deps.stdout ?? process.stdout,
        stderr: deps.stderr ?? process.stderr,
      });

      if (authRes.ok) {
        exitCode = await executeCodex(deps.runCodex, codexArgs, sandboxEnv);
      } else {
        stderr.error(`Auth recovery failed: ${authRes.message}`);
      }
    }
  }

  return { ok: true, exitCode };
}

async function executeCodex(
  runCodex: CodexRunner,
  args: string[],
  env: NodeJS.ProcessEnv,
): Promise<number> {
  const run = runCodex(args, { env, stdio: "inherit" });
  return run.code ?? 1;
}

type ParsedArgs = {
  codexArgs: string[];
  accountLabel?: string;
  useAuto: boolean;
  error?: string;
};

function parseArgs(args: string[]): ParsedArgs {
  const delimiterIndex = args.indexOf("--");
  const flagArgs = delimiterIndex === -1 ? args : args.slice(0, delimiterIndex);
  const codexArgs = delimiterIndex === -1 ? [] : args.slice(delimiterIndex + 1);

  let accountLabel: string | undefined;
  let useAuto = false;

  for (let index = 0; index < flagArgs.length; index += 1) {
    const value = flagArgs[index];
    if (value === "--account") {
      const label = flagArgs[index + 1];
      if (!label || label.startsWith("--")) {
        return { codexArgs, useAuto, error: "--account requires a label." };
      }
      if (accountLabel) {
        return { codexArgs, useAuto, error: "--account can only be provided once." };
      }
      accountLabel = label;
      index += 1;
      continue;
    }
    if (value === "--auto") {
      useAuto = true;
      continue;
    }

    return {
      codexArgs,
      useAuto,
      error: "Unexpected argument. Use -- to pass arguments to codex.",
    };
  }

  if (accountLabel && useAuto) {
    return { codexArgs, useAuto, error: "Use either --account or --auto, not both." };
  }

  return {
    codexArgs,
    accountLabel,
    useAuto: Boolean(useAuto || !accountLabel),
  };
}

type SelectedAccount =
  | { ok: true; label: string; warning?: string }
  | { ok: false; message: string; exitCode: number };

function selectExplicitAccount(label: string | undefined, env: NodeJS.ProcessEnv): SelectedAccount {
  if (!label) {
    return {
      ok: false,
      message: "Missing account label. Example: swop codex --account Work -- --version",
      exitCode: 2,
    };
  }

  const paths = resolveSandboxPaths(label, env);
  const metaPath = path.join(paths.sandboxRoot, "meta.json");

  if (!lstatSafe(paths.sandboxRoot).isDirectory || !lstatSafe(metaPath).isFile) {
    return {
      ok: false,
      message: `Unknown account: ${label}. Try \"swop add ${label}\" or \"swop status\".`,
      exitCode: 1,
    };
  }

  return { ok: true, label };
}

type UsageOk = Extract<UsageClientResult, { ok: true }>;

async function selectAutoAccount(
  env: NodeJS.ProcessEnv,
  deps: {
    listSandboxes: (env: NodeJS.ProcessEnv) => { label: string }[];
    getUsageForAccount: (label: string, env: NodeJS.ProcessEnv) => Promise<UsageClientResult>;
  },
): Promise<SelectedAccount> {
  const sandboxes = deps.listSandboxes(env);
  if (sandboxes.length === 0) {
    return {
      ok: false,
      message: "No accounts configured. Run \"swop add <label>\" first.",
      exitCode: 1,
    };
  }

  const tier1: { label: string; usage: UsageOk }[] = [];
  const tier2: {
    label: string;
    usage: UsageOk;
    ageSeconds: number;
  }[] = [];

  for (const sandbox of sandboxes) {
    const result = await deps.getUsageForAccount(sandbox.label, env);
    if (!result.ok) {
      continue;
    }

    if (!result.freshness.stale) {
      tier1.push({ label: sandbox.label, usage: result });
      continue;
    }

    if (result.freshness.age_seconds <= STALE_MAX_AGE_SECONDS) {
      tier2.push({
        label: sandbox.label,
        usage: result,
        ageSeconds: result.freshness.age_seconds,
      });
    }
  }

  const candidates = tier1.length > 0 ? tier1 : tier2;
  if (candidates.length === 0) {
    return {
      ok: false,
      message: "No eligible accounts found. Retry or check account health.",
      exitCode: 1,
    };
  }

  const selection = selectAutoPickAccount(
    candidates.map((candidate) => ({ label: candidate.label, usage: candidate.usage.usage })),
  );

  if (!selection.ok) {
    return { ok: false, message: selection.message, exitCode: 1 };
  }

  let warning: string | undefined;
  if (tier1.length === 0) {
    const selectedTier2 = tier2.find((candidate) => candidate.label === selection.selected.label);
    if (selectedTier2) {
      warning = `Warning: stale usage data (${selectedTier2.ageSeconds}s old).`;
    }
  }

  return { ok: true, label: selection.selected.label, warning };
}
