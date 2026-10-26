# 14 · Testing Strategy & Developer Setup

## Test pyramid

| Level | What | Tool | Runs in CI |
|---|---|---|---|
| Unit | domain validation, GST math, money, narration normaliser, fuzzy matcher | Vitest | ✅ |
| Golden / snapshot | `tally-client` builders: DraftVoucher → XML compared with a reviewed `.xml` file | Vitest snapshots | ✅ |
| Parser | importers fed anonymised fixture files (each bank format) | Vitest | ✅ |
| Contract | `tally-client` against **`tools/tally-mock`**, a small HTTP server that validates envelopes and replies like Tally (incl. LINEERRORs) | Vitest | ✅ |
| E2E UI | upload → review → push against tally-mock | Playwright | ✅ |
| Manual integration | real TallyPrime 7.1 + **TH Test Co** company | Checklist | ❌ (before each release) |

**Rule:** a bug reported from real Tally first becomes a tally-mock scenario plus a failing test, and only then gets fixed.

## Developer setup (Windows)
1. Install Node 20 LTS, pnpm 9, Rust stable (`rustup`), and Tauri prerequisites (WebView2, MSVC build tools).
2. `pnpm install`
3. `pnpm dev`: starts tally-mock on :9900 and the desktop app pointed at it.
4. To use real Tally: Settings › Tally URL = `http://localhost:9000`, with **TH Test Co** open in Tally.

## Conventions
- TypeScript `strict`. No `any` in `packages/*`.
- Conventional commits (`feat(bank): ...`, `fix(tally-client): ...`).
- Branches: `main` (releases) ← `dev` ← `feat/*`. PRs need green CI.
- Every package has its own `README.md` stating its single responsibility.
