# 06 · Tech Stack & Decisions

Each decision below is recorded in a lightweight ADR style: what we chose, why, and what we rejected.

## ADR-001 · Desktop app, not a web app or a TDL add-on
- **Choice:** Windows desktop app that talks to Tally on localhost.
- **Why:** Tally runs on this PC, client data should stay local, and the app must work offline.
- **Rejected:** A **cloud web app** adds data-privacy concerns, needs a connector anyway, and costs money to host. A **TDL add-on** means a dated UI, a niche language and hard testing. We may still ship a *tiny* TDL later for things XML can't do.

## ADR-002 · Tauri 2 (Rust shell) + React + TypeScript
- **Why:** The machine is an i3 with 8 GB RAM. A Tauri app idles at about 30–60 MB versus about 150–300 MB for Electron, and installers are around 10 MB. Its Rust HTTP plugin bypasses the CORS limitation of Tally's server.
- **Rejected:** **Electron** is simpler for JS devs (the TrulyInvoice connector is Electron) but too heavy next to the existing connectors. It remains the fallback: the core packages are shell-agnostic, so switching costs about a week. **.NET WPF** has a smaller talent pool on our side and slower UI iteration.

## ADR-003 · Pure TypeScript core packages
- Domain, mapping, importers and the XML builder are plain TS, tested with **Vitest**, with no Tauri imports.
- Benefits: fast tests, possible reuse in a CLI or future server, and easy swapping of the shell.

## ADR-004 · SQLite + Drizzle ORM
- Embedded, zero-admin, one file to back up. Drizzle gives typed queries and migrations.

## ADR-005 · Money as integer paise
- Amounts are never stored as floats. ₹1,234.50 is stored as `123450`. Values are formatted with `Intl.NumberFormat('en-IN')` (lakh/crore grouping).

## ADR-006 · Optional AI via the Claude API
- Used only for **unstructured** input: scanned invoices, image or PDF bank statements, messy narrations.
- `claude-sonnet-5-5` for document extraction (structured JSON output). `claude-haiku-5-5` for cheap bulk narration-to-ledger classification.
- Off by default and enabled per company. The document is sent only after the user clicks "Extract with AI".
- Hidden behind the `ai` package interface (`ExtractionProvider`), so a local OCR provider can be added later.

## Libraries

| Concern | Library |
|---|---|
| UI kit | React 18, **shadcn/ui** + Tailwind, lucide icons |
| Data grid (review screen) | **TanStack Table** + virtualisation (thousands of rows, keyboard nav) |
| State / data | TanStack Query (Tally calls), Zustand (UI state) |
| Forms & validation | react-hook-form + **zod** (shared schemas with `domain`) |
| Excel / CSV | **SheetJS (xlsx)**, PapaParse |
| PDF text | **pdf.js** (text layer); AI fallback for scanned PDFs |
| XML | **fast-xml-parser** (parse and build) |
| Fuzzy matching | **fuse.js** + custom token normaliser (remove "M/s", "Pvt Ltd", punctuation) |
| Dates | date-fns |
| Monorepo | **pnpm workspaces** + Turborepo |
| Lint / format | ESLint (with import-boundary rules), Prettier |
| Tests | Vitest (unit), Playwright (UI e2e against `tally-mock`) |
| Packaging | Tauri bundler (MSI/NSIS), Tauri updater |
| CI | GitHub Actions: lint → test → build Windows installer |
