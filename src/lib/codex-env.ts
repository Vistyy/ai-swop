import path from "node:path";

export function buildSandboxCodexEnv(
  baseEnv: NodeJS.ProcessEnv,
  sandboxHome: string,
  sandboxRoot: string,
): NodeJS.ProcessEnv {
  return {
    ...baseEnv,
    HOME: sandboxHome,
    XDG_CONFIG_HOME: path.join(sandboxRoot, "xdg", "config"),
    XDG_STATE_HOME: path.join(sandboxRoot, "xdg", "state"),
    XDG_DATA_HOME: path.join(sandboxRoot, "xdg", "data"),
    XDG_CACHE_HOME: path.join(sandboxRoot, "xdg", "cache"),
  };
}
