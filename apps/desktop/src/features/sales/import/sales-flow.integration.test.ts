// @vitest-environment happy-dom
import type { ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { fetchCompanies, fetchLedgers, fetchSalesVoucherTypes } from "../../tally/masters";
import { buildSalesVouchers, type SalesVoucher } from "./build-vouchers";
import { openSheet, sheetOf } from "./import-file";
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

describe("sales import against the dummy Tally", () => {
  let vouchers: SalesVoucher[];
  let voucherType: string;

  test("reads companies, ledgers and voucher types", async () => {
    const companies = await fetchCompanies(URL);
    expect(companies.map((c) => c.name)).toContain(COMPANY);
    const company = companies.find((c) => c.name === COMPANY)!;
    expect(company).toMatchObject({ stateName: "Maharashtra", booksFrom: "20250401" });

    const ledgers = await fetchLedgers(URL, COMPANY);
    expect(ledgers.find((l) => l.name === "ABC Traders")).toMatchObject({ parent: "Sundry Debtors", isBillWise: true });
    const voucherTypes = await fetchSalesVoucherTypes(URL, COMPANY);
    expect(voucherTypes).toEqual(["Sales", "RSPL CASH SALE"]);

    const csv = readFileSync(resolve(ROOT, "fixtures/sales-register-sample.csv"));
    const file = openSheet(await readWorkbook(new File([csv], "sales-register-sample.csv")));
    expect(file.headerRow).toBe(2);

    const settings = guessSettings(ledgers, voucherTypes);
    voucherType = settings.voucherType;
    vouchers = buildSalesVouchers({
      rows: sheetOf(file).rows, headerRow: file.headerRow, mapping: file.mapping, settings, company, ledgers, today: "20250430",
    });
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
