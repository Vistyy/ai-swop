declare module "../../bin/swop" {
  type RunDeps = {
    execPath: string;
    spawnSync: typeof import("node:child_process").spawnSync;
    existsSync?: typeof import("node:fs").existsSync;
  };

  export function run(argv: string[], deps: RunDeps): number;
}
