import { describe, expect, it } from "vitest";

import { normalizeLabelKey } from "../labels";

const CASES: Array<[string, string]> = [
  ["Work", "work"],
  ["work account", "work-account"],
  ["work_account", "work-account"],
  ["work---account", "work-account"],
  ["a__b", "a-b"],
];

describe("normalizeLabelKey", () => {
  it.each(CASES)("normalizes %p", (input, expected) => {
    expect(normalizeLabelKey(input)).toBe(expected);
  });

  it("rejects traversal-like labels", () => {
    expect(() => normalizeLabelKey("../work")).toThrow();
    expect(() => normalizeLabelKey("work/evil")).toThrow();
  });

  it("rejects whitespace-only labels", () => {
    expect(() => normalizeLabelKey("   ")).toThrow();
  });
});
