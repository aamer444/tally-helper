import { childText, escapeXml } from "../../lib/xml";
import { postToTally } from "./tally-client";
import type { Company, Ledger } from "./types";

// Read-only Export requests (docs/07). Nothing here changes the user's books.
const COMPANIES_REQUEST = `<ENVELOPE>
 <HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>CompanyList</ID></HEADER>
 <BODY><DESC>
  <STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES>
  <TDL><TDLMESSAGE>
   <COLLECTION NAME="CompanyList" ISMODIFY="No">
    <TYPE>Company</TYPE>
    <FETCH>Name, GUID, StateName, BooksFrom</FETCH>
   </COLLECTION>
  </TDLMESSAGE></TDL>
 </DESC></BODY>
</ENVELOPE>`;

/** A read-only collection export; `staticVars` adds e.g. SVFROMDATE/SVTODATE for vouchers. */
export function collectionRequest(company: string, id: string, type: string, fetch: string, staticVars = ""): string {
  return `<ENVELOPE>
 <HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>${id}</ID></HEADER>
 <BODY><DESC>
  <STATICVARIABLES>
   <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
   <SVCURRENTCOMPANY>${escapeXml(company)}</SVCURRENTCOMPANY>${staticVars}
  </STATICVARIABLES>
  <TDL><TDLMESSAGE>
   <COLLECTION NAME="${id}" ISMODIFY="No"><TYPE>${type}</TYPE><FETCH>${fetch}</FETCH></COLLECTION>
  </TDLMESSAGE></TDL>
 </DESC></BODY>
</ENVELOPE>`;
}

/** Tally puts the object's name in its NAME attribute; the NAME child is a fallback. */
export const nameOf = (el: Element) => el.getAttribute("NAME") || childText(el, "NAME");

export function rejectLineError(doc: Document): void {
  const lineError = doc.getElementsByTagName("LINEERROR")[0]?.textContent?.trim();
  if (lineError) throw new Error(`Tally said: ${lineError}`);
}

/** The companies currently open in TallyPrime. */
export async function fetchCompanies(url: string): Promise<Company[]> {
  const doc = await postToTally(url, COMPANIES_REQUEST);
  return [...doc.getElementsByTagName("COMPANY")]
    .map((el) => ({
      name: nameOf(el),
      guid: childText(el, "GUID"),
      stateName: childText(el, "STATENAME"),
      booksFrom: childText(el, "BOOKSFROM"),
    }))
    .filter((c) => c.name);
}

export async function fetchLedgers(url: string, company: string): Promise<Ledger[]> {
  const xml = collectionRequest(company, "THLedgers", "Ledger", "Name, Parent, PartyGSTIN, LedStateName, IsBillWiseOn");
  const doc = await postToTally(url, xml, 60_000);
  rejectLineError(doc);
  return [...doc.getElementsByTagName("LEDGER")]
    .map((el) => ({
      name: nameOf(el),
      parent: childText(el, "PARENT"),
      gstin: childText(el, "PARTYGSTIN").toUpperCase(),
      stateName: childText(el, "LEDSTATENAME"),
      isBillWise: childText(el, "ISBILLWISEON") === "Yes",
    }))
    .filter((l) => l.name);
}

/** Voucher types whose parent is Sales, e.g. "Sales" and a custom "Cash Sale". */
export async function fetchSalesVoucherTypes(url: string, company: string): Promise<string[]> {
  const doc = await postToTally(url, collectionRequest(company, "THVoucherTypes", "VoucherType", "Name, Parent"));
  rejectLineError(doc);
  return [...doc.getElementsByTagName("VOUCHERTYPE")]
    .filter((el) => childText(el, "PARENT") === "Sales")
    .map(nameOf)
    .filter(Boolean);
}
