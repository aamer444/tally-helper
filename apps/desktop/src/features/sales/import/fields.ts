import type { KindConfig } from "./kind";

export type FieldId =
  | "date"
  | "originalInvoiceNo"
  | "invoiceNo"
  | "party"
  | "gstin"
  | "placeOfSupply"
  | "taxable"
  | "gstRate"
  | "cgst"
  | "sgst"
  | "igst"
  | "total"
  | "narration";

export interface FieldDef {
  id: FieldId;
  label: string;
  required: boolean;
  synonyms: string[];
}

/** Column index in the sheet for each field the user's file has. */
export type Mapping = Partial<Record<FieldId, number>>;

export const FIELDS: FieldDef[] = [
  { id: "date", label: "Invoice Date", required: true, synonyms: ["date", "invoice date", "inv date", "bill date", "voucher date", "vch date", "doc date", "supplier invoice date"] },
  // Before Invoice No, so "Original Invoice No" is not taken for the note's own number.
  { id: "originalInvoiceNo", label: "Original Invoice No", required: false, synonyms: ["original invoice no", "original invoice number", "original invoice", "orig inv no", "original bill no", "against invoice", "against invoice no", "agst invoice", "ref invoice no", "invoice ref", "reference invoice no"] },
  { id: "invoiceNo", label: "Invoice No", required: true, synonyms: ["credit note no", "debit note no", "note no", "note number", "cn no", "dn no", "invoice no", "invoice number", "inv no", "invoice", "bill no", "bill number", "voucher no", "vch no", "doc no", "supplier invoice no", "supplier bill no"] },
  { id: "party", label: "Party / Customer", required: true, synonyms: ["party", "party name", "customer", "customer name", "buyer", "buyer name", "supplier", "supplier name", "seller", "vendor", "vendor name", "name", "particulars", "ledger", "account"] },
  { id: "gstin", label: "GSTIN", required: false, synonyms: ["gstin", "gstin uin", "gst no", "gst number", "party gstin", "customer gstin", "supplier gstin", "gstin no"] },
  { id: "placeOfSupply", label: "Place of Supply", required: false, synonyms: ["place of supply", "pos", "state", "supply state"] },
  { id: "taxable", label: "Taxable Value", required: false, synonyms: ["taxable value", "taxable", "taxable amount", "assessable value", "basic amount", "amount before tax", "value", "sales value"] },
  { id: "gstRate", label: "GST Rate %", required: false, synonyms: ["gst rate", "tax rate", "gst %", "gst", "rate of tax", "rate %", "gst rate %"] },
  { id: "cgst", label: "CGST Amount", required: false, synonyms: ["cgst", "cgst amount", "cgst amt", "central tax"] },
  { id: "sgst", label: "SGST Amount", required: false, synonyms: ["sgst", "sgst amount", "sgst amt", "state tax", "utgst", "sgst utgst"] },
  { id: "igst", label: "IGST Amount", required: false, synonyms: ["igst", "igst amount", "igst amt", "integrated tax"] },
  { id: "total", label: "Invoice Total", required: false, synonyms: ["total", "invoice total", "invoice value", "invoice amount", "total amount", "grand total", "bill amount", "bill total", "bill value", "gross amount", "net total", "amount"] },
  { id: "narration", label: "Narration", required: false, synonyms: ["narration", "remarks", "description", "note", "notes"] },
];

/** The same fields, worded for the kind of register being imported. */
export function fieldsFor(kind: KindConfig): FieldDef[] {
  const labels: Partial<Record<FieldId, string>> = { party: kind.partyLabel, invoiceNo: kind.invoiceNoLabel };
  // Only a credit or debit note points back at an original invoice.
  const fields = kind.isReturn ? FIELDS : FIELDS.filter((f) => f.id !== "originalInvoiceNo");
  return fields.map((f) => (labels[f.id] ? { ...f, label: labels[f.id]! } : f));
}

// Single words too vague to match inside a longer header ("GST Amount" is not a GST rate).
const GENERIC = new Set(["gst", "name", "value", "amount", "total", "invoice", "date", "party", "account", "ledger", "state", "pos"]);
const HEADER_SEARCH_ROWS = 15;

export const cellText = (v: unknown): string => (v === null || v === undefined ? "" : String(v).trim());
const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9%]+/g, " ").trim();

/** Guesses which column holds which field from the header text. Each column is used once. */
export function autoMap(headers: string[]): Mapping {
  return autoMapFields(headers, FIELDS);
}

/** autoMap for any set of fields, e.g. a bank statement's. */
export function autoMapFields<F extends string>(headers: string[], fields: { id: F; synonyms: string[] }[]): Partial<Record<F, number>> {
  const mapping: Partial<Record<F, number>> = {};
  const used = new Set<number>();
  const names = headers.map(normalise);

  const claim = (matches: (name: string, synonym: string) => boolean) => {
    for (const field of fields) {
      if (mapping[field.id] !== undefined) continue;
      const col = names.findIndex((name, i) => name && !used.has(i) && field.synonyms.some((s) => matches(name, s)));
      if (col >= 0) {
        mapping[field.id] = col;
        used.add(col);
      }
    }
  };
  claim((name, s) => name === s);
  claim((name, s) => !GENERIC.has(s) && ` ${name} `.includes(` ${s} `));
  return mapping;
}

/** Registers often start with a title or company name; the header is the row that looks most like one. */
export function findHeaderRow(rows: unknown[][], fields: { id: string; synonyms: string[] }[] = FIELDS): number {
  let best = 0;
  let bestScore = 0;
  rows.slice(0, HEADER_SEARCH_ROWS).forEach((row, i) => {
    const score = Object.keys(autoMapFields(row.map(cellText), fields)).length;
    if (score > bestScore) {
      best = i;
      bestScore = score;
    }
  });
  return best;
}

export function missingRequired(mapping: Mapping): string[] {
  const missing = FIELDS.filter((f) => f.required && mapping[f.id] === undefined).map((f) => f.label);
  if (mapping.taxable === undefined && mapping.total === undefined) missing.push("Taxable Value or Invoice Total");
  return missing;
}
