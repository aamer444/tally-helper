import { escapeXml as e } from "../../../lib/xml";
import { postToTally } from "../../tally/tally-client";
import type { InvoiceVoucher } from "./build-vouchers";
import { isValidGstin, stateNameOf } from "./gst";

export interface NewParty {
  name: string;
  group: "Sundry Creditors" | "Sundry Debtors";
  gstin: string;
  /** Derived from the GSTIN; empty when there is none. */
  stateName: string;
}

/** What we know about a party the file names but Tally does not have. */
export function newPartyFor(v: InvoiceVoucher): NewParty {
  const gstin = isValidGstin(v.gstin) ? v.gstin : "";
  return {
    name: v.party.trim(),
    group: v.kind === "purchase" ? "Sundry Creditors" : "Sundry Debtors",
    gstin,
    stateName: stateNameOf(gstin.slice(0, 2)),
  };
}

/** A party ledger the way TallyPrime imports it: bill-wise on, so vouchers can carry the invoice as a New Ref. */
export function partyLedgerXml(company: string, p: NewParty): string {
  const gst = p.gstin
    ? `<GSTREGISTRATIONTYPE>Regular</GSTREGISTRATIONTYPE><PARTYGSTIN>${e(p.gstin)}</PARTYGSTIN>`
    : `<GSTREGISTRATIONTYPE>Unregistered</GSTREGISTRATIONTYPE>`;
  return `<ENVELOPE>
 <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
 <BODY><IMPORTDATA>
  <REQUESTDESC>
   <REPORTNAME>All Masters</REPORTNAME>
   <STATICVARIABLES><SVCURRENTCOMPANY>${e(company)}</SVCURRENTCOMPANY></STATICVARIABLES>
  </REQUESTDESC>
  <REQUESTDATA>
   <TALLYMESSAGE xmlns:UDF="TallyUDF">
    <LEDGER NAME="${e(p.name)}" ACTION="Create">
     <NAME.LIST><NAME>${e(p.name)}</NAME></NAME.LIST>
     <PARENT>${e(p.group)}</PARENT>
     <ISBILLWISEON>Yes</ISBILLWISEON>
     ${p.stateName ? `<LEDSTATENAME>${e(p.stateName)}</LEDSTATENAME>` : ""}
     <COUNTRYOFRESIDENCE>India</COUNTRYOFRESIDENCE>
     ${gst}
    </LEDGER>
   </TALLYMESSAGE>
  </REQUESTDATA>
 </IMPORTDATA></BODY>
</ENVELOPE>`;
}

/** Writes to the user's books: only call this after they click Create. */
export async function createPartyLedger(url: string, company: string, p: NewParty): Promise<void> {
  const doc = await postToTally(url, partyLedgerXml(company, p));
  const lineError = doc.getElementsByTagName("LINEERROR")[0]?.textContent?.trim();
  if (lineError) throw new Error(`Tally said: ${lineError}`);
  const count = (tag: string) => Number(doc.getElementsByTagName(tag)[0]?.textContent ?? 0);
  if (!count("CREATED") && !count("ALTERED")) throw new Error("Tally did not create the ledger.");
}
