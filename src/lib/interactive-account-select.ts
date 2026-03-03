import readline from "node:readline";

import { formatCompactAccountHeader } from "./account-status-summary";

const ANSI = {
  altScreenEnter: "\x1b[?1049h",
  altScreenExit: "\x1b[?1049l",
  hideCursor: "\x1b[?25l",
  showCursor: "\x1b[?25h",
  reverse: "\x1b[7m",
  dim: "\x1b[2m",
  reset: "\x1b[0m",
};

export type InteractiveAccountChoice = {
  label: string;
  summary: string;
};

export type InteractiveAccountSelectionResult =
  | { ok: true; label: string }
  | { ok: false; message: string; exitCode: number };

export async function selectInteractiveAccount(
  choices: InteractiveAccountChoice[],
  io: {
    stdin: NodeJS.ReadStream;
    stdout?: NodeJS.WriteStream;
  },
): Promise<InteractiveAccountSelectionResult> {
  if (!io.stdin.isTTY) {
    return {
      ok: false,
      message: "Interactive account selection requires a TTY.",
      exitCode: 2,
    };
  }

  if (choices.length === 0) {
    return {
      ok: false,
      message: 'No accounts configured. Run "swop add <label>" first.',
      exitCode: 1,
    };
  }

  const stdout = io.stdout ?? process.stdout;
  const stdin = io.stdin;
  let selectedIndex = 0;

  readline.emitKeypressEvents(stdin);
  const setRawMode = typeof stdin.setRawMode === "function" ? stdin.setRawMode.bind(stdin) : undefined;
  setRawMode?.(true);
  stdin.resume();
  stdout.write(`${ANSI.altScreenEnter}${ANSI.hideCursor}`);

  const render = (): void => {
    readline.cursorTo(stdout, 0, 0);
    readline.clearScreenDown(stdout);
    stdout.write("Select account for codex\n");
    stdout.write(`${ANSI.dim}Use arrows or j/k, Enter to confirm, q or Ctrl+C to cancel.${ANSI.reset}\n\n`);
    stdout.write(`${formatCompactAccountHeader()}\n`);
    for (let index = 0; index < choices.length; index += 1) {
      const prefix = index === selectedIndex ? ">" : " ";
      const row = `${prefix} ${choices[index].summary}`;
      stdout.write(index === selectedIndex ? `${ANSI.reverse}${row}${ANSI.reset}\n` : `${row}\n`);
    }
  };

  return await new Promise<InteractiveAccountSelectionResult>((resolve) => {
    const cleanup = (): void => {
      stdin.off("keypress", onKeypress);
      setRawMode?.(false);
      stdin.pause();
      stdout.write(`${ANSI.showCursor}${ANSI.altScreenExit}`);
    };

    const finish = (result: InteractiveAccountSelectionResult): void => {
      cleanup();
      resolve(result);
    };

    const onKeypress = (_str: string, key: { name?: string; ctrl?: boolean }): void => {
      if (key.ctrl && key.name === "c") {
        finish({ ok: false, message: "Interactive selection cancelled.", exitCode: 130 });
        return;
      }

      if (key.name === "up" || key.name === "k") {
        selectedIndex = (selectedIndex - 1 + choices.length) % choices.length;
        render();
        return;
      }

      if (key.name === "down" || key.name === "j") {
        selectedIndex = (selectedIndex + 1) % choices.length;
        render();
        return;
      }

      if (key.name === "return" || key.name === "enter") {
        finish({ ok: true, label: choices[selectedIndex].label });
        return;
      }

      if (key.name === "escape" || key.name === "q") {
        finish({ ok: false, message: "Interactive selection cancelled.", exitCode: 130 });
      }
    };

    stdin.on("keypress", onKeypress);
    render();
  });
}
