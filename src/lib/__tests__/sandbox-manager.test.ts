import { afterEach, describe, expect, it } from "vitest";

import { lstatSafe, mkdir0700, readJson, removeTree, writeFile0600Atomic } from "../fs";
import { populateSharedCodexEntries } from "../codex-sharing";
import { resolveAccountsRoot } from "../swop-root";
import {
  createSandbox,
  listSandboxes,
  removeSandbox,
  touchSandboxLastUsedAt,
} from "../sandbox-manager";

function makeTempDir(): string {
  const base = process.env.VITEST_WORKER_ID
    ? `/tmp/swop-test-${process.env.VITEST_WORKER_ID}-${Date.now()}`
    : `/tmp/swop-test-${Date.now()}`;
  return base;
}

describe("fs helpers", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("creates directories and files with expected permissions", () => {
    const tempRoot = makeTempDir();
    process.env.SWOP_ROOT = tempRoot;

    const accountsRoot = resolveAccountsRoot(process.env);
    const sandboxDir = `${accountsRoot}/sandbox-a`;

    mkdir0700(sandboxDir);

    const targetFile = `${sandboxDir}/meta.json`;
    writeFile0600Atomic(targetFile, JSON.stringify({ ok: true }));

    const statDir = lstatSafe(sandboxDir);
    const statFile = lstatSafe(targetFile);

    expect(statDir.exists).toBe(true);
    expect(statDir.isDirectory).toBe(true);
    expect(statFile.exists).toBe(true);
    expect(statFile.isFile).toBe(true);

    const parsed = readJson<{ ok: boolean }>(targetFile);
    expect(parsed.ok).toBe(true);

    removeTree(tempRoot);
    expect(lstatSafe(tempRoot).exists).toBe(false);
  });
});

describe("codex sharing", () => {
  it("symlinks shared entries excluding auth.json", () => {
    const tempRoot = makeTempDir();
    const realHome = `${tempRoot}/real-home`;
    const sandboxHome = `${tempRoot}/sandbox-home`;
    const realCodex = `${realHome}/.codex`;
    const sandboxCodex = `${sandboxHome}/.codex`;

    mkdir0700(realCodex);
    writeFile0600Atomic(`${realCodex}/config.toml`, "config");
    writeFile0600Atomic(`${realCodex}/history.jsonl`, "history");
    mkdir0700(`${realCodex}/sessions`);
    writeFile0600Atomic(`${realCodex}/auth.json`, "secret");

    populateSharedCodexEntries(realCodex, sandboxCodex);

    const authStat = lstatSafe(`${sandboxCodex}/auth.json`);
    expect(authStat.exists).toBe(false);

    const configStat = lstatSafe(`${sandboxCodex}/config.toml`);
    const historyStat = lstatSafe(`${sandboxCodex}/history.jsonl`);
    const sessionsStat = lstatSafe(`${sandboxCodex}/sessions`);

    expect(configStat.isSymbolicLink).toBe(true);
    expect(historyStat.isSymbolicLink).toBe(true);
    expect(sessionsStat.isSymbolicLink).toBe(true);

    removeTree(tempRoot);
  });
});

describe("sandbox manager", () => {
  it("creates and lists sandboxes", () => {
    const tempRoot = makeTempDir();
    process.env.SWOP_ROOT = tempRoot;
    const realHome = `${tempRoot}/real-home`;
    const realCodex = `${realHome}/.codex`;

    mkdir0700(realCodex);
    writeFile0600Atomic(`${realCodex}/config.toml`, "config");

    const sandbox = createSandbox("Work", process.env, realHome);

    expect(sandbox.label).toBe("Work");
    expect(sandbox.label_key).toBe("work");
    expect(sandbox.schema_version).toBe(1);

    const accountsRoot = resolveAccountsRoot(process.env);
    const metaPath = `${accountsRoot}/work/meta.json`;
    const codexDir = `${accountsRoot}/work/home/.codex`;

    const metaStat = lstatSafe(metaPath);
    const codexStat = lstatSafe(codexDir);

    expect(metaStat.exists).toBe(true);
    expect(codexStat.exists).toBe(true);

    const listed = listSandboxes(process.env);
    expect(listed.length).toBe(1);
    expect(listed[0]?.label).toBe("Work");
    expect(listed[0]?.label_key).toBe("work");

    removeTree(tempRoot);
  });

  it("updates last_used_at without changing other fields", () => {
    const tempRoot = makeTempDir();
    process.env.SWOP_ROOT = tempRoot;
    const realHome = `${tempRoot}/real-home`;
    const realCodex = `${realHome}/.codex`;

    mkdir0700(realCodex);
    writeFile0600Atomic(`${realCodex}/config.toml`, "config");

    const meta = createSandbox("Work", process.env, realHome);
    const now = new Date("2026-01-02T00:00:00Z");

    touchSandboxLastUsedAt("Work", process.env, now);

    const accountsRoot = resolveAccountsRoot(process.env);
    const updated = readJson<typeof meta>(`${accountsRoot}/work/meta.json`);

    expect(updated.last_used_at).toBe(now.toISOString());
    expect(updated.label).toBe(meta.label);
    expect(updated.label_key).toBe(meta.label_key);
    expect(updated.created_at).toBe(meta.created_at);
    expect(updated.schema_version).toBe(1);

    removeTree(tempRoot);
  });

  it("fails when sandbox already exists (case-insensitive)", () => {
    const tempRoot = makeTempDir();
    process.env.SWOP_ROOT = tempRoot;

    createSandbox("Work", process.env, `${tempRoot}/real-home`);

    expect(() => createSandbox("work", process.env, `${tempRoot}/real-home`)).toThrow();

    removeTree(tempRoot);
  });

  it("removes sandbox safely", () => {
    const tempRoot = makeTempDir();
    process.env.SWOP_ROOT = tempRoot;

    createSandbox("Work", process.env, `${tempRoot}/real-home`);

    removeSandbox("Work", process.env);

    const accountsRoot = resolveAccountsRoot(process.env);
    expect(lstatSafe(`${accountsRoot}/work`).exists).toBe(false);

    removeTree(tempRoot);
  });

  it("refuses to remove non-existent sandbox", () => {
    const tempRoot = makeTempDir();
    process.env.SWOP_ROOT = tempRoot;

    expect(() => removeSandbox("Missing", process.env)).toThrow();

    removeTree(tempRoot);
  });
});
