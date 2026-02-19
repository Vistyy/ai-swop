import { normalizeLabelKey } from "./labels";
import type { UsageSnapshotV1 } from "./usage-types";

export type AutoPickCandidate = {
  label: string;
  usage: UsageSnapshotV1;
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

const MIN_REMAINING_PERCENT = 5;
const MIN_PRIMARY_REMAINING_PERCENT = 20;
const OVERRIDE_GAP_PERCENT = 40;
const OVERRIDE_RESET_LEAD_MS = 2 * 24 * 60 * 60 * 1000;

export function selectAutoPickAccount(candidates: AutoPickCandidate[]): AutoPickResult {
  const viable = candidates.filter(
    (candidate) =>
      candidate.usage.rate_limit !== null &&
      candidate.usage.rate_limit.allowed &&
      !candidate.usage.rate_limit.limit_reached
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

  const secondaryFractionScale = usesFractionScale(viable, (candidate) => {
    return candidate.usage.rate_limit?.secondary_window.used_percent;
  });
  const primaryFractionScale = usesFractionScale(viable, (candidate) => {
    return candidate.usage.rate_limit?.primary_window?.used_percent;
  });

  const scored = viable.map((candidate) => {
    const rateLimit = candidate.usage.rate_limit!;
    const secondaryUsedPercent = normalizeUsedPercent(rateLimit.secondary_window.used_percent, secondaryFractionScale);
    const primaryUsedPercent = normalizeUsedPercent(rateLimit.primary_window?.used_percent ?? 0, primaryFractionScale);

    return {
      candidate,
      secondaryRemainingPercent: 100 - secondaryUsedPercent,
      primaryRemainingPercent: 100 - primaryUsedPercent,
      secondaryResetMs: parseResetAtMs(rateLimit.secondary_window.reset_at),
    };
  });

  const primaryEligible = scored.filter((entry) => entry.primaryRemainingPercent >= MIN_PRIMARY_REMAINING_PERCENT);
  const afterPrimaryRule = primaryEligible.length > 0 ? primaryEligible : scored;

  const secondaryEligible = afterPrimaryRule.filter((entry) => entry.secondaryRemainingPercent >= MIN_REMAINING_PERCENT);
  const selectionPool = secondaryEligible.length > 0 ? secondaryEligible : afterPrimaryRule;

  const byClosestReset = [...selectionPool].sort(compareByClosestResetThenLabel);
  const closestReset = byClosestReset[0];

  const highestUsageLeft = [...selectionPool].sort((left, right) => {
    const remainingDelta = right.secondaryRemainingPercent - left.secondaryRemainingPercent;
    if (remainingDelta !== 0) {
      return remainingDelta;
    }

    return compareByClosestResetThenLabel(left, right);
  })[0];

  const usageLeftGap = highestUsageLeft.secondaryRemainingPercent - closestReset.secondaryRemainingPercent;
  const nowMs = Date.now();
  const closestResetIsMoreThanTwoDaysAway =
    closestReset.secondaryResetMs !== null && closestReset.secondaryResetMs - nowMs > OVERRIDE_RESET_LEAD_MS;

  const selected =
    usageLeftGap > OVERRIDE_GAP_PERCENT && closestResetIsMoreThanTwoDaysAway
      ? highestUsageLeft.candidate
      : closestReset.candidate;

  return {
    ok: true,
    selected: { label: selected.label },
    message: `Selected account ${selected.label}.`,
  };
}

function parseResetAtMs(resetAt: string): number | null {
  const parsed = Date.parse(resetAt);
  return Number.isNaN(parsed) ? null : parsed;
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
  getValue: (candidate: AutoPickCandidate) => number | undefined
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
  secondaryResetMs: number | null;
};

function compareByClosestResetThenLabel(left: ScoredCandidate, right: ScoredCandidate): number {
  if (left.secondaryResetMs !== null && right.secondaryResetMs !== null && left.secondaryResetMs !== right.secondaryResetMs) {
    return left.secondaryResetMs - right.secondaryResetMs;
  }
  if (left.secondaryResetMs !== null && right.secondaryResetMs === null) {
    return -1;
  }
  if (left.secondaryResetMs === null && right.secondaryResetMs !== null) {
    return 1;
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
