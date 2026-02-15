export type IsolationMode = "strict" | "relaxed";

export function resolveIsolationMode(env: NodeJS.ProcessEnv): IsolationMode {
  const rawMode = (env.SWOP_ISOLATION_MODE ?? "relaxed").trim().toLowerCase();
  if (rawMode === "strict") {
    return "strict";
  }
  return "relaxed";
}
