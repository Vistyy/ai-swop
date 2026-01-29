import fs from "node:fs";
import path from "node:path";

export type LstatSafeResult = {
  exists: boolean;
  isFile: boolean;
  isDirectory: boolean;
  isSymbolicLink: boolean;
};

export function mkdir0700(targetPath: string): void {
  fs.mkdirSync(targetPath, { recursive: true, mode: 0o700 });
  try {
    fs.chmodSync(targetPath, 0o700);
  } catch {
    // Best-effort on platforms with restricted chmod behavior.
  }
}

export function writeFile0600Atomic(targetPath: string, content: string): void {
  const dir = path.dirname(targetPath);
  mkdir0700(dir);

  const tempPath = `${targetPath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tempPath, content, { mode: 0o600 });
  try {
    fs.chmodSync(tempPath, 0o600);
  } catch {
    // Best-effort on platforms with restricted chmod behavior.
  }
  fs.renameSync(tempPath, targetPath);
  try {
    fs.chmodSync(targetPath, 0o600);
  } catch {
    // Best-effort on platforms with restricted chmod behavior.
  }
}

export function readJson<T = unknown>(targetPath: string): T {
  const raw = fs.readFileSync(targetPath, "utf8");
  return JSON.parse(raw) as T;
}

export function removeTree(targetPath: string): void {
  fs.rmSync(targetPath, { recursive: true, force: true });
}

export function lstatSafe(targetPath: string): LstatSafeResult {
  try {
    const stat = fs.lstatSync(targetPath);
    return {
      exists: true,
      isFile: stat.isFile(),
      isDirectory: stat.isDirectory(),
      isSymbolicLink: stat.isSymbolicLink(),
    };
  } catch {
    return {
      exists: false,
      isFile: false,
      isDirectory: false,
      isSymbolicLink: false,
    };
  }
}
