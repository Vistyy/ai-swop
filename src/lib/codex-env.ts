import path from "node:path";
import { resolveIsolationMode } from "./isolation-mode";

export function buildSandboxCodexEnv(
  baseEnv: NodeJS.ProcessEnv,
  sandboxHome: string,
  sandboxRoot: string,
): NodeJS.ProcessEnv {
  const mode = resolveIsolationMode(baseEnv);
  if (mode === "relaxed") {
    return {
      ...baseEnv,
    };
  }

  return {
    ...baseEnv,
    HOME: sandboxHome,
    XDG_CONFIG_HOME: path.join(sandboxRoot, "xdg", "config"),
    XDG_STATE_HOME: path.join(sandboxRoot, "xdg", "state"),
    XDG_DATA_HOME: path.join(sandboxRoot, "xdg", "data"),
    XDG_CACHE_HOME: path.join(sandboxRoot, "xdg", "cache"),
  };
}
