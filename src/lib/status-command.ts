import type { UsageClientResult, UsageSnapshotV1 } from "./usage-types";

export type StatusResult = { ok: true } | { ok: false; message: string; exitCode: number };

export async function runSwopStatus(
  args: string[],
  env: NodeJS.ProcessEnv,
  deps: {
    listSandboxes: (env: NodeJS.ProcessEnv) => { label: string }[];
    getUsageForAccount: (
      label: string,
      env: NodeJS.ProcessEnv,
      options?: { forceRefresh?: boolean },
    ) => Promise<UsageClientResult>;
    stdout?: Pick<Console, "log">;
    stderr?: Pick<Console, "error">;
    now?: () => Date;
  },
): Promise<StatusResult> {
  const forceRefresh = args.includes("--refresh") || args.includes("-R");
  const now = deps.now?.() ?? new Date();
  const stdout = deps.stdout ?? console;

  const sandboxes = deps.listSandboxes(env);
  if (sandboxes.length === 0) {
    stdout.log('No accounts configured. Run "swop add <label>" first.');
    return { ok: true };
  }

  const results = await Promise.all(
    sandboxes.map(async (s) => ({
      label: s.label,
      usage: await deps.getUsageForAccount(s.label, env, { forceRefresh }),
    })),
  );

  for (const { label, usage } of results) {
    renderAccountCard(label, usage, stdout, now);
  }

  return { ok: true };
}

function renderAccountCard(
  label: string,
  result: UsageClientResult,
  stdout: Pick<Console, "log">,
  now: Date,
): void {
  const reset = "\x1b[0m";
  const bold = "\x1b[1m";

  stdout.log(`${bold}Account: ${label}${reset}`);

  if (!result.ok) {
    stdout.log(`  Status: \x1b[31mError: ${result.message}\x1b[0m`);
    stdout.log("");
    return;
  }

  const { plan_type, rate_limit } = result.usage;
  stdout.log(`  Plan: ${plan_type}`);

  if (!rate_limit) {
    stdout.log("  Status: No quota (Free/Expired)");
    stdout.log("");
    return;
  }

  if (rate_limit.limit_reached) {
    stdout.log("  Status: \x1b[31;1mBLOCKED\x1b[0m");
  }

  if (plan_type === "free" && windowsEquivalent(rate_limit.primary_window, rate_limit.secondary_window)) {
    renderWindow("Quota (7d)", rate_limit.secondary_window, stdout, now);
  } else {
    // Primary (5h)
    renderWindow("Primary (5h)", rate_limit.primary_window, stdout, now);
    // Secondary (7d)
    renderWindow("Secondary (7d)", rate_limit.secondary_window, stdout, now);
  }

  if (result.freshness.stale) {
    stdout.log(`  \x1b[33mWarning: data is ${result.freshness.age_seconds}s old\x1b[0m`);
  }
  if (result.warning) {
    stdout.log(`  \x1b[33mWarning: ${result.warning.message}\x1b[0m`);
  }
  stdout.log("");
}

function renderWindow(
  label: string,
  window: { used_percent: number; reset_at: string },
  stdout: Pick<Console, "log">,
  now: Date,
): void {
  const remainingPercent = Math.max(0, 100 - window.used_percent);
  const bar = renderInverseBar(window.used_percent);
  const color = getUsageColor(remainingPercent);
  const resetStr = formatRelativeReset(window.reset_at, now);

  const paddedLabel = label.padEnd(14);
  stdout.log(`  ${paddedLabel}: ${color}${bar}\x1b[0m ${remainingPercent.toFixed(0)}% remains (${resetStr})`);
}

function windowsEquivalent(
  left: { used_percent: number; reset_at: string },
  right: { used_percent: number; reset_at: string },
): boolean {
  return left.used_percent === right.used_percent && left.reset_at === right.reset_at;
}

function renderInverseBar(usedPercent: number): string {
  const totalWidth = 20;
  // Inverse: 0% used = totalWidth filled, 100% used = 0 filled
  const filledWidth = Math.max(0, Math.min(totalWidth, Math.round(((100 - usedPercent) / 100) * totalWidth)));
  const emptyWidth = totalWidth - filledWidth;

  return "█".repeat(filledWidth) + "░".repeat(emptyWidth);
}

function getUsageColor(remainingPercent: number): string {
  if (remainingPercent > 50) return "\x1b[32m"; // Green
  if (remainingPercent > 20) return "\x1b[33m"; // Yellow
  return "\x1b[31m"; // Red
}

function formatRelativeReset(resetAt: string, now: Date): string {
  const resetTime = new Date(resetAt).getTime();
  const diffMs = resetTime - now.getTime();

  if (diffMs <= 0) return "resets now";

  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffDay > 0) {
    return `resets in ${diffDay}d ${diffHour % 24}h`;
  }
  if (diffHour > 0) {
    return `resets in ${diffHour}h ${diffMin % 60}m`;
  }
  if (diffMin > 0) {
    return `resets in ${diffMin}m ${diffSec % 60}s`;
  }
  return `resets in ${diffSec}s`;
}
