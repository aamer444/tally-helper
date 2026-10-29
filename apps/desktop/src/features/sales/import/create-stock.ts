import { escapeXml as e } from "../../../lib/xml";
import { postToTally } from "../../tally/tally-client";
import type { MissingItem } from "./build-vouchers";

/**
 * Stock items named as on the supplier's bill, in `unit`. The unit is created first when Tally
 * does not have it, in the same request.
 */
export function stockItemsXml(company: string, items: MissingItem[], unit: string, unitExists: boolean): string {
  const unitXml = unitExists
    ? ""
    : `<UNIT NAME="${e(unit)}" ACTION="Create"><NAME>${e(unit)}</NAME><ISSIMPLEUNIT>Yes</ISSIMPLEUNIT><DECIMALPLACES>0</DECIMALPLACES></UNIT>`;
  const itemsXml = items
    .map((i) => `<STOCKITEM NAME="${e(i.name)}" ACTION="Create"><NAME.LIST><NAME>${e(i.name)}</NAME></NAME.LIST><BASEUNITS>${e(unit)}</BASEUNITS></STOCKITEM>`)
    .join("\n    ");
  return `<ENVELOPE>
 <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
 <BODY><IMPORTDATA>
  <REQUESTDESC>
   <REPORTNAME>All Masters</REPORTNAME>
   <STATICVARIABLES><SVCURRENTCOMPANY>${e(company)}</SVCURRENTCOMPANY></STATICVARIABLES>
  </REQUESTDESC>
  <REQUESTDATA>
   <TALLYMESSAGE xmlns:UDF="TallyUDF">
    ${unitXml}
    ${itemsXml}
   </TALLYMESSAGE>
  </REQUESTDATA>
 </IMPORTDATA></BODY>
</ENVELOPE>`;
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
}
