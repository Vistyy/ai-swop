import { describe, expect, it } from "vitest";

import {
  InvalidLabelError,
  SandboxAlreadyExistsError,
  SandboxNotFoundError,
  UnsafePathError,
} from "../errors";

describe("errors", () => {
  it("uses stable error names", () => {
    expect(new InvalidLabelError().name).toBe("InvalidLabelError");
    expect(new SandboxAlreadyExistsError().name).toBe("SandboxAlreadyExistsError");
    expect(new SandboxNotFoundError().name).toBe("SandboxNotFoundError");
    expect(new UnsafePathError().name).toBe("UnsafePathError");
  });
});
