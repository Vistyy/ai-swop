# Findings: Auth Failure Signatures

## 1. Usage API

**Status:** Definitive.

- **HTTP Status:** `401 Unauthorized`
- **Response Body:**
  ```json
  {
    "detail": "Could not parse your authentication token. Please try signing in again."
  }
  ```
- **Detection Logic:**
  - Status Code == 401
  - AND Body contains `"Could not parse your authentication token"`

## 2. Codex CLI

**Status:** Ambiguous (TTY limitation).

Tests for `codex user-info` failed with `Error: stdout is not a terminal` for both valid and invalid tokens. This masked the actual auth failure signature.

**Malformed Config detection:**

- Stderr: `key must be a string at line 1 column 3` (for bad JSON)

**Recommendation:**

- Proceed with API detection logic (Usage Client).
- For CLI, we might need to assume that _if_ `swop` is running interactively, `codex` will also output its auth errors to stderr.
- **Request:** Can you confirm if `codex` has a specific exit code for auth failure when run with a TTY? Or should we rely solely on the Usage API check to gate the `codex` run?
