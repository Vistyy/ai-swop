# swop 🔄

A quota-aware, multi-account wrapper for the `codex` CLI. `swop` manages multiple isolated sessions, tracks usage across accounts, and automatically selects the best account for your tasks to maximize your productivity.

## 🚀 Key Features

- **Multi-Account Sandboxing**: Isolate multiple `codex` sessions without credential corruption.
- **Quota Awareness**: Fetches real-time usage data (both 5-hour and 7-day windows) from the API.
- **Auto-Selection**: Automatically picks the account with the most remaining quota for your commands.
- **Visual Status**: High-density, color-coded status dashboard (`swop status`) showing remaining capacity at a glance.
- **Background Caching**: Intelligent 15-minute caching of usage data to keep the CLI snappy.

## 🛠 Installation

```bash
# Clone the repository
git clone https://github.com/Vistyy/ai-swop.git
cd ai-swop

# Install dependencies and build
npm install
npm run build

# Link the command globally
npm link
```

## 📖 Usage Guide

### Managing Accounts

```bash
# Add a new account (interactive login)
swop add my-work-account

# Check current status of all accounts
swop status

# Force a fresh usage update
swop status -R

# Logout and remove an account
swop logout my-work-account
```

### Running Commands

Use `--` to pass arguments directly to the underlying `codex` CLI.

```bash
# Explicitly use an account
swop codex --account my-work-account -- version

# Let swop pick the best account automatically (default)
swop codex -- version
```

## 🏗 Project Architecture

- **Sandboxes**: Located in `~/.swop/sandboxes/`. Each account gets its own `$HOME` and environment isolation.
- **CLI Core**: Built with TypeScript in `src/`.
- **Logic Layers**:
  - `usage-client.ts`: Handles quota fetching and caching.
  - `auto-pick-policy.ts`: Implements the "Smart Selection" logic.
  - `status-command.ts`: The visual rendering engine for account health.

## 📚 Internal Documentation

- **Roadmap**: [docs-ai/docs/roadmap.md](docs-ai/docs/roadmap.md)
- **Delivery Map**: [docs-ai/docs/initiatives/delivery-map.md](docs-ai/docs/initiatives/delivery-map.md)
- **Feature Overview**: [docs-ai/docs/initiatives/swop/features/cli-wrapper/overview.md](docs-ai/docs/initiatives/swop/features/cli-wrapper/overview.md)
- **Implementation Plans**: Found within `work-items` directories.

