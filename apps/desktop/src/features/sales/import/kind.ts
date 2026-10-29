export type InvoiceKind = "sales" | "purchase" | "credit-note" | "debit-note";

/** Everything that differs between importing sales invoices, purchase bills and their returns. */
export interface KindConfig {
  kind: InvoiceKind;
  title: string;
  intro: string;
  /** Tally's parent voucher type, used to list e.g. "Sales" and a custom "Cash Sale". */
  voucherParent: "Sales" | "Purchase" | "Credit Note" | "Debit Note";
  /** Whose GST ledgers and parties: a credit note is on the sales side, a debit note on the purchase side. */
  side: "sales" | "purchase";
  /** A return reverses its side's usual entry: a credit note debits Sales Return and credits the customer. */
  isReturn: boolean;
  /** The ledger group the taxable value goes to. */
  mainRole: "Sales" | "Purchase";
  /** What that ledger is called on screen. */
  mainLabel: string;
  partyWord: "customer" | "supplier";
  partyLabel: string;
  invoiceNoLabel: string;
  documentWord: "invoice" | "bill" | "credit note" | "debit note";
  remoteIdPrefix: string;
  /** Purchase bills can be read straight from the supplier's PDF. */
  acceptsPdf: boolean;
  narration: (documentNo: string, originalInvoiceNo: string) => string;
}

const against = (original: string) => (original ? ` against invoice ${original}` : "");

export const KINDS: Record<InvoiceKind, KindConfig> = {
  sales: {
    kind: "sales",
    title: "Sales Import",
    intro: "Import a sales register from Excel/CSV, check it against your Tally ledgers, and push it to Tally.",
    voucherParent: "Sales",
    side: "sales",
    isReturn: false,
    mainRole: "Sales",
    mainLabel: "Sales",
    partyWord: "customer",
    partyLabel: "Party / Customer",
    invoiceNoLabel: "Invoice No",
    documentWord: "invoice",
    remoteIdPrefix: "th-sales",
    acceptsPdf: false,
    narration: (no) => `Sales as per invoice ${no}`,
  },
  purchase: {
    kind: "purchase",
    title: "Purchase Import",
    intro: "Import supplier PDF bills or a purchase register from Excel/CSV, check them against your Tally ledgers, and push them to Tally.",
    voucherParent: "Purchase",
    side: "purchase",
    isReturn: false,
    mainRole: "Purchase",
    mainLabel: "Purchase",
    partyWord: "supplier",
    partyLabel: "Party / Supplier",
    invoiceNoLabel: "Supplier Invoice No",
    documentWord: "bill",
    remoteIdPrefix: "th-purc",
    acceptsPdf: true,
    narration: (no) => `Purchase as per bill ${no}`,
  },
  "credit-note": {
    kind: "credit-note",
    title: "Credit Notes",
    intro: "Sales returns and discounts given: import credit notes from Excel/CSV. Customer is credited, Sales Return and output GST are debited.",
    voucherParent: "Credit Note",
    side: "sales",
    isReturn: true,
    mainRole: "Sales",
    mainLabel: "Sales return",
    partyWord: "customer",
    partyLabel: "Party / Customer",
    invoiceNoLabel: "Credit Note No",
    documentWord: "credit note",
    remoteIdPrefix: "th-crnt",
    acceptsPdf: false,
    narration: (no, original) => `Credit note ${no}${against(original)}`,
  },
  "debit-note": {
    kind: "debit-note",
    title: "Debit Notes",
    intro: "Purchase returns and discounts received: import debit notes from Excel/CSV. Supplier is debited, Purchase Return and input GST are credited.",
    voucherParent: "Debit Note",
    side: "purchase",
    isReturn: true,
    mainRole: "Purchase",
    mainLabel: "Purchase return",
    partyWord: "supplier",
    partyLabel: "Party / Supplier",
    invoiceNoLabel: "Debit Note No",
    documentWord: "debit note",
    remoteIdPrefix: "th-dbnt",
    acceptsPdf: false,
    narration: (no, original) => `Debit note ${no}${against(original)}`,
  },
};
