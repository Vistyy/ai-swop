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

const MIN_REMAINING_QUOTA = 0.05;

export function selectAutoPickAccount(candidates: AutoPickCandidate[]): AutoPickResult {
  const viable = candidates.filter(
    (candidate) =>
      candidate.usage.rate_limit !== null &&
      candidate.usage.rate_limit.allowed &&
      !candidate.usage.rate_limit.limit_reached
  );

  if (viable.length === 0) {
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

  const aboveThreshold = viable.filter((candidate) => {
    const usedPercent = candidate.usage.rate_limit!.secondary_window.used_percent;
    const remaining = 1 - usedPercent;
    return remaining >= MIN_REMAINING_QUOTA;
  });

  const rankingPool = aboveThreshold.length > 0 ? aboveThreshold : viable;

  const sorted = [...rankingPool].sort((left, right) => {
    // Both are guaranteed to have rate_limit not null due to filter above
    const leftUsage = left.usage.rate_limit!;
    const rightUsage = right.usage.rate_limit!;

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

    const usageDelta =
      leftUsage.secondary_window.used_percent -
      rightUsage.secondary_window.used_percent;
    if (usageDelta !== 0) {
      return usageDelta;
    }

    const leftKey = normalizeLabelKey(left.label);
    const rightKey = normalizeLabelKey(right.label);
    if (leftKey < rightKey) {
      return -1;
    }
    if (leftKey > rightKey) {
      return 1;
    }

    if (left.label < right.label) {
      return -1;
    }
    if (left.label > right.label) {
      return 1;
    }

    return 0;
  });

  const selected = sorted[0];

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
