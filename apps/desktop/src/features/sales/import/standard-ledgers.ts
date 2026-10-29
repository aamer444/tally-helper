import type { InvoiceSettings, LedgerLine } from "./build-vouchers";
import type { LedgerSpec } from "./create-party";
import type { Ledger } from "../../tally/types";
import { KINDS, type InvoiceKind } from "./kind";

/** Ledgers a voucher needs besides the party's. */
export type LedgerRole = Exclude<LedgerLine["role"], "Party">;
export type LedgerKey = Exclude<keyof InvoiceSettings, "voucherType" | "withStock">;

export const SETTING_FOR: Record<LedgerRole, LedgerKey> = {
  Sales: "mainLedger",
  Purchase: "mainLedger",
  CGST: "cgstLedger",
  SGST: "sgstLedger",
  IGST: "igstLedger",
  "Round Off": "roundOffLedger",
};

const gstTax = (head: string) => `<TAXTYPE>GST</TAXTYPE><GSTDUTYHEAD>${head}</GSTDUTYHEAD>`;
// Purchase and sales ledgers carry stock values when bills are entered as item invoices.
const AFFECTS_STOCK = "<AFFECTSSTOCK>Yes</AFFECTSSTOCK>";

/**
 * The ledger an accountant would normally create for `role`, so a new company (with none of
 * these yet) can be set up from the app in one click.
 */
export function standardLedger(kind: InvoiceKind, role: LedgerRole): LedgerSpec {
  const { side: whose, isReturn } = KINDS[kind];
  const side = whose === "purchase" ? "Input" : "Output";
  switch (role) {
    case "Purchase":
      return isReturn ? { name: "Purchase Return", group: "Purchase Accounts" } : { name: "Purchase GST", group: "Purchase Accounts", details: AFFECTS_STOCK };
    case "Sales":
      return isReturn ? { name: "Sales Return", group: "Sales Accounts" } : { name: "Sales GST", group: "Sales Accounts", details: AFFECTS_STOCK };
    case "CGST":
      return { name: `${side} CGST`, group: "Duties & Taxes", details: gstTax("Central Tax") };
    case "SGST":
      return { name: `${side} SGST`, group: "Duties & Taxes", details: gstTax("State Tax") };
    case "IGST":
      return { name: `${side} IGST`, group: "Duties & Taxes", details: gstTax("Integrated Tax") };
    case "Round Off":
      return { name: "Round Off", group: "Indirect Expenses" };
  }
}

/** Which role a setting key fills, for the step-2 Create buttons. */
export function roleFor(kind: InvoiceKind, key: LedgerKey): LedgerRole {
  if (key === "mainLedger") return KINDS[kind].mainRole;
  return (Object.keys(SETTING_FOR) as LedgerRole[]).find((r) => SETTING_FOR[r] === key && r !== "Sales" && r !== "Purchase")!;
}

// Tally's own groups. A ledger under any other group sits in a group the company made, whose
// place in the tree we do not read, so it is offered for every role rather than hidden.
const TALLY_GROUPS = new Set(
  [
    "Bank Accounts", "Bank OD A/c", "Branch / Divisions", "Capital Account", "Cash-in-Hand", "Current Assets",
    "Current Liabilities", "Deposits (Asset)", "Direct Expenses", "Direct Incomes", "Duties & Taxes", "Fixed Assets",
    "Indirect Expenses", "Indirect Incomes", "Investments", "Loans & Advances (Asset)", "Loans (Liability)",
    "Misc. Expenses (ASSET)", "Provisions", "Purchase Accounts", "Reserves & Surplus", "Sales Accounts",
    "Secured Loans", "Stock-in-Hand", "Sundry Creditors", "Sundry Debtors", "Suspense A/c", "Unsecured Loans", "Primary", "",
  ].map((g) => g.toLowerCase()),
);

const GROUPS_FOR: Record<LedgerRole, string[]> = {
  Purchase: ["purchase accounts"],
  Sales: ["sales accounts"],
  CGST: ["duties & taxes"],
  SGST: ["duties & taxes"],
  IGST: ["duties & taxes"],
  "Round Off": ["indirect expenses", "indirect incomes"],
};

/** The ledgers that can fill `role`: never a party, cash or bank ledger. */
export function ledgersFor<L extends Ledger>(role: LedgerRole, ledgers: L[]): L[] {
  return ledgers.filter((l) => {
    // Tally prefixes the top group with a control character ("\u0004 Primary").
    const group = l.parent.replace(/[\u0000-\u001f]/g, "").trim().toLowerCase();
    return GROUPS_FOR[role].includes(group) || !TALLY_GROUPS.has(group);
  });
}
