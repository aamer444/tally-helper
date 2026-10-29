import type { Ledger } from "../../tally/types";
import type { SalesSettings } from "./build-vouchers";

function pick(ledgers: Ledger[], patterns: RegExp[], avoid?: RegExp): string {
  for (const re of patterns) {
    const hit = ledgers.find((l) => re.test(l.name) && !avoid?.test(l.name));
    if (hit) return hit.name;
  }
  return "";
}

/** First guess at the ledgers from their names; the user confirms or changes them in step 2. */
export function guessSettings(ledgers: Ledger[], voucherTypes: string[]): SalesSettings {
  const salesAccounts = ledgers.filter((l) => /^sales accounts$/i.test(l.parent));
  const input = /input|purchase/i;
  return {
    voucherType: voucherTypes.includes("Sales") ? "Sales" : (voucherTypes[0] ?? "Sales"),
    salesLedger: pick(salesAccounts, [/gst/i, /./], /return/i),
    cgstLedger: pick(ledgers, [/output.*cgst|cgst.*output/i, /cgst/i], input),
    sgstLedger: pick(ledgers, [/output.*[su]tgst|[su]tgst.*output/i, /sgst|utgst/i], input),
    igstLedger: pick(ledgers, [/output.*igst|igst.*output/i, /igst/i], input),
    roundOffLedger: pick(ledgers, [/round(ed|ing)?[\s-]*off/i]),
  };
}
