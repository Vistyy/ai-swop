# Plan: session-auto-relogin

**Execution mode:** interactive

## Goal

Recover from session expiry by prompting an interactive relogin and retrying once.

## Tasks

### 1) Discovery: Auth failure signatures

- [ ] Create a temporary reproduction script (`scripts/tmp-auth-failure-discovery.sh`) that:
  - Backs up valid `auth.json`.
  - Corrupts/expires the token in `auth.json`.
  - Runs `codex user-info` (or similar) and captures exit code + stderr.
  - Runs a known-bad usage fetch and captures the HTTP error body.
- [ ] Run the script and record findings in `work-items/session-auto-relogin/findings.md`.
- [ ] Define precise go regex/structs for detection in `spec.md` (backfill if needed).
- [ ] **Verification:** User confirms findings match observed reality.

### 2) Feature: Auth failure detection

- [ ] Implement `func IsAuthError(err error, output string) bool` in `pkg/codex/client` (or similar).
- [ ] Unit test with exact strings/codes captured in Discovery.
- [ ] **Verification:** Run `go test ./pkg/...`.

### 3) Feature: Interactive Relogin Flow

- [ ] Implement `func EnsureAuth(ctx context.Context, account string) error`.
  - Check if interactive; if not, return "Run 'swop relogin <account>'".
  - Prompt "Session expired for <account>. Login now? [Y/n]".
  - If yes, run `codex login`.
- [ ] Wire into `swop codex` wrapper execution path:
  - Execute command.
  - If `IsAuthError`, trigger `EnsureAuth`.
  - If success, retry original command once.
- [ ] **Verification:** Manual verification with a corrupted token.

### 4) Feature: Explicit Relogin

- [ ] Implement `swop relogin <account>` command.
- [ ] Reuses `EnsureAuth` logic (force interactive).
- [ ] **Verification:** Run `swop relogin default` and verify `codex login` starts.

### 5) Feature: Usage Client Integration

- [ ] Update `usage-client` to use `IsAuthError`.
- [ ] If auth error during fetch, return error state (do _not_ prompt interactive login inside `swop status` render loop; keep it non-blocking/fail-fast).
  - _Self-correction:_ Spec says "likely auth/session failures during usage fetch". For `swop status`, we likely want to just report "Needs Login" rather than interrupting.
- [ ] **Verification:** `swop status` shows "Auth Error" or similar when token is dead.

### 6) Final Polish

- [ ] Run `just quality` and fix lint/types.
- [ ] Documentation: Update `swop/cli-wrapper/overview.md` status.
- [ ] Commit: `feat(swop): implement session-auto-relogin`
