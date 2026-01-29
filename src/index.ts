import { createSandbox, listSandboxes, removeSandbox } from "./lib/sandbox-manager";
import { addAccount, logoutAccount } from "./lib/login-logout-orchestration";
import { runCodex } from "./lib/codex-runner";

function printUsage(): void {
  console.log("Usage:");
  console.log("  swop add <label>");
  console.log("  swop logout <label>");
  console.log("  swop sandbox create <label>");
  console.log("  swop sandbox list");
  console.log("  swop sandbox remove <label>");
}

export function main(argv: string[]): void {
  const args = argv.slice(2);
  const command = args[0];

  if (!command) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  try {
    if (command === "add") {
      const label = args[1];
      if (!label) {
        throw new Error("Missing label. Example: swop add work");
      }
      const isInteractive = Boolean(process.stdin.isTTY && process.stdout.isTTY);
      const result = addAccount(label, process.env, { isInteractive, runCodex });
      if (!result.ok) {
        console.error(result.message);
        process.exitCode = 1;
        return;
      }
      console.log(`Added account: ${label}`);
      return;
    }

    if (command === "logout") {
      const label = args[1];
      if (!label) {
        throw new Error("Missing label. Example: swop logout work");
      }
      const result = logoutAccount(label, process.env, { runCodex });
      if (!result.ok) {
        console.error(result.message);
        process.exitCode = 1;
        return;
      }
      console.log(`Logged out account: ${label}`);
      if (result.warning) {
        console.error(result.warning);
      }
      return;
    }

    if (command !== "sandbox") {
      printUsage();
      process.exitCode = 1;
      return;
    }

    const subcommand = args[1];

    if (subcommand === "create") {
      const label = args[2];
      if (!label) {
        throw new Error("Missing label. Example: swop sandbox create work");
      }
      const meta = createSandbox(label, process.env);
      console.log(`Created sandbox: ${meta.label} (${meta.label_key})`);
      return;
    }

    if (subcommand === "list") {
      const sandboxes = listSandboxes(process.env);
      if (sandboxes.length === 0) {
        console.log("No sandboxes found.");
        return;
      }
      for (const sandbox of sandboxes) {
        console.log(`${sandbox.label} (${sandbox.label_key})`);
      }
      return;
    }

    if (subcommand === "remove") {
      const label = args[2];
      if (!label) {
        throw new Error("Missing label. Example: swop sandbox remove work");
      }
      removeSandbox(label, process.env);
      console.log(`Removed sandbox: ${label}`);
      return;
    }

    printUsage();
    process.exitCode = 1;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    console.error(message);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main(process.argv);
}
