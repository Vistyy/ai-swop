import { readJson } from "./fs";
import { resolveSandboxPaths } from "./sandbox-paths";

export type UsageAuthResult =
  | { ok: true; token: string }
  | { ok: false; kind: "auth"; message: string };

type AuthJson = {
  tokens?: {
    access_token?: string;
  };
};

export function readUsageAccessToken(label: string, env: NodeJS.ProcessEnv): UsageAuthResult {
  const { authPath } = resolveSandboxPaths(label, env);

  try {
    const auth = readJson<AuthJson>(authPath);
    const token = auth.tokens?.access_token;

    if (typeof token !== "string" || token.trim().length === 0) {
      return {
        ok: false,
        kind: "auth",
        message: "Missing access token in auth.json",
      };
    }

    return { ok: true, token };
  } catch {
    return { ok: false, kind: "auth", message: "Missing auth.json for account" };
  }
}
