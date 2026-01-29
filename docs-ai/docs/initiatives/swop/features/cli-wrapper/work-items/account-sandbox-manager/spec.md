# Work Item: account-sandbox-manager

## Status

done

**Type:** interactive

## Parent

Feature: `swop/cli-wrapper` (see `docs-ai/docs/initiatives/swop/features/cli-wrapper/overview.md`)

## Goal

Provide a small, well-defined “account sandbox” on-disk model and manager that enables:

- Per-account `codex` auth isolation (only `auth.json` is per-account; other `.codex` state is shared).
- Safe sandbox listing and removal (local-only, no remote revoke).

## Scope

### In scope

- Define the sandbox root location rules (including an override for tests/dev).
- Define sandbox directory layout and metadata format (account label, created/last-used timestamps).
- Define sandbox operations:
  - create (idempotent or explicit conflict behavior)
  - list
  - remove (safe delete; no cross-account deletion)
- Enforce strict local permissions and a “no secrets in output” posture.

### Out of scope

- Running `codex login` / `codex logout` (owned by `swop/cli-wrapper/login-logout-orchestration`).
- Calling the usage endpoint (owned by `swop/cli-wrapper/usage-client`).
- Account selection policy (owned by `swop/cli-wrapper/auto-pick-policy`).
- Executing `codex` under a selected account (owned by `swop/cli-wrapper/codex-wrapper-exec`).
- Windows-native behavior (w1 targets WSL/mac only).

## Sandbox model (v1)

### Root location

Sandbox root is local-only and per-user.

- If `SWOP_ROOT` is set, store sandboxes under: `$SWOP_ROOT/accounts/`
- Else if `XDG_STATE_HOME` is set, store sandboxes under: `$XDG_STATE_HOME/swop/accounts/`
- Else store sandboxes under: `$HOME/.swop/accounts/`

### Account identity

- v1 account key is the **account label** provided by the user (e.g., `work`, `personal`).
- Labels are treated as **case-insensitive** keys for uniqueness and lookup.
- `label_key` is derived by normalizing the user label:
  - lower-case
  - spaces and `_` become `-`
  - only `[a-z0-9-]` allowed in the final key
  - collapse consecutive `-`
  - reject if the result is empty or contains `..` or path separators

### Layout

For account label `<label>` (normalized key `<key>`), the sandbox directory is:

`<accounts_root>/<key>/`

Inside:

- `meta.json` (0600): metadata for the account sandbox
- `home/` (0700): the per-account `$HOME` used when running `codex` for this account
  - `home/.codex/` (0700)
    - `auth.json` (0600) is per-account
    - all other `.codex/*` content is shared with the user’s real `~/.codex` (symlink all existing entries except `auth.json`)

### Metadata (`meta.json`)

Minimum required fields:

- `schema_version` (number): `1`
- `label` (string): original user-provided label
- `label_key` (string): normalized key used for directory naming and lookup
- `created_at` (RFC3339 string)
- `last_used_at` (RFC3339 string, optional until first use)

## Acceptance Criteria

- [x] The spec defines a single sandbox root rule (including `SWOP_ROOT` override) usable on both WSL and macOS.
- [x] The sandbox layout and `meta.json` schema are specified (fields + meanings) and do not include secrets.
- [x] **Create** behavior is defined for:
  - [x] new label
  - [x] existing label (must fail with an actionable “already exists” message)
- [x] **List** behavior is defined, including what fields are displayed (must not display token/session material).
- [x] **Remove** behavior is defined and includes “safe delete” guardrails:
  - [x] refuses to delete anything outside the sandbox root
  - [x] does not delete shared `~/.codex` content
  - [x] deleting one account cannot delete another account’s sandbox
- [x] Permission expectations are explicit (owner-only directories/files; no world/group readable secrets).
- [x] The spec links to the isolation discovery decision and states the security posture: local-only storage; secrets never printed.

## Decisions

| Decision | Chosen option | Source |
|---|---|---|
| Per-account vs shared `.codex` state | Only `auth.json` is per-account; all other `.codex` content is shared | user reply (A) + `swop/cli-wrapper/codex-auth-isolation-discovery` |
| Sandbox root | `SWOP_ROOT` override, else `$XDG_STATE_HOME/swop`, else `$HOME/.swop` | this spec (v1 default) |
| Account identity | User-provided label is the v1 key (case-insensitive) | `w1-cli-mvp` scenarios (`swop add work/personal`) |
| Create on existing label | Fail with actionable message; no implicit overwrite | user reply (B) |
| `.codex` sharing mechanism | Symlink all existing `~/.codex/*` entries except `auth.json` | user reply (A) |
| `label_key` normalization | Friendly labels normalized to `[a-z0-9-]` (lowercase), reject unsafe | user reply (B) |
| `meta.json` versioning | Include `schema_version: 1` | user reply (A) |

## Open Questions (non-blocking)

- Should `last_used_at` be updated by `swop status` reads, or only on `swop codex ...` execution?

## Dependencies / References

- Feature overview: `docs-ai/docs/initiatives/swop/features/cli-wrapper/overview.md`
- Wave brief (w1 DoD + scenarios): `docs-ai/docs/initiatives/waves/w1-cli-mvp.md`
- Isolation findings: `docs-ai/docs/initiatives/swop/features/cli-wrapper/work-items/codex-auth-isolation-discovery/spec.md`
- Downstream work items:
  - `swop/cli-wrapper/login-logout-orchestration`
  - `swop/cli-wrapper/codex-wrapper-exec`
