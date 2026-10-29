import { childText, escapeXml } from "../../lib/xml";
import { postToTally } from "./tally-client";
import type { Company, Ledger, StockItem } from "./types";

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

export async function fetchStockItems(url: string, company: string): Promise<StockItem[]> {
  const fetch = "Name, BaseUnits, GSTDetails.HSNCode, HSNDetails.HSNCode";
  const doc = await postToTally(url, collectionRequest(company, "THStockItems", "StockItem", fetch), 60_000);
  rejectLineError(doc);
  // The code sits in HSNDETAILS (TallyPrime 4+) or GSTDETAILS (older); either will do.
  const hsnOf = (el: Element) => [...el.getElementsByTagName("HSNCODE")].map((h) => h.textContent?.trim() ?? "").find(Boolean) ?? "";
  return [...doc.getElementsByTagName("STOCKITEM")]
    .map((el) => ({ name: nameOf(el), baseUnits: childText(el, "BASEUNITS"), hsn: hsnOf(el) }))
    .filter((s) => s.name);
}

/** Unit symbols, e.g. "Nos" and "PAIR"; a stock item can only use a unit that exists. */
export async function fetchUnits(url: string, company: string): Promise<string[]> {
  const doc = await postToTally(url, collectionRequest(company, "THUnits", "Unit", "Name"));
  rejectLineError(doc);
  return [...doc.getElementsByTagName("UNIT")].map(nameOf).filter(Boolean);
}

const EDUCATIONAL_MODE_REQUEST = `<ENVELOPE>
 <HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Function</TYPE><ID>$$LicenseInfo</ID></HEADER>
 <BODY><DESC><FUNCPARAMLIST><PARAM>IsEducationalMode</PARAM></FUNCPARAMLIST></DESC></BODY>
</ENVELOPE>`;

/**
 * Whether TallyPrime runs without a licence (Educational mode). It then takes vouchers dated only
 * the 1st, 2nd or 31st, and reports any other date as "missing". False when Tally does not say.
 */
export async function fetchEducationalMode(url: string): Promise<boolean> {
  try {
    const doc = await postToTally(url, EDUCATIONAL_MODE_REQUEST);
    return doc.getElementsByTagName("RESULT")[0]?.textContent?.trim() === "Yes";
  } catch {
    return false;
  }
}

/** Voucher types under one parent, e.g. Sales gives "Sales" and a custom "Cash Sale". */
export async function fetchVoucherTypes(url: string, company: string, parent: string): Promise<string[]> {
  const doc = await postToTally(url, collectionRequest(company, "THVoucherTypes", "VoucherType", "Name, Parent"));
  rejectLineError(doc);
  return [...doc.getElementsByTagName("VOUCHERTYPE")]
    .filter((el) => childText(el, "PARENT") === parent)
    .map(nameOf)
    .filter(Boolean);
}
