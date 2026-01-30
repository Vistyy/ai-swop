# Work Item: status-command

- **Status**: planned
- **Parent Feature**: [`cli-wrapper`](../../overview.md)

## Goal

Add a `status` command to the `swop` CLI that renders account quota usage visually using high-density block characters and a stacked-card layout.

## Scope

### Included

- `swop status` command implementation.
- `swop status --refresh` (and `-R`) flag to bypass the 15-minute usage cache.
- Rendering engine for "Stacked Cards":
  - Card Header: `[Account Name] (Plan Type)`
  - Primary (5h) row: Bar + `% used` + `resets in Xm/h/s`
  - Secondary (7d) row: Bar + `% used` + `resets in Xd/h`
- Logic for "Inverse Bars":
  - 0% used = 100% full bar.
  - 100% used = 0% empty bar.
- Dynamic color-coding:
  - Green: > 50% remaining.
  - Yellow: 20-50% remaining.
  - Red: < 20% remaining.
    -"BLOCKED" handling: If `limit_reached=true`, show empty red bar + "BLOCKED" label.
- Time conversion: Usage reset timestamps must be shown in the user's local timezone.
- Empty State: Handle cases where no accounts are logged in.

### Excluded

- Interactive switching from the status command.
- Changes to the auto-pick algorithm.
- Multi-column layout (fixed to stacked cards).

## Acceptance Criteria

- [ ] Running `swop status` prints a clear list of all logged-in accounts.
- [ ] Usage bars use Unicode block characters (`█`, `░`).
- [ ] Usage bars empty from right to left as usage increases (Inverse logic).
- [ ] Reset times are correct for the user's local time and formatted for human readability (e.g., "resets in 4h 12m").
- [ ] The `--refresh` flag triggers a fresh API call (observable via a brief network latency).
- [ ] Blocked accounts are visually distinct and labeled "BLOCKED".
- [ ] Output handles diverse terminal widths without breaking the card layout (wraps or truncates safely).

## Decisions

| Decision           | Chosen Option                                     |
| ------------------ | ------------------------------------------------- |
| **Bar Characters** | Unicode Block Characters (█, ░)                   |
| **Layout**         | Stacked Cards (Each account is a block)           |
| **Caching**        | 15m by default, flag for override                 |
| **Colors**         | Dynamic Green/Yellow/Red based on remaining quota |

## Dependencies / References

- Feature Overview: [`cli-wrapper/overview.md`](../../overview.md)
- Wave Brief: [`waves/w1-status.md`](../../../../waves/w1-status.md)
- Usage Client: [`swop/cli-wrapper/usage-client`](../usage-client/spec.md) (Shared data source)
