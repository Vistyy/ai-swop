import { describe, expect, it } from "vitest";

import { buildSandboxCodexEnv } from "../codex-env";

describe("codex env", () => {
  it("keeps the incoming environment in relaxed mode", () => {
    const baseEnv = {
      HOME: "/real/home",
      PATH: "/bin",
      OTHER: "value",
    };

    const env = buildSandboxCodexEnv(baseEnv, "/sandbox/home", "/sandbox/root");

    expect(env.HOME).toBe("/real/home");
    expect(env.XDG_CONFIG_HOME).toBeUndefined();
    expect(env.XDG_STATE_HOME).toBeUndefined();
    expect(env.XDG_DATA_HOME).toBeUndefined();
    expect(env.XDG_CACHE_HOME).toBeUndefined();
    expect(env.PATH).toBe("/bin");
    expect(env.OTHER).toBe("value");
    expect(env).not.toBe(baseEnv);
  });

  it("builds sandbox-scoped XDG and HOME paths in strict mode", () => {
    const baseEnv = {
      HOME: "/real/home",
      PATH: "/bin",
      OTHER: "value",
      SWOP_ISOLATION_MODE: "strict",
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
