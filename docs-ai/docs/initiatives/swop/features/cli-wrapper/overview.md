# Feature: cli-wrapper

## Goal

Provide a CLI wrapper that can manage multiple accounts, fetch 7‑day usage for each account, auto-select the best account, and execute `codex` under the selected account without cross-run corruption.

## Work Items

| Slug | Status | Description | Spec |
|---|---:|---|---|
| `codex-auth-isolation-discovery` | Planned | Validate how to isolate `codex` auth/config per account/process in WSL/mac | `docs-ai/docs/initiatives/swop/features/cli-wrapper/work-items/codex-auth-isolation-discovery/spec.md` |
| `account-sandbox-manager` | Planned | Manage per-account sandboxes (create/list/remove), permissions and layout | `docs-ai/docs/initiatives/swop/features/cli-wrapper/work-items/account-sandbox-manager/spec.md` |
| `login-logout-orchestration` | Planned | Orchestrate `codex login`/`codex logout` within a sandbox | `docs-ai/docs/initiatives/swop/features/cli-wrapper/work-items/login-logout-orchestration/spec.md` |
| `usage-client` | Planned | Fetch + parse `/backend-api/wham/usage`; cache + timeouts | `docs-ai/docs/initiatives/swop/features/cli-wrapper/work-items/usage-client/spec.md` |
| `auto-pick-policy` | Planned | Choose best account by lowest 7‑day usage; blocked behavior | `docs-ai/docs/initiatives/swop/features/cli-wrapper/work-items/auto-pick-policy/spec.md` |
| `codex-wrapper-exec` | Planned | Run `codex` under chosen sandbox; concurrent safety | `docs-ai/docs/initiatives/swop/features/cli-wrapper/work-items/codex-wrapper-exec/spec.md` |
| `session-auto-relogin` | Planned | Detect auth failure and prompt interactive relogin; retry once | `docs-ai/docs/initiatives/swop/features/cli-wrapper/work-items/session-auto-relogin/spec.md` |
