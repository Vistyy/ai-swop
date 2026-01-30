import path from "node:path";

import { lstatSafe, readJson, writeFile0600Atomic } from "./fs";
import { resolveSandboxPaths } from "./sandbox-paths";
import type { UsageSnapshotV1 } from "./usage-types";

export type UsageCacheReadResult =
  | { ok: true; usage: UsageSnapshotV1; fetched_at: string }
  | { ok: false; reason: "missing" | "invalid" };

type UsageCachePayload = {
  fetched_at: string;
  usage: UsageSnapshotV1;
};

export function getUsageCachePath(label: string, env: NodeJS.ProcessEnv): string {
  const { sandboxRoot } = resolveSandboxPaths(label, env);
  return path.join(sandboxRoot, "usage-cache.json");
}

export function readUsageCache(label: string, env: NodeJS.ProcessEnv): UsageCacheReadResult {
  const cachePath = getUsageCachePath(label, env);
  const stat = lstatSafe(cachePath);
  if (!stat.exists) {
    return { ok: false, reason: "missing" };
  }

  try {
    const parsed = readJson<UsageCachePayload>(cachePath);
    if (!isUsageCachePayload(parsed)) {
      return { ok: false, reason: "invalid" };
    }
    return { ok: true, usage: parsed.usage, fetched_at: parsed.fetched_at };
  } catch {
    return { ok: false, reason: "invalid" };
  }
}

export function writeUsageCache(
  label: string,
  env: NodeJS.ProcessEnv,
  payload: UsageCachePayload,
): void {
  const cachePath = getUsageCachePath(label, env);
  writeFile0600Atomic(cachePath, JSON.stringify(payload, null, 2));
}

export function isWithinTtl(fetchedAtIso: string, now: Date, ttlMs: number): boolean {
  const fetchedAtMs = Date.parse(fetchedAtIso);
  if (Number.isNaN(fetchedAtMs)) {
    return false;
  }
  return now.getTime() - fetchedAtMs <= ttlMs;
}

function isUsageCachePayload(value: unknown): value is UsageCachePayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as { fetched_at?: unknown; usage?: unknown };
  if (typeof record.fetched_at !== "string") {
    return false;
  }

  return isUsageSnapshotV1(record.usage);
}

function isUsageSnapshotV1(value: unknown): value is UsageSnapshotV1 {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as UsageSnapshotV1;
  if (typeof record.plan_type !== "string") {
    return false;
  }

  const rateLimit = record.rate_limit;
  if (!rateLimit || typeof rateLimit !== "object") {
    return false;
  }

  if (typeof rateLimit.allowed !== "boolean") {
    return false;
  }

  if (typeof rateLimit.limit_reached !== "boolean") {
    return false;
  }

  const primary = rateLimit.primary_window;
  if (!primary || typeof primary !== "object") {
    return false;
  }

  const secondary = rateLimit.secondary_window;
  if (!secondary || typeof secondary !== "object") {
    return false;
  }

  return (
    typeof primary.used_percent === "number" &&
    typeof primary.reset_at === "string" &&
    typeof secondary.used_percent === "number" &&
    typeof secondary.reset_at === "string"
  );
}
