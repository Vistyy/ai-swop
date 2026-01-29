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
}));

vi.mock("../lib/usage-client", () => ({
  getUsageForAccount: vi.fn(),
}));

import { addAccount, logoutAccount } from "../lib/login-logout-orchestration";
import { getUsageForAccount } from "../lib/usage-client";
import { main } from "../index";

describe("cli entrypoint", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
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

    await main(["node", "swop", "usage", "gmail"]);

    expect(getUsageForAccount).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith("plan_type: pro");
    expect(logSpy).toHaveBeenCalledWith("used_percent: 98");
    expect(logSpy).toHaveBeenCalledWith("reset_at: 2026-01-30 23:28:50");

    process.env.TZ = originalTz;
  });
});
