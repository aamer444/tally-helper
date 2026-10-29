import { describe, expect, test, vi } from "vitest";
import { makePdf, type PdfText } from "../../../test/make-pdf";
import { billsToImportFile, readPdfBill, supplierGstin } from "./bills";
import { parseBill, toPhrases } from "./parse-bill";
import { PdfLockedError, readPdfText, type TextItem } from "./pdf-text";
import { readBills, unlockBills } from "./read-bills";

// Node has no browser worker: run pdf.js's worker code in-process, as pdf.js does in Node.
vi.mock("pdfjs-dist", async () => {
  // @ts-expect-error the worker bundle ships without type declarations
  (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  return import("pdfjs-dist/legacy/build/pdf.mjs");
});

/**
 * Laid out like a real footwear distributor's bill (made-up names and numbers): labels and values
 * sit in separate columns, the gross amount's baseline is lower than its label's, and the tax label
 * carries the rate ("igst5").
 */
const COLUMN_BILL: PdfText[][] = [
  [
    { text: "TAX INVOICE", x: 245, y: 806, size: 14 },
    { text: "SAMPLE FOOTWEAR PRIVATE LIMITED", x: 165, y: 777, size: 18 },
    { text: "Invoice Number", x: 19, y: 708 },
    { text: ":", x: 88, y: 708 },
    { text: "INV/26/0417", x: 98, y: 708 },
    { text: "GST NO", x: 168, y: 710 },
    { text: "07AAACD1234E1ZB", x: 226, y: 710 },
    { text: "Invoice Date", x: 19, y: 695 },
    { text: ":", x: 88, y: 695 },
    { text: "07/09/2026", x: 96, y: 695 },
    { text: "Sales Order Date", x: 19, y: 670 },
    { text: "01/09/2026", x: 96, y: 670 },
    { text: "GST No.", x: 18, y: 527 },
    { text: "27AAACE5678F1ZI", x: 72, y: 527 },
  ],
  [
    { text: "Total", x: 183, y: 343 },
    { text: "2131446.00", x: 538, y: 343 },
    { text: "Trade Discount@4.76%", x: 402, y: 331 },
    { text: "101456.83", x: 546, y: 331 },
    { text: "Taxable Amount In Words : (INR)", x: 24, y: 271 },
    { text: "Taxable Amount", x: 402, y: 253.3 },
    { text: "2,029,989.17", x: 538, y: 252.8 },
    { text: "igst5", x: 402, y: 240.8 },
    { text: "101499.46", x: 547, y: 240.8 },
    { text: "Bill Amount In Words : (INR)", x: 24, y: 200 },
    { text: "E & O.E.", x: 18, y: 182.8, size: 6.5 },
    { text: "Gross Amount", x: 402, y: 185.8, size: 9.4 },
    { text: "2131488.61", x: 535, y: 185.4, size: 9.4 },
  ],
];

/** A different design: values inline after their labels, CGST + SGST, a split "Bill No." label. */
const INLINE_BILL: PdfText[][] = [
  [
    { text: "Om Distributors", x: 40, y: 800, size: 16 },
    { text: "GSTIN: 27CCCCC2222C1Z7", x: 40, y: 780 },
    { text: "Bill", x: 40, y: 750 },
    { text: "No.", x: 55.5, y: 750 },
    { text: "OD/2025/91", x: 120, y: 750 },
    { text: "Dated: 5-Apr-2026", x: 300, y: 750 },
    { text: "Item", x: 40, y: 600 },
    { text: "CGST Rate", x: 300, y: 600 },
    { text: "Taxable Value", x: 300, y: 200 },
    { text: "10,000.00", x: 480, y: 200 },
    { text: "CGST @ 9%", x: 300, y: 185 },
    { text: "900.00", x: 480, y: 185 },
    { text: "SGST @ 9%", x: 300, y: 170 },
    { text: "900.00", x: 480, y: 170 },
    { text: "Grand Total Rs. 11,800.00", x: 300, y: 150 },
  ],
];

const pdfFile = (pages: PdfText[][], name: string, password?: string) =>
  new File([makePdf(pages, { userPassword: password })], name, { type: "application/pdf" });

describe("reading supplier bills of different designs", () => {
  test("finds values in a separate column, even on a slightly different baseline", async () => {
    const bill = await readPdfBill(pdfFile(COLUMN_BILL, "sample-bill.pdf"));
    expect(bill).toEqual({
      fileName: "sample-bill.pdf",
      supplierName: "SAMPLE FOOTWEAR PRIVATE LIMITED",
      gstins: ["07AAACD1234E1ZB", "27AAACE5678F1ZI"],
      gstin: "",
      invoiceNo: "INV/26/0417",
      date: "07/09/2026",
      taxable: "2,029,989.17",
      cgst: "",
      sgst: "",
      igst: "101499.46",
      total: "2131488.61",
      items: { lines: [], unit: "" },
    });
  });

  test("reads inline values, joins split labels and skips table headings", async () => {
    const bill = await readPdfBill(pdfFile(INLINE_BILL, "om.pdf"));
    expect(bill).toMatchObject({
      supplierName: "Om Distributors",
      gstins: ["27CCCCC2222C1Z7"],
      invoiceNo: "OD/2025/91",
      date: "5-Apr-2026",
      taxable: "10,000.00",
      cgst: "900.00",
      sgst: "900.00",
      igst: "",
      total: "11,800.00",
    });
  });

  test("says so when a PDF has no text (a scan)", async () => {
    await expect(readPdfBill(pdfFile([[]], "scan.pdf"))).rejects.toThrow("no text");
  });
});

describe("password-protected PDFs", () => {
  const locked = () => makePdf(COLUMN_BILL, { userPassword: "test1234" });

  test("asks for the password, rejects a wrong one, and opens with the right one", async () => {
    await expect(readPdfText(locked())).rejects.toMatchObject({ wrongPassword: false });
    await expect(readPdfText(locked(), "wrong")).rejects.toBeInstanceOf(PdfLockedError);
    await expect(readPdfText(locked(), "wrong")).rejects.toMatchObject({ wrongPassword: true });

    const { items } = await readPdfText(locked(), "test1234");
    expect(items.map((i) => i.text)).toContain("2131488.61");
  });

  test("reads the bill once unlocked", async () => {
    const bill = await readPdfBill(pdfFile(COLUMN_BILL, "locked.pdf", "test1234"), "test1234");
    expect(bill.total).toBe("2131488.61");
  });
});

describe("reading several bills at once", () => {
  test("keeps locked and unreadable files aside, and one password unlocks every file that shares it", async () => {
    const open = pdfFile(INLINE_BILL, "open.pdf");
    const lockedA = pdfFile(COLUMN_BILL, "locked-a.pdf", "test1234");
    const lockedB = pdfFile(COLUMN_BILL, "locked-b.pdf", "test1234");
    const scan = pdfFile([[]], "scan.pdf");

    const batch = await readBills([open, lockedA, lockedB, scan]);
    expect(batch.bills.map((b) => b.fileName)).toEqual(["open.pdf"]);
    expect(batch.locked.map((l) => l.file.name)).toEqual(["locked-a.pdf", "locked-b.pdf"]);
    expect(batch.failed).toEqual([{ fileName: "scan.pdf", message: expect.stringContaining("no text") }]);

    const wrong = await unlockBills(batch, lockedA, "nope");
    expect(wrong.locked).toEqual([
      { file: lockedA, wrongPassword: true },
      { file: lockedB, wrongPassword: false },
    ]);

    const unlocked = await unlockBills(wrong, lockedA, "test1234");
    expect(unlocked.locked).toEqual([]);
    expect(unlocked.bills.map((b) => b.fileName)).toEqual(["open.pdf", "locked-a.pdf", "locked-b.pdf"]);
  });
});

describe("product lines", () => {
  // Columns: S.No, HSN, description, cartons, qty, MRP, rate, amount. Only qty × rate = amount says which is which.
  const ITEM_BILL: PdfText[][] = [
    [
      { text: "Description", x: 100, y: 660 },
      { text: "Rate / (PAIR)", x: 420, y: 660 },
      { text: "1", x: 20, y: 600 }, { text: "64029990", x: 40, y: 600 }, { text: "EVA-SAMPLE GENTS BLACK SMALL", x: 100, y: 600 },
      { text: "2", x: 300, y: 600 }, { text: "240", x: 340, y: 600 }, { text: "186", x: 380, y: 600 }, { text: "62.00", x: 420, y: 600 }, { text: "14880.00", x: 500, y: 600 },
      { text: "8X10", x: 100, y: 588 },
      { text: "HAWAI FOOTWEARS", x: 200, y: 575 },
      { text: "2", x: 20, y: 562 }, { text: "64022090", x: 40, y: 562 }, { text: "HAWAI-SAMPLE 01 COL/MIX 4x6", x: 100, y: 562 },
      { text: "10", x: 300, y: 562 }, { text: "1320", x: 340, y: 562 }, { text: "165", x: 380, y: 562 }, { text: "55.00", x: 420, y: 562 }, { text: "72600.00", x: 500, y: 562 },
      { text: "Total", x: 183, y: 540 }, { text: "12", x: 300, y: 540 }, { text: "1560", x: 340, y: 540 }, { text: "87480.00", x: 500, y: 540 },
    ],
  ];

  test("finds each product whatever the columns, joins wrapped names and skips headings and totals", async () => {
    const bill = await readPdfBill(pdfFile(ITEM_BILL, "items.pdf"));
    expect(bill.items).toEqual({
      unit: "PAIR",
      lines: [
        { description: "EVA-SAMPLE GENTS BLACK SMALL 8X10", hsn: "64029990", qty: "240", rate: "62.00", amount: "14880.00" },
        { description: "HAWAI-SAMPLE 01 COL/MIX 4x6", hsn: "64022090", qty: "1320", rate: "55.00", amount: "72600.00" },
      ],
    });
  });
});

describe("toPhrases", () => {
  const item = (text: string, x: number, w: number): TextItem => ({ text, x, w, y: 100, h: 9, page: 1 });

  test("joins words a PDF stored separately but keeps columns apart", () => {
    const phrases = toPhrases([item("Invoice", 10, 30), item("No.", 42, 12), item("123", 120, 15)]);
    expect(phrases.map((p) => p.text)).toEqual(["Invoice No.", "123"]);
  });

  test("reads '#' invoice labels and keeps supplier names that contain filter words", () => {
    const bill = parseBill(
      [
        { text: "Mobile World Traders", x: 10, w: 120, y: 800, h: 16, page: 1 },
        { text: "Invoice # 4521", x: 10, w: 70, y: 700, h: 9, page: 1 },
      ],
      "x.pdf",
    );
    expect(bill).toMatchObject({ supplierName: "Mobile World Traders", invoiceNo: "4521" });
  });

  test("ignores labels for amounts in words", () => {
    const bill = parseBill([item("Bill Amount In Words", 10, 80), item("(INR)", 95, 20), item("Twenty only", 200, 50)], "x.pdf");
    expect(bill.total).toBe("");
  });
});

describe("bills as a purchase register", () => {
  const bill = {
    fileName: "a.pdf", supplierName: "Sample Footwear", gstins: ["27AAACE5678F1ZI", "07AAACD1234E1ZB"], gstin: "",
    invoiceNo: "INV-1", date: "07/09/2026", taxable: "100.00", cgst: "", sgst: "", igst: "5.00", total: "105.00", items: { lines: [], unit: "" },
  };

  test("takes the GSTIN that belongs to a supplier in Tally, unless the user picked one", () => {
    expect(supplierGstin(bill, new Set(["07AAACD1234E1ZB"]))).toBe("07AAACD1234E1ZB");
    expect(supplierGstin(bill, new Set())).toBe("27AAACE5678F1ZI");
    expect(supplierGstin({ ...bill, gstin: "07AAACD1234E1ZB" }, new Set())).toBe("07AAACD1234E1ZB");
  });

  test("puts one bill on each row under fixed headings", () => {
    const file = billsToImportFile([bill], []);
    expect(file.workbook.sheets[0].rows[1]).toEqual(["a.pdf", "Sample Footwear", "27AAACE5678F1ZI", "INV-1", "07/09/2026", "100.00", "", "", "5.00", "105.00"]);
    expect(file.mapping).toMatchObject({ party: 1, invoiceNo: 3, total: 9 });
  });
});
