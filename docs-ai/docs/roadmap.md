# Roadmap

This repository tracks product planning and delivery for **swop** (Codex multi-account switching + quota-aware selection).

## Current Focus

- **Wave w1-cli-mvp**: ship a WSL/mac CLI wrapper that can manage multiple Codex login sessions, pick the best account by 7‑day usage, and run `codex` concurrently without credential corruption.

## Initiatives

| Initiative | Goal                                                                    |  Status | Links                                           |
| ---------- | ----------------------------------------------------------------------- | ------: | ----------------------------------------------- |
| `swop`     | Make Codex multi-account usage safe + low-friction (auto-pick by quota) | Planned | See `docs-ai/docs/initiatives/swop/overview.md` |

## Waves

| Wave         | Outcome                                                 |  Status | Brief                                          |
| ------------ | ------------------------------------------------------- | ------: | ---------------------------------------------- |
| `w1-cli-mvp` | CLI wrapper + account sandboxes + usage-aware auto-pick | Planned | `docs-ai/docs/initiatives/waves/w1-cli-mvp.md` |
| `w1-status`  | High-density visual status + usage bars + cache refresh | Planned | `docs-ai/docs/initiatives/waves/w1-status.md`  |
| `w2-tray-ui` | Windows tray + macOS menu-bar UI (status + switching)   |  Future | `docs-ai/docs/initiatives/waves/w2-tray-ui.md` |

## Decisions (Log)

| Date       | Decision                                                                                | Source                 |
| ---------- | --------------------------------------------------------------------------------------- | ---------------------- |
| 2026-01-29 | v1 is CLI-only; tray/menu-bar UI is v2                                                  | user-confirmed in chat |
| 2026-01-29 | Reuse `codex login` for account acquisition                                             | user-confirmed in chat |
| 2026-01-29 | Auto-pick: lowest 7‑day `secondary_window.used_percent` (skip blocked)                  | user-confirmed in chat |
| 2026-01-29 | If auth/session fails, auto-prompt interactive relogin; explicit relogin also supported | user-confirmed in chat |
| 2026-01-29 | Logout: local delete + best-effort `codex logout` if available                          | user-confirmed in chat |
| 2026-01-29 | Windows execution: wrapper runs in WSL; UI later bridges to WSL                         | user-confirmed in chat |
| 2026-01-29 | Storage: local on disk with strict permissions; never print secrets                     | user-confirmed in chat |
