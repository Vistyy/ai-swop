# Work Item: codex-auth-isolation-discovery

## Status

Planned

## Objective

Determine how to run `codex` concurrently under different accounts when `codex` does not expose an explicit config/auth directory override.

## Scope

- Identify which files/directories `codex login` and `codex` read/write on:
  - WSL (Windows)
  - macOS
- Validate whether setting process environment (e.g., `HOME`, `XDG_CONFIG_HOME`, `XDG_STATE_HOME`, etc.) isolates `codex` reliably.
- Document the chosen isolation strategy and its limitations.

## Non-goals

- Implementing tray/menu-bar UI.
- Changing upstream `codex` authentication behavior.

## Acceptance Criteria

- A documented isolation approach exists for WSL and macOS.
- Two concurrent `codex` runs under different accounts do not corrupt each other’s auth/config.
- Any required env var overrides are enumerated and justified.
