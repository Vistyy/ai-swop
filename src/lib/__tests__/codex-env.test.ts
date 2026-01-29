import { describe, expect, it } from "vitest";

import { buildSandboxCodexEnv } from "../codex-env";

describe("codex env", () => {
  it("builds sandbox-scoped XDG and HOME paths", () => {
    const baseEnv = {
      HOME: "/real/home",
      PATH: "/bin",
      OTHER: "value",
    };

    const env = buildSandboxCodexEnv(baseEnv, "/sandbox/home", "/sandbox/root");

    expect(env.HOME).toBe("/sandbox/home");
    expect(env.XDG_CONFIG_HOME).toBe("/sandbox/root/xdg/config");
    expect(env.XDG_STATE_HOME).toBe("/sandbox/root/xdg/state");
    expect(env.XDG_DATA_HOME).toBe("/sandbox/root/xdg/data");
    expect(env.XDG_CACHE_HOME).toBe("/sandbox/root/xdg/cache");
    expect(env.PATH).toBe("/bin");
    expect(env.OTHER).toBe("value");
    expect(env).not.toBe(baseEnv);
  });
});
