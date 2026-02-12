import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { runSwopCodexCommand } from "../codex-wrapper-exec";
import { normalizeLabelKey } from "../labels";
import type { UsageSnapshotV1 } from "../usage-types";

const baseUsage = (overrides?: Partial<UsageSnapshotV1>): UsageSnapshotV1 => ({
  plan_type: "pro",
  rate_limit: {
    allowed: true,
    limit_reached: false,
    secondary_window: {
      used_percent: 0,
      reset_at: "2026-01-01T00:00:00Z",
    },
  },
  ...overrides,
});

const freshUsageResult = (overrides?: Partial<UsageSnapshotV1>) => ({
  ok: true as const,
  usage: baseUsage(overrides),
  freshness: {
    fetched_at: "2026-01-01T00:00:00Z",
    stale: false,
    age_seconds: 0,
  },
});

const staleUsageResult = (ageSeconds: number, overrides?: Partial<UsageSnapshotV1>) => ({
  ok: true as const,
  usage: baseUsage(overrides),
  freshness: {
    fetched_at: "2026-01-01T00:00:00Z",
    stale: true,
    age_seconds: ageSeconds,
  },
});

const errorUsageResult = () => ({
  ok: false as const,
  message: "network failure",
  kind: "network" as const,
});

const createTempRoot = (): string =>
  fs.mkdtempSync(path.join(os.tmpdir(), "swop-codex-"));

const writeMeta = (root: string, label: string): void => {
  const key = normalizeLabelKey(label);
  const meta = {
    schema_version: 1,
    label,
    label_key: key,
    created_at: "2026-01-01T00:00:00Z",
  };
  const metaPath = path.join(root, "accounts", key, "meta.json");
  fs.mkdirSync(path.dirname(metaPath), { recursive: true });
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
};

describe("runSwopCodexCommand", () => {
  it("uses explicit --account, touches last_used_at before exec, and prints selection", async () => {
    const root = createTempRoot();
    const env = { SWOP_ROOT: root };
    writeMeta(root, "Work");

    const runCodex = vi.fn().mockReturnValue({ code: 0, signal: null });
    const touchLastUsedAt = vi.fn();
    const stdout = { log: vi.fn() };

    const result = await runSwopCodexCommand(
      ["--account", "Work", "--", "--version"],
      env,
      {
        runCodex,
        listSandboxes: vi.fn(),
        getUsageForAccount: vi.fn(),
        touchLastUsedAt,
        now: () => new Date("2026-01-02T00:00:00Z"),
        stdout,
        stderr: { error: vi.fn() },
      },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.exitCode).toBe(0);
    }

    expect(touchLastUsedAt).toHaveBeenCalledWith(
      "Work",
      env,
      new Date("2026-01-02T00:00:00Z"),
    );
    expect(runCodex).toHaveBeenCalledWith(
      ["--version"],
      expect.objectContaining({ stdio: "inherit" }),
    );
    expect(
      touchLastUsedAt.mock.invocationCallOrder[0],
    ).toBeLessThan(runCodex.mock.invocationCallOrder[0]);
    expect(stdout.log).toHaveBeenCalledWith(
      expect.stringContaining("Work"),
    );
  });

  it("defaults to auto-pick and selects from fresh Tier 1 candidates", async () => {
    const env = {};
    const runCodex = vi.fn().mockReturnValue({ code: 0, signal: null });
    const listSandboxes = vi.fn().mockReturnValue([
      {
        schema_version: 1,
        label: "Work",
        label_key: "work",
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        schema_version: 1,
        label: "Personal",
        label_key: "personal",
        created_at: "2026-01-01T00:00:00Z",
      },
    ]);
    const getUsageForAccount = vi
      .fn()
      .mockImplementation((label: string) =>
        label === "Work"
          ? freshUsageResult({
              rate_limit: {
                allowed: true,
                limit_reached: false,
                secondary_window: { used_percent: 0.6, reset_at: "2026-01-01T00:00:00Z" },
              },
            })
          : freshUsageResult({
              rate_limit: {
                allowed: true,
                limit_reached: false,
                secondary_window: { used_percent: 0.1, reset_at: "2026-01-01T00:00:00Z" },
              },
            }),
      );

    const result = await runSwopCodexCommand(["--"], env, {
      runCodex,
      listSandboxes,
      getUsageForAccount,
      touchLastUsedAt: vi.fn(),
      now: () => new Date("2026-01-02T00:00:00Z"),
      stdout: { log: vi.fn() },
      stderr: { error: vi.fn() },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.exitCode).toBe(0);
    }
    expect(runCodex).toHaveBeenCalled();
    expect(runCodex).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ env: expect.any(Object) }),
    );
  });

  it("warns when Tier 2 stale accounts are used", async () => {
    const env = {};
    const stderr = { error: vi.fn() };

    const result = await runSwopCodexCommand(["--"], env, {
      runCodex: vi.fn().mockReturnValue({ code: 0, signal: null }),
      listSandboxes: vi.fn().mockReturnValue([
        {
          schema_version: 1,
          label: "Work",
          label_key: "work",
          created_at: "2026-01-01T00:00:00Z",
        },
      ]),
      getUsageForAccount: vi.fn().mockResolvedValue(staleUsageResult(3600)),
      touchLastUsedAt: vi.fn(),
      now: () => new Date("2026-01-02T00:00:00Z"),
      stdout: { log: vi.fn() },
      stderr,
    });

    expect(result.ok).toBe(true);
    expect(stderr.error).toHaveBeenCalledWith(
      expect.stringContaining("3600"),
    );
    expect(stderr.error).toHaveBeenCalledWith(
      expect.stringContaining("stale"),
    );
  });

  it("falls back to Tier 2 when Tier 1 cannot produce a selectable account", async () => {
    const env = {};
    const runCodex = vi.fn().mockReturnValue({ code: 0, signal: null });
    const stdout = { log: vi.fn() };
    const stderr = { error: vi.fn() };

    const result = await runSwopCodexCommand(["--"], env, {
      runCodex,
      listSandboxes: vi.fn().mockReturnValue([
        {
          schema_version: 1,
          label: "gmail",
          label_key: "gmail",
          created_at: "2026-01-01T00:00:00Z",
        },
        {
          schema_version: 1,
          label: "gmail2",
          label_key: "gmail2",
          created_at: "2026-01-01T00:00:00Z",
        },
      ]),
      getUsageForAccount: vi
        .fn()
        // Tier 2 stale but healthy
        .mockResolvedValueOnce(
          staleUsageResult(900, {
            rate_limit: {
              allowed: true,
              limit_reached: false,
              secondary_window: { used_percent: 37, reset_at: "2026-01-16T00:00:00Z" },
            },
          }),
        )
        // Tier 1 fresh but below 5% remaining
        .mockResolvedValueOnce(
          freshUsageResult({
            rate_limit: {
              allowed: true,
              limit_reached: false,
              secondary_window: { used_percent: 99, reset_at: "2026-01-14T00:00:00Z" },
            },
          }),
        ),
      touchLastUsedAt: vi.fn(),
      now: () => new Date("2026-01-12T00:00:00Z"),
      stdout,
      stderr,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.exitCode).toBe(0);
    }
    expect(stdout.log).toHaveBeenCalledWith(expect.stringContaining("gmail"));
    expect(stderr.error).toHaveBeenCalledWith(expect.stringContaining("stale usage data"));
    expect(runCodex).toHaveBeenCalled();
  });

  it("fails when no eligible accounts exist", async () => {
    const env = {};

    const result = await runSwopCodexCommand(["--"], env, {
      runCodex: vi.fn(),
      listSandboxes: vi.fn().mockReturnValue([
        {
          schema_version: 1,
          label: "Work",
          label_key: "work",
          created_at: "2026-01-01T00:00:00Z",
        },
        {
          schema_version: 1,
          label: "Personal",
          label_key: "personal",
          created_at: "2026-01-01T00:00:00Z",
        },
      ]),
      getUsageForAccount: vi
        .fn()
        .mockResolvedValueOnce(errorUsageResult())
        .mockResolvedValueOnce(staleUsageResult(90000)),
      touchLastUsedAt: vi.fn(),
      now: () => new Date("2026-01-02T00:00:00Z"),
      stdout: { log: vi.fn() },
      stderr: { error: vi.fn() },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("No eligible");
    }
  });

  it("fails when all accounts are blocked", async () => {
    const env = {};

    const result = await runSwopCodexCommand(["--"], env, {
      runCodex: vi.fn(),
      listSandboxes: vi.fn().mockReturnValue([
        {
          schema_version: 1,
          label: "Work",
          label_key: "work",
          created_at: "2026-01-01T00:00:00Z",
        },
        {
          schema_version: 1,
          label: "Personal",
          label_key: "personal",
          created_at: "2026-01-01T00:00:00Z",
        },
      ]),
      getUsageForAccount: vi.fn().mockResolvedValue(
        freshUsageResult({
          rate_limit: {
            allowed: false,
            limit_reached: true,
            secondary_window: { used_percent: 1, reset_at: "2026-01-01T12:00:00Z" },
          },
        }),
      ),
      touchLastUsedAt: vi.fn(),
      now: () => new Date("2026-01-02T00:00:00Z"),
      stdout: { log: vi.fn() },
      stderr: { error: vi.fn() },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("blocked");
      expect(result.message).toContain("2026-01-01T12:00:00Z");
    }
  });

  it("fails auto-pick when all accounts are below the 5% remaining threshold", async () => {
    const env = {};
    const runCodex = vi.fn();

    const result = await runSwopCodexCommand(["--"], env, {
      runCodex,
      listSandboxes: vi.fn().mockReturnValue([
        {
          schema_version: 1,
          label: "Gmail1",
          label_key: "gmail1",
          created_at: "2026-01-01T00:00:00Z",
        },
        {
          schema_version: 1,
          label: "Gmail2",
          label_key: "gmail2",
          created_at: "2026-01-01T00:00:00Z",
        },
      ]),
      getUsageForAccount: vi
        .fn()
        .mockResolvedValueOnce(
          freshUsageResult({
            rate_limit: {
              allowed: true,
              limit_reached: false,
              secondary_window: { used_percent: 97, reset_at: "2026-01-02T00:00:00Z" },
            },
          }),
        )
        .mockResolvedValueOnce(
          freshUsageResult({
            rate_limit: {
              allowed: true,
              limit_reached: false,
              secondary_window: { used_percent: 96, reset_at: "2026-01-03T00:00:00Z" },
            },
          }),
        ),
      touchLastUsedAt: vi.fn(),
      now: () => new Date("2026-01-02T00:00:00Z"),
      stdout: { log: vi.fn() },
      stderr: { error: vi.fn() },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("below");
      expect(result.message).toContain("5%");
    }
    expect(runCodex).not.toHaveBeenCalled();
  });

  it("passes through args after --", async () => {
    const env = {};
    const runCodex = vi.fn().mockReturnValue({ code: 0, signal: null });

    const result = await runSwopCodexCommand(["--", "--version"], env, {
      runCodex,
      listSandboxes: vi.fn().mockReturnValue([
        {
          schema_version: 1,
          label: "Work",
          label_key: "work",
          created_at: "2026-01-01T00:00:00Z",
        },
      ]),
      getUsageForAccount: vi.fn().mockResolvedValue(freshUsageResult()),
      touchLastUsedAt: vi.fn(),
      now: () => new Date("2026-01-02T00:00:00Z"),
      stdout: { log: vi.fn() },
      stderr: { error: vi.fn() },
    });

    expect(result.ok).toBe(true);
    expect(runCodex).toHaveBeenCalledWith(
      ["--version"],
      expect.objectContaining({ stdio: "inherit" }),
    );
  });
});
