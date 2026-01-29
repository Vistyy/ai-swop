import { describe, expect, it, vi } from "vitest";

import { spawnSync } from "node:child_process";

vi.mock("node:child_process", () => ({
  spawnSync: vi.fn(),
}));

describe("swop bin", () => {
  it("spawns tsx cli with index.ts", async () => {
    const mockedSpawn = vi.mocked(spawnSync);
    mockedSpawn.mockReturnValue({
      status: 0,
      signal: null,
    } as any);

    const { run } = await import("../../bin/swop");
    const exitCode = run(["node", "swop", "add", "work"], {
      execPath: "/usr/bin/node",
      existsSync: () => true,
      spawnSync: mockedSpawn,
    });

    expect(exitCode).toBe(0);
    const [command, args] = mockedSpawn.mock.calls[0] ?? [];
    expect(command).toBe("/usr/bin/node");
    expect(args).toEqual(["dist/index.js", "add", "work"]);
  });
});
