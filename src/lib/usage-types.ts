export const USAGE_TYPES_VERSION = 1;

export type UsageSnapshotV1 = {
  plan_type: string;
  rate_limit: {
    allowed: boolean;
    limit_reached: boolean;
    primary_window: {
      used_percent: number;
      reset_at: string;
    };
    secondary_window: {
      used_percent: number;
      reset_at: string;
    };
  } | null;
};

export type UsageFreshness = {
  fetched_at: string;
  stale: boolean;
  age_seconds: number;
};

export type UsageClientResult =
  | {
      ok: true;
      usage: UsageSnapshotV1;
      freshness: UsageFreshness;
      warning?: { kind: "auth" | "network" | "timeout" | "server" | "parse"; message: string };
    }
  | {
      ok: false;
      message: string;
      kind: "auth" | "network" | "timeout" | "server" | "parse";
      freshness?: UsageFreshness;
    };
