# tally-mock (dummy Tally)

A dummy TallyPrime for development, so we don't need the accountant's PC or a real Tally install.

```bash
node tools/tally-mock/server.mjs          # http://localhost:9900  (TALLY_MOCK_PORT to change)
curl -s -X POST --data-binary @tools/tally-mock/samples/13-sales.req.xml http://localhost:9900
```

- **Reads** (companies, ledgers, groups, voucher types, items, vouchers, bills, Day Book, Trial Balance) return the files in `samples/`.
- **Imports** are checked the way Tally checks them: company must be open, ledgers must exist, Dr must equal Cr, date ≥ books beginning. Results are kept in memory, so a re-sent `REMOTEID` counts as *altered* and `ACTION="Delete"` removes the voucher.
- Ledgers created via `All Masters` become valid for later vouchers.
- Demo company: **Demo Traders - 2025-26** (books from 01-Apr-2025).

## Sample library (`samples/`)

Each Tally operation has a `NN-name.req.xml` and a `NN-name.res.xml`. Regenerate them with `bash tools/tally-mock/gen-samples.sh`.

| # | Operation | Request source | Response source |
|---|---|---|---|
| 01 | Ping (GET /) | standard | standard |
| 02 | Company list + AltMstId/AltVchId | built | built ⚠ |
| 03 | Ledgers changed since AlterID (GSTIN, state, balances) | built | built ⚠ |
| 04 | Groups | built | built |
| 05 | Voucher types (incl. custom "RSPL CASH SALE" → Sales) | built | built |
| 06 | Stock items | built | built |
| 07 | Vouchers changed since AlterID | built | built ⚠ |
| 08 | Pending bills (outstandings) | built | built ⚠ |
| 09 | Day Book (built-in report) | built | built |
| 10 | Trial Balance (built-in report, DSP* tags) | built | built |
| 11 | Custom TDL report `ListOfVouchers` | **captured** (Livekeeping) | built ⚠ |
| 12 | Create ledger with GSTIN + address | shape **captured** (TrulyInvoice) | built |
| 13 | Sales voucher with GST + bill ref | built | built |
| 14 | Purchase voucher with supplier ref | built | built |
| 15 | Bank payment with UTR (bank allocation) | built | built |
| 16 | Bank receipt (UPI) | built | built |
| 17 | Contra (cash deposit) | built | built |
| 18 | Credit note against invoice | built | built |
| 19 | Debit note against supplier bill | built | built |
| 20 | Journal | built | built |
| 21 | Re-send same REMOTEID → altered | built | built ⚠ **must verify** |
| 22 | Delete voucher by REMOTEID | built | built ⚠ |
| 23 | Error: ledger does not exist | built | built |
| 24 | Error: Dr ≠ Cr | built | built |
| 25 | Error: company not open | built | built ⚠ |
| 26 | Error: date before books | built | built ⚠ |
| 27 | Older `<RESPONSE>` import result shape (parser must accept both) | — | built |

**captured** = copied from real traffic on the accountant's PC (anonymised, originals in `research/xml-captures/`).
**built** = written from Tally's documented XML formats with demo data.
⚠ = check against real TallyPrime 7.1 (the exact tag names or error wording may differ) during roadmap Sprint 0, then update the sample.

For the full real-world request bodies (Livekeeping's complete sync TDL for sales, purchase, receipts, outstandings and reports), see `research/xml-captures/tally-http-log/`.
