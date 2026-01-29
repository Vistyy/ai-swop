import { createSandbox, listSandboxes, removeSandbox } from "./lib/sandbox-manager";

function printUsage(): void {
  console.log("Usage:");
  console.log("  swop sandbox create <label>");
  console.log("  swop sandbox list");
  console.log("  swop sandbox remove <label>");
}

function main(argv: string[]): void {
  const args = argv.slice(2);

  if (args.length < 2 || args[0] !== "sandbox") {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const subcommand = args[1];

  try {
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

main(process.argv);
