import type { Ledger } from "../../tally/types";
import type { InvoiceSettings } from "./build-vouchers";
import type { KindConfig } from "./kind";

function pick(ledgers: Ledger[], patterns: RegExp[], avoid?: RegExp): string {
  for (const re of patterns) {
    const hit = ledgers.find((l) => re.test(l.name) && !avoid?.test(l.name));
    if (hit) return hit.name;
  }
  return "";
}

/** First guess at the ledgers from their names; the user confirms or changes them in step 2. */
export function guessSettings(kind: KindConfig, ledgers: Ledger[], voucherTypes: string[]): InvoiceSettings {
  const isSales = kind.kind === "sales";
  const group = isSales ? /^sales accounts$/i : /^purchase accounts$/i;
  const side = isSales ? "output" : "input";
  const otherSide = isSales ? /input|purchase/i : /output|sales/i;
  const taxLedger = (tax: string) =>
    pick(ledgers, [new RegExp(`${side}.*${tax}|${tax}.*${side}`, "i"), new RegExp(tax, "i")], otherSide);

  return {
    voucherType: voucherTypes.includes(kind.voucherParent) ? kind.voucherParent : (voucherTypes[0] ?? kind.voucherParent),
    mainLedger: pick(ledgers.filter((l) => group.test(l.parent)), [/gst/i, /./], /return/i),
    cgstLedger: taxLedger("cgst"),
    sgstLedger: pick(ledgers, [new RegExp(`${side}.*[su]tgst|[su]tgst.*${side}`, "i"), /sgst|utgst/i], otherSide),
    igstLedger: taxLedger("igst"),
    roundOffLedger: pick(ledgers, [/round(ed|ing)?[\s-]*off/i]),
    discountLedger: pick(ledgers, isSales ? [/discount.*(allowed|given)/i, /discount/i] : [/discount.*(received|recd)/i, /discount/i]),
    withStock: true,
  };
}
