# Tally Helper (app)

Desktop app that turns Excel registers, bank statements and notes into reviewed TallyPrime vouchers.
Tauri 2 (Rust) + React 19 + TypeScript. Design docs and research live in the separate `tally-helper` folder.

```
apps/desktop      Tauri 2 + React app (the thing users install)
tools/tally-mock  fake Tally server on :9900 for development
```

## Developer setup (Windows)

One-time installs (skip any you already have; check with `node -v`, `pnpm -v`, `rustc -V`):

| Tool | Install |
|---|---|
| Node 20+ | `winget install OpenJS.NodeJS.LTS` |
| pnpm 10 | `npm install -g pnpm@10` |
| Rust stable | `winget install Rustlang.Rustup`, then `rustup default stable-msvc` |
| MSVC build tools | Visual Studio Build Tools with **Desktop development with C++** |
| WebView2 | Already on Windows 11 |

Then, in this folder:

| Command | What it does |
|---|---|
| `pnpm install` | Installs JS dependencies |
| `pnpm dev` | Starts tally-mock on :9900 and opens the app pointed at it. First run compiles Rust (a few minutes) |
| `pnpm build` | Builds the installers into `apps/desktop/src-tauri/target/release/bundle/` (`nsis/*.exe`, `msi/*.msi`). These talk to real Tally on :9000 |
| `pnpm mock` | Runs only the fake Tally |
| `pnpm -C apps/desktop test` | Unit tests, plus an end-to-end Sales import against the fake Tally (starts its own copy on :9911) |

To try the Sales import in `pnpm dev`, upload [fixtures/sales-register-sample.csv](fixtures/sales-register-sample.csv). It is made-up data that matches the fake Tally's ledgers and covers each case: ready, IGST, a two-line invoice, a party missing from Tally, a GSTIN typo, and a date before books begin.

SheetJS (the Excel reader) is vendored in `apps/desktop/vendor/`, as SheetJS recommends, because the npm copy is outdated.

## End-user install (the accountant)

No Node, Rust or terminal. The user gets one file.

1. Double-click `Tally Helper_<version>_x64-setup.exe`. It installs per user (no admin prompt) and installs WebView2 itself if it is missing.
2. Open **Tally Helper** from the Start menu.
3. If Tally is not reachable, the app shows the fix on screen: TallyPrime → F1 Help → Settings → Connectivity → *TallyPrime acts as* = **Both**, Port = **9000**, then Retry.

Before the first real release, sign the installer with a code-signing certificate, or Windows SmartScreen will warn "Unknown publisher".
