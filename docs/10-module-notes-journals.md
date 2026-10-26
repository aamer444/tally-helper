# 10 · Module: Credit Notes, Debit Notes & Journals

## Credit Note (sales return / discount given)
1. Upload Excel with Date, Note No, Party, Original Invoice No/Date, Taxable, GST.
2. Map columns (template saved).
3. Pick the voucher type (Credit Note, or the company's custom type) and the default "Sales Return" ledger.
4. Review: we look up the **original invoice** in Tally to auto-fill the GST rate and place of supply, and warn if the note exceeds the original invoice value.
5. Push → Result.

Entry: **Dr** Sales Return + Output GST · **Cr** Party (Agst Ref: original invoice).

## Debit Note (purchase return / discount received)
The mirror of the above. Entry: **Dr** Party · **Cr** Purchase Return + Input GST.

## Journal (generic)
For year-end adjustments, depreciation, TDS and salary provisions.
- Excel layout: `Date | Voucher No | Ledger | Debit | Credit | Narration`. Consecutive rows with the same Voucher No form one journal.
- Validation: each voucher's debit total = credit total.

## Shared rules
- The same review grid, push engine and undo as every other module.
- GST: same-state → CGST + SGST, else IGST. Taxes are recomputed from taxable × rate and a ±₹1 difference is flagged.
