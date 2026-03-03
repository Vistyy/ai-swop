import { normalizeLabelKey } from "./labels";
import type { UsageSnapshotV1 } from "./usage-types";

export type AutoPickCandidate = {
  label: string;
  usage: UsageSnapshotV1;
  last_used_at?: string;
};

export type AutoPickSuccess = {
  ok: true;
  selected: { label: string };
  message: string;
};

export type AutoPickFailure = {
  ok: false;
  kind: "all-blocked";
  message: string;
  earliest_reset_at?: string;
};

export type AutoPickResult = AutoPickSuccess | AutoPickFailure;

const MIN_PRIMARY_REMAINING_PERCENT = 50;
const MAX_SECONDARY_BALANCE_GAP_PERCENT = 20;

export function selectAutoPickAccount(candidates: AutoPickCandidate[]): AutoPickResult {
  const viable = candidates.filter(
    (candidate) =>
      candidate.usage.rate_limit !== null &&
      candidate.usage.rate_limit.allowed &&
      !candidate.usage.rate_limit.limit_reached,
  );

  if (viable.length === 0) {
    const earliestResetAt = findEarliestResetAt(candidates);

    if (earliestResetAt) {
      return {
        ok: false,
        kind: "all-blocked",
        earliest_reset_at: earliestResetAt,
        message: `all accounts blocked until ${earliestResetAt}.`,
      };
    }

    return {
      ok: false,
      kind: "all-blocked",
      message: "all accounts blocked; reset time unknown.",
    };
  }

  const secondaryFractionScale = usesFractionScale(viable, (candidate) => candidate.usage.rate_limit?.secondary_window.used_percent);
  const primaryFractionScale = usesFractionScale(viable, (candidate) => candidate.usage.rate_limit?.primary_window.used_percent);

  const scored = viable.map((candidate) => {
    const rateLimit = candidate.usage.rate_limit!;
    const secondaryUsedPercent = normalizeUsedPercent(rateLimit.secondary_window.used_percent, secondaryFractionScale);
    const primaryUsedPercent = normalizeUsedPercent(rateLimit.primary_window.used_percent, primaryFractionScale);

    return {
      candidate,
      secondaryRemainingPercent: 100 - secondaryUsedPercent,
      primaryRemainingPercent: 100 - primaryUsedPercent,
      lastUsedAtMs: parseTimestampMs(candidate.last_used_at),
    };
  });

  const primaryHealthy = scored.filter((entry) => entry.primaryRemainingPercent >= MIN_PRIMARY_REMAINING_PERCENT);
  const primaryPool = primaryHealthy.length > 0 ? primaryHealthy : scored;

  const highestSecondaryRemaining = Math.max(...primaryPool.map((entry) => entry.secondaryRemainingPercent));
  const balancedPool = primaryPool.filter(
    (entry) => highestSecondaryRemaining - entry.secondaryRemainingPercent <= MAX_SECONDARY_BALANCE_GAP_PERCENT,
  );

  const selectionPool = balancedPool.length > 0 ? balancedPool : primaryPool;
  const selected = [...selectionPool].sort(compareBalancedCandidates)[0];

  return {
    ok: true,
    selected: { label: selected.candidate.label },
    message: `Selected account ${selected.candidate.label}.`,
  };
}

function findEarliestResetAt(candidates: AutoPickCandidate[]): string | undefined {
  let earliestResetAt: string | undefined;
  let earliestResetMs = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    if (!candidate.usage.rate_limit) {
      continue;
    }
    const resetAt = candidate.usage.rate_limit.secondary_window.reset_at;
    const parsed = Date.parse(resetAt);
    if (!Number.isNaN(parsed) && parsed < earliestResetMs) {
      earliestResetMs = parsed;
      earliestResetAt = resetAt;
    }
  }

  return earliestResetAt;
}

function usesFractionScale(
  candidates: AutoPickCandidate[],
  getValue: (candidate: AutoPickCandidate) => number | undefined,
): boolean {
  const values = candidates
    .map((candidate) => getValue(candidate))
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  if (values.length === 0) {
    return false;
  }

  if (values.some((value) => value > 1)) {
    return false;
  }

  return values.some((value) => value > 0 && value < 1 && !Number.isInteger(value));
}

function normalizeUsedPercent(rawUsedPercent: number, fractionScale: boolean): number {
  return fractionScale ? rawUsedPercent * 100 : rawUsedPercent;
}

type ScoredCandidate = {
  candidate: AutoPickCandidate;
  secondaryRemainingPercent: number;
  primaryRemainingPercent: number;
  lastUsedAtMs: number | null;
};

function compareBalancedCandidates(left: ScoredCandidate, right: ScoredCandidate): number {
  const recentComparison = compareLastUsed(left.lastUsedAtMs, right.lastUsedAtMs);
  if (recentComparison !== 0) {
    return recentComparison;
  }

  if (right.secondaryRemainingPercent !== left.secondaryRemainingPercent) {
    return right.secondaryRemainingPercent - left.secondaryRemainingPercent;
  }

  if (right.primaryRemainingPercent !== left.primaryRemainingPercent) {
    return right.primaryRemainingPercent - left.primaryRemainingPercent;
  }

  const leftKey = normalizeLabelKey(left.candidate.label);
  const rightKey = normalizeLabelKey(right.candidate.label);
  if (leftKey < rightKey) {
    return -1;
  }
  if (leftKey > rightKey) {
    return 1;
  }

  if (left.candidate.label < right.candidate.label) {
    return -1;
  }
  if (left.candidate.label > right.candidate.label) {
    return 1;
  }

  return 0;
}

function compareLastUsed(left: number | null, right: number | null): number {
  if (left === null && right !== null) {
    return -1;
  }
  if (left !== null && right === null) {
    return 1;
  }
  if (left !== null && right !== null && left !== right) {
    return left - right;
  }

  return 0;
}

function parseTimestampMs(timestamp: string | undefined): number | null {
  if (!timestamp) {
    return null;
  }

  const parsed = Date.parse(timestamp);
  return Number.isNaN(parsed) ? null : parsed;
}
