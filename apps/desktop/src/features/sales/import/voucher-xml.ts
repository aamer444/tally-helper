import { paiseToTally } from "../../../lib/money";
import { escapeXml as e } from "../../../lib/xml";
import type { LedgerLine, InvoiceVoucher, VoucherItem } from "./build-vouchers";

/** Debits go to Tally as negative amounts with ISDEEMEDPOSITIVE=Yes; credits as positive with No. */
function entryXml(line: LedgerLine, tag = "ALLLEDGERENTRIES.LIST"): string {
  const isDebit = line.debit > 0;
  const amount = paiseToTally(isDebit ? -line.debit : line.credit);
  const party = tag === "LEDGERENTRIES.LIST" && line.role === "Party" ? "<ISPARTYLEDGER>Yes</ISPARTYLEDGER>" : "";
  const bill = line.billRef
    ? `<BILLALLOCATIONS.LIST><NAME>${e(line.billRef)}</NAME><BILLTYPE>New Ref</BILLTYPE><AMOUNT>${amount}</AMOUNT></BILLALLOCATIONS.LIST>`
    : "";
  return `<${tag}><LEDGERNAME>${e(line.ledger)}</LEDGERNAME><ISDEEMEDPOSITIVE>${isDebit ? "Yes" : "No"}</ISDEEMEDPOSITIVE>${party}<AMOUNT>${amount}</AMOUNT>${bill}</${tag}>`;
}

/** One stock line, with the purchase/sales ledger it is booked to nested inside (item invoice mode). */
function inventoryXml(item: VoucherItem, ledger: string, isDebit: boolean): string {
  const amount = paiseToTally(isDebit ? -item.amount : item.amount);
  const qty = `${item.qty} ${item.unit}`;
  return [
    `<ALLINVENTORYENTRIES.LIST><STOCKITEMNAME>${e(item.name)}</STOCKITEMNAME><ISDEEMEDPOSITIVE>${isDebit ? "Yes" : "No"}</ISDEEMEDPOSITIVE>`,
    `<RATE>${item.rate.toFixed(2)}/${e(item.unit)}</RATE><AMOUNT>${amount}</AMOUNT><ACTUALQTY> ${e(qty)}</ACTUALQTY><BILLEDQTY> ${e(qty)}</BILLEDQTY>`,
    `<ACCOUNTINGALLOCATIONS.LIST><LEDGERNAME>${e(ledger)}</LEDGERNAME><ISDEEMEDPOSITIVE>${isDebit ? "Yes" : "No"}</ISDEEMEDPOSITIVE><AMOUNT>${amount}</AMOUNT></ACCOUNTINGALLOCATIONS.LIST>`,
    `</ALLINVENTORYENTRIES.LIST>`,
  ].join("");
}

/** The voucher's body: plain ledger lines, or, with products, ledger lines plus stock lines in place of the purchase/sales line. */
function entriesXml(v: InvoiceVoucher): string[] {
  if (!v.items.length) return v.lines.map((l) => entryXml(l));
  const main = v.lines[1];
  return [...v.lines.filter((l) => l !== main).map((l) => entryXml(l, "LEDGERENTRIES.LIST")), ...v.items.map((i) => inventoryXml(i, main.ledger, main.debit > 0))];
}

/**
 * REMOTEID lets us find (and later undo) exactly the vouchers this app created.
 * A purchase keeps Tally's own voucher numbering; the supplier's bill number and date go to
 * REFERENCE / REFERENCEDATE, which is what GSTR-2B matching reads.
 */
export function voucherXml(v: InvoiceVoucher, voucherType: string): string {
  const date = v.date ?? "";
  const numbering =
    v.kind === "purchase"
      ? [`<REFERENCE>${e(v.invoiceNo)}</REFERENCE><REFERENCEDATE>${date}</REFERENCEDATE>`]
      : [`<VOUCHERNUMBER>${e(v.invoiceNo)}</VOUCHERNUMBER>`, `<REFERENCE>${e(v.invoiceNo)}</REFERENCE>`];
  const view = v.items.length ? "Invoice Voucher View" : "Accounting Voucher View";
  return [
    `<VOUCHER VCHTYPE="${e(voucherType)}" ACTION="Create" OBJVIEW="${view}" REMOTEID="${e(v.remoteId)}">`,
    `<DATE>${date}</DATE><EFFECTIVEDATE>${date}</EFFECTIVEDATE>`,
    `<VOUCHERTYPENAME>${e(voucherType)}</VOUCHERTYPENAME>`,
    ...numbering,
    `<PARTYLEDGERNAME>${e(v.party)}</PARTYLEDGERNAME>`,
    `<PERSISTEDVIEW>${view}</PERSISTEDVIEW>`,
    ...(v.items.length ? ["<ISINVOICE>Yes</ISINVOICE><VCHENTRYMODE>Item Invoice</VCHENTRYMODE>"] : []),
    `<NARRATION>${e(v.narration)}</NARRATION>`,
    ...entriesXml(v),
    `</VOUCHER>`,
  ].join("\n");
}

export function importVouchersXml(company: string, vouchersXml: string): string {
  return `<ENVELOPE>
 <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
 <BODY><IMPORTDATA>
  <REQUESTDESC>
   <REPORTNAME>Vouchers</REPORTNAME>
   <STATICVARIABLES><SVCURRENTCOMPANY>${e(company)}</SVCURRENTCOMPANY></STATICVARIABLES>
  </REQUESTDESC>
  <REQUESTDATA>
   <TALLYMESSAGE xmlns:UDF="TallyUDF">
${vouchersXml}
   </TALLYMESSAGE>
  </REQUESTDATA>
 </IMPORTDATA></BODY>
</ENVELOPE>`;
}
