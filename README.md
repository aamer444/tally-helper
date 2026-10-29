# tally-helper

One local desktop app where an accountant turns **Excel sales/purchase registers, supplier PDF bills, bank statements, credit/debit notes and journals** into reviewed TallyPrime vouchers. It replaces the mix of Eazy Auto Vch, VouchrIt, TrulyInvoice and similar tools with a single, simple workflow:

**Upload → Map → Review → Push → Done**

## Documentation (read in order)

| # | Doc | What it answers |
|---|---|---|
| 01 | [Discovery findings](docs/01-discovery-findings.md) | What is on the accountant's PC today, and the health issues found |
| 02 | [How data reaches Tally](docs/02-how-data-reaches-tally.md) | How third-party tools actually get data into Tally |
| 03 | [Market & Tally built-ins](docs/03-market-and-tally-builtins.md) | What exists already and where we fit |
| 04 | [Product scope](docs/04-product-scope.md) | Modules, requirements, out of scope |
| 05 | [Architecture](docs/05-architecture.md) | Components, pipeline, data model, repo layout |
| 06 | [Tech stack & decisions](docs/06-tech-stack.md) | Tauri, React, TS, SQLite, and why |
| 07 | [Tally XML reference](docs/07-tally-xml-reference.md) | Exact XML for every voucher type + responses |
| 08 | [Module: Sales & Purchase](docs/08-module-sales-purchase.md) | Step-by-step flow and rules |
| 09 | [Module: Bank statement](docs/09-module-bank-statement.md) | Step-by-step flow, auto-classification |
| 10 | [Module: Notes & Journals](docs/10-module-notes-journals.md) | Credit/debit notes, journals |
| 11 | [UX design](docs/11-ux-design.md) | Layout, components, keyboard-first rules |
| 12 | [Roadmap](docs/12-roadmap.md) | Phase-by-phase plan with checklists |
| 13 | [Security & privacy](docs/13-security-privacy.md) | Protecting client data |
| 14 | [Testing & dev setup](docs/14-testing-and-dev-setup.md) | Test pyramid, tally-mock, conventions |
| 15 | [Database design](docs/15-database-design.md) | Full SQLite schema, ER diagram, state machines, sync |
| 16 | [Module implementation playbook](docs/16-module-implementation-playbook.md) | Exactly how Sales, Purchase, Bank and Credit Notes become vouchers |
| 17 | [Sync engine & company workspace](docs/17-sync-and-company-workspace.md) | How apps show old Tally records and party details; open a company and work inside it |

## Repository layout

```
apps/desktop        Tauri 2 + React app (the thing users install); Sales and Purchase import live here today
packages/domain     canonical models, validation, GST & money
packages/tally-client  XML builders, transport, response parser
packages/importers  excel / csv / bank pdf / gstr-2b
packages/mapping-engine  rules, learned mappings, fuzzy matching
packages/pipeline   ingest → map → validate → push orchestration
packages/sync       AlterID incremental mirror of Tally (company workspace)
packages/storage    SQLite schema, migrations, repositories
packages/ai         optional document extraction (opt-in)
tools/tally-mock    fake Tally server on :9900 for development and tests
fixtures            anonymised sample files only
docs, research      design docs and anonymised Tally research
```

> ⚠️ Never commit real client data. See [docs/13](docs/13-security-privacy.md).

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
| `pnpm -C apps/desktop test` | Unit tests, plus end-to-end Sales and Purchase imports against the fake Tally (starts its own copy on :9911) |

To try the imports in `pnpm dev`, upload [fixtures/sales-register-sample.csv](fixtures/sales-register-sample.csv) on **Sales** or [fixtures/purchase-register-sample.csv](fixtures/purchase-register-sample.csv) on **Purchase**. Both are made-up data that match the fake Tally's ledgers and cover each case (ready, IGST, a multi-line invoice, a party missing from Tally, round off). Purchase also accepts supplier PDF bills, including password-protected ones.

SheetJS (the Excel reader) is vendored in `apps/desktop/vendor/`, as SheetJS recommends, because the npm copy is outdated.

## End-user install (the accountant)

No Node, Rust or terminal. The user gets one file.

1. Double-click `Tally Helper_<version>_x64-setup.exe`. It installs per user (no admin prompt) and installs WebView2 itself if it is missing.
2. Open **Tally Helper** from the Start menu.
3. If Tally is not reachable, the app shows the fix on screen: TallyPrime → F1 Help → Settings → Connectivity → *TallyPrime acts as* = **Both**, Port = **9000**, then Retry.

Before the first real release, sign the installer with a code-signing certificate, or Windows SmartScreen will warn "Unknown publisher".
