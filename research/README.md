# Research captured from the accountant's PC (26 Oct 2026)

Everything here is **anonymised**: client company names become `{COMPANY}`, and party names, GSTINs, PANs, phones, emails and account numbers become placeholders. Login tokens, API keys and session files were never copied. Raw material (`_private/`) is git-ignored and was left on that PC only.

| Folder | What's inside |
|---|---|
| [tally/](tally/) | `tally.ini` and `tallygateway.ini` for TallyPrime 7.1, 7.0 and 6.2, plus each install's executables and folder tree |
| [xml-captures/tally-http-log/](xml-captures/tally-http-log/INDEX.md) | 21 distinct request types seen in about 53k logged requests: Livekeeping's full inline-TDL sync reports (sales, purchase, receipts, payments, contra, journal, inventory, outstandings) and report exports |
| [xml-captures/trulyinvoice/](xml-captures/trulyinvoice/INDEX.md) | TrulyInvoice's import payloads: stock item, ledger (GSTIN + mailing address), unit |
| [xml-captures/tally-import-files/](xml-captures/tally-import-files/README.md) | Full item-invoice sales voucher XML in TallyPrime 7.1's own format |
| [connectors/](connectors/) | Livekeeping, TrulyInvoice, VouchrIt, TallyIra and Eazy Auto Vch: files, versions, redacted configs, local DB schemas, log patterns |
| [file-layouts/](file-layouts/README.md) | Header rows of the accountant's real sales, purchase, bank, GST and notes spreadsheets, plus PDF statement counts by bank |

## Key findings

1. **Every tool uses Tally's XML server.** Reads are `Export` requests with inline TDL; writes are `Import Data`. Sync is incremental by **AlterID** (about 28k AlterID-filtered requests).
2. **TallyPrime 7.1's own AI (TallyIra) imports transactions** (`TSPL__TallyAI__ImportTransaction` in `tdlfunc.log`, with many "does not exist" ledger and stock-item errors). Tally is moving into this space, so our edge is the review UX, learning and bank handling.
3. **Top input formats to support first:**
   - Sales: one billing-software export (`Bill type | Bill Date | … | CGST 2.50% | CGST 9.00% …`) that repeats monthly.
   - Purchase: a distributor-portal register (`S.No | Company Name | Division Name | … | Invoice No | Distributor Name …`).
   - An existing import template (`GSTIN | Party Name | Invoice Number | Invoice Date | … | Narrations`).
   - Banks: mostly **PDF** statements; SBI is the most common (33 files), then HDFC (5). Bank Excel files are rare.
4. **Tally's HTTP log keeps requests only.** Responses are truncated to `<ENVELOPE>`, so the response samples in `tools/tally-mock/samples/` were built from Tally's documented formats and are flagged ⚠ where they need checking against real Tally.
5. The Eazy Auto Vch `.tcp` is encrypted, so nothing could be learned from it beyond its size and date.
