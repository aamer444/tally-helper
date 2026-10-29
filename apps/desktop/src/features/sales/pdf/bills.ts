import type { Ledger } from "../../tally/types";
import type { Mapping } from "../import/fields";
import type { ImportFile } from "../import/import-file";
import { parseBill, type PdfBill } from "./parse-bill";
import { readPdfText } from "./pdf-text";

const MAX_FILE_BYTES = 20 * 1024 * 1024;

export const BILL_HEADERS = ["File", "Supplier", "GSTIN", "Bill No", "Bill Date", "Taxable Value", "CGST", "SGST", "IGST", "Bill Total"];
const BILL_MAPPING: Mapping = { party: 1, gstin: 2, invoiceNo: 3, date: 4, taxable: 5, cgst: 6, sgst: 7, igst: 8, total: 9 };

export async function readPdfBill(file: File, password?: string): Promise<PdfBill> {
  if (file.size > MAX_FILE_BYTES) throw new Error("This PDF is larger than 20 MB.");
  const { items } = await readPdfText(new Uint8Array(await file.arrayBuffer()), password);
  if (!items.length) throw new Error("This PDF has no text in it (it is probably a scan). Scanned bills cannot be read yet.");
  return parseBill(items, file.name);
}

/** The GSTIN the user picked; otherwise the first one on the bill that belongs to a Tally ledger; otherwise the first one. */
export function supplierGstin(bill: PdfBill, ledgerGstins: ReadonlySet<string>): string {
  return bill.gstin || bill.gstins.find((g) => ledgerGstins.has(g)) || bill.gstins[0] || "";
}

/**
 * Lays the bills out like a purchase register, one row per bill, so they go through exactly the
 * same checks, review and push as an Excel file.
 */
export function billsToImportFile(bills: PdfBill[], ledgers: Ledger[]): ImportFile {
  const known = new Set(ledgers.map((l) => l.gstin).filter(Boolean));
  const rows = bills.map((b) => [b.fileName, b.supplierName, supplierGstin(b, known), b.invoiceNo, b.date, b.taxable, b.cgst, b.sgst, b.igst, b.total]);
  return {
    workbook: { fileName: bills.length === 1 ? bills[0].fileName : `${bills.length} PDF bills`, sheets: [{ name: "Bills", rows: [BILL_HEADERS, ...rows] }] },
    sheetIndex: 0,
    headerRow: 0,
    mapping: BILL_MAPPING,
    // Row 1 holds the headings, so bill i is on row i + 2.
    items: new Map(bills.map((b, i) => [i + 2, b.items])),
  };
}
