import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { REPO_ROOT } from "../../test/mock-tally";
import { readWorkbook } from "../sales/import/read-sheet";
import type { Company, Ledger } from "../tally/types";
import { buildJournals, groupJournal, journalXml, openJournal, readJournal, resolveLedger, unknownLedgers, type JournalBuildInput, type JournalFile } from "./journal";

const company: Company = { name: "Demo Traders", guid: "g-1", stateName: "Maharashtra", booksFrom: "20250401" };
const ledger = (name: string, parent: string, extra: Partial<Ledger> = {}): Ledger => ({ name, parent, gstin: "", stateName: "", isBillWise: false, ...extra });
const ledgers: Ledger[] = [
  ledger("Bank Charges", "Indirect Expenses"),
  ledger("Suspense A/c", "Suspense A/c"),
  ledger("Cash", "Cash-in-Hand"),
  ledger("ABC Traders", "Sundry Debtors", { isBillWise: true }),
  ledger("Om Distributors", "Sundry Creditors", { isBillWise: true }),
  ledger("Salaries", "Indirect Expenses"),
];

const sample = async (): Promise<JournalFile> => {
  const name = "journal-sample.csv";
  return openJournal(await readWorkbook(new File([readFileSync(resolve(REPO_ROOT, "fixtures", name))], name)));
};
const input = async (extra: Partial<JournalBuildInput> = {}): Promise<JournalBuildInput> => {
  const file = await sample();
  return { company, rows: readJournal(file), byNumber: true, ledgers, links: new Map(), today: "20251231", ...extra };
};

describe("reading journal sheets", () => {
  test("finds the headings, reads each ledger line and leaves out the total row", async () => {
    const file = await sample();
    expect(file.headerRow).toBe(1);
    expect(file.mapping).toMatchObject({ date: 0, voucherNo: 1, ledger: 2, debit: 3, credit: 4, narration: 5 });
    const rows = readJournal(file);
    expect(rows).toHaveLength(8);
    expect(rows[2]).toMatchObject({ ledger: "Salary Expenses", debit: 2_500_000, credit: 0 });
  });

  test("groups by voucher number; a blank number continues the voucher above", async () => {
    const groups = groupJournal(readJournal(await sample()), true);
    expect(groups.map((g) => g.map((r) => r.rowNumber))).toEqual([
      [3, 4],
      [5, 6],
      [7, 8],
      [9, 10],
    ]);
  });

  test("without voucher numbers, rows join until debit equals credit", async () => {
    const rows = readJournal(await sample()).map((r) => ({ ...r, voucherNo: "" }));
    expect(groupJournal(rows, false).map((g) => g.length)).toEqual([2, 2, 2, 2]);
  });
});

describe("journal vouchers", () => {
  test("checks each journal and names what to fix", async () => {
    const vouchers = buildJournals(await input());
    expect(vouchers.map((v) => [v.voucherNo, v.status])).toEqual([
      ["JV-1", "ready"],
      ["JV-2", "error"],
      ["JV-3", "ready"],
      ["JV-4", "error"],
    ]);
    expect(vouchers[1].issues.map((i) => i.message)).toContain('Ledger "Salary Expenses" is not in Tally. Link it to a ledger or create it above.');
    expect(vouchers[3].issues.map((i) => i.message)).toContain("Debit ₹100.00 and credit ₹90.00 do not match (difference ₹10.00)");
    expect(unknownLedgers(vouchers)).toEqual([
      { name: "Salary Expenses", uses: 1 },
      { name: "Salary Payable", uses: 1 },
    ]);
  });

  test("matches a ledger in any capitals, and uses the user's links", () => {
    expect(resolveLedger("abc traders", ledgers, new Map())).toBe("ABC Traders");
    expect(resolveLedger("Salary Expenses", ledgers, new Map([["salary expenses", "Salaries"]]))).toBe("Salaries");
    expect(resolveLedger("Salary Expenses", ledgers, new Map([["salary expenses", "Gone Ledger"]]))).toBe("");
  });

  test("writes a journal: debits negative, credits positive, bill-wise parties On Account", async () => {
    const jv3 = buildJournals(await input())[2];
    const xml = journalXml(jv3, "Journal", ledgers);
    expect(xml).toContain('<VOUCHER VCHTYPE="Journal"');
    expect(xml).toContain("<VOUCHERNUMBER>JV-3</VOUCHERNUMBER>");
    expect(xml).toContain(
      "<LEDGERNAME>Om Distributors</LEDGERNAME><ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE><AMOUNT>-1000.00</AMOUNT><BILLALLOCATIONS.LIST><BILLTYPE>On Account</BILLTYPE><AMOUNT>-1000.00</AMOUNT>",
    );
    expect(xml).toContain("<LEDGERNAME>ABC Traders</LEDGERNAME><ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE><AMOUNT>1000.00</AMOUNT>");
  });

  test("the same journal pushed again keeps its id, so Tally updates it", async () => {
    const [a] = buildJournals(await input());
    const [b] = buildJournals(await input());
    expect(a.remoteId).toBe(b.remoteId);
  });
});
