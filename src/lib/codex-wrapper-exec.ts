import path from "node:path";

import { ensureAuthInteractive } from "./auth-flow";
import { routeCodexAuthToAccount } from "./auth-routing";
import { formatCompactAccountSummary } from "./account-status-summary";
import { selectAutoPickAccount } from "./auto-pick-policy";
import type { CodexRunner } from "./codex-runner";
import { buildSandboxCodexEnv } from "./codex-env";
import { lstatSafe } from "./fs";
import { selectInteractiveAccount as selectInteractiveAccountUi } from "./interactive-account-select";
import { resolveIsolationMode } from "./isolation-mode";
import { resolveSandboxPaths } from "./sandbox-paths";
import type { UsageClientResult } from "./usage-types";

const STALE_MAX_AGE_SECONDS = 24 * 60 * 60;

type ResultOk = { ok: true; exitCode: number };

type ResultError = { ok: false; message: string; exitCode: number };

type SandboxRecord = { label: string; email?: string; last_used_at?: string };

export async function runSwopCodexCommand(
  args: string[],
  env: NodeJS.ProcessEnv,
  deps: {
    runCodex: CodexRunner;
    listSandboxes: (env: NodeJS.ProcessEnv) => SandboxRecord[];
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
    selectInteractiveAccount?: typeof selectInteractiveAccountUi;
  },
): Promise<ResultOk | ResultError> {
  const { codexArgs, accountLabel, useAuto, interactive, error } = parseArgs(args);
  if (error) {
    return { ok: false, message: error, exitCode: 2 };
  }

  const now = deps.now?.() ?? new Date();
  const stdout = deps.stdout ?? console;
  const stderr = deps.stderr ?? console;

  let selection: SelectedAccount;
  if (interactive) {
    selection = await selectInteractiveAccount(env, deps, now);
  } else if (useAuto) {
    selection = await selectAutoAccount(env, deps);
  } else {
    selection = selectExplicitAccount(accountLabel, env);
  }

  if (!selection.ok) {
    return selection;
  }

  const { label, warning } = selection;
  if (warning) {
    stderr.error(warning);
  }

  stdout.log(`Selected account: ${label}`);

  const paths = resolveSandboxPaths(label, env);
  if (resolveIsolationMode(env) === "relaxed") {
    const routeResult = routeCodexAuthToAccount(label, env);
    if (!routeResult.ok) {
      return { ok: false, message: routeResult.message, exitCode: 1 };
    }
  }
  const sandboxEnv = buildSandboxCodexEnv(env, paths.sandboxHome, paths.sandboxRoot);

  deps.touchLastUsedAt(label, env, now);

  let exitCode = await executeCodex(deps.runCodex, codexArgs, sandboxEnv);

  if (exitCode !== 0) {
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
  interactive: boolean;
  error?: string;
};

function parseArgs(args: string[]): ParsedArgs {
  const delimiterIndex = args.indexOf("--");
  const flagArgs = delimiterIndex === -1 ? args : args.slice(0, delimiterIndex);
  const codexArgs = delimiterIndex === -1 ? [] : args.slice(delimiterIndex + 1);

  let accountLabel: string | undefined;
  let autoFlag = false;
  let interactive = false;

  for (let index = 0; index < flagArgs.length; index += 1) {
    const value = flagArgs[index];
    if (value === "--account" || value === "-a") {
      const label = flagArgs[index + 1];
      if (!label || label.startsWith("-")) {
        return { codexArgs, useAuto: false, interactive, error: "--account requires a label." };
      }
      if (accountLabel) {
        return { codexArgs, useAuto: false, interactive, error: "--account can only be provided once." };
      }
      accountLabel = label;
      index += 1;
      continue;
    }
    if (value === "--auto") {
      autoFlag = true;
      continue;
    }
    if (value === "--interactive" || value === "-i") {
      interactive = true;
      continue;
    }

    return {
      codexArgs,
      useAuto: false,
      interactive,
      error: "Unexpected argument. Use -- to pass arguments to codex.",
    };
  }

  if (accountLabel && autoFlag) {
    return { codexArgs, useAuto: false, interactive, error: "Use either --account or --auto, not both." };
  }
  if (accountLabel && interactive) {
    return { codexArgs, useAuto: false, interactive, error: "Use either --account or --interactive, not both." };
  }
  if (autoFlag && interactive) {
    return { codexArgs, useAuto: false, interactive, error: "Use either --auto or --interactive, not both." };
  }

  return {
    codexArgs,
    accountLabel,
    interactive,
    useAuto: Boolean(autoFlag || (!accountLabel && !interactive)),
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

type TierCandidate = {
  label: string;
  email?: string;
  last_used_at?: string;
  usage: UsageOk;
  ageSeconds?: number;
};

async function selectAutoAccount(
  env: NodeJS.ProcessEnv,
  deps: {
    listSandboxes: (env: NodeJS.ProcessEnv) => SandboxRecord[];
    getUsageForAccount: (label: string, env: NodeJS.ProcessEnv) => Promise<UsageClientResult>;
  },
): Promise<SelectedAccount> {
  const sandboxes = deps.listSandboxes(env);
  if (sandboxes.length === 0) {
    return {
      ok: false,
      message: 'No accounts configured. Run "swop add <label>" first.',
      exitCode: 1,
    };
  }

  const tier1: TierCandidate[] = [];
  const tier2: TierCandidate[] = [];

  for (const sandbox of sandboxes) {
    const result = await deps.getUsageForAccount(sandbox.label, env);
    if (!result.ok) {
      continue;
    }

    const candidate: TierCandidate = {
      label: sandbox.label,
      email: sandbox.email,
      last_used_at: sandbox.last_used_at,
      usage: result,
    };

    if (!result.freshness.stale) {
      tier1.push(candidate);
      continue;
    }

    if (result.freshness.age_seconds <= STALE_MAX_AGE_SECONDS) {
      tier2.push({
        ...candidate,
        ageSeconds: result.freshness.age_seconds,
      });
    }
  }

  if (tier1.length === 0 && tier2.length === 0) {
    return {
      ok: false,
      message: "No eligible accounts found. Retry or check account health.",
      exitCode: 1,
    };
  }

  if (tier1.length > 0) {
    const tier1Selection = selectAutoPickAccount(mapCandidates(tier1));
    if (tier1Selection.ok) {
      return { ok: true, label: tier1Selection.selected.label };
    }

    if (tier2.length === 0) {
      return { ok: false, message: tier1Selection.message, exitCode: 1 };
    }
  }

  const tier2Selection = selectAutoPickAccount(mapCandidates(tier2));
  if (!tier2Selection.ok) {
    return { ok: false, message: tier2Selection.message, exitCode: 1 };
  }

  const selectedTier2 = tier2.find((candidate) => candidate.label === tier2Selection.selected.label);
  const warning = selectedTier2?.ageSeconds
    ? `Warning: stale usage data (${selectedTier2.ageSeconds}s old).`
    : undefined;

  return { ok: true, label: tier2Selection.selected.label, warning };
}

async function selectInteractiveAccount(
  env: NodeJS.ProcessEnv,
  deps: {
    listSandboxes: (env: NodeJS.ProcessEnv) => SandboxRecord[];
    getUsageForAccount: (label: string, env: NodeJS.ProcessEnv) => Promise<UsageClientResult>;
    stdin?: NodeJS.ReadStream;
    selectInteractiveAccount?: typeof selectInteractiveAccountUi;
  },
  now: Date,
): Promise<SelectedAccount> {
  const sandboxes = deps.listSandboxes(env);
  if (sandboxes.length === 0) {
    return {
      ok: false,
      message: 'No accounts configured. Run "swop add <label>" first.',
      exitCode: 1,
    };
  }

  const choices = await Promise.all(
    sandboxes.map(async (sandbox) => {
      const result = await deps.getUsageForAccount(sandbox.label, env);
      return {
        label: sandbox.label,
        summary: formatCompactAccountSummary(sandbox.label, sandbox.email, result, now),
      };
    }),
  );

  const selectFn = deps.selectInteractiveAccount ?? selectInteractiveAccountUi;
  const selection = await selectFn(choices, {
    stdin: deps.stdin ?? process.stdin,
  });
  if (!selection.ok) {
    return selection;
  }

  if (!sandboxes.some((sandbox) => sandbox.label === selection.label)) {
    return {
      ok: false,
      message: `Unknown account: ${selection.label}. Try \"swop add ${selection.label}\" or \"swop status\".`,
      exitCode: 1,
    };
  }

  return { ok: true, label: selection.label };
}

function mapCandidates(candidates: TierCandidate[]) {
  return candidates.map((candidate) => ({
    label: candidate.label,
    usage: candidate.usage.usage,
    last_used_at: candidate.last_used_at,
  }));
}
