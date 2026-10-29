import { describe, expect, test } from "vitest";
import type { Company, Ledger } from "../../tally/types";
import { buildSalesVouchers, type BuildInput, type SalesSettings } from "./build-vouchers";
import { autoMap, findHeaderRow, missingRequired } from "./fields";
import { isValidGstin, stateCodeOf } from "./gst";
import { guessSettings } from "./settings";
import { salesVoucherXml } from "./voucher-xml";

const company: Company = { name: "Demo Traders", guid: "g-1", stateName: "Maharashtra", booksFrom: "20250401" };

const ledger = (name: string, parent: string, extra: Partial<Ledger> = {}): Ledger => ({
  name, parent, gstin: "", stateName: "", isBillWise: false, ...extra,
});

const ledgers: Ledger[] = [
  ledger("ABC Traders", "Sundry Debtors", { gstin: "27AAPFU0939F1ZV", isBillWise: true }),
  ledger("Delhi Mart", "Sundry Debtors", { stateName: "Delhi" }),
  ledger("Sales GST 18%", "Sales Accounts"),
  ledger("Sales Return 18%", "Sales Accounts"),
  ledger("Input CGST 9%", "Duties & Taxes"),
  ledger("Output CGST 9%", "Duties & Taxes"),
  ledger("Output SGST 9%", "Duties & Taxes"),
  ledger("Output IGST 18%", "Duties & Taxes"),
  ledger("Round Off", "Indirect Expenses"),
];

const settings: SalesSettings = {
  voucherType: "Sales",
  salesLedger: "Sales GST 18%",
  cgstLedger: "Output CGST 9%",
  sgstLedger: "Output SGST 9%",
  igstLedger: "Output IGST 18%",
  roundOffLedger: "Round Off",
};

const HEADER = ["Date", "Invoice No", "Party Name", "Taxable Value", "GST %", "Total"];

function build(rows: unknown[][], overrides: Partial<BuildInput> = {}) {
  const all = [HEADER, ...rows];
  return buildSalesVouchers({
    rows: all, headerRow: 0, mapping: autoMap(HEADER), settings, company, ledgers, today: "20251231", ...overrides,
  });
}

const balance = (v: { lines: { debit: number; credit: number }[] }) =>
  v.lines.reduce((acc, l) => acc + l.debit - l.credit, 0);

describe("autoMap", () => {
  test("matches common header spellings", () => {
    const m = autoMap(["Inv. No.", "Bill Date", "Customer Name", "GSTIN/UIN", "Taxable Value (Rs)", "CGST Amt", "SGST Amt", "IGST Amt", "Invoice Value"]);
    expect(m).toEqual({ invoiceNo: 0, date: 1, party: 2, gstin: 3, taxable: 4, cgst: 5, sgst: 6, igst: 7, total: 8 });
  });

  test("does not treat a tax amount column as the GST rate", () => {
    expect(autoMap(["GST Amount"]).gstRate).toBeUndefined();
  });

  test("finds the header below a title row", () => {
    expect(findHeaderRow([["Demo Traders - Sales Register April"], [], HEADER, ["01-04-2025"]])).toBe(2);
  });

  test("asks for a taxable value or total", () => {
    expect(missingRequired({ date: 0, invoiceNo: 1, party: 2 })).toEqual(["Taxable Value or Invoice Total"]);
  });
});

describe("gst helpers", () => {
  test("validates the GSTIN check digit", () => {
    expect(isValidGstin("27AAPFU0939F1ZV")).toBe(true);
    expect(isValidGstin("27AAPFU0939F1ZW")).toBe(false);
  });

  test("reads state from names and codes", () => {
    expect(stateCodeOf("Maharashtra")).toBe("27");
    expect(stateCodeOf("27-Maharashtra")).toBe("27");
    expect(stateCodeOf("Dadra & Nagar Haveli and Daman & Diu")).toBe("26");
    expect(stateCodeOf("Atlantis")).toBeNull();
  });
});

describe("buildSalesVouchers", () => {
  test("splits intra-state GST into CGST and SGST and balances", () => {
    const [v] = build([["05/04/2025", "INV-1", "abc traders", "10,000", "18", "11800"]]);
    expect(v.status).toBe("ready");
    expect(v.party).toBe("ABC Traders"); // Tally's spelling, not the file's
    expect({ cgst: v.cgst, sgst: v.sgst, igst: v.igst, total: v.total }).toEqual({ cgst: 90_000, sgst: 90_000, igst: 0, total: 1_180_000 });
    expect(v.lines[0]).toMatchObject({ ledger: "ABC Traders", debit: 1_180_000, billRef: "INV-1" });
    expect(balance(v)).toBe(0);
  });

  test("uses IGST when the customer is in another state", () => {
    const [v] = build([["05/04/2025", "INV-2", "Delhi Mart", "10000", "18", ""]]);
    expect({ cgst: v.cgst, igst: v.igst }).toEqual({ cgst: 0, igst: 180_000 });
    expect(v.lines.map((l) => l.ledger)).toContain("Output IGST 18%");
  });

  test("adds a round-off line for a small gap to the file's total", () => {
    const [v] = build([["05/04/2025", "INV-3", "ABC Traders", "1000.40", "18", "1180"]]);
    expect(v.roundOff).toBe(-48); // 1000.40 + 2 × 90.04 = 1180.48, rounded down to 1180
    expect(v.lines.find((l) => l.role === "Round Off")).toMatchObject({ debit: 48, credit: 0 });
    expect(balance(v)).toBe(0);
  });

  test("works out the taxable value from a GST-inclusive total", () => {
    const [v] = build([["05/04/2025", "INV-4", "ABC Traders", "", "18", "1180"]]);
    expect({ taxable: v.taxable, tax: v.cgst + v.sgst, total: v.total }).toEqual({ taxable: 100_000, tax: 18_000, total: 118_000 });
  });

  test("merges rows of the same invoice into one voucher", () => {
    const vouchers = build([
      ["05/04/2025", "INV-5", "ABC Traders", "1000", "18", ""],
      ["05/04/2025", "INV-5", "ABC Traders", "500", "18", ""],
    ]);
    expect(vouchers).toHaveLength(1);
    expect(vouchers[0]).toMatchObject({ taxable: 150_000, total: 177_000, rowNumbers: [2, 3] });
  });

  test("skips blank and total rows", () => {
    const vouchers = build([["05/04/2025", "INV-6", "ABC Traders", "100", "0", ""], ["", "", "", "", "", ""], ["", "Grand Total", "", "100", "", ""]]);
    expect(vouchers).toHaveLength(1);
  });

  test.each([
    [["05/04/2025", "INV-7", "Unknown Party", "100", "18", ""], "is not a ledger in Tally"],
    [["01/03/2025", "INV-8", "ABC Traders", "100", "18", ""], "before the company's books begin"],
    [["32/04/2025", "INV-9", "ABC Traders", "100", "18", ""], "is not a date"],
    [["05/04/2025", "INV-10", "ABC Traders", "1000", "18", "1500"], "does not match"],
    [["05/04/2025", "INV-11", "ABC Traders", "ten", "18", ""], "is not a number"],
  ])("blocks %j with an error", (row, message) => {
    const [v] = build([row]);
    expect(v.status).toBe("error");
    expect(v.issues.map((i) => i.message).join(" | ")).toContain(message);
  });

  test("flags the same invoice number with different parties", () => {
    const [v] = build([
      ["05/04/2025", "INV-12", "ABC Traders", "100", "0", ""],
      ["05/04/2025", "INV-12", "Delhi Mart", "100", "0", ""],
    ]);
    expect(v.issues[0].message).toContain("different parties");
  });

  test("asks for a tax ledger that was not chosen", () => {
    const [v] = build([["05/04/2025", "INV-13", "Delhi Mart", "100", "18", ""]], { settings: { ...settings, igstLedger: "" } });
    expect(v.issues.map((i) => i.message)).toContain("Choose a IGST ledger in step 2 (Map Columns)");
  });

  test("gives the same REMOTEID for the same company and invoice, so a re-push cannot duplicate", () => {
    const [a] = build([["05/04/2025", "INV-14", "ABC Traders", "100", "0", ""]]);
    const [b] = build([["06/04/2025", "inv-14", "ABC Traders", "200", "0", ""]]);
    expect(a.remoteId).toBe(b.remoteId);
    expect(a.remoteId).toMatch(/^th-sales-[0-9a-f]{8}$/);
  });
});

describe("guessSettings", () => {
  test("picks output tax ledgers and skips input and return ledgers", () => {
    expect(guessSettings(ledgers, ["Sales", "Cash Sale"])).toEqual(settings);
  });
});

describe("salesVoucherXml", () => {
  test("writes debits negative, credits positive, and escapes names", () => {
    const [v] = build([["05/04/2025", "INV-15", "ABC Traders", "10000", "18", ""]]);
    const xml = salesVoucherXml({ ...v, narration: "R&D <sample>" }, "Sales");
    expect(xml).toContain('REMOTEID="th-sales-');
    expect(xml).toContain("<DATE>20250405</DATE>");
    expect(xml).toContain("<LEDGERNAME>ABC Traders</LEDGERNAME><ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE><AMOUNT>-11800.00</AMOUNT>");
    expect(xml).toContain("<BILLTYPE>New Ref</BILLTYPE><AMOUNT>-11800.00</AMOUNT>");
    expect(xml).toContain("<LEDGERNAME>Output CGST 9%</LEDGERNAME><ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE><AMOUNT>900.00</AMOUNT>");
    expect(xml).toContain("<NARRATION>R&amp;D &lt;sample&gt;</NARRATION>");
  });
});
