import { InvalidLabelError } from "./errors";

const INVALID_LABEL_MESSAGE =
  "Label must be non-empty, contain only letters/numbers/spaces/_/-, and not include path separators or traversal.";

export function normalizeLabelKey(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) {
    throw new InvalidLabelError(INVALID_LABEL_MESSAGE);
  }

  if (trimmed.includes("/") || trimmed.includes("\\") || trimmed.includes("..")) {
    throw new InvalidLabelError(INVALID_LABEL_MESSAGE);
  }

  const normalized = trimmed
    .toLowerCase()
    .replace(/[ _]+/g, "-")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!normalized) {
    throw new InvalidLabelError(INVALID_LABEL_MESSAGE);
  }

  return normalized;
}
