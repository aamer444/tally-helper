import { escapeXml as e } from "../../../lib/xml";
import { fetchLedgers } from "../../tally/masters";
import { postToTally } from "../../tally/tally-client";
import type { InvoiceVoucher } from "./build-vouchers";
import { isValidGstin, stateNameOf } from "./gst";
import { KINDS } from "./kind";

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
    group: KINDS[v.kind].side === "purchase" ? "Sundry Creditors" : "Sundry Debtors",
    gstin,
    stateName: stateNameOf(gstin.slice(0, 2)),
  };
}

/** Any ledger: its name, group, and the tags that set it up (GST details, bill-wise and so on). */
export interface LedgerSpec {
  name: string;
  group: string;
  /** Tally tags inside <LEDGER>, already escaped. */
  details?: string;
}

/** A party ledger the way TallyPrime imports it: bill-wise on, so vouchers can carry the invoice as a New Ref. */
export function partyLedgerSpec(p: NewParty): LedgerSpec {
  const gst = p.gstin
    ? `<GSTREGISTRATIONTYPE>Regular</GSTREGISTRATIONTYPE><PARTYGSTIN>${e(p.gstin)}</PARTYGSTIN>`
    : `<GSTREGISTRATIONTYPE>Unregistered</GSTREGISTRATIONTYPE>`;
  const state = p.stateName ? `<LEDSTATENAME>${e(p.stateName)}</LEDSTATENAME>` : "";
  return { name: p.name, group: p.group, details: `<ISBILLWISEON>Yes</ISBILLWISEON>${state}<COUNTRYOFRESIDENCE>India</COUNTRYOFRESIDENCE>${gst}` };
}

export function ledgerXml(company: string, spec: LedgerSpec): string {
  return `<ENVELOPE>
 <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
 <BODY><IMPORTDATA>
  <REQUESTDESC>
   <REPORTNAME>All Masters</REPORTNAME>
   <STATICVARIABLES><SVCURRENTCOMPANY>${e(company)}</SVCURRENTCOMPANY></STATICVARIABLES>
  </REQUESTDESC>
  <REQUESTDATA>
   <TALLYMESSAGE xmlns:UDF="TallyUDF">
    <LEDGER NAME="${e(spec.name)}" ACTION="Create">
     <NAME.LIST><NAME>${e(spec.name)}</NAME></NAME.LIST>
     <PARENT>${e(spec.group)}</PARENT>
     ${spec.details ?? ""}
    </LEDGER>
   </TALLYMESSAGE>
  </REQUESTDATA>
 </IMPORTDATA></BODY>
</ENVELOPE>`;
}

/** Writes to the user's books: only call this after they click Create. */
export async function createLedger(url: string, company: string, spec: LedgerSpec): Promise<void> {
  const doc = await postToTally(url, ledgerXml(company, spec));
  const lineError = doc.getElementsByTagName("LINEERROR")[0]?.textContent?.trim();
  if (lineError) throw new Error(`Tally said: ${lineError}`);
  const count = (tag: string) => Number(doc.getElementsByTagName(tag)[0]?.textContent ?? 0);
  if (!count("CREATED") && !count("ALTERED")) throw new Error(`Tally did not create the ledger "${spec.name}".`);

  // Read it back: a reply that says "created" is not proof the ledger is there to use.
  const ledgers = await fetchLedgers(url, company);
  if (!ledgers.some((l) => l.name.toLowerCase() === spec.name.toLowerCase())) {
    throw new Error(`Tally replied that "${spec.name}" was created, but it is not in Tally's ledger list. Check in Tally, then click Refresh from Tally.`);
  }
}

export const createPartyLedger = (url: string, company: string, p: NewParty): Promise<void> => createLedger(url, company, partyLedgerSpec(p));
