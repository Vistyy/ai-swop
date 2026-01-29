import path from "node:path";

import { normalizeLabelKey } from "./labels";
import { resolveAccountsRoot } from "./swop-root";

export type SandboxPaths = {
  sandboxRoot: string;
  sandboxHome: string;
  sandboxCodexDir: string;
  authPath: string;
};

export function resolveSandboxPaths(label: string, env: NodeJS.ProcessEnv): SandboxPaths {
  const key = normalizeLabelKey(label);
  const accountsRoot = resolveAccountsRoot(env);
  const sandboxRoot = path.join(accountsRoot, key);
  const sandboxHome = path.join(sandboxRoot, "home");
  const sandboxCodexDir = path.join(sandboxHome, ".codex");
  const authPath = path.join(sandboxCodexDir, "auth.json");

  return { sandboxRoot, sandboxHome, sandboxCodexDir, authPath };
}
