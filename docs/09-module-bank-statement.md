# 09 · Module: Bank Statement → Vouchers

The biggest time-saver. A typical month has 100 to 500 bank lines per client.

## Step-by-step flow

1. **Pick the bank ledger.** Choose the Tally bank ledger (e.g. "SBI CC A/c"). The app remembers which statement format belongs to which ledger.
2. **Upload the statement.**
   - **Excel/CSV** (best). Column mapping happens once per bank: Date, Narration, Ref/Chq, Withdrawal, Deposit, Balance.
   - **PDF (text)**: parsed with pdf.js using a per-bank parser (SBI, BOI, HDFC, ICICI, Bank of Maharashtra and local co-op banks first).
   - **PDF (scanned)**: optional AI extraction (asks for consent first).
3. **Integrity check.** Opening balance + deposits − withdrawals must equal the closing balance, otherwise rows were missed. Each row's running balance is verified too.
4. **Skip already-entered rows.** We fetch existing bank vouchers for the period from Tally and auto-match them by date ±2 days, amount and reference. Matched rows are greyed out as "Already in Tally".
5. **Auto-classify each remaining row:**
   | Signal | Example narration | Suggestion |
   |---|---|---|
   | Explicit rule | `*BANK CHARGES*` | Payment → Bank Charges |
   | Learned mapping | `NEFT-XYZ TRADERS-...` | Payment → XYZ Traders (used 14×) |
   | Name inside narration ↔ ledger list (fuzzy) | `UPI/ABC TRADERS/...` | Receipt ← ABC Traders |
   | Own other bank/cash ledger | `CASH DEP`, `TRF TO HDFC` | Contra |
   | Nothing found | — | Suspense A/c (🟡) |
6. **Review grid.** Columns: Date · Narration · Dr/Cr · Amount · **Voucher type** (auto: Receipt/Payment/Contra) · **Ledger** (picker) · Confidence · Bill ref.
   - Bulk actions: select rows › set ledger; "Apply to all similar narrations".
   - Split a row across multiple ledgers (e.g. a payment covering 2 bills).
   - Bill-wise: for parties with bill-by-bill on, suggest pending bills of the same amount (Agst Ref).
7. **Push.** Vouchers are created with `BANKALLOCATIONS` (UTR/cheque no., instrument date) so Tally's Bank Reconciliation can match them.
8. **Learn.** Every manual ledger choice is saved as a learned mapping (narration key → ledger) for this company.

## Narration key extraction (for learning)
Normalise the narration before using it as a key: uppercase it, then strip dates, long numbers (UTR/ref), amounts and channel prefixes (`UPI/`, `NEFT-`, `IMPS/`, `RTGS`), and keep the remaining name tokens.
For example, `UPI/DR/412345678901/ABC TRADERS/SBIN/abc@sbi` becomes `ABC TRADERS`.

## Validation
- Statement balances are continuous (step 3).
- No row is pushed twice (deterministic REMOTEID per bank ledger + date + amount + ref + row hash).
- Contra is never created against the same ledger.
