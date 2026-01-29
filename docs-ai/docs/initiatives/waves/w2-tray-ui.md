# Wave: w2-tray-ui

## Objective

Provide a small, always-available UI for account switching + quota visibility:
- Windows taskbar tray icon UI (with a WSL bridge)
- macOS menu-bar UI

## Definition of Done

- UI shows all configured accounts and their 7‑day usage + reset time.
- UI allows selecting an account (manual) and triggering auto-pick.
- UI triggers the same underlying WSL/mac CLI operations as w1 (no duplicated business logic).

## Constraints / Non-goals

- This wave depends on the core CLI + API behaviors from `w1-cli-mvp`.
- Cross-OS UX polish is valuable, but functional parity is the primary goal.
