import { formatTallyDate } from "../../lib/format";
import { paiseToTally, type Paise } from "../../lib/money";
import { escapeXml as e } from "../../lib/xml";
import { hash } from "../sales/import/build-vouchers";
import { pushXml, type PushResult } from "../sales/import/push";
import { importVouchersXml } from "../sales/import/voucher-xml";
import type { VoucherRow } from "../tally-data/tally-data";
import { educationalDate } from "../tally/educational";
import type { Company, Ledger } from "../tally/types";
import { classify, instrumentOf, isBankOrCashLedger, narrationKey, type Source } from "./classify";
import type { StatementRow } from "./statement";

export type BankVoucherType = "Receipt" | "Payment" | "Contra";
export type EntryStatus = "ready" | "warning" | "error" | "in-tally";

export interface EntryIssue {
  level: "error" | "warning";
  message: string;
}

/** One statement line on its way to becoming a voucher. */
export interface BankEntry {
  id: string;
  row: StatementRow;
  side: "withdrawal" | "deposit";
  amount: Paise;
  /** The date the voucher is entered on; differs from the statement only in Educational mode. */
  date: string | null;
  type: BankVoucherType;
  ledger: string;
  source: Source | "manual";
  confidence: number;
  /** The narration's name part; choices are remembered under it. */
  key: string;
  instrument: { number: string; isCheque: boolean };
  remoteId: string;
  /** The voucher already in Tally that this line matches, so it is not entered twice. */
  inTally: VoucherRow | null;
  issues: EntryIssue[];
  status: EntryStatus;
}

export interface BankBuildInput {
  company: Company;
  bankLedger: string;
  rows: StatementRow[];
  ledgers: Ledger[];
  learned: ReadonlyMap<string, string>;
  /** Ledgers the user picked by hand, by statement row number. */
  overrides: ReadonlyMap<number, string>;
  inTally: ReadonlyMap<number, VoucherRow>;
  today: string; // YYYYMMDD
  educationalMode?: boolean;
  moveToFirst?: boolean;
}

function checkRow(row: StatementRow, input: BankBuildInput, issues: EntryIssue[]): void {
  const error = (message: string) => issues.push({ level: "error", message });
  for (const label of row.badCells) error(`${label} is not a number`);
  if (row.withdrawal && row.deposit) error("Row has both a withdrawal and a deposit");
  if (!row.date) error(row.rawDate ? `Date "${row.rawDate}" is not a date` : "Date is empty");
  else if (input.company.booksFrom && row.date < input.company.booksFrom) {
    error(`Date is before the company's books begin (${formatTallyDate(input.company.booksFrom)})`);
  } else if (row.date > input.today) issues.push({ level: "warning", message: "Date is in the future" });
}

function checkLedger(ledger: string, source: BankEntry["source"], input: BankBuildInput, issues: EntryIssue[]): void {
  if (!ledger) issues.push({ level: "error", message: "Choose a ledger" });
  else if (ledger === input.bankLedger) issues.push({ level: "error", message: "The other side cannot be the bank ledger itself" });
  else if (!input.ledgers.some((l) => l.name === ledger)) issues.push({ level: "error", message: `Ledger "${ledger}" is not in Tally` });
  else if (source === "suspense") {
    issues.push({ level: "warning", message: "No ledger found for this narration, so it goes to Suspense A/c. Choose the right ledger if you know it." });
  }
}

/** Same line twice (two ₹17.70 SMS charges on one day) must still be two vouchers, so repeats are numbered. */
function remoteIds(input: BankBuildInput): string[] {
  const seen = new Map<string, number>();
  return input.rows.map((r) => {
    const base = [input.company.guid || input.company.name, input.bankLedger, r.date ?? r.rawDate, r.withdrawal, r.deposit, r.ref, r.narration].join("|");
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return `th-bank-${hash(`${base}|${n}`)}`;
  });
}

/** Every statement line as a Receipt, Payment or Contra, with its suggested ledger and anything to fix. */
export function buildBankEntries(input: BankBuildInput): BankEntry[] {
  const ids = remoteIds(input);
  const ctx = { bankLedger: input.bankLedger, ledgers: input.ledgers, learned: input.learned };
  const byName = new Map(input.ledgers.map((l) => [l.name, l]));

  return input.rows.map((row, i) => {
    const side = row.deposit ? "deposit" : "withdrawal";
    const issues: EntryIssue[] = [];
    checkRow(row, input, issues);

    const manual = input.overrides.get(row.rowNumber);
    const suggested = manual === undefined ? classify(row.narration, side, ctx) : { ledger: manual, source: "manual" as const, confidence: 100 };
    checkLedger(suggested.ledger, suggested.source, input, issues);

    const { date, issue } = educationalDate(row.date, { ...input, booksFrom: input.company.booksFrom });
    if (issue) issues.push(issue);

    const counter = byName.get(suggested.ledger);
    const isContra = counter ? isBankOrCashLedger(counter) : suggested.source === "contra";
    const inTally = input.inTally.get(row.rowNumber) ?? null;
    let status: EntryStatus = issues.some((x) => x.level === "error") ? "error" : issues.length ? "warning" : "ready";
    if (inTally) status = "in-tally";

    return {
      id: `r${row.rowNumber}`,
      row,
      side,
      amount: row.deposit || row.withdrawal,
      date,
      type: isContra ? "Contra" : side === "deposit" ? "Receipt" : "Payment",
      ...suggested,
      key: narrationKey(row.narration),
      instrument: instrumentOf(row.narration, row.ref),
      remoteId: ids[i],
      inTally,
      issues,
      status,
    };
  });
}

/** Debits go to Tally as negative amounts with ISDEEMEDPOSITIVE=Yes; credits as positive with No. */
function lineXml(ledger: string, isDebit: boolean, amount: Paise, inner: string): string {
  const value = paiseToTally(isDebit ? -amount : amount);
  return `<ALLLEDGERENTRIES.LIST><LEDGERNAME>${e(ledger)}</LEDGERNAME><ISDEEMEDPOSITIVE>${isDebit ? "Yes" : "No"}</ISDEEMEDPOSITIVE><AMOUNT>${value}</AMOUNT>${inner}</ALLLEDGERENTRIES.LIST>`;
}

/**
 * A deposit debits the bank and credits the other side; a withdrawal the reverse. The bank line
 * carries the cheque number or UTR so Tally's Bank Reconciliation can match the statement.
 * A bill-wise party gets the amount On Account, to be set against bills later.
 */
export function bankVoucherXml(entry: BankEntry, bankLedger: string, counter: Ledger | undefined): string {
  const date = entry.date ?? "";
  const bankDebit = entry.side === "deposit";
  const value = paiseToTally(bankDebit ? -entry.amount : entry.amount);
  const { number, isCheque } = entry.instrument;
  const bankAlloc = [
    `<BANKALLOCATIONS.LIST><DATE>${date}</DATE><INSTRUMENTDATE>${date}</INSTRUMENTDATE>`,
    `<TRANSACTIONTYPE>${isCheque ? "Cheque" : "e-Fund Transfer"}</TRANSACTIONTYPE>`,
    number ? `<INSTRUMENTNUMBER>${e(number)}</INSTRUMENTNUMBER>` : "",
    `<PAYMENTFAVOURING>${e(entry.ledger)}</PAYMENTFAVOURING><AMOUNT>${value}</AMOUNT></BANKALLOCATIONS.LIST>`,
  ].join("");
  const counterValue = paiseToTally(bankDebit ? entry.amount : -entry.amount);
  const billAlloc = counter?.isBillWise ? `<BILLALLOCATIONS.LIST><BILLTYPE>On Account</BILLTYPE><AMOUNT>${counterValue}</AMOUNT></BILLALLOCATIONS.LIST>` : "";

  return [
    `<VOUCHER VCHTYPE="${entry.type}" ACTION="Create" OBJVIEW="Accounting Voucher View" REMOTEID="${e(entry.remoteId)}">`,
    `<DATE>${date}</DATE><EFFECTIVEDATE>${date}</EFFECTIVEDATE>`,
    `<VOUCHERTYPENAME>${entry.type}</VOUCHERTYPENAME>`,
    `<PARTYLEDGERNAME>${e(entry.ledger)}</PARTYLEDGERNAME>`,
    `<PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>`,
    `<NARRATION>${e(entry.row.narration)}</NARRATION>`,
    lineXml(entry.ledger, !bankDebit, entry.amount, billAlloc),
    lineXml(bankLedger, bankDebit, entry.amount, bankAlloc),
    `</VOUCHER>`,
  ].join("\n");
}

/** One voucher per request, so every error points at the right line. Writes to the user's books. */
export function pushBankEntry(url: string, company: string, entry: BankEntry, bankLedger: string, ledgers: Ledger[]): Promise<PushResult> {
  const counter = ledgers.find((l) => l.name === entry.ledger);
  return pushXml(url, importVouchersXml(company, bankVoucherXml(entry, bankLedger, counter)), "bank line");
}
