# 07 · Tally XML API Reference (what `tally-client` sends)

All requests are `POST http://localhost:9000` with an XML body (`Content-Type: text/xml`, UTF-8).
Replace `{COMPANY}` with the exact company name as shown in Tally, including the year suffix such as `- 2025-2026`.

> ⚠️ Always test on a **dummy company** first, never on a client's books.

## 7.1 Health check

`GET http://localhost:9000` returns `<RESPONSE>TallyPrime Server is Running</RESPONSE>`.

## 7.2 List open companies

```xml
<ENVELOPE>
 <HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>CompanyList</ID></HEADER>
 <BODY><DESC>
  <STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES>
  <TDL><TDLMESSAGE>
   <COLLECTION NAME="CompanyList" ISMODIFY="No">
    <TYPE>Company</TYPE>
    <NATIVEMETHOD>Name</NATIVEMETHOD>
    <NATIVEMETHOD>StartingFrom</NATIVEMETHOD>
    <NATIVEMETHOD>BooksFrom</NATIVEMETHOD>
   </COLLECTION>
  </TDLMESSAGE></TDL>
 </DESC></BODY>
</ENVELOPE>
```

## 7.3 Fetch masters (ledgers, voucher types)

The same pattern with a different `TYPE`. Repeat for `Group`, `VoucherType`, `StockItem` and `Unit`.

```xml
<ENVELOPE>
 <HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>LedgerList</ID></HEADER>
 <BODY><DESC>
  <STATICVARIABLES>
   <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
   <SVCURRENTCOMPANY>{COMPANY}</SVCURRENTCOMPANY>
  </STATICVARIABLES>
  <TDL><TDLMESSAGE>
   <COLLECTION NAME="LedgerList" ISMODIFY="No">
    <TYPE>Ledger</TYPE>
    <NATIVEMETHOD>Name</NATIVEMETHOD>
    <NATIVEMETHOD>Parent</NATIVEMETHOD>
    <NATIVEMETHOD>GUID</NATIVEMETHOD>
    <NATIVEMETHOD>LedGSTRegDetails</NATIVEMETHOD>   <!-- GSTIN, reg. type (Prime 3.0+) — verify on 7.1 -->
    <NATIVEMETHOD>ClosingBalance</NATIVEMETHOD>
   </COLLECTION>
  </TDLMESSAGE></TDL>
 </DESC></BODY>
</ENVELOPE>
```

For voucher types, also fetch `Parent` (the base type: Sales, Purchase, Payment...). That way the user can pick a custom type such as "RSPL CASH SALE" and we still know it is a Sales voucher.

## 7.4 Import envelope (wraps every create/alter)

```xml
<ENVELOPE>
 <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
 <BODY><IMPORTDATA>
  <REQUESTDESC>
   <REPORTNAME>Vouchers</REPORTNAME>            <!-- "All Masters" for ledgers -->
   <STATICVARIABLES><SVCURRENTCOMPANY>{COMPANY}</SVCURRENTCOMPANY></STATICVARIABLES>
  </REQUESTDESC>
  <REQUESTDATA>
   <TALLYMESSAGE xmlns:UDF="TallyUDF"> ...one VOUCHER or LEDGER... </TALLYMESSAGE>
   <TALLYMESSAGE xmlns:UDF="TallyUDF"> ...next... </TALLYMESSAGE>
  </REQUESTDATA>
 </IMPORTDATA></BODY>
</ENVELOPE>
```

### Sign convention (the most common bug)

| Side | `ISDEEMEDPOSITIVE` | `AMOUNT` |
|---|---|---|
| **Debit** | `Yes` | **negative** (e.g. `-11800.00`) |
| **Credit** | `No` | **positive** (e.g. `11800.00`) |

## 7.5 Sales voucher (accounting invoice, intra-state GST 18%)

```xml
<VOUCHER VCHTYPE="Sales" ACTION="Create" OBJVIEW="Accounting Voucher View" REMOTEID="th-{hash}">
 <DATE>20250405</DATE>
 <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
 <VOUCHERNUMBER>INV-101</VOUCHERNUMBER>
 <PARTYLEDGERNAME>ABC Traders</PARTYLEDGERNAME>
 <PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>
 <NARRATION>Imported by Tally Helper</NARRATION>
 <LEDGERENTRIES.LIST>
  <LEDGERNAME>ABC Traders</LEDGERNAME>
  <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE><ISPARTYLEDGER>Yes</ISPARTYLEDGER>
  <AMOUNT>-11800.00</AMOUNT>
  <BILLALLOCATIONS.LIST><NAME>INV-101</NAME><BILLTYPE>New Ref</BILLTYPE><AMOUNT>-11800.00</AMOUNT></BILLALLOCATIONS.LIST>
 </LEDGERENTRIES.LIST>
 <LEDGERENTRIES.LIST><LEDGERNAME>Sales GST 18%</LEDGERNAME><ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE><AMOUNT>10000.00</AMOUNT></LEDGERENTRIES.LIST>
 <LEDGERENTRIES.LIST><LEDGERNAME>Output CGST 9%</LEDGERNAME><ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE><AMOUNT>900.00</AMOUNT></LEDGERENTRIES.LIST>
 <LEDGERENTRIES.LIST><LEDGERNAME>Output SGST 9%</LEDGERNAME><ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE><AMOUNT>900.00</AMOUNT></LEDGERENTRIES.LIST>
</VOUCHER>
```

**Item invoice mode** (as used in the `Sales_25-26-RSPL-*.xml` files found on the PC): add `<VCHENTRYMODE>Item Invoice</VCHENTRYMODE>`, set `OBJVIEW="Invoice Voucher View"`, and use `ALLINVENTORYENTRIES.LIST` (stock item, rate, actual/billed qty, amount, plus a nested `ACCOUNTINGALLOCATIONS.LIST` for the sales ledger) instead of the sales ledger line.

## 7.6 Purchase voucher

The mirror of sales: the party is **credited**, while purchase and input-tax ledgers are **debited**. Put the supplier's invoice number in `<REFERENCE>` and `<REFERENCEDATE>`, which GSTR-2B matching needs.

## 7.7 Bank Payment / Receipt / Contra

```xml
<!-- Payment: money out of bank -->
<VOUCHER VCHTYPE="Payment" ACTION="Create" REMOTEID="th-{hash}">
 <DATE>20250410</DATE><VOUCHERTYPENAME>Payment</VOUCHERTYPENAME>
 <NARRATION>NEFT/XYZ TRADERS/UTR123</NARRATION>
 <ALLLEDGERENTRIES.LIST>
  <LEDGERNAME>XYZ Traders</LEDGERNAME><ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE><AMOUNT>-5000.00</AMOUNT>
 </ALLLEDGERENTRIES.LIST>
 <ALLLEDGERENTRIES.LIST>
  <LEDGERNAME>SBI Current A/c</LEDGERNAME><ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE><AMOUNT>5000.00</AMOUNT>
  <BANKALLOCATIONS.LIST>
   <DATE>20250410</DATE><INSTRUMENTDATE>20250410</INSTRUMENTDATE>
   <TRANSACTIONTYPE>e-Fund Transfer</TRANSACTIONTYPE><INSTRUMENTNUMBER>UTR123</INSTRUMENTNUMBER>
   <PAYMENTFAVOURING>XYZ Traders</PAYMENTFAVOURING><AMOUNT>5000.00</AMOUNT>
  </BANKALLOCATIONS.LIST>
 </ALLLEDGERENTRIES.LIST>
</VOUCHER>
```

- **Receipt:** the bank is debited (`Yes`, negative) and the party credited.
- **Contra:** bank ↔ cash or bank ↔ bank, with both sides being cash/bank ledgers.
- Filling `BANKALLOCATIONS.LIST` lets Tally's **Bank Reconciliation** auto-match these entries later.

## 7.8 Credit Note / Debit Note

- **Credit Note** (sales return): the party is credited, while the Sales Return ledger and output taxes are debited. Add `<ORIGINALINVOICENO>` / `<REFERENCE>` for GST.
- **Debit Note** (purchase return): the party is debited, while the Purchase Return ledger and input taxes are credited.

## 7.9 Create a missing ledger

```xml
<!-- REPORTNAME = All Masters -->
<LEDGER NAME="XYZ Traders" ACTION="Create">
 <NAME.LIST><NAME>XYZ Traders</NAME></NAME.LIST>
 <PARENT>Sundry Creditors</PARENT>
 <ISBILLWISEON>Yes</ISBILLWISEON>
 <!-- GST: LEDGSTREGDETAILS.LIST with GSTIN, GSTREGISTRATIONTYPE, STATE — confirm tags on 7.1 by exporting an existing ledger -->
</LEDGER>
```

**Tip:** to learn the exact tags for anything, create one sample by hand in Tally and then **export it as XML** (Alt+E › Masters/Transactions › XML). Copy the structure.

## 7.10 Response parsing

```xml
<RESPONSE>
 <CREATED>48</CREATED><ALTERED>0</ALTERED><DELETED>0</DELETED>
 <LASTVCHID>4521</LASTVCHID><COMBINED>0</COMBINED><IGNORED>0</IGNORED>
 <ERRORS>2</ERRORS><CANCELLED>0</CANCELLED><EXCEPTIONS>0</EXCEPTIONS>
 <LINEERROR>Voucher totals do not match! Dr: 11,800.00 Dr Cr: 11,700.00 Cr</LINEERROR>
 <LINEERROR>Ledger 'ABC Tradrs' does not exist!</LINEERROR>
</RESPONSE>
```

Tally does **not** say *which* voucher failed, so `tally-client` uses this strategy:
1. Push in chunks (default 50).
2. If a chunk has errors, **bisect** it (25 → 12 → ... → 1) to pinpoint the failing voucher. Successful ones are already created, and the deterministic `REMOTEID` makes re-sends safe.
3. Map each `LINEERROR` to a friendly message and to its review-grid row.

## 7.11 Idempotency and undo (verify in Phase 0)

- Send `REMOTEID="th-<sha1(companyId|batchId|row)>"` on each voucher. Re-importing the same REMOTEID should **alter** rather than duplicate. **Confirm this on 7.1 with a test company.**
- Undo is the same envelope with `ACTION="Delete"` on the voucher, identified by its REMOTEID/GUID, or `DATE` + `VOUCHERTYPENAME` + `VOUCHERNUMBER`.

## 7.12 Gotchas
- The company **must be open** in Tally, or you get "Could not set SVCurrentCompany".
- Dates outside the company's FY or before "Books From" are rejected.
- Ledger names must match **exactly**, including trailing spaces and the "M/s." prefix. That is why we match against the cached list.
- Escape `&`, `<` and `>` in names (`&amp;`). The builder must handle this.
- Large posts (thousands of vouchers) can freeze Tally's UI. Chunk them.
- Tally's HTTP server is single-threaded. Keep one in-flight request per Tally instance.
