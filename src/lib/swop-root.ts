import path from "node:path";

export function resolveAccountsRoot(env: NodeJS.ProcessEnv): string {
  if (env.SWOP_ROOT) {
    return path.resolve(env.SWOP_ROOT, "accounts");
  }

  if (env.XDG_STATE_HOME) {
    return path.resolve(env.XDG_STATE_HOME, "swop", "accounts");
  }

  if (!env.HOME) {
    return path.resolve(".swop", "accounts");
  }

  return path.resolve(env.HOME, ".swop", "accounts");
}
