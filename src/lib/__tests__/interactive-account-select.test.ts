import { EventEmitter } from "node:events";

import { describe, expect, it } from "vitest";

import { selectInteractiveAccount } from "../interactive-account-select";

class FakeStdin extends EventEmitter {
  isTTY = true;
  rawModes: boolean[] = [];
  resumed = 0;
  paused = 0;

  setRawMode(value: boolean): void {
    this.rawModes.push(value);
  }

  resume(): this {
    this.resumed += 1;
    return this;
  }

  pause(): this {
    this.paused += 1;
    return this;
  }
}

class FakeStdout {
  writes: string[] = [];

  write(chunk: string): boolean {
    this.writes.push(chunk);
    return true;
  }
}

describe("interactive-account-select", () => {
  it("cancels on a single ctrl+c and restores terminal state", async () => {
    const stdin = new FakeStdin();
    const stdout = new FakeStdout();

    const promise = selectInteractiveAccount(
      [{ label: "work", summary: "work row" }],
      { stdin: stdin as never, stdout: stdout as never },
    );

    stdin.emit("keypress", "\u0003", { ctrl: true, name: "c" });
    const result = await promise;

    expect(result).toEqual({ ok: false, message: "Interactive selection cancelled.", exitCode: 130 });
    expect(stdin.rawModes).toEqual([true, false]);
    expect(stdin.paused).toBe(1);
    expect(stdout.writes.join("")).toContain("\x1b[?1049h");
    expect(stdout.writes.join("")).toContain("\x1b[?1049l");
  });

  it("moves selection without clearing the whole terminal buffer and confirms with enter", async () => {
    const stdin = new FakeStdin();
    const stdout = new FakeStdout();

    const promise = selectInteractiveAccount(
      [
        { label: "work", summary: "work row" },
        { label: "personal", summary: "personal row" },
      ],
      { stdin: stdin as never, stdout: stdout as never },
    );

    stdin.emit("keypress", "", { name: "down" });
    stdin.emit("keypress", "\r", { name: "return" });
    const result = await promise;

    expect(result).toEqual({ ok: true, label: "personal" });
    const output = stdout.writes.join("");
    expect(output.match(/\x1b\[\?1049h/g)?.length ?? 0).toBe(1);
    expect(output).not.toContain("\x1b[2J");
    expect(output).toContain("Select account for codex");
  });
});
