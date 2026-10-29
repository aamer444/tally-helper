import type { Ledger } from "../../tally/types";
import type { InvoiceSettings } from "./build-vouchers";
import type { KindConfig } from "./kind";
import { ledgersFor } from "./standard-ledgers";

function pick(ledgers: Ledger[], patterns: RegExp[], avoid?: RegExp): string {
  for (const re of patterns) {
    const hit = ledgers.find((l) => re.test(l.name) && !avoid?.test(l.name));
    if (hit) return hit.name;
  }
  return "";
}

/** First guess at the ledgers from their names; the user confirms or changes them in step 2. */
export function guessSettings(kind: KindConfig, ledgers: Ledger[], voucherTypes: string[]): InvoiceSettings {
  const isSales = kind.side === "sales";
  const side = isSales ? "output" : "input";
  const otherSide = isSales ? /input|purchase/i : /output|sales/i;
  const taxes = ledgersFor("IGST", ledgers);
  const taxLedger = (tax: string) =>
    pick(taxes, [new RegExp(`${side}.*${tax}|${tax}.*${side}`, "i"), new RegExp(tax, "i")], otherSide);

  return {
    voucherType: voucherTypes.includes(kind.voucherParent) ? kind.voucherParent : (voucherTypes[0] ?? kind.voucherParent),
    // Only Tally's own group here: the catch-all /./ must not land on a ledger in some other group.
    // A note goes to the Sales/Purchase Return ledger; an invoice never does.
    mainLedger: pick(
      ledgers.filter((l) => l.parent.toLowerCase() === `${kind.mainRole.toLowerCase()} accounts`),
      kind.isReturn ? [/return/i] : [/gst/i, /./],
      kind.isReturn ? undefined : /return/i,
    ),
    cgstLedger: taxLedger("cgst"),
    sgstLedger: pick(taxes, [new RegExp(`${side}.*[su]tgst|[su]tgst.*${side}`, "i"), /sgst|utgst/i], otherSide),
    igstLedger: taxLedger("igst"),
    roundOffLedger: pick(ledgersFor("Round Off", ledgers), [/round(ed|ing)?[\s-]*off/i]),
    withStock: true,
  };
}
