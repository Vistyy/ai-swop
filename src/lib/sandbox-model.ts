export type SandboxMetaV1 = {
  schema_version: 1;
  label: string;
  label_key: string;
  created_at: string;
  last_used_at?: string;
};

export function createSandboxMetaV1(input: Omit<SandboxMetaV1, "schema_version">): SandboxMetaV1 {
  return {
    schema_version: 1,
    ...input,
  };
}
