import { escapeXml as e } from "../../../lib/xml";
import { fetchStockItems } from "../../tally/masters";
import { postToTally } from "../../tally/tally-client";
import type { MissingItem } from "./build-vouchers";

// Tally keeps the HSN code in two places (TallyPrime 4 and later read HSNDETAILS); both are
// written, as checked on TallyPrime 7.2. GST applies from its start date, before any company's books.
const GST_FROM = "20170701";
const hsnXml = (hsn: string) =>
  hsn
    ? `<GSTAPPLICABLE>&#4; Applicable</GSTAPPLICABLE><GSTDETAILS.LIST><APPLICABLEFROM>${GST_FROM}</APPLICABLEFROM><HSNCODE>${e(hsn)}</HSNCODE><TAXABILITY>Taxable</TAXABILITY></GSTDETAILS.LIST><HSNDETAILS.LIST><APPLICABLEFROM>${GST_FROM}</APPLICABLEFROM><HSNCODE>${e(hsn)}</HSNCODE><SRCOFHSNDETAILS>Specify Details Here</SRCOFHSNDETAILS></HSNDETAILS.LIST>`
    : "";

const mastersXml = (company: string, body: string) => `<ENVELOPE>
 <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
 <BODY><IMPORTDATA>
  <REQUESTDESC>
   <REPORTNAME>All Masters</REPORTNAME>
   <STATICVARIABLES><SVCURRENTCOMPANY>${e(company)}</SVCURRENTCOMPANY></STATICVARIABLES>
  </REQUESTDESC>
  <REQUESTDATA>
   <TALLYMESSAGE xmlns:UDF="TallyUDF">
    ${body}
   </TALLYMESSAGE>
  </REQUESTDATA>
 </IMPORTDATA></BODY>
</ENVELOPE>`;

/**
 * Stock items named as on the supplier's bill, in `unit`. The unit is created first when Tally
 * does not have it, in the same request.
 */
export function stockItemsXml(company: string, items: MissingItem[], unit: string, unitExists: boolean): string {
  const unitXml = unitExists
    ? ""
    : `<UNIT NAME="${e(unit)}" ACTION="Create"><NAME>${e(unit)}</NAME><ISSIMPLEUNIT>Yes</ISSIMPLEUNIT><DECIMALPLACES>0</DECIMALPLACES></UNIT>`;
  const itemsXml = items
    .map((i) => `<STOCKITEM NAME="${e(i.name)}" ACTION="Create"><NAME.LIST><NAME>${e(i.name)}</NAME></NAME.LIST><BASEUNITS>${e(unit)}</BASEUNITS>${hsnXml(i.hsn)}</STOCKITEM>`)
    .join("\n    ");
  return mastersXml(company, `${unitXml}\n    ${itemsXml}`);
}

/** Adds the bill's HSN code to stock items Tally already has. */
export function stockHsnXml(company: string, items: MissingItem[]): string {
  return mastersXml(
    company,
    items.map((i) => `<STOCKITEM NAME="${e(i.name)}" ACTION="Alter"><NAME.LIST><NAME>${e(i.name)}</NAME></NAME.LIST>${hsnXml(i.hsn)}</STOCKITEM>`).join("\n    "),
  );
}

/** Writes to the user's books: only call this after they click Save. Reads the codes back to be sure. */
export async function saveStockHsn(url: string, company: string, items: MissingItem[]): Promise<void> {
  const doc = await postToTally(url, stockHsnXml(company, items), 60_000);
  const lineError = doc.getElementsByTagName("LINEERROR")[0]?.textContent?.trim();
  if (lineError) throw new Error(`Tally said: ${lineError}`);
  const saved = new Map((await fetchStockItems(url, company)).map((s) => [s.name.toLowerCase(), s.hsn ?? ""]));
  const notSaved = items.filter((i) => saved.get(i.name.toLowerCase()) !== i.hsn).length;
  if (notSaved) throw new Error(`Tally did not keep the HSN code on ${notSaved} of ${items.length} products. Check them in Tally.`);
}

/** Writes to the user's books: only call this after they click Create. */
export async function createStockItems(url: string, company: string, items: MissingItem[], unit: string, existingUnits: string[]): Promise<void> {
  const unitExists = existingUnits.some((u) => u.toLowerCase() === unit.toLowerCase());
  const doc = await postToTally(url, stockItemsXml(company, items, unit, unitExists), 60_000);
  const lineError = doc.getElementsByTagName("LINEERROR")[0]?.textContent?.trim();
  if (lineError) throw new Error(`Tally said: ${lineError}`);
  const count = (tag: string) => Number(doc.getElementsByTagName(tag)[0]?.textContent ?? 0);
  // The unit, when created, counts as one more master.
  const created = count("CREATED") + count("ALTERED") - (unitExists ? 0 : 1);
  if (created < items.length) throw new Error(`Tally created ${created} of ${items.length} products. Click Refresh from Tally and check.`);

  // Read them back: a reply that says "created" is not proof the items are there to use.
  const inTally = new Set((await fetchStockItems(url, company)).map((s) => s.name.toLowerCase()));
  const notFound = items.filter((i) => !inTally.has(i.name.toLowerCase())).length;
  if (notFound) {
    throw new Error(`Tally replied that the products were created, but ${notFound} are not in its stock item list. Check in Tally, then click Refresh from Tally.`);
  }
}
