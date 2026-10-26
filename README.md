# tally-helper

One local desktop app where an accountant turns **Excel sales/purchase registers, bank statements, credit/debit notes and journals** into reviewed TallyPrime vouchers. It replaces the mix of Eazy Auto Vch, VouchrIt, TrulyInvoice and similar tools with a single, simple workflow:

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
apps/desktop        Tauri 2 + React UI
packages/domain     canonical models, validation, GST & money
packages/tally-client  XML builders, transport, response parser
packages/importers  excel / csv / bank pdf / gstr-2b
packages/mapping-engine  rules, learned mappings, fuzzy matching
packages/pipeline   ingest → map → validate → push orchestration
packages/sync       AlterID incremental mirror of Tally (company workspace)
packages/storage    SQLite schema, migrations, repositories
packages/ai         optional document extraction (opt-in)
tools/tally-mock    fake Tally server for tests
fixtures            anonymised sample files only
```

> ⚠️ Never commit real client data. See [docs/13](docs/13-security-privacy.md).
