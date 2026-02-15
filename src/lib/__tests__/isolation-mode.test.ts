import { describe, expect, it } from "vitest";

import { resolveIsolationMode } from "../isolation-mode";

describe("resolveIsolationMode", () => {
  it("defaults to relaxed", () => {
    expect(resolveIsolationMode({})).toBe("relaxed");
  });

  it("supports strict override", () => {
    expect(resolveIsolationMode({ SWOP_ISOLATION_MODE: "strict" })).toBe("strict");
  });
});

