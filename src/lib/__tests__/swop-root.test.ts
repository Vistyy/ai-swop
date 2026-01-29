import { afterEach, describe, expect, it } from "vitest";

import { resolveAccountsRoot } from "../swop-root";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("resolveAccountsRoot", () => {
  it("prefers SWOP_ROOT", () => {
    process.env.SWOP_ROOT = "/tmp/swop-root";
    process.env.XDG_STATE_HOME = "/tmp/xdg-state";
    process.env.HOME = "/tmp/home";

    expect(resolveAccountsRoot(process.env)).toBe("/tmp/swop-root/accounts");
  });

  it("falls back to XDG_STATE_HOME", () => {
    delete process.env.SWOP_ROOT;
    process.env.XDG_STATE_HOME = "/tmp/xdg-state";
    process.env.HOME = "/tmp/home";

    expect(resolveAccountsRoot(process.env)).toBe("/tmp/xdg-state/swop/accounts");
  });

  it("falls back to HOME", () => {
    delete process.env.SWOP_ROOT;
    delete process.env.XDG_STATE_HOME;
    process.env.HOME = "/tmp/home";

    expect(resolveAccountsRoot(process.env)).toBe("/tmp/home/.swop/accounts");
  });
});
