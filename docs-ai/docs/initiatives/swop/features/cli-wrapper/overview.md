# Feature: cli-wrapper

## Goal

Provide a CLI wrapper that can manage multiple accounts, fetch 7‑day usage for each account, auto-select the best account, and execute `codex` under the selected account without cross-run corruption.

## Work Items

| Work Item                                                                                              | Description                                                                   | Status |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- | ------ |
| [`swop/cli-wrapper/codex-auth-isolation-discovery`](work-items/codex-auth-isolation-discovery/spec.md) | Validate how to isolate `codex` auth/config per account/process in WSL/mac    | done   |
| [`swop/cli-wrapper/account-sandbox-manager`](work-items/account-sandbox-manager/spec.md)               | Manage per-account sandboxes (create/list/remove), permissions and layout     | done   |
| [`swop/cli-wrapper/login-logout-orchestration`](work-items/login-logout-orchestration/spec.md)         | Orchestrate `codex login`/`codex logout` within a sandbox                     | done   |
| [`swop/cli-wrapper/usage-client`](work-items/usage-client/spec.md)                                     | Fetch + parse `/backend-api/wham/usage`; cache + timeouts                     | done   |
| [`swop/cli-wrapper/auto-pick-freshness-policy`](work-items/auto-pick-freshness-policy/spec.md)         | Decide how auto-pick treats stale/missing usage                               | done   |
| [`swop/cli-wrapper/auto-pick-policy`](work-items/auto-pick-policy/spec.md)                             | Choose best account by lowest 7‑day usage; blocked behavior                   | done   |
| [`swop/cli-wrapper/codex-wrapper-exec`](work-items/codex-wrapper-exec/spec.md)                         | Run `codex` under chosen sandbox (`swop codex ... -- ...`); concurrent safety | done   |
| [`swop/cli-wrapper/session-auto-relogin`](work-items/session-auto-relogin/spec.md)                     | Detect auth failure and prompt interactive relogin; retry once                | done   |
| [`swop/cli-wrapper/status-command`](work-items/status-command/spec.md)                                 | High-density visual status + usage bars; w1-status                            | done   |
