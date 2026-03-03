import type { UsageClientResult } from "./usage-types";

const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  blue: "\x1b[34m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
};

const LABEL_WIDTH = 14;
const EMAIL_WIDTH = 24;
const PLAN_WIDTH = 5;
const WINDOW_WIDTH = 10;

export function formatCompactAccountSummary(
  label: string,
  email: string | undefined,
  result: UsageClientResult,
  now: Date,
): string {
  if (!result.ok) {
    return [
      color(pad(label, LABEL_WIDTH), ANSI.bold + ANSI.cyan),
      color(pad(email ?? "-", EMAIL_WIDTH), ANSI.dim),
      color(pad("err", PLAN_WIDTH), ANSI.red),
      color(truncate(`err:${result.message}`, 28), ANSI.red),
    ].join("  ");
  }

  const displayEmail = result.usage.email ?? email ?? "-";
  const baseParts = [
    color(pad(label, LABEL_WIDTH), ANSI.bold + ANSI.cyan),
    color(pad(displayEmail, EMAIL_WIDTH), ANSI.dim),
    color(pad(result.usage.plan_type, PLAN_WIDTH), ANSI.blue),
  ];

  const rateLimit = result.usage.rate_limit;
  if (!rateLimit) {
    baseParts.push(color(pad("5h --", WINDOW_WIDTH), ANSI.dim));
    baseParts.push(color(pad("7d --", WINDOW_WIDTH), ANSI.dim));
    baseParts.push(color("noquota", ANSI.yellow));
    return baseParts.join("  ");
  }

  const primaryRemaining = Math.max(0, 100 - rateLimit.primary_window.used_percent);
  const secondaryRemaining = Math.max(0, 100 - rateLimit.secondary_window.used_percent);
  const stateParts: string[] = [];
  if (rateLimit.limit_reached || !rateLimit.allowed) {
    stateParts.push("blocked");
  }
  if (result.freshness.stale) {
    stateParts.push(`stale:${result.freshness.age_seconds}s`);
  }
  if (result.warning) {
    stateParts.push(result.warning.kind);
  }

  baseParts.push(color(pad(`5h ${primaryRemaining.toFixed(0)}% ${formatShortReset(rateLimit.primary_window.reset_at, now)}`, WINDOW_WIDTH), usageColor(primaryRemaining)));
  baseParts.push(color(pad(`7d ${secondaryRemaining.toFixed(0)}% ${formatShortReset(rateLimit.secondary_window.reset_at, now)}`, WINDOW_WIDTH), usageColor(secondaryRemaining)));
  if (stateParts.length > 0) {
    baseParts.push(color(stateParts.join(" "), stateParts.includes("blocked") ? ANSI.red : ANSI.yellow));
  }

  return baseParts.join("  ");
}

export function formatCompactAccountHeader(): string {
  return color(
    [
      pad("Account", LABEL_WIDTH),
      pad("Email", EMAIL_WIDTH),
      pad("Plan", PLAN_WIDTH),
      pad("5h", WINDOW_WIDTH),
      pad("7d", WINDOW_WIDTH),
      "State",
    ].join("  "),
    ANSI.dim,
  );
}

function formatShortReset(resetAt: string, now: Date): string {
  const resetTime = new Date(resetAt).getTime();
  const diffMs = resetTime - now.getTime();
  if (diffMs <= 0) {
    return "now";
  }

  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `${diffDays}d`;
  }
  if (diffHours > 0) {
    return `${diffHours}h`;
  }
  return `${Math.max(1, diffMinutes)}m`;
}

function usageColor(remainingPercent: number): string {
  if (remainingPercent > 50) {
    return ANSI.green;
  }
  if (remainingPercent > 20) {
    return ANSI.yellow;
  }
  return ANSI.red;
}

function color(value: string, ansi: string): string {
  return `${ansi}${value}${ANSI.reset}`;
}

function pad(value: string, width: number): string {
  const truncated = truncate(value, width);
  return truncated.length >= width ? truncated : truncated.padEnd(width, " ");
}

function truncate(value: string, width: number): string {
  if (value.length <= width) {
    return value;
  }
  if (width <= 3) {
    return value.slice(0, width);
  }
  return `${value.slice(0, width - 3)}...`;
}
