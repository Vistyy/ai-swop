import https from "node:https";

import type { UsageSnapshotV1 } from "./usage-types";
import { normalizeUsageSnapshotV1 } from "./usage-normalize";

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
  const timeoutMs = options?.timeoutMs ?? 5000;
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
    const normalized = normalizeUsageSnapshotV1(parsed);
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
