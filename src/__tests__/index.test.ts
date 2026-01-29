import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/login-logout-orchestration", () => ({
  addAccount: vi.fn(),
  logoutAccount: vi.fn(),
}));

vi.mock("../lib/codex-runner", () => ({
  runCodex: vi.fn(),
}));

vi.mock("../lib/sandbox-manager", () => ({
  createSandbox: vi.fn(),
  listSandboxes: vi.fn(() => []),
  removeSandbox: vi.fn(),
  touchSandboxLastUsedAt: vi.fn(),
}));

vi.mock("../lib/usage-client", () => ({
  getUsageForAccount: vi.fn(),
}));

vi.mock("../lib/codex-wrapper-exec", () => ({
  runSwopCodexCommand: vi.fn(),
}));

import { addAccount, logoutAccount } from "../lib/login-logout-orchestration";
import { getUsageForAccount } from "../lib/usage-client";

describe("cli entrypoint", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    process.exitCode = undefined;
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("prints add error message and exits 1 on failure", async () => {
    vi.mocked(addAccount).mockReturnValue({
      ok: false,
      message: "no tty",
    });

    const { main } = await import("../index");

    await main(["node", "swop", "add", "work"]);

    expect(addAccount).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith("no tty");
    expect(process.exitCode).toBe(1);
  });

  it("prints warning on logout but still succeeds", async () => {
    vi.mocked(logoutAccount).mockReturnValue({
      ok: true,
      warning: "remote logout failed",
    });

    const { main } = await import("../index");

    await main(["node", "swop", "logout", "work"]);

    expect(logoutAccount).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith("Logged out account: work");
    expect(errorSpy).toHaveBeenCalledWith("remote logout failed");
  });

  it("prints usage output with local reset time", async () => {
    const originalTz = process.env.TZ;
    process.env.TZ = "UTC";

    vi.mocked(getUsageForAccount).mockResolvedValue({
      ok: true,
      usage: {
        plan_type: "pro",
        rate_limit: {
          allowed: true,
          limit_reached: false,
          secondary_window: {
            used_percent: 98,
            reset_at: "2026-01-30T23:28:50.000Z",
          },
        },
      },
      freshness: {
        fetched_at: "2026-01-30T23:28:50.000Z",
        stale: false,
        age_seconds: 0,
      },
    });

    const { main } = await import("../index");

    await main(["node", "swop", "usage", "gmail"]);

    expect(getUsageForAccount).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith("plan_type: pro");
    expect(logSpy).toHaveBeenCalledWith("used_percent: 98");
    expect(logSpy).toHaveBeenCalledWith("reset_at: 2026-01-30 23:28:50");

    process.env.TZ = originalTz;
  });

  it("defaults to auto-pick for swop codex when using --", async () => {
    const { main } = await import("../index");
    const { runSwopCodexCommand } = await import("../lib/codex-wrapper-exec");

    vi.mocked(runSwopCodexCommand).mockResolvedValue({
      ok: true,
      exitCode: 0,
    });

    await main(["node", "swop", "codex", "--", "--version"]);

    expect(runSwopCodexCommand).toHaveBeenCalledWith(
      ["--", "--version"],
      process.env,
      expect.any(Object),
    );
  });

  it("rejects ambiguous codex args without --", async () => {
    const { main } = await import("../index");
    const { runSwopCodexCommand } = await import("../lib/codex-wrapper-exec");

    vi.mocked(runSwopCodexCommand).mockResolvedValue({
      ok: false,
      message: "Please use -- to pass arguments to codex.",
      exitCode: 2,
    });

    await main(["node", "swop", "codex", "--version"]);

    expect(process.exitCode).toBe(2);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("use --"),
    );
  });

  it("accepts empty pass-through for swop codex", async () => {
    const { main } = await import("../index");
    const { runSwopCodexCommand } = await import("../lib/codex-wrapper-exec");

    vi.mocked(runSwopCodexCommand).mockResolvedValue({
      ok: true,
      exitCode: 0,
    });

    await main(["node", "swop", "codex"]);

    expect(runSwopCodexCommand).toHaveBeenCalledWith(
      [],
      process.env,
      expect.any(Object),
    );
  });
});
