import {
  createSandbox,
  listSandboxes,
  removeSandbox,
  touchSandboxLastUsedAt,
} from "./lib/sandbox-manager";
import { addAccount, logoutAccount } from "./lib/login-logout-orchestration";
import { runCodex } from "./lib/codex-runner";
import { getUsageForAccount } from "./lib/usage-client";
import { runSwopCodexCommand } from "./lib/codex-wrapper-exec";
import { runSwopRelogin } from "./lib/relogin-command";
import { runSwopStatus } from "./lib/status-command";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import type { Argv, ArgumentsCamelCase } from "yargs";

export async function main(argv: string[]): Promise<void> {
  const rawArgs = hideBin(argv);
  const cli = yargs(rawArgs)
    .scriptName("swop")
    .parserConfiguration({ "populate--": true })
    .help("help")
    .alias("help", "h")
    .version(false)
    .strictCommands()
    .exitProcess(false)
    .fail((message: string | undefined, err: unknown, y: unknown) => {
      const finalMessage = err instanceof Error ? err.message : message;
      if (finalMessage) {
        console.error(finalMessage);
      }
      if (typeof (y as { showHelp?: unknown }).showHelp === "function") {
        (y as { showHelp: () => void }).showHelp();
      }
      process.exitCode = 1;
    });

  type AddArgs = { label: string };
  cli.command(
    "add <label>",
    "Add an account",
    (y: Argv) => y.positional("label", { type: "string", demandOption: true }),
    async (args: ArgumentsCamelCase<AddArgs>) => {
      const isInteractive = Boolean(process.stdin.isTTY && process.stdout.isTTY);
      const result = addAccount(String(args.label), process.env, { isInteractive, runCodex });
      if (!result.ok) {
        console.error(result.message);
        process.exitCode = 1;
        return;
      }
      console.log(`Added account: ${String(args.label)}`);
      process.exitCode = 0;
    },
  );

  type LogoutArgs = { label: string };
  cli.command(
    "logout <label>",
    "Logout an account",
    (y: Argv) => y.positional("label", { type: "string", demandOption: true }),
    async (args: ArgumentsCamelCase<LogoutArgs>) => {
      const result = logoutAccount(String(args.label), process.env, { runCodex });
      if (!result.ok) {
        console.error(result.message);
        process.exitCode = 1;
        return;
      }
      console.log(`Logged out account: ${String(args.label)}`);
      if (result.warning) {
        console.error(result.warning);
      }
      process.exitCode = 0;
    },
  );

  type UsageArgs = { label: string };
  cli.command(
    "usage <label>",
    "Show quota usage for an account",
    (y: Argv) => y.positional("label", { type: "string", demandOption: true }),
    async (args: ArgumentsCamelCase<UsageArgs>) => {
      const label = String(args.label);
      const result = await getUsageForAccount(label, process.env);
      if (!result.ok) {
        console.error(result.message);
        process.exitCode = 1;
        return;
      }

      console.log(`plan_type: ${result.usage.plan_type}`);

      if (!result.usage.rate_limit) {
        console.log("Status: No quota (Free/Expired)");
      } else {
        console.log(`used_percent: ${result.usage.rate_limit.secondary_window.used_percent}`);
        const resetAt = formatLocalTimestamp(result.usage.rate_limit.secondary_window.reset_at);
        console.log(`reset_at: ${resetAt}`);
      }

      if (result.freshness.stale) {
        console.error(`Warning: stale usage data (${result.freshness.age_seconds}s old)`);
      }
      if (result.warning) {
        console.error(result.warning.message);
      }
      process.exitCode = 0;
    },
  );

  type StatusArgs = { refresh: boolean };
  cli.command(
    "status",
    "Show status for all accounts",
    (y: Argv) =>
      y.option("refresh", {
        type: "boolean",
        alias: "R",
        default: false,
        describe: "Bypass the 15-minute cache and fetch live usage",
      }),
    async (args: ArgumentsCamelCase<StatusArgs>) => {
      const statusArgs: string[] = [];
      if (args.refresh) {
        statusArgs.push("--refresh");
      }
      const result = await runSwopStatus(statusArgs, process.env, {
        listSandboxes,
        getUsageForAccount,
        stdout: console,
        stderr: console,
      });
      if (!result.ok) {
        console.error(result.message);
        process.exitCode = result.exitCode;
        return;
      }
      process.exitCode = 0;
    },
  );

  type ReloginArgs = { label: string };
  cli.command(
    "relogin <label>",
    "Relogin an account",
    (y: Argv) => y.positional("label", { type: "string", demandOption: true }),
    async (args: ArgumentsCamelCase<ReloginArgs>) => {
      const result = await runSwopRelogin([String(args.label)], process.env, {
        runCodex,
        stdin: process.stdin,
        stdout: process.stdout,
        stderr: process.stderr,
      });
      if (!result.ok) {
        console.error(result.message);
        process.exitCode = result.exitCode;
        return;
      }
      process.exitCode = 0;
    },
  );

  cli.command(
    "codex [args..]",
    "Run codex in a selected sandbox. Use -- to pass codex args.",
    (y: Argv) => y.parserConfiguration({ "unknown-options-as-args": true }),
    async () => {
      const codexIndex = rawArgs.indexOf("codex");
      const passArgs = codexIndex === -1 ? [] : rawArgs.slice(codexIndex + 1);
      const result = await runSwopCodexCommand(passArgs, process.env, {
        runCodex,
        listSandboxes,
        getUsageForAccount,
        touchLastUsedAt: touchSandboxLastUsedAt,
        stdin: process.stdin,
      });
      if (!result.ok) {
        console.error(result.message);
      }
      process.exitCode = result.exitCode;
    },
  );

  type SandboxArgs = { action: "create" | "list" | "remove"; label?: string };
  cli.command(
    "sandbox <action> [label]",
    "Manage sandboxes",
    (y: Argv) =>
      y
        .positional("action", {
          choices: ["create", "list", "remove"] as const,
          demandOption: true,
        })
        .positional("label", { type: "string" }),
    async (args: ArgumentsCamelCase<SandboxArgs>) => {
      const action = args.action;

      if (action === "create") {
        if (!args.label) {
          console.error("Missing label. Example: swop sandbox create work");
          process.exitCode = 2;
          return;
        }
        const meta = createSandbox(String(args.label), process.env);
        console.log(`Created sandbox: ${meta.label} (${meta.label_key})`);
        process.exitCode = 0;
        return;
      }

      if (action === "list") {
        const sandboxes = listSandboxes(process.env);
        if (sandboxes.length === 0) {
          console.log("No sandboxes found.");
          process.exitCode = 0;
          return;
        }
        for (const sandbox of sandboxes) {
          console.log(`${sandbox.label} (${sandbox.label_key})`);
        }
        process.exitCode = 0;
        return;
      }

      if (!args.label) {
        console.error("Missing label. Example: swop sandbox remove work");
        process.exitCode = 2;
        return;
      }
      removeSandbox(String(args.label), process.env);
      console.log(`Removed sandbox: ${String(args.label)}`);
      process.exitCode = 0;
    },
  );

  if (rawArgs.length === 0) {
    cli.showHelp();
    process.exitCode = 0;
    return;
  }

  await cli.parseAsync();
  if (process.exitCode === undefined) {
    process.exitCode = 0;
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
