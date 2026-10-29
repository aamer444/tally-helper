import { paiseToTally } from "../../../lib/money";
import { escapeXml as e } from "../../../lib/xml";
import type { LedgerLine, SalesVoucher } from "./build-vouchers";

/** Debits go to Tally as negative amounts with ISDEEMEDPOSITIVE=Yes; credits as positive with No. */
function entryXml(line: LedgerLine): string {
  const isDebit = line.debit > 0;
  const amount = paiseToTally(isDebit ? -line.debit : line.credit);
  const bill = line.billRef
    ? `<BILLALLOCATIONS.LIST><NAME>${e(line.billRef)}</NAME><BILLTYPE>New Ref</BILLTYPE><AMOUNT>${amount}</AMOUNT></BILLALLOCATIONS.LIST>`
    : "";
  return `<ALLLEDGERENTRIES.LIST><LEDGERNAME>${e(line.ledger)}</LEDGERNAME><ISDEEMEDPOSITIVE>${isDebit ? "Yes" : "No"}</ISDEEMEDPOSITIVE><AMOUNT>${amount}</AMOUNT>${bill}</ALLLEDGERENTRIES.LIST>`;
}

/** REMOTEID lets us find (and later undo) exactly the vouchers this app created. */
export function salesVoucherXml(v: SalesVoucher, voucherType: string): string {
  const date = v.date ?? "";
  return [
    `<VOUCHER VCHTYPE="${e(voucherType)}" ACTION="Create" OBJVIEW="Accounting Voucher View" REMOTEID="${e(v.remoteId)}">`,
    `<DATE>${date}</DATE><EFFECTIVEDATE>${date}</EFFECTIVEDATE>`,
    `<VOUCHERTYPENAME>${e(voucherType)}</VOUCHERTYPENAME>`,
    `<VOUCHERNUMBER>${e(v.invoiceNo)}</VOUCHERNUMBER>`,
    `<REFERENCE>${e(v.invoiceNo)}</REFERENCE>`,
    `<PARTYLEDGERNAME>${e(v.party)}</PARTYLEDGERNAME>`,
    `<PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>`,
    `<NARRATION>${e(v.narration)}</NARRATION>`,
    ...v.lines.map(entryXml),
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
