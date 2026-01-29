import { describe, expect, it } from "vitest";

import { createSandboxMetaV1 } from "../sandbox-model";

describe("createSandboxMetaV1", () => {
  it("always sets schema_version to 1", () => {
    const meta = createSandboxMetaV1({
      label: "Work",
      label_key: "work",
      created_at: new Date().toISOString(),
    });

    expect(meta.schema_version).toBe(1);
  });
});
