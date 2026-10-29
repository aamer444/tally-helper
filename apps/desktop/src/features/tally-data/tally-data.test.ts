// @vitest-environment happy-dom
import type { ChildProcess } from "node:child_process";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { formatDrCr } from "../../lib/format";
import { parseXml } from "../../lib/xml";
import { startMockTally } from "../../test/mock-tally";
import { fetchGroups, fetchLedgerBook, fetchStockItems, fetchVouchers, parseLedgers, parseVouchers } from "./tally-data";

vi.mock("@tauri-apps/plugin-http", () => import("../../test/node-http-fetch"));

// Shape of a real TallyPrime 7 reply: CMPINFO counts first, empty amounts for zero balances.
const REAL_SHAPE = `<ENVELOPE><BODY><DESC><CMPINFO><LEDGER>2</LEDGER><VOUCHER>1</VOUCHER></CMPINFO></DESC><DATA><COLLECTION>
 <LEDGER NAME="Cash" RESERVEDNAME=""><PARENT TYPE="String">&#4; Cash-in-Hand</PARENT>
  <CLOSINGBALANCE TYPE="Amount"></CLOSINGBALANCE><OPENINGBALANCE TYPE="Amount">-2500.50</OPENINGBALANCE></LEDGER>
 <VOUCHER VCHTYPE="Receipt"><DATE>20260405</DATE><VOUCHERTYPENAME>Receipt</VOUCHERTYPENAME><VOUCHERNUMBER>1</VOUCHERNUMBER>
  <LEDGERENTRIES.LIST><LEDGERNAME>Cash</LEDGERNAME><AMOUNT>-500.00</AMOUNT></LEDGERENTRIES.LIST>
  <LEDGERENTRIES.LIST><LEDGERNAME>Party</LEDGERNAME><AMOUNT>500.00</AMOUNT>
   <BILLALLOCATIONS.LIST><NAME>B1</NAME><AMOUNT>500.00</AMOUNT></BILLALLOCATIONS.LIST></LEDGERENTRIES.LIST>
 </VOUCHER></COLLECTION></DATA></BODY></ENVELOPE>`;

describe("reading Tally replies", () => {
  test("ignores the CMPINFO counts and treats an empty balance as zero", () => {
    const ledgers = parseLedgers(parseXml(REAL_SHAPE));
    expect(ledgers).toEqual([{ name: "Cash", group: "Cash-in-Hand", gstin: "", stateName: "", opening: -250050, closing: 0 }]);
  });

  test("reads invoice-view vouchers and does not count bill allocations twice", () => {
    const [v] = parseVouchers(parseXml(REAL_SHAPE));
    expect(v).toMatchObject({ date: "20260405", type: "Receipt", number: "1", amount: 50000 });
    expect(v.lines).toEqual([{ ledger: "Cash", amount: -50000 }, { ledger: "Party", amount: 50000 }]);
  });

  test("shows debit balances as Dr and credit balances as Cr", () => {
    expect([formatDrCr(-1230000), formatDrCr(90000), formatDrCr(0)]).toEqual(["12,300.00 Dr", "900.00 Cr", "–"]);
  });
});

describe("reading the dummy Tally", () => {
  const PORT = 9912;
  const URL = `http://localhost:${PORT}`;
  const COMPANY = "Demo Traders - 2025-26";
  let mock: ChildProcess;

  beforeAll(async () => {
    mock = await startMockTally(PORT);
  });
  afterAll(() => {
    mock?.kill();
  });

  test("ledgers come with balances", async () => {
    const cash = (await fetchLedgerBook(URL, COMPANY)).find((l) => l.name === "Cash");
    expect(cash).toMatchObject({ group: "Cash-in-Hand", opening: -500000, closing: -1230000 });
  });

  test("groups, stock items and vouchers", async () => {
    expect((await fetchGroups(URL, COMPANY)).find((g) => g.name === "Sundry Debtors")).toEqual({ name: "Sundry Debtors", parent: "Current Assets" });
    expect((await fetchStockItems(URL, COMPANY))[0]).toMatchObject({ name: "Item A 500g", unit: "Nos", closingQty: "120 Nos" });

    const vouchers = await fetchVouchers(URL, COMPANY, "20250401", "20260331");
    expect(vouchers.map((v) => [v.date, v.type, v.number, v.party, v.amount])).toEqual([
      ["20250405", "Sales", "INV-101", "ABC Traders", 1180000],
      ["20250410", "Payment", "12", "Om Distributors", 500000],
    ]);
    expect(vouchers[0].lines).toHaveLength(4);
  });

  test("a company that is not open gives Tally's own message", async () => {
    await expect(fetchLedgerBook(URL, "No Such Co")).rejects.toThrow("Could not set 'SVCurrentCompany'");
  });
});
