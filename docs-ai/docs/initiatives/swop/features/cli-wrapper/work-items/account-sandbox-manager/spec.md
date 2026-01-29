# Work Item: account-sandbox-manager

## Status

Planned

## Objective

Create a per-account sandbox model that stores all account-specific state on disk with strict permissions and supports listing/removal.

## Scope

- Define sandbox directory layout and metadata (account name/label, created_at, last_used_at).
- Enforce strict local permissions (e.g., owner-only access) and ensure secrets are never printed.
- Implement commands to create/list/remove sandboxes (interface only; implementation details out of scope here).

## Acceptance Criteria

- Sandbox layout is specified and consistent across WSL/mac.
- Removal deletes local state for an account and is safe (no accidental cross-account deletion).
- Documentation clearly states local-only storage and security posture.
