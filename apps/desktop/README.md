# @th/desktop

Tauri 2 + React shell. UI features live in `src/features/<module>`; Rust side (`src-tauri`) only does HTTP to Tally (localhost allow-list), file access, SQLite and updates. No business logic here.

- `pnpm dev`: run the app (from the repo root this also starts tally-mock on :9900, which dev builds talk to).
- `pnpm build`: build the NSIS (`.exe`) and MSI installers into `src-tauri/target/release/bundle/`. Release builds talk to `http://localhost:9000`.
- Network scope lives in `src-tauri/capabilities/default.json` (localhost only).

Setup: see the root [README](../../README.md). Architecture: [docs/05-architecture.md](../../docs/05-architecture.md).
