import { readUsageAccessToken } from "./usage-auth";
import { fetchUsageSnapshot, UsageFetchResult } from "./usage-fetch";
import { isWithinTtl, readUsageCache, writeUsageCache } from "./usage-cache";
import type { UsageClientResult, UsageFreshness } from "./usage-types";

const DEFAULT_TTL_MS = 15 * 60 * 1000;

export type UsageFetcher = (
  accessToken: string,
  options?: { timeoutMs?: number },
) => Promise<UsageFetchResult>;

export async function getUsageForAccount(
  label: string,
  env: NodeJS.ProcessEnv,
  options?: {
    now?: () => Date;
    fetcher?: UsageFetcher;
    timeoutMs?: number;
    ttlMs?: number;
    forceRefresh?: boolean;
  },
): Promise<UsageClientResult> {
  const now = options?.now?.() ?? new Date();
  const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
  const fetcher = options?.fetcher ?? fetchUsageSnapshot;
  const debugUsage = env.SWOP_DEBUG_USAGE === "1" || (env.SWOP_DEBUG ?? "").split(",").includes("usage");

  const cacheResult = readUsageCache(label, env);
  const cacheWithinTtl = cacheResult.ok && isWithinTtl(cacheResult.fetched_at, now, ttlMs);
  if (!options?.forceRefresh && cacheWithinTtl) {
    if (debugUsage) {
      const ageSeconds = buildFreshness(cacheResult.fetched_at, now, false).age_seconds;
      console.error(`swop:usage cache-hit label=${label} age_seconds=${ageSeconds}`);
    }
    return {
      ok: true,
      usage: cacheResult.usage,
      freshness: buildFreshness(cacheResult.fetched_at, now, false),
    };
  }

  if (debugUsage) {
    console.error(
      `swop:usage fetch label=${label} forceRefresh=${Boolean(options?.forceRefresh)} cache=${cacheResult.ok ? "ok" : cacheResult.reason} withinTtl=${cacheWithinTtl}`,
    );
  }

  const tokenResult = readUsageAccessToken(label, env);
  if (!tokenResult.ok) {
    if (cacheResult.ok) {
      return {
        ok: true,
        usage: cacheResult.usage,
        freshness: buildFreshness(cacheResult.fetched_at, now, true),
        warning: { kind: tokenResult.kind, message: tokenResult.message },
      };
    }

    return {
      ok: false,
      kind: tokenResult.kind,
      message: tokenResult.message,
    };
  }

  const fetchResult = await fetcher(tokenResult.token, { timeoutMs: options?.timeoutMs });

  if (fetchResult.ok) {
    const fetchedAt = now.toISOString();
    writeUsageCache(label, env, { fetched_at: fetchedAt, usage: fetchResult.usage });
    if (debugUsage) {
      console.error(`swop:usage cache-write label=${label} fetched_at=${fetchedAt}`);
    }
    return {
      ok: true,
      usage: fetchResult.usage,
      freshness: buildFreshness(fetchedAt, now, false),
    };
  }

  if (cacheResult.ok) {
    return {
      ok: true,
      usage: cacheResult.usage,
      freshness: buildFreshness(cacheResult.fetched_at, now, true),
      warning: { kind: fetchResult.kind, message: fetchResult.message },
    };
  }

  return {
    ok: false,
    kind: fetchResult.kind,
    message: fetchResult.message,
  };
}

function buildFreshness(fetchedAtIso: string, now: Date, stale: boolean): UsageFreshness {
  const ageSeconds = calculateAgeSeconds(fetchedAtIso, now);
  return {
    fetched_at: fetchedAtIso,
    stale,
    age_seconds: ageSeconds,
  };
}

function calculateAgeSeconds(fetchedAtIso: string, now: Date): number {
  const fetchedMs = Date.parse(fetchedAtIso);
  if (Number.isNaN(fetchedMs)) {
    return 0;
  }

  return Math.max(0, Math.floor((now.getTime() - fetchedMs) / 1000));
}
