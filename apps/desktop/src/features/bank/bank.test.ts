import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { REPO_ROOT } from "../../test/mock-tally";
import { readWorkbook } from "../sales/import/read-sheet";
import type { TextItem } from "../sales/pdf/pdf-text";
import type { VoucherRow } from "../tally-data/tally-data";
import type { Company, Ledger } from "../tally/types";
import { bankVoucherXml, buildBankEntries, type BankBuildInput } from "./bank-vouchers";
import { classify, instrumentOf, narrationKey } from "./classify";
import { matchInTally } from "./in-tally";
import { statementFromText } from "./pdf-statement";
import { checkBalances, openStatement, readStatement, type StatementFile } from "./statement";

const company: Company = { name: "Demo Traders", guid: "g-1", stateName: "Maharashtra", booksFrom: "20250401" };
const ledger = (name: string, parent: string, extra: Partial<Ledger> = {}): Ledger => ({ name, parent, gstin: "", stateName: "", isBillWise: false, ...extra });
const ledgers: Ledger[] = [
  ledger("SBI Current A/c", "Bank Accounts"),
  ledger("HDFC CC A/c", "Bank OD A/c"),
  ledger("Cash", "Cash-in-Hand"),
  ledger("ABC Traders", "Sundry Debtors", { isBillWise: true }),
  ledger("XYZ Agencies", "Sundry Debtors"),
  ledger("Om Distributors", "Sundry Creditors"),
  ledger("Bank Charges", "Indirect Expenses"),
  ledger("Suspense A/c", "Suspense A/c"),
];
const ctx = { bankLedger: "SBI Current A/c", ledgers, learned: new Map<string, string>() };

const sample = async (): Promise<StatementFile> => {
  const name = "bank-statement-sample.csv";
  return openStatement(await readWorkbook(new File([readFileSync(resolve(REPO_ROOT, "fixtures", name))], name)));
};
const sheet = (rows: unknown[][]): StatementFile => openStatement({ fileName: "t.csv", sheets: [{ name: "S", rows }] });

describe("reading a statement", () => {
  test("finds the headings under the title rows and reads every line oldest first", async () => {
    const file = await sample();
    expect(file.headerRow).toBe(2);
    expect(file.mapping).toMatchObject({ date: 0, narration: 2, ref: 3, withdrawal: 4, deposit: 5, balance: 6 });
    const rows = readStatement(file);
    expect(rows.map((r) => r.rowNumber)).toEqual([11, 10, 9, 8, 7, 6, 5, 4]);
    expect(rows[0]).toMatchObject({ date: "20250405", deposit: 1_180_000, withdrawal: 0, balance: 11_180_000 });
  });

  test("checks that the balance follows on every line", async () => {
    const check = checkBalances(readStatement(await sample()));
    expect(check).toMatchObject({ checked: true, opening: 10_000_000, closing: 11_553_230, breaks: [] });
  });

  test("points at the line where the balance breaks", () => {
    const rows = readStatement(
      sheet([
        ["Date", "Narration", "Withdrawal", "Deposit", "Balance"],
        ["01/04/2025", "A", "", "100.00", "1100.00"],
        ["02/04/2025", "B", "50.00", "", "1000.00"],
      ]),
    );
    expect(checkBalances(rows).breaks).toEqual([{ rowNumber: 3, expected: 105_000, found: 100_000 }]);
  });

  test("reads one Amount column with a Dr/Cr column", () => {
    const rows = readStatement(
      sheet([
        ["Date", "Particulars", "Amount", "Dr/Cr", "Balance"],
        ["01/04/2025", "Fees", "1,000.00", "DR", "9,000.00 Cr"],
        ["02/04/2025", "Receipt", "500.00", "CR", "9,500.00 Cr"],
      ]),
    );
    expect(rows.map((r) => [r.withdrawal, r.deposit])).toEqual([
      [100_000, 0],
      [0, 50_000],
    ]);
  });
});

describe("narrations", () => {
  test("keeps only the name part as the key choices are remembered under", () => {
    expect(narrationKey("UPI/DR/412345678901/ABC TRADERS/SBIN/abc@sbi")).toBe("ABC TRADERS");
    expect(narrationKey("NEFT-XYZ TRADERS-N123456789")).toBe("XYZ TRADERS");
  });

  test("finds the UTR or cheque number for bank reconciliation", () => {
    expect(instrumentOf("NEFT/ABC TRADERS/UTR987654321098", "")).toEqual({ number: "987654321098", isCheque: false });
    expect(instrumentOf("UPI/CR/509876543210/RANDOM PERSON/okaxis", "")).toEqual({ number: "509876543210", isCheque: false });
    expect(instrumentOf("CHQ PAID 000123 XYZ AGENCIES", "123")).toEqual({ number: "000123", isCheque: true });
  });
});

describe("classifying lines", () => {
  const cases: [string, "withdrawal" | "deposit", string, string][] = [
    ["NEFT/ABC TRADERS/SBIN0001234/UTR987654321098", "deposit", "ABC Traders", "party"],
    ["CHQ PAID 000123 XYZ AGENCIES", "withdrawal", "XYZ Agencies", "party"],
    ["CASH DEPOSIT BY SELF", "deposit", "Cash", "contra"],
    ["TRF TO HDFC CC A/c SELF", "withdrawal", "HDFC CC A/c", "contra"],
    ["SMS ALERT CHARGES", "withdrawal", "Bank Charges", "rule"],
    ["INT.PD 01-04-25 TO 30-04-25", "deposit", "Bank Interest Received", "rule"],
    ["UPI/CR/509876543210/RANDOM PERSON/okaxis", "deposit", "Suspense A/c", "suspense"],
  ];
  test.each(cases)("%s → %s", (narration, side, ledgerName, source) => {
    expect(classify(narration, side, ctx)).toMatchObject({ ledger: ledgerName, source });
  });

  test("an IFSC code of another bank is not a transfer to our own bank", () => {
    expect(classify("NEFT/ABC TRADERS/HDFC0001234/UTR123456789012", "deposit", ctx).ledger).toBe("ABC Traders");
  });

  test("what the user chose before wins", () => {
    const learned = new Map([["RANDOM PERSON", "XYZ Agencies"]]);
    expect(classify("UPI/CR/1/RANDOM PERSON/okaxis", "deposit", { ...ctx, learned })).toMatchObject({ ledger: "XYZ Agencies", source: "learned" });
  });
});

describe("vouchers from lines", () => {
  const voucher = (date: string, ledgerName: string, amount: number): VoucherRow => ({
    id: "g", date, type: "Payment", number: "12", party: "Om Distributors", narration: "", cancelled: false, amount, items: [],
    lines: [{ ledger: "Om Distributors", amount: -amount }, { ledger: ledgerName, amount }],
  });

  test("finds a line already entered in Tally within two days, once", async () => {
    const rows = readStatement(await sample());
    const matches = matchInTally(rows, [voucher("20250411", "SBI Current A/c", 500_000), voucher("20250420", "HDFC CC A/c", 1_000_000)], "SBI Current A/c");
    expect([...matches.keys()]).toEqual([10]);
  });

  const input = async (extra: Partial<BankBuildInput> = {}): Promise<BankBuildInput> => ({
    company, bankLedger: "SBI Current A/c", rows: readStatement(await sample()), ledgers, learned: new Map(), overrides: new Map(),
    inTally: new Map(), today: "20251231", ...extra,
  });

  test("makes receipts, payments and contras, and says what needs fixing", async () => {
    const entries = buildBankEntries(await input());
    expect(entries.map((e) => [e.row.rowNumber, e.type, e.ledger, e.status])).toEqual([
      [11, "Receipt", "ABC Traders", "ready"],
      [10, "Payment", "Om Distributors", "ready"],
      [9, "Payment", "XYZ Agencies", "ready"],
      [8, "Contra", "Cash", "ready"],
      [7, "Payment", "Bank Charges", "ready"],
      [6, "Receipt", "Suspense A/c", "warning"],
      [5, "Contra", "HDFC CC A/c", "ready"],
      [4, "Receipt", "Bank Interest Received", "error"],
    ]);
    expect(entries[7].issues[0].message).toBe('Ledger "Bank Interest Received" is not in Tally');
  });

  test("a line the user picked by hand uses their ledger", async () => {
    const [first] = buildBankEntries(await input({ overrides: new Map([[11, "XYZ Agencies"]]) }));
    expect(first).toMatchObject({ ledger: "XYZ Agencies", source: "manual" });
  });

  test("two identical lines still get two different voucher ids", async () => {
    const row = ["01/04/2025", "SMS CHARGES", "17.70", ""];
    const rows = readStatement(sheet([["Date", "Narration", "Withdrawal", "Deposit"], row, row]));
    const [a, b] = buildBankEntries({ ...(await input()), rows });
    expect(a.remoteId).not.toBe(b.remoteId);
  });

  test("writes a receipt: bank debited with the UTR, a bill-wise party credited On Account", async () => {
    const [receipt] = buildBankEntries(await input());
    const xml = bankVoucherXml(receipt, "SBI Current A/c", ledgers.find((l) => l.name === "ABC Traders"));
    expect(xml).toContain('<VOUCHER VCHTYPE="Receipt"');
    expect(xml).toContain(
      "<ALLLEDGERENTRIES.LIST><LEDGERNAME>ABC Traders</LEDGERNAME><ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE><AMOUNT>11800.00</AMOUNT><BILLALLOCATIONS.LIST><BILLTYPE>On Account</BILLTYPE><AMOUNT>11800.00</AMOUNT>",
    );
    expect(xml).toContain("<LEDGERNAME>SBI Current A/c</LEDGERNAME><ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE><AMOUNT>-11800.00</AMOUNT><BANKALLOCATIONS.LIST>");
    expect(xml).toContain("<INSTRUMENTNUMBER>987654321098</INSTRUMENTNUMBER>");
  });
});

describe("text PDF statements", () => {
  let y = 800;
  const line = (...cells: [number, string][]): TextItem[] => {
    y -= 14;
    return cells.map(([x, text]) => ({ text, page: 1, x, y, w: text.length * 5, h: 10 }));
  };

  test("reads lines by date and amounts, whatever the layout, and tells deposits from the balance", () => {
    y = 800;
    const items = [
      ...line([40, "Date"], [120, "Particulars"], [380, "Withdrawals"], [460, "Deposits"], [540, "Balance"]),
      ...line([40, "Opening Balance"], [540, "1,000.00"]),
      ...line([40, "05-04-2025"], [120, "NEFT/ABC TRADERS"], [460, "500.00"], [540, "1,500.00"]),
      ...line([120, "SALES PAYMENT APRIL"]),
      ...line([40, "06-04-2025"], [120, "SMS CHARGES"], [380, "17.70"], [540, "1,482.30"]),
    ];
    const book = statementFromText(items, "s.pdf");
    expect(book.sheets[0].rows.slice(1)).toEqual([
      ["20250405", "NEFT/ABC TRADERS SALES PAYMENT APRIL", "", "", "500.00", "1,500.00"],
      ["20250406", "SMS CHARGES", "", "17.70", "", "1,482.30"],
    ]);
    const rows = readStatement(openStatement(book));
    expect(checkBalances(rows)).toMatchObject({ opening: 100_000, breaks: [] });
  });
});
