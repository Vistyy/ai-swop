import fs from "node:fs";
import path from "node:path";

import {
  InvalidLabelError,
  SandboxAlreadyExistsError,
  SandboxNotFoundError,
  UnsafePathError,
} from "./errors";
import { mkdir0700, readJson, removeTree, writeFile0600Atomic, lstatSafe } from "./fs";
import { normalizeLabelKey } from "./labels";
import { createSandboxMetaV1, SandboxMetaV1 } from "./sandbox-model";
import { resolveAccountsRoot } from "./swop-root";
import { populateSharedCodexEntries } from "./codex-sharing";

function ensureInsideRoot(root: string, target: string): void {
  const relative = path.relative(root, target);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new UnsafePathError("Refusing to operate outside sandbox root");
  }
}

function metaPathForLabel(label: string, env: NodeJS.ProcessEnv): { key: string; root: string; metaPath: string } {
  const key = normalizeLabelKey(label);
  const root = resolveAccountsRoot(env);
  const metaPath = path.join(root, key, "meta.json");
  ensureInsideRoot(root, metaPath);
  return { key, root, metaPath };
}

export function createSandbox(
  label: string,
  env: NodeJS.ProcessEnv,
  realHome?: string,
): SandboxMetaV1 {
  let key: string;
  try {
    key = normalizeLabelKey(label);
  } catch (err) {
    throw err instanceof InvalidLabelError
      ? err
      : new InvalidLabelError("Invalid label for sandbox");
  }

  const accountsRoot = resolveAccountsRoot(env);
  const sandboxRoot = path.join(accountsRoot, key);
  ensureInsideRoot(accountsRoot, sandboxRoot);

  const metaPath = path.join(sandboxRoot, "meta.json");
  if (lstatSafe(metaPath).exists) {
    throw new SandboxAlreadyExistsError(`Sandbox already exists for label: ${label}`);
  }

  mkdir0700(sandboxRoot);

  const sandboxHome = path.join(sandboxRoot, "home");
  mkdir0700(sandboxHome);

  const sandboxCodex = path.join(sandboxHome, ".codex");
  const resolvedRealHome = realHome ?? env.HOME ?? "";
  const realCodex = path.join(resolvedRealHome, ".codex");
  populateSharedCodexEntries(realCodex, sandboxCodex);

  const meta = createSandboxMetaV1({
    label,
    label_key: key,
    created_at: new Date().toISOString(),
  });

  writeFile0600Atomic(metaPath, JSON.stringify(meta, null, 2));

  return meta;
}

export function listSandboxes(env: NodeJS.ProcessEnv): SandboxMetaV1[] {
  const accountsRoot = resolveAccountsRoot(env);
  if (!lstatSafe(accountsRoot).exists) {
    return [];
  }

  const entries = fs.readdirSync(accountsRoot, { withFileTypes: true });
  const results: SandboxMetaV1[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const metaPath = path.join(accountsRoot, entry.name, "meta.json");
    if (!lstatSafe(metaPath).exists) {
      continue;
    }

    const meta = readJson<SandboxMetaV1>(metaPath);
    results.push(meta);
  }

  return results;
}

function assertSandboxMeta(value: unknown): asserts value is SandboxMetaV1 {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid sandbox metadata");
  }
  const meta = value as SandboxMetaV1;
  if (meta.schema_version !== 1) {
    throw new Error("Unsupported sandbox metadata version");
  }
  if (!meta.label || !meta.label_key || !meta.created_at) {
    throw new Error("Invalid sandbox metadata");
  }
}

export function touchSandboxLastUsedAt(
  label: string,
  env: NodeJS.ProcessEnv,
  now: Date,
): void {
  const { key, metaPath } = metaPathForLabel(label, env);
  const meta = readJson<unknown>(metaPath);
  assertSandboxMeta(meta);
  if (meta.label_key !== key) {
    throw new Error("Sandbox metadata label mismatch");
  }

  const updated: SandboxMetaV1 = {
    ...meta,
    last_used_at: now.toISOString(),
  };

  writeFile0600Atomic(metaPath, JSON.stringify(updated, null, 2));
}

export function removeSandbox(label: string, env: NodeJS.ProcessEnv): void {
  const { key, root } = metaPathForLabel(label, env);
  const sandboxRoot = path.join(root, key);
  ensureInsideRoot(root, sandboxRoot);

  if (!lstatSafe(sandboxRoot).exists) {
    throw new SandboxNotFoundError(`Sandbox not found for label: ${label}`);
  }

  removeTree(sandboxRoot);
}
