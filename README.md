# ai-swop

Planning + delivery docs for **swop**: a quota-aware multi-account wrapper for `codex`.

## What we’re building

- **v1 (Wave `w1-cli-mvp`)**: a WSL/mac CLI wrapper that manages multiple `codex login` sessions, fetches 7‑day usage from `GET /backend-api/wham/usage`, auto-picks the best account, and runs `codex` concurrently without credential corruption.
- **v2 (Wave `w2-tray-ui`)**: Windows tray + macOS menu-bar UI (status + switching), bridging to the same CLI (no duplicated business logic).

## Where the docs live

- Roadmap: `docs-ai/docs/roadmap.md`
- Delivery map (work item status): `docs-ai/docs/initiatives/delivery-map.md`
- Initiative overview: `docs-ai/docs/initiatives/swop/overview.md`
- Wave briefs:
  - `docs-ai/docs/initiatives/waves/w1-cli-mvp.md`
  - `docs-ai/docs/initiatives/waves/w2-tray-ui.md`

## Status

The CLI wrapper is now runnable locally.

## Current working solution

Build and install a real `swop` command:

```bash
npm run build
npm link
```

Run it:

```bash
swop
swop add <label>
swop logout <label>
```

Notes:
- `swop add <label>` creates a sandbox and runs `codex login` inside it (TTY required).
- `swop logout <label>` best-effort runs `codex logout` then always deletes the local sandbox.
