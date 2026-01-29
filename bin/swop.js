#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

function run(argv, deps) {
  const execPath = deps.execPath;
  const spawnSync = deps.spawnSync;
  const existsSync = deps.existsSync ?? fs.existsSync;
  const args = argv.slice(2);
  const entry = path.join("dist", "index.js");
  if (!existsSync(entry)) {
    console.error("Missing dist build. Run: npm run build");
    return 1;
  }
  const result = spawnSync(execPath, [entry, ...args], { stdio: "inherit" });
  return result.status ?? 1;
}

if (require.main === module) {
  const exitCode = run(process.argv, {
    execPath: process.execPath,
    spawnSync: require("node:child_process").spawnSync,
  });
  process.exitCode = exitCode;
}

module.exports = { run };
