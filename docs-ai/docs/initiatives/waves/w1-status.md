# Wave: w1-status

## Objective

Implement a high-density, visual `swop status` command that provides a clear overview of all managed accounts and their remaining quota using color-coded "inverse" usage bars.

## Definition of Done

- `swop status` displays a list of all accounts in a "Stacked Card" layout.
- Each account card shows:
  - Account Name and Plan Type.
  - Primary (5h) usage bar: Full at 0% used, empty at 100% used.
  - Secondary (7d) usage bar: Full at 0% used, empty at 100% used.
  - Reset timestamps for both windows in local time.
- Implementation of dynamic colors:
  - Green: High remaining (e.g., > 50% remaining / < 50% used)
  - Yellow: Low remaining (e.g., 20-50% remaining)
  - Red: Critical / Empty (< 20% remaining)
- Blocked accounts (e.g., `limit_reached=true`) show an empty bar and a persistent "BLOCKED" flag.
- Caching behavior:
  - Default: Uses the existing 15-minute `swop` usage cache.
  - Override: `--refresh` or `-R` flag forces a fresh API fetch.
- Graceful "Empty State": If no accounts are added, show an actionable message (e.g., "No accounts found. Use `swop add [name]` to log in.")

## Scenarios

1. **Multiple Accounts**: User has 3 accounts. `swop status` shows 3 cards, each with distinct bars reflecting their independent quotas.
2. **Forced Refresh**: User runs `swop status -R`, the tool skips the cache and fetches fresh usage data from the API before rendering.
3. **Blocked State**: One account has reached its 7-day limit. Its secondary bar is empty and red, with a "BLOCKED" label and reset time highlighted.
4. **Invalid Tokens**: An account's token is invalid. The status shows a warning (e.g., "Error: Auth expired") but continues to show other accounts.

## Constraints / Non-goals

- No interactive elements in this wave (static terminal output only).
- No changes to the `auto-pick` logic itself, though the rendering logic should share the same usage data.
- Must not output bearer tokens or sensitive secrets.
