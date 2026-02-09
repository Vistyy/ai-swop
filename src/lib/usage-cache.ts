import path from "node:path";

import { lstatSafe, readJson, writeFile0600Atomic } from "./fs";
import { resolveSandboxPaths } from "./sandbox-paths";
import type { UsageSnapshotV1 } from "./usage-types";
import { normalizeUsageSnapshotV1 } from "./usage-normalize";

type UsageRefreshErrorKind = "auth" | "network" | "timeout" | "server" | "parse";

export type UsageCacheReadResult =
  | {
      ok: true;
      usage: UsageSnapshotV1;
      fetched_at: string;
      last_refresh_attempt_at?: string;
      last_refresh_error_kind?: UsageRefreshErrorKind;
    }
  | { ok: false; reason: "missing" | "invalid" };

export type UsageCachePayload = {
  fetched_at: string;
  usage: UsageSnapshotV1;
  last_refresh_attempt_at?: string;
  last_refresh_error_kind?: UsageRefreshErrorKind;
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
    const parsed = readJson<unknown>(cachePath);
    const normalized = normalizeUsageCachePayload(parsed);
    if (!normalized) {
      return { ok: false, reason: "invalid" };
    }
    return {
      ok: true,
      usage: normalized.usage,
      fetched_at: normalized.fetched_at,
      last_refresh_attempt_at: normalized.last_refresh_attempt_at,
      last_refresh_error_kind: normalized.last_refresh_error_kind,
    };
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

function normalizeUsageCachePayload(value: unknown): UsageCachePayload | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as {
    fetched_at?: unknown;
    usage?: unknown;
    last_refresh_attempt_at?: unknown;
    last_refresh_error_kind?: unknown;
  };
  if (typeof record.fetched_at !== "string") {
    return null;
  }

  const normalizedUsage = normalizeUsageSnapshotV1(record.usage);
  if (!normalizedUsage) {
    return null;
  }

  const lastRefreshAttemptAt =
    typeof record.last_refresh_attempt_at === "string"
      ? record.last_refresh_attempt_at
      : undefined;
  const lastRefreshErrorKind = isRefreshErrorKind(record.last_refresh_error_kind)
    ? record.last_refresh_error_kind
    : undefined;

  return {
    fetched_at: record.fetched_at,
    usage: normalizedUsage,
    last_refresh_attempt_at: lastRefreshAttemptAt,
    last_refresh_error_kind: lastRefreshErrorKind,
  };
}

function isRefreshErrorKind(value: unknown): value is UsageRefreshErrorKind {
  return (
    value === "auth" ||
    value === "network" ||
    value === "timeout" ||
    value === "server" ||
    value === "parse"
  );
}
