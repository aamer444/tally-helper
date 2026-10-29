// @vitest-environment happy-dom
import type { ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { fetchCompanies, fetchLedgers, fetchStockItems, fetchUnits, fetchVoucherTypes } from "../../tally/masters";
import type { Company, Ledger, StockItem } from "../../tally/types";
import { billsToImportFile } from "../pdf/bills";
import { buildVouchers, type InvoiceVoucher } from "./build-vouchers";
import { createPartyLedger, newPartyFor } from "./create-party";
import { createStockItems } from "./create-stock";
import { openSheet, sheetOf, type ImportFile } from "./import-file";
import { KINDS, type InvoiceKind } from "./kind";
import { pushVoucher } from "./push";
import { readWorkbook } from "./read-sheet";
import { guessSettings } from "./settings";
import { REPO_ROOT as ROOT, startMockTally } from "../../../test/mock-tally";

// The app talks to Tally through Tauri's HTTP plugin; in tests a plain Node request does the same job.
vi.mock("@tauri-apps/plugin-http", () => import("../../../test/node-http-fetch"));

const PORT = 9911;
const URL = `http://localhost:${PORT}`;
const COMPANY = "Demo Traders - 2025-26";
let mock: ChildProcess;

beforeAll(async () => {
  mock = await startMockTally(PORT);
});

afterAll(() => {
  mock?.kill();
});

const readFixture = async (name: string) => readWorkbook(new File([readFileSync(resolve(ROOT, "fixtures", name))], name));

function build(kind: InvoiceKind, file: ImportFile, settings: ReturnType<typeof guessSettings>, company: Company, ledgers: Ledger[], stockItems: StockItem[] = []) {
  return buildVouchers({
    kind, rows: sheetOf(file).rows, headerRow: file.headerRow, mapping: file.mapping, settings, company, ledgers, today: "20250430",
    items: file.items, stockItems,
  });
}

describe("purchase import against the dummy Tally", () => {
  test("turns a purchase register and a PDF bill into vouchers that Tally accepts", async () => {
    const company = (await fetchCompanies(URL)).find((c) => c.name === COMPANY)!;
    const ledgers = await fetchLedgers(URL, COMPANY);
    const voucherTypes = await fetchVoucherTypes(URL, COMPANY, "Purchase");
    expect(voucherTypes).toEqual(["Purchase"]);
    const settings = guessSettings(KINDS.purchase, ledgers, voucherTypes);
    expect(settings).toMatchObject({ mainLedger: "Purchase GST 18%", cgstLedger: "Input CGST 9%", igstLedger: "Input IGST 18%" });

    const register = build("purchase", openSheet(await readFixture("purchase-register-sample.csv")), settings, company, ledgers);
    expect(register.map((v) => [v.invoiceNo, v.party, v.status])).toEqual([
      ["OD/2025/91", "Om Distributors", "ready"],
      ["DF-778", "Delhi Footwear Co", "ready"],
      ["101", "Om Distributors", "ready"],
      ["101", "Laxmi Footwear Agencies", "error"],
    ]);
    expect(register[1].roundOff).toBe(-2);

    // What the PDF reader hands over for a bill: printed values, supplier found by GSTIN.
    const pdfBill = {
      fileName: "df-779.pdf", supplierName: "DELHI FOOTWEAR CO", gstins: ["07AAACD1234E1ZB", "27AAACE5678F1ZI"], gstin: "",
      invoiceNo: "DF-779", date: "15/04/2025", taxable: "10,000.00", cgst: "", sgst: "", igst: "500.00", total: "10,500.00", items: { lines: [], unit: "" },
    };
    const [fromPdf] = build("purchase", billsToImportFile([pdfBill], ledgers), settings, company, ledgers);
    expect(fromPdf).toMatchObject({ party: "Delhi Footwear Co", status: "ready", igst: 50_000 });

    for (const v of [...register.filter((x) => x.status !== "error"), fromPdf]) {
      expect(await pushVoucher(URL, COMPANY, settings.voucherType, v), v.invoiceNo).toEqual({ state: "created" });
    }
  });

  test("creates a missing supplier from review, after which its bill is ready and Tally accepts it", async () => {
    const company = (await fetchCompanies(URL)).find((c) => c.name === COMPANY)!;
    const before = await fetchLedgers(URL, COMPANY);
    const settings = guessSettings(KINDS.purchase, before, ["Purchase"]);
    const file = openSheet(await readFixture("purchase-register-sample.csv"));
    const missing = build("purchase", file, settings, company, before).find((v) => v.party === "Laxmi Footwear Agencies")!;
    expect(missing).toMatchObject({ status: "error", partyMissing: true });

    await createPartyLedger(URL, COMPANY, newPartyFor(missing));
    const after = await fetchLedgers(URL, COMPANY);
    expect(after.find((l) => l.name === "Laxmi Footwear Agencies")).toMatchObject({ parent: "Sundry Creditors", isBillWise: true });

    const fixed = build("purchase", file, settings, company, after).find((v) => v.party === "Laxmi Footwear Agencies")!;
    expect(fixed).toMatchObject({ status: "ready", partyMissing: false });
    expect(await pushVoucher(URL, COMPANY, settings.voucherType, fixed)).toEqual({ state: "created" });
  });

  test("creates a bill's missing products with a new unit, then Tally accepts the item invoice", async () => {
    const company = (await fetchCompanies(URL)).find((c) => c.name === COMPANY)!;
    const ledgers = await fetchLedgers(URL, COMPANY);
    const settings = guessSettings(KINDS.purchase, ledgers, ["Purchase"]);
    expect(settings.discountLedger).toBe("Discount Received");

    const bill = {
      fileName: "df-780.pdf", supplierName: "DELHI FOOTWEAR CO", gstins: ["07AAACD1234E1ZB"], gstin: "",
      invoiceNo: "DF-780", date: "16/04/2025", taxable: "83315.95", cgst: "", sgst: "", igst: "4165.80", total: "87481.75",
      items: {
        unit: "PAIR",
        lines: [
          { description: "EVA-SAMPLE GENTS BLACK SMALL 8X10", hsn: "64029990", qty: "240", rate: "62.00", amount: "14880.00" },
          { description: "HAWAI-SAMPLE 01 COL/MIX 4x6", hsn: "64022090", qty: "1320", rate: "55.00", amount: "72600.00" },
        ],
      },
    };
    const file = billsToImportFile([bill], ledgers);
    const [before] = build("purchase", file, settings, company, ledgers, await fetchStockItems(URL, COMPANY));
    expect(before.missingItems.map((i) => i.name)).toEqual(bill.items.lines.map((l) => l.description));
    expect(await fetchUnits(URL, COMPANY)).not.toContain("PAIR");

    await createStockItems(URL, COMPANY, before.missingItems, "PAIR", await fetchUnits(URL, COMPANY));
    expect(await fetchUnits(URL, COMPANY)).toContain("PAIR");

    const [after] = build("purchase", file, settings, company, ledgers, await fetchStockItems(URL, COMPANY));
    expect(after).toMatchObject({ status: "ready", missingItems: [], discount: 416_405 });
    expect(await pushVoucher(URL, COMPANY, settings.voucherType, after)).toEqual({ state: "created" });
  });
});

describe("sales import against the dummy Tally", () => {
  let vouchers: InvoiceVoucher[];
  let voucherType: string;

  test("reads companies, ledgers and voucher types", async () => {
    const companies = await fetchCompanies(URL);
    expect(companies.map((c) => c.name)).toContain(COMPANY);
    const company = companies.find((c) => c.name === COMPANY)!;
    expect(company).toMatchObject({ stateName: "Maharashtra", booksFrom: "20250401" });

    const ledgers = await fetchLedgers(URL, COMPANY);
    expect(ledgers.find((l) => l.name === "ABC Traders")).toMatchObject({ parent: "Sundry Debtors", isBillWise: true });
    const voucherTypes = await fetchVoucherTypes(URL, COMPANY, "Sales");
    expect(voucherTypes).toEqual(["Sales", "RSPL CASH SALE"]);

    const file = openSheet(await readFixture("sales-register-sample.csv"));
    expect(file.headerRow).toBe(2);

    const settings = guessSettings(KINDS.sales, ledgers, voucherTypes);
    voucherType = settings.voucherType;
    vouchers = build("sales", file, settings, company, ledgers);
    expect(vouchers.map((v) => [v.invoiceNo, v.status])).toEqual([
      ["INV-101", "ready"],
      ["INV-102", "ready"],
      ["INV-103", "ready"],
      ["INV-104", "error"],
      ["INV-105", "warning"],
      ["INV-106", "error"],
    ]);
    expect(vouchers[1].igst).toBe(90_000);
    expect(vouchers[2]).toMatchObject({ taxable: 350_050, rowNumbers: [6, 7] });
  });

  test("pushes every voucher without errors, and Tally accepts each one", async () => {
    for (const v of vouchers.filter((x) => x.status !== "error")) {
      expect(await pushVoucher(URL, COMPANY, voucherType, v), v.invoiceNo).toEqual({ state: "created" });
    }
  });

  test("pushing the same invoice again updates it instead of creating a duplicate", async () => {
    expect(await pushVoucher(URL, COMPANY, voucherType, vouchers[0])).toEqual({ state: "altered" });
  });

  test("reports Tally's own reason when it rejects a voucher", async () => {
    const broken = { ...vouchers[0], lines: vouchers[0].lines.map((l) => (l.role === "Party" ? { ...l, ledger: "ABC Tradrs" } : l)) };
    expect(await pushVoucher(URL, COMPANY, voucherType, broken)).toEqual({ state: "failed", message: "Ledger 'ABC Tradrs' does not exist!" });
  });
});
