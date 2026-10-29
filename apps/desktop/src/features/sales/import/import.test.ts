import { describe, expect, test } from "vitest";
import type { Company, Ledger } from "../../tally/types";
import { buildVouchers, type BuildInput, type InvoiceSettings } from "./build-vouchers";
import { autoMap, findHeaderRow, missingRequired } from "./fields";
import { isValidGstin, stateCodeOf } from "./gst";
import { KINDS } from "./kind";
import { partyKey, similarity } from "./party-match";
import { guessSettings } from "./settings";
import { voucherXml } from "./voucher-xml";

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

const settings: InvoiceSettings = {
  voucherType: "Sales",
  mainLedger: "Sales GST 18%",
  cgstLedger: "Output CGST 9%",
  sgstLedger: "Output SGST 9%",
  igstLedger: "Output IGST 18%",
  roundOffLedger: "Round Off",
  discountLedger: "",
  withStock: true,
};

const HEADER = ["Date", "Invoice No", "Party Name", "Taxable Value", "GST %", "Total"];

function build(rows: unknown[][], overrides: Partial<BuildInput> = {}) {
  const all = [HEADER, ...rows];
  return buildVouchers({
    kind: "sales", rows: all, headerRow: 0, mapping: autoMap(HEADER), settings, company, ledgers, today: "20251231", ...overrides,
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

describe("buildVouchers", () => {
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
    expect(v.issues.map((i) => i.message)).toContain("Choose a IGST ledger in step 2");
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
    expect(guessSettings(KINDS.sales, ledgers, ["Sales", "Cash Sale"])).toEqual(settings);
  });

  test("picks input tax ledgers and a purchase account for purchases", () => {
    expect(guessSettings(KINDS.purchase, purchaseLedgers, ["Purchase"])).toEqual(purchaseSettings);
  });
});

const purchaseLedgers: Ledger[] = [
  ...ledgers,
  ledger("Sample Footwear Pvt Ltd", "Sundry Creditors", { gstin: "07AAACD1234E1ZB", stateName: "Delhi", isBillWise: true }),
  ledger("Om Distributors", "Sundry Creditors", { gstin: "27AAACE5678F1ZI" }),
  ledger("Purchase GST 5%", "Purchase Accounts"),
  ledger("Purchase Return 5%", "Purchase Accounts"),
  ledger("Input SGST 9%", "Duties & Taxes"),
  ledger("Input IGST", "Duties & Taxes"),
  ledger("Discount Received", "Indirect Incomes"),
  ledger("kgn1", "Sundry Creditors"),
  ledger("KGN Traders", "Sundry Creditors"),
];

const purchaseSettings: InvoiceSettings = {
  voucherType: "Purchase",
  mainLedger: "Purchase GST 5%",
  cgstLedger: "Input CGST 9%",
  sgstLedger: "Input SGST 9%",
  igstLedger: "Input IGST",
  roundOffLedger: "Round Off",
  discountLedger: "Discount Received",
  withStock: true,
};

const BILL_HEADER = ["Supplier", "GSTIN", "Bill No", "Bill Date", "Taxable Value", "CGST", "SGST", "IGST", "Bill Total"];

function buildPurchases(rows: unknown[][], extra: Partial<BuildInput> = {}) {
  return buildVouchers({
    kind: "purchase", rows: [BILL_HEADER, ...rows], headerRow: 0, mapping: autoMap(BILL_HEADER),
    settings: purchaseSettings, company, ledgers: purchaseLedgers, today: "20261231", ...extra,
  });
}

describe("parties named differently on bills", () => {
  const row = (name: string) => [name, "", "K-1", "05/04/2026", "1000", "90", "90", "", "1180"];

  test("suggests similar ledgers but does not pick one on its own", () => {
    const [v] = buildPurchases([row("KGN")]);
    expect(v).toMatchObject({ status: "error", partyMissing: true, partyOnBill: "KGN" });
    expect(v.partySuggestions.slice(0, 2)).toEqual(["kgn1", "KGN Traders"]);
  });

  test("uses the ledger the user linked the bill's name to", () => {
    const [v] = buildPurchases([row("M/s. KGN")], { partyAliases: new Map([[partyKey("KGN"), "kgn1"]]) });
    expect(v).toMatchObject({ status: "ready", party: "kgn1", partyMissing: false });
  });

  test("ignores capitals and spaces in names", () => {
    expect(similarity("kGn  Traders", "KGN TRADERS")).toBe(1);
  });
});

describe("item invoices from bills with product lines", () => {
  const items = (lines: { description: string; qty: string; rate: string; amount: string }[]) =>
    new Map([[2, { unit: "PAIR", lines: lines.map((l) => ({ hsn: "64029990", ...l })) }]]);
  const products = [
    { description: "EVA-ASHA LADIES BLACK 5x7", qty: "240", rate: "62.00", amount: "14880.00" },
    { description: "HAWAI-HEALTH GENTS COL/MIX 4x6", qty: "1320", rate: "55.00", amount: "72600.00" },
  ];
  // Products 87,480.00, less 4.76% trade discount 4,164.05 = taxable 83,315.95; IGST 5% 4,165.80.
  const bill = ["Sample Footwear Pvt Ltd", "07AAACD1234E1ZB", "INV-7", "07/09/2026", "83315.95", "", "", "4165.80", "87481.75"];
  const stockItems = products.map((p) => ({ name: p.description, baseUnits: "PAIR" }));

  test("books each product as stock and the bill's discount on its own line", () => {
    const [v] = buildPurchases([bill], { items: items(products), stockItems });
    expect(v.status).toBe("ready");
    expect(v.items).toEqual([
      { name: "EVA-ASHA LADIES BLACK 5x7", qty: 240, unit: "PAIR", rate: 62, amount: 1_488_000 },
      { name: "HAWAI-HEALTH GENTS COL/MIX 4x6", qty: 1320, unit: "PAIR", rate: 55, amount: 7_260_000 },
    ]);
    expect(v.discount).toBe(416_405);
    expect(v.lines.map((l) => [l.role, l.debit, l.credit])).toEqual([
      ["Party", 0, 8_748_175],
      ["Purchase", 8_748_000, 0],
      ["IGST", 416_580, 0],
      ["Discount", 0, 416_405],
    ]);
    expect(balance(v)).toBe(0);
  });

  test("matches stock items whatever the capitals, and lists the ones Tally does not have", () => {
    const [v] = buildPurchases([bill], { items: items(products), stockItems: [{ name: "eva-asha ladies black 5X7", baseUnits: "Pair" }] });
    expect(v.items[0]).toMatchObject({ name: "eva-asha ladies black 5X7", unit: "Pair" });
    expect(v.missingItems).toEqual([{ name: "HAWAI-HEALTH GENTS COL/MIX 4x6", hsn: "64029990", unit: "PAIR" }]);
    expect(v.issues.map((i) => i.message)).toContain("1 product is not a stock item in Tally. Create it here.");
  });

  test("writes an item invoice: stock lines carry the purchase ledger, other lines stay ledger entries", () => {
    const [v] = buildPurchases([bill], { items: items(products), stockItems });
    const xml = voucherXml(v, "Purchase");
    expect(xml).toContain('OBJVIEW="Invoice Voucher View"');
    expect(xml).toContain("<VCHENTRYMODE>Item Invoice</VCHENTRYMODE>");
    expect(xml).toContain(
      "<ALLINVENTORYENTRIES.LIST><STOCKITEMNAME>EVA-ASHA LADIES BLACK 5x7</STOCKITEMNAME><ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE><RATE>62.00/PAIR</RATE><AMOUNT>-14880.00</AMOUNT><ACTUALQTY> 240 PAIR</ACTUALQTY>",
    );
    expect(xml).toContain("<ACCOUNTINGALLOCATIONS.LIST><LEDGERNAME>Purchase GST 5%</LEDGERNAME>");
    expect(xml).toContain("<LEDGERENTRIES.LIST><LEDGERNAME>Discount Received</LEDGERNAME><ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE><AMOUNT>4164.05</AMOUNT>");
    expect(xml).not.toContain("<ALLLEDGERENTRIES.LIST><LEDGERNAME>Purchase GST 5%");
  });

  test("stays an accounting invoice when the user turns stock off", () => {
    const [v] = buildPurchases([bill], { items: items(products), stockItems, settings: { ...purchaseSettings, withStock: false } });
    expect(v.items).toEqual([]);
    expect(voucherXml(v, "Purchase")).toContain('OBJVIEW="Accounting Voucher View"');
  });

  test("flags products that add up to less than the taxable value", () => {
    const [v] = buildPurchases([bill], { items: items(products.slice(0, 1)), stockItems });
    expect(v.issues.map((i) => i.message).join(" | ")).toContain("less than the taxable value");
  });
});

describe("purchase vouchers", () => {
  // The amounts of a real footwear bill: the supplier's own rounding leaves it 2 paise short.
  const bill = ["SAMPLE FOOTWEAR PRIVATE LIMITED", "07AAACD1234E1ZB", "INV/26/0417", "07/09/2026", "2,029,989.17", "", "", "101499.46", "2131488.61"];

  test("debits purchase and input tax, credits the supplier, and rounds off the supplier's paise", () => {
    const [v] = buildPurchases([bill]);
    expect(v.status).toBe("ready");
    expect(v.party).toBe("Sample Footwear Pvt Ltd"); // matched by GSTIN, not the printed name
    expect(v.lines).toEqual([
      { role: "Party", ledger: "Sample Footwear Pvt Ltd", debit: 0, credit: 213_148_861, billRef: "INV/26/0417" },
      { role: "Purchase", ledger: "Purchase GST 5%", debit: 202_998_917, credit: 0 },
      { role: "IGST", ledger: "Input IGST", debit: 10_149_946, credit: 0 },
      { role: "Round Off", ledger: "Round Off", debit: 0, credit: 2 },
    ]);
    expect(balance(v)).toBe(0);
    expect(v.narration).toBe("Purchase as per bill INV/26/0417");
    expect(v.remoteId).toMatch(/^th-purc-[0-9a-f]{8}$/);
  });

  test("keeps two suppliers' bills with the same number apart", () => {
    const vouchers = buildPurchases([
      ["Om Distributors", "27AAACE5678F1ZI", "101", "05/04/2026", "1000", "90", "90", "", "1180"],
      ["Sample Footwear Pvt Ltd", "07AAACD1234E1ZB", "101", "05/04/2026", "1000", "", "", "50", "1050"],
    ]);
    expect(vouchers.map((v) => v.party)).toEqual(["Om Distributors", "Sample Footwear Pvt Ltd"]);
    expect(vouchers[0].remoteId).not.toBe(vouchers[1].remoteId);
  });

  test("judges inter-state from the supplier's GSTIN, not the bill's place of supply", () => {
    const [v] = buildPurchases([["Om Distributors", "27AAACE5678F1ZI", "102", "05/04/2026", "1000", "", "", "50", "1050"]]);
    expect(v.issues.map((i) => i.message)).toContain("IGST charged, but the supplier is in the same state (should be CGST + SGST)");
  });

  test("trusts the matched supplier's state when the bill's first GSTIN is our own", () => {
    const ourGstin = "27AAAFG0000B1ZK"; // Maharashtra, like the company; the supplier ledger is in Delhi
    const [v] = buildPurchases([["Sample Footwear Pvt Ltd", ourGstin, "INV-9", "07/09/2026", "1000", "", "", "50", "1050"]]);
    expect(v.party).toBe("Sample Footwear Pvt Ltd");
    expect(v.issues.map((i) => i.message).join(" | ")).not.toContain("same state");
  });

  test("joins one supplier's rows into one bill whether or not a row has the GSTIN", () => {
    const vouchers = buildPurchases([
      ["Sample Footwear Pvt Ltd", "07AAACD1234E1ZB", "B-5", "05/04/2026", "1000", "", "", "50", ""],
      ["Sample Footwear Pvt Ltd", "", "B-5", "05/04/2026", "500", "", "", "25", ""],
    ]);
    expect(vouchers).toHaveLength(1);
    expect(vouchers[0]).toMatchObject({ taxable: 150_000, igst: 7_500 });
  });

  test("sends the supplier's bill number as REFERENCE and leaves voucher numbering to Tally", () => {
    const [v] = buildPurchases([bill]);
    const xml = voucherXml(v, "Purchase");
    expect(xml).toContain("<REFERENCE>INV/26/0417</REFERENCE><REFERENCEDATE>20260907</REFERENCEDATE>");
    expect(xml).not.toContain("<VOUCHERNUMBER>");
    expect(xml).toContain("<LEDGERNAME>Sample Footwear Pvt Ltd</LEDGERNAME><ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE><AMOUNT>2131488.61</AMOUNT>");
    expect(xml).toContain("<LEDGERNAME>Input IGST</LEDGERNAME><ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE><AMOUNT>-101499.46</AMOUNT>");
  });
});

describe("voucherXml", () => {
  test("writes debits negative, credits positive, and escapes names", () => {
    const [v] = build([["05/04/2025", "INV-15", "ABC Traders", "10000", "18", ""]]);
    const xml = voucherXml({ ...v, narration: "R&D <sample>" }, "Sales");
    expect(xml).toContain('REMOTEID="th-sales-');
    expect(xml).toContain("<DATE>20250405</DATE>");
    expect(xml).toContain("<LEDGERNAME>ABC Traders</LEDGERNAME><ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE><AMOUNT>-11800.00</AMOUNT>");
    expect(xml).toContain("<BILLTYPE>New Ref</BILLTYPE><AMOUNT>-11800.00</AMOUNT>");
    expect(xml).toContain("<LEDGERNAME>Output CGST 9%</LEDGERNAME><ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE><AMOUNT>900.00</AMOUNT>");
    expect(xml).toContain("<NARRATION>R&amp;D &lt;sample&gt;</NARRATION>");
  });
});
