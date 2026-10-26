# 04 · Product Scope & Modules

## Users
- **Primary:** an accountant handling 6 or more GST trader clients in TallyPrime (Silver, single user).
- **Later:** small CA offices running Gold (multi-user, LAN).

## Modules

| # | Module | Inputs | Output in Tally | Doc |
|---|---|---|---|---|
| M0 | **Connection & Masters** | Tally on :9000 | Reads companies, ledgers, groups, voucher types, stock items, GST rates; creates missing ledgers | [07](07-tally-xml-reference.md) |
| M1 | **Sales** | Excel/CSV (any layout), billing-software exports | Sales vouchers (accounting or item invoice) | [08](08-module-sales-purchase.md) |
| M2 | **Purchase** | Excel/CSV, purchase register, invoice PDFs (AI) | Purchase vouchers with GST | [08](08-module-sales-purchase.md) |
| M3 | **Bank Statement** | Bank Excel/CSV/PDF | Receipt / Payment / Contra vouchers | [09](09-module-bank-statement.md) |
| M4 | **Credit / Debit Notes & Journals** | Excel/CSV | Credit Note / Debit Note / Journal | [10](10-module-notes-journals.md) |
| M5 | **GSTR-2B Reconciliation** | 2B JSON/Excel from the portal | Mismatch report; push missing purchases | Phase 4 |
| M6 | **History & Undo** | — | Audit log of every push; delete pushed batch | [05](05-architecture.md) |

## Non-functional requirements
- **Local first:** works offline. Client data never leaves the PC unless he turns on AI for a document.
- **Safe:** never writes Tally files directly. Every push is previewed, balanced and logged, and can be undone by batch.
- **Fast:** 500 bank rows reviewed and pushed in under 2 minutes. Memory below 250 MB.
- **Friendly:** keyboard-first like Tally. English UI first, with Marathi/Hindi labels later.
- **Idempotent:** pushing the same file twice must never create duplicates.

## Out of scope (v1)
GST return filing, payroll, inventory valuation reports, mobile app, multi-user cloud sync.
