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

  const fractionScale = usesFractionScale(viable);
  const viableWithUsage = viable.map((candidate) => ({
    candidate,
    usedPercent: normalizeUsedPercent(candidate.usage.rate_limit!.secondary_window.used_percent, fractionScale),
  }));

  const aboveThreshold = viableWithUsage.filter((entry) => {
    const remainingPercent = 100 - entry.usedPercent;
    return remainingPercent >= MIN_REMAINING_PERCENT;
  });

  if (aboveThreshold.length === 0) {
    const earliestResetAt = findEarliestResetAt(viable);
    if (earliestResetAt) {
      return {
        ok: false,
        kind: "all-blocked",
        earliest_reset_at: earliestResetAt,
        message: `all accounts are below ${MIN_REMAINING_PERCENT}% remaining quota; earliest reset at ${earliestResetAt}.`,
      };
    }

    return {
      ok: false,
      kind: "all-blocked",
      message: `all accounts are below ${MIN_REMAINING_PERCENT}% remaining quota.`,
    };
  }

  const sorted = [...aboveThreshold].sort((left, right) => {
    // Both are guaranteed to have rate_limit not null due to filter above
    const leftUsage = left.candidate.usage.rate_limit!;
    const rightUsage = right.candidate.usage.rate_limit!;

    const usageDelta = left.usedPercent - right.usedPercent;
    if (usageDelta !== 0) {
      return usageDelta;
    }

    const leftResetMs = parseResetAtMs(leftUsage.secondary_window.reset_at);
    const rightResetMs = parseResetAtMs(rightUsage.secondary_window.reset_at);
    if (leftResetMs !== null && rightResetMs !== null && leftResetMs !== rightResetMs) {
      return leftResetMs - rightResetMs;
    }
    if (leftResetMs !== null && rightResetMs === null) {
      return -1;
    }
    if (leftResetMs === null && rightResetMs !== null) {
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
  });

  const selected = sorted[0].candidate;

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

function usesFractionScale(candidates: AutoPickCandidate[]): boolean {
  const values = candidates.map((candidate) => candidate.usage.rate_limit!.secondary_window.used_percent);
  if (values.some((value) => value > 1)) {
    return false;
  }

  return values.some((value) => value > 0 && value < 1 && !Number.isInteger(value));
}

function normalizeUsedPercent(rawUsedPercent: number, fractionScale: boolean): number {
  return fractionScale ? rawUsedPercent * 100 : rawUsedPercent;
}
