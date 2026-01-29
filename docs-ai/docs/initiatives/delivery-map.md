# Delivery Map

Work item status is tracked here. Higher-level intent/status lives in `docs-ai/docs/roadmap.md`.

## Waves (Near-term)

| Wave | Status | Outcome | Brief |
|---|---:|---|---|
| `w1-cli-mvp` | Planned | WSL/mac CLI wrapper + multi-account sessions + quota-aware auto-pick + concurrent runs | `docs-ai/docs/initiatives/waves/w1-cli-mvp.md` |
| `w2-tray-ui` | Future | Windows tray + macOS menu-bar UI for status + switching | `docs-ai/docs/initiatives/waves/w2-tray-ui.md` |

## Work Queue (Ordered)

### swop / cli-wrapper (w1)

- **DONE** ⛔ `swop/cli-wrapper/codex-auth-isolation-discovery` (validate per-process account isolation; WSL/mac)
- **DONE** ✅ `swop/cli-wrapper/account-sandbox-manager` (create/list/remove sandboxes; permissions)
- ✅ `swop/cli-wrapper/login-logout-orchestration` (`codex login`/`codex logout` orchestration)
- ✅ `swop/cli-wrapper/usage-client` (fetch + parse `/backend-api/wham/usage`; caching/timeouts)
- ✅ `swop/cli-wrapper/auto-pick-policy` (selection rule + blocked handling)
- ✅ `swop/cli-wrapper/codex-wrapper-exec` (`swop codex ...` runs under chosen sandbox; concurrency-safe)
- ✅ `swop/cli-wrapper/session-auto-relogin` (detect auth failure, prompt interactive relogin, retry)

## Legend

- ✅ Parallelizable
- ⛔ Sequential / blocked by dependencies
- Prefix with **DONE** when complete (✅/⛔ stays the same)
