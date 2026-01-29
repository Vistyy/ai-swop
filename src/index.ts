import { createSandbox, listSandboxes, removeSandbox } from "./lib/sandbox-manager";
import { addAccount, logoutAccount } from "./lib/login-logout-orchestration";
import { runCodex } from "./lib/codex-runner";
import { getUsageForAccount } from "./lib/usage-client";

function printUsage(): void {
  console.log("Usage:");
  console.log("  swop add <label>");
  console.log("  swop logout <label>");
  console.log("  swop usage <label>");
  console.log("  swop sandbox create <label>");
  console.log("  swop sandbox list");
  console.log("  swop sandbox remove <label>");
}

export async function main(argv: string[]): Promise<void> {
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

    if (command === "usage") {
      const label = args[1];
      if (!label) {
        throw new Error("Missing label. Example: swop usage work");
      }
      const result = await getUsageForAccount(label, process.env);
      if (!result.ok) {
        console.error(result.message);
        process.exitCode = 1;
        return;
      }
      console.log(`plan_type: ${result.usage.plan_type}`);
      console.log(
        `used_percent: ${result.usage.rate_limit.secondary_window.used_percent}`,
      );
      const resetAt = formatLocalTimestamp(
        result.usage.rate_limit.secondary_window.reset_at,
      );
      console.log(`reset_at: ${resetAt}`);
      if (result.freshness.stale) {
        console.error(
          `Warning: stale usage data (${result.freshness.age_seconds}s old)`,
        );
      }
      if (result.warning) {
        console.error(result.warning.message);
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
  void main(process.argv);
}

function formatLocalTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}
