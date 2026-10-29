export type InvoiceKind = "sales" | "purchase";

/** Everything that differs between importing sales invoices and purchase bills. */
export interface KindConfig {
  kind: InvoiceKind;
  title: string;
  intro: string;
  /** Tally's parent voucher type, used to list e.g. "Sales" and a custom "Cash Sale". */
  voucherParent: "Sales" | "Purchase";
  mainRole: "Sales" | "Purchase";
  partyWord: "customer" | "supplier";
  partyLabel: string;
  invoiceNoLabel: string;
  documentWord: "invoice" | "bill";
  remoteIdPrefix: string;
  /** Purchase bills can be read straight from the supplier's PDF. */
  acceptsPdf: boolean;
}

export const KINDS: Record<InvoiceKind, KindConfig> = {
  sales: {
    kind: "sales",
    title: "Sales Import",
    intro: "Import a sales register from Excel/CSV, check it against your Tally ledgers, and push it to Tally.",
    voucherParent: "Sales",
    mainRole: "Sales",
    partyWord: "customer",
    partyLabel: "Party / Customer",
    invoiceNoLabel: "Invoice No",
    documentWord: "invoice",
    remoteIdPrefix: "th-sales",
    acceptsPdf: false,
  },
  purchase: {
    kind: "purchase",
    title: "Purchase Import",
    intro: "Import supplier PDF bills or a purchase register from Excel/CSV, check them against your Tally ledgers, and push them to Tally.",
    voucherParent: "Purchase",
    mainRole: "Purchase",
    partyWord: "supplier",
    partyLabel: "Party / Supplier",
    invoiceNoLabel: "Supplier Invoice No",
    documentWord: "bill",
    remoteIdPrefix: "th-purc",
    acceptsPdf: true,
  },
};
