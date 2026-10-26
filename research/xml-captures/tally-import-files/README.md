# Import files found in the TallyPrime 7.1 folder (anonymised)

- **sales-item-invoice-full.xml**: one of `Sales_25-26-RSPL-22/23/24.xml` (Oct 2026). A complete Import Data envelope for an **item-invoice** sales voucher: custom voucher type `RSPL CASH SALE`, GST, inventory entries. It looks like an export from Tally kept for re-import.
- **sales-template-tally-xml.xml**: `Tally.xml`, a stripped-down voucher template with default flags.

Use these as the reference for the exact 7.1 tag set when building item-invoice support in `tally-client`.
