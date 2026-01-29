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

import { addAccount, logoutAccount } from "../lib/login-logout-orchestration";
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

  it("prints add error message and exits 1 on failure", () => {
    vi.mocked(addAccount).mockReturnValue({
      ok: false,
      message: "no tty",
    });

    main(["node", "swop", "add", "work"]);

    expect(addAccount).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith("no tty");
    expect(process.exitCode).toBe(1);
  });

  it("prints warning on logout but still succeeds", () => {
    vi.mocked(logoutAccount).mockReturnValue({
      ok: true,
      warning: "remote logout failed",
    });

    main(["node", "swop", "logout", "work"]);

    expect(logoutAccount).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith("Logged out account: work");
    expect(errorSpy).toHaveBeenCalledWith("remote logout failed");
  });
});
