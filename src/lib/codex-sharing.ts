import fs from "node:fs";
import path from "node:path";

import { mkdir0700, lstatSafe } from "./fs";

export function populateSharedCodexEntries(
  realHomeCodexDir: string,
  sandboxHomeCodexDir: string,
): void {
  mkdir0700(sandboxHomeCodexDir);

  const entries = fs.existsSync(realHomeCodexDir)
    ? fs.readdirSync(realHomeCodexDir, { withFileTypes: true })
    : [];

  for (const entry of entries) {
    if (entry.name === "auth.json") {
      continue;
    }

    const sourcePath = path.join(realHomeCodexDir, entry.name);
    const targetPath = path.join(sandboxHomeCodexDir, entry.name);

    const existing = lstatSafe(targetPath);
    if (existing.exists) {
      const linkTarget = fs.readlinkSync(targetPath);
      if (linkTarget !== sourcePath) {
        throw new Error(
          `Sandbox .codex entry already exists and does not point to shared target: ${entry.name}`,
        );
      }
      continue;
    }

    fs.symlinkSync(sourcePath, targetPath, entry.isDirectory() ? "dir" : "file");
  }
}
