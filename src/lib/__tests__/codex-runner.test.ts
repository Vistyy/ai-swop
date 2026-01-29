import { afterEach, describe, expect, it, vi } from "vitest";

import { runCodex } from "../codex-runner";
import { spawnSync } from "node:child_process";

vi.mock("node:child_process", () => ({
  spawnSync: vi.fn(),
}));

describe("codex runner", () => {
  const mockedSpawnSync = vi.mocked(spawnSync);

  afterEach(() => {
    mockedSpawnSync.mockReset();
  });

  it("returns safe error info on spawn failure", () => {
    mockedSpawnSync.mockReturnValue({
      status: null,
      signal: null,
      error: { code: "ENOENT" },
    } as any);

    const result = runCodex(["logout"], {
      env: { HOME: "/tmp" },
      stdio: "pipe",
    });

    expect(result.code).toBeNull();
    expect(result.errorCode).toBe("ENOENT");
    expect(result.stderr ?? "").toContain("ENOENT");
    expect(result.stderr ?? "").not.toMatch(/Error:|at\s/);
  });
});
