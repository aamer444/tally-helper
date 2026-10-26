# 08 · Module: Sales & Purchase Import

## User story
> "My client sends me their sales register in Excel every month. I want to drop the file in, check it, and post 300 invoices to Tally in one go without retyping."

## Step-by-step flow

1. **Choose the company and module.** Pick Company (top bar) › Sales (or Purchase).
2. **Upload** an `.xlsx`, `.xls` or `.csv` file. Multiple sheets are supported, and the user picks one.
3. **Map columns**, done once per layout and then remembered:
   - Required: Date, Invoice No, Party, Taxable Value (or Total)
   - Optional: GSTIN, Place of Supply, GST rate, CGST/SGST/IGST, Cess, Round-off, Narration, Item, Qty, Rate
   - Auto-detection guesses columns from their headers ("Inv No", "Bill No", "Voucher No" → Invoice No)
   - Saved as a template such as *"Client A – Sales Excel"*
4. **Settings for the batch:** voucher type (from Tally's list, e.g. "RSPL CASH SALE"), accounting vs item invoice, and a default sales/purchase ledger per GST rate.
5. **Review grid**
   - One row per invoice. Expand a row to see its ledger lines.
   - Party matched by **GSTIN** first, then by name. If neither matches, the row is 🟡 and offers "Create ledger" (pre-filled with GSTIN, state and group).
   - GST auto-split: same state → CGST + SGST, different state → IGST (state comes from the GSTIN's first 2 digits).
   - Round-off line added automatically if the gap is ≤ ₹1.
   - Duplicate check: an invoice number already in Tally, or already pushed from this tool, is flagged 🔴.
6. **Push.** A progress bar shows chunks of 50. Pressing Esc pauses after the current chunk.
7. **Result.** Shows "298 created, 2 failed", with reasons and Fix → Retry for the failed rows.

## Grouping rule
Multiple Excel rows with the same **Invoice No + Date + Party** are merged into one voucher, as multi-item or multi-rate lines.

## Validation checklist
- [ ] Date within the company FY and ≥ Books From
- [ ] Taxable + taxes + round-off = invoice total (±₹0.01)
- [ ] All ledgers exist (or are queued for creation)
- [ ] GST rate is one of 0/0.25/3/5/12/18/28 (warn otherwise)
- [ ] GSTIN format and checksum are valid
- [ ] No duplicate invoice number for the same party in the FY

## Edge cases
- Cash sales with no party: use the "Cash" ledger (as in the RSPL sample).
- B2C below threshold: no GSTIN, so set registration type to "Unregistered/Consumer".
- Reverse charge, SEZ and exports: Phase 2+. Show a warning for now.
- Discounts as negative lines: allowed, but they must still balance.
