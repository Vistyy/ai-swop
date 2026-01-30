import https from "node:https";

import type { UsageSnapshotV1 } from "./usage-types";

export type UsageFetchResult =
  | { ok: true; usage: UsageSnapshotV1 }
  | {
      ok: false;
      kind: "auth" | "network" | "timeout" | "server" | "parse";
      message: string;
    };

export type UsageFetchRequestParams = {
  url: string;
  headers: Record<string, string>;
  signal?: AbortSignal;
  timeoutMs: number;
};

export type UsageFetchResponse = {
  status: number;
  body: string;
};

export type UsageFetchRequest = (
  params: UsageFetchRequestParams,
) => Promise<UsageFetchResponse>;

const USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";

export async function fetchUsageSnapshot(
  accessToken: string,
  options?: {
    request?: UsageFetchRequest;
    timeoutMs?: number;
  },
): Promise<UsageFetchResult> {
  const timeoutMs = options?.timeoutMs ?? 2000;
  const request = options?.request ?? defaultUsageRequest;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await request({
      url: USAGE_URL,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      signal: controller.signal,
      timeoutMs,
    });

    if (response.status === 401 || response.status === 403) {
      return { ok: false, kind: "auth", message: "Usage request unauthorized" };
    }

    if (response.status >= 500) {
      return { ok: false, kind: "server", message: "Usage service error" };
    }

    if (response.status !== 200) {
      return { ok: false, kind: "network", message: `Usage request failed (${response.status})` };
    }

    const parsed = safeParseJson(response.body);
    const normalized = normalizeUsageSnapshot(parsed);
    if (!normalized) {
      return { ok: false, kind: "parse", message: "Usage response malformed" };
    }

    return { ok: true, usage: normalized };
  } catch (err) {
    if (isTimeoutError(err)) {
      return { ok: false, kind: "timeout", message: "Usage request timed out" };
    }

    return { ok: false, kind: "network", message: "Usage request failed" };
  } finally {
    clearTimeout(timeoutId);
  }
}

function defaultUsageRequest({ url, headers, signal, timeoutMs }: UsageFetchRequestParams): Promise<UsageFetchResponse> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: "GET",
        headers,
        signal,
      },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          resolve({ status: res.statusCode ?? 0, body: data });
        });
      },
    );

    req.on("error", (err) => reject(err));

    if (timeoutMs > 0) {
      const timer = setTimeout(() => {
        const timeoutError = new Error("Request timed out");
        (timeoutError as Error & { code?: string }).code = "ETIMEDOUT";
        req.destroy(timeoutError);
      }, timeoutMs);

      req.on("close", () => clearTimeout(timer));
    }

    req.end();
  });
}

function safeParseJson(raw: string): unknown | null {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function normalizeUsageSnapshot(value: unknown): UsageSnapshotV1 | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as UsageSnapshotV1;
  if (typeof record.plan_type !== "string") {
    return null;
  }

  const rateLimit = record.rate_limit;
  if (record.plan_type === "free" && rateLimit === null) {
    return {
      plan_type: record.plan_type,
      rate_limit: null,
    };
  }

  if (!rateLimit || typeof rateLimit !== "object") {
    return null;
  }

  if (typeof rateLimit.allowed !== "boolean") {
    return null;
  }

  if (typeof rateLimit.limit_reached !== "boolean") {
    return null;
  }

  const secondary = rateLimit.secondary_window;
  if (!secondary || typeof secondary !== "object") {
    return null;
  }

  if (typeof secondary.used_percent !== "number") {
    return null;
  }

  const resetAt = normalizeResetAt(secondary.reset_at);
  if (!resetAt) {
    return null;
  }

  return {
    plan_type: record.plan_type,
    rate_limit: {
      allowed: rateLimit.allowed,
      limit_reached: rateLimit.limit_reached,
      secondary_window: {
        used_percent: secondary.used_percent,
        reset_at: resetAt,
      },
    },
  };
}

function normalizeResetAt(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const iso = new Date(value * 1000).toISOString();
    return Number.isNaN(Date.parse(iso)) ? null : iso;
  }

  return null;
}

function isTimeoutError(err: unknown): boolean {
  if (!err || typeof err !== "object") {
    return false;
  }

  const record = err as { name?: string; code?: string; message?: string };
  if (record.name === "AbortError") {
    return true;
  }

  if (record.code === "ETIMEDOUT") {
    return true;
  }

  return typeof record.message === "string" && record.message.toLowerCase().includes("timeout");
}
