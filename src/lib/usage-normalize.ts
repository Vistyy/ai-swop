import type { UsageSnapshotV1 } from "./usage-types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function normalizeResetAt(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }

  // Some APIs provide epoch-seconds.
  if (typeof value === "number" && Number.isFinite(value)) {
    const iso = new Date(value * 1000).toISOString();
    return Number.isNaN(Date.parse(iso)) ? null : iso;
  }

  return null;
}

function normalizeWindow(
  value: unknown,
): { used_percent: number; reset_at: string } | null {
  if (!isRecord(value)) {
    return null;
  }

  const usedPercent = value.used_percent;
  const resetAt = normalizeResetAt(value.reset_at);

  if (typeof usedPercent !== "number" || !Number.isFinite(usedPercent)) {
    return null;
  }

  if (!resetAt) {
    return null;
  }

  return { used_percent: usedPercent, reset_at: resetAt };
}

/**
 * Converts unknown input into the canonical internal UsageSnapshotV1 shape.
 *
 * - Accepts `rate_limit: null` (Free/Expired, but also tolerates other plan_types).
 * - Accepts missing `primary_window` by falling back to `secondary_window`.
 * - Accepts reset timestamps as ISO strings or epoch-seconds numbers.
 */
export function normalizeUsageSnapshotV1(value: unknown): UsageSnapshotV1 | null {
  if (!isRecord(value)) {
    return null;
  }

  const planType = value.plan_type;
  if (typeof planType !== "string") {
    return null;
  }

  const rateLimit = value.rate_limit;
  if (rateLimit === null) {
    return { plan_type: planType, rate_limit: null };
  }

  if (!isRecord(rateLimit)) {
    return null;
  }

  const allowed = rateLimit.allowed;
  const limitReached = rateLimit.limit_reached;

  if (typeof allowed !== "boolean" || typeof limitReached !== "boolean") {
    return null;
  }

  const secondary = normalizeWindow(rateLimit.secondary_window);
  if (!secondary) {
    return null;
  }

  const primary = normalizeWindow(rateLimit.primary_window) ?? secondary;

  return {
    plan_type: planType,
    rate_limit: {
      allowed,
      limit_reached: limitReached,
      primary_window: primary,
      secondary_window: secondary,
    },
  };
}
