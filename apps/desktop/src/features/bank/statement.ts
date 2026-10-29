import { parseDateCell } from "../../lib/dates";
import { parseAmount, type Paise } from "../../lib/money";
import { autoMapFields, cellText, findHeaderRow } from "../sales/import/fields";
import type { Workbook } from "../sales/import/read-sheet";

export type BankFieldId = "date" | "narration" | "ref" | "withdrawal" | "deposit" | "amount" | "drCr" | "balance";

export interface BankField {
  id: BankFieldId;
  label: string;
  required: boolean;
  synonyms: string[];
}

export const BANK_FIELDS: BankField[] = [
  { id: "date", label: "Date", required: true, synonyms: ["date", "txn date", "transaction date", "tran date", "trans date", "posting date", "value date", "value dt"] },
  { id: "narration", label: "Narration", required: true, synonyms: ["narration", "description", "particulars", "remarks", "transaction details", "transaction remarks", "details", "transaction description"] },
  { id: "ref", label: "Cheque / Ref No", required: false, synonyms: ["chq no", "cheque no", "chq ref no", "ref no", "reference no", "cheque number", "chq number", "ref", "utr", "utr no", "instrument no", "chq ref number", "reference"] },
  { id: "withdrawal", label: "Withdrawal (Dr)", required: false, synonyms: ["withdrawal", "withdrawals", "debit", "debits", "debit amount", "withdrawal amt", "withdrawal amount", "dr amount", "dr", "paid out"] },
  { id: "deposit", label: "Deposit (Cr)", required: false, synonyms: ["deposit", "deposits", "credit", "credits", "credit amount", "deposit amt", "deposit amount", "cr amount", "cr", "paid in"] },
  { id: "amount", label: "Amount (with Dr/Cr)", required: false, synonyms: ["amount", "transaction amount", "txn amount", "amount inr"] },
  { id: "drCr", label: "Dr / Cr", required: false, synonyms: ["dr cr", "cr dr", "debit credit", "type", "txn type", "transaction type"] },
  { id: "balance", label: "Balance", required: false, synonyms: ["balance", "closing balance", "running balance", "available balance", "bal", "balance inr"] },
];

export type BankMapping = Partial<Record<BankFieldId, number>>;

/** The uploaded statement and how to read it. */
export interface StatementFile {
  workbook: Workbook;
  sheetIndex: number;
  headerRow: number; // 0-based
  mapping: BankMapping;
}

export const statementRows = (f: StatementFile): unknown[][] => f.workbook.sheets[f.sheetIndex].rows;
export const statementHeaders = (f: StatementFile): string[] => (statementRows(f)[f.headerRow] ?? []).map(cellText);

export function withStatementHeader(f: StatementFile, headerRow: number): StatementFile {
  const next = { ...f, headerRow };
  return { ...next, mapping: autoMapFields(statementHeaders(next), BANK_FIELDS) };
}

export function openStatement(workbook: Workbook, sheetIndex = 0): StatementFile {
  const headerRow = findHeaderRow(workbook.sheets[sheetIndex].rows, BANK_FIELDS);
  return withStatementHeader({ workbook, sheetIndex, headerRow, mapping: {} }, headerRow);
}

export function missingBankFields(mapping: BankMapping): string[] {
  const missing = BANK_FIELDS.filter((f) => f.required && mapping[f.id] === undefined).map((f) => f.label);
  const hasSides = mapping.withdrawal !== undefined || mapping.deposit !== undefined;
  if (!hasSides && mapping.amount === undefined) missing.push("Withdrawal / Deposit columns, or an Amount column");
  return missing;
}

/** One money line of the statement. Exactly one of withdrawal and deposit is above zero. */
export interface StatementRow {
  rowNumber: number; // as the user sees it in Excel, from 1
  date: string | null; // YYYYMMDD
  rawDate: string;
  narration: string;
  ref: string;
  withdrawal: Paise;
  deposit: Paise;
  balance: Paise | null;
  /** Cells that should hold a number but do not. */
  badCells: string[];
}

const SIDE = /\s*\b(dr|cr)\.?$/i;

/** "1,200.00 Cr" → 120000 and "cr"; a Dr balance is an overdraft, so it reads as negative. */
function signedAmount(value: unknown): { paise: Paise | null; side: "dr" | "cr" | "" } {
  if (typeof value === "number") return { paise: parseAmount(value), side: "" };
  const text = cellText(value);
  const side = (text.match(SIDE)?.[1]?.toLowerCase() ?? "") as "dr" | "cr" | "";
  return { paise: parseAmount(text.replace(SIDE, "")), side };
}

const isDebit = (text: string) => /^(d|dr|debit|withdrawal|wdl)\b/i.test(text.trim());

function readRow(row: unknown[], rowNumber: number, m: BankMapping): StatementRow | null {
  const cell = (id: BankFieldId) => (m[id] === undefined ? "" : row[m[id]!]);
  const badCells: string[] = [];
  const money = (id: BankFieldId, label: string): Paise => {
    const raw = cellText(cell(id));
    if (!raw || raw === "-") return 0;
    const { paise } = signedAmount(cell(id));
    if (paise === null) badCells.push(label);
    return Math.abs(paise ?? 0);
  };

  let withdrawal = money("withdrawal", "Withdrawal");
  let deposit = money("deposit", "Deposit");
  if (m.amount !== undefined && !withdrawal && !deposit) {
    const { paise, side } = signedAmount(cell("amount"));
    if (paise === null && cellText(cell("amount"))) badCells.push("Amount");
    const debit = side ? side === "dr" : m.drCr !== undefined ? isDebit(cellText(cell("drCr"))) : (paise ?? 0) < 0;
    if (debit) withdrawal = Math.abs(paise ?? 0);
    else deposit = Math.abs(paise ?? 0);
  }

  const rawDate = cellText(cell("date"));
  const date = parseDateCell(cell("date"));
  // Titles, "Opening Balance" lines, totals and blank rows carry no transaction.
  if (!withdrawal && !deposit && !badCells.length) return null;
  if (!date && !rawDate) return null;

  const bal = m.balance === undefined || !cellText(cell("balance")) ? null : signedAmount(cell("balance"));
  if (bal && bal.paise === null) badCells.push("Balance");
  const balance = bal?.paise == null ? null : bal.side === "dr" ? -Math.abs(bal.paise) : bal.paise;

  return { rowNumber, date, rawDate, narration: cellText(cell("narration")), ref: cellText(cell("ref")), withdrawal, deposit, balance, badCells };
}

/** The statement's transactions, oldest first (some banks list newest first). */
export function readStatement(f: StatementFile): StatementRow[] {
  const rows = statementRows(f)
    .map((row, i) => (i > f.headerRow ? readRow(row, i + 1, f.mapping) : null))
    .filter((r): r is StatementRow => r !== null);
  const dated = rows.filter((r) => r.date);
  const newestFirst = dated.length > 1 && dated[0].date! > dated[dated.length - 1].date!;
  return newestFirst ? [...rows].reverse() : rows;
}

export interface BalanceBreak {
  rowNumber: number;
  expected: Paise;
  found: Paise;
}

export interface BalanceCheck {
  /** False when the statement has no balance column; nothing could be checked. */
  checked: boolean;
  opening: Paise;
  closing: Paise;
  deposits: Paise;
  withdrawals: Paise;
  breaks: BalanceBreak[];
}

/**
 * Each row's balance must equal the one before plus its deposit less its withdrawal. A break means
 * a row is missing or was misread, and pushing would leave the bank ledger wrong in Tally.
 */
export function checkBalances(rows: StatementRow[]): BalanceCheck {
  const deposits = rows.reduce((n, r) => n + r.deposit, 0);
  const withdrawals = rows.reduce((n, r) => n + r.withdrawal, 0);
  const first = rows.find((r) => r.balance !== null);
  if (!first) return { checked: false, opening: 0, closing: 0, deposits, withdrawals, breaks: [] };

  const opening = first.balance! - first.deposit + first.withdrawal;
  const breaks: BalanceBreak[] = [];
  let running = opening;
  for (const r of rows) {
    running += r.deposit - r.withdrawal;
    if (r.balance === null) continue;
    if (r.balance !== running) breaks.push({ rowNumber: r.rowNumber, expected: running, found: r.balance });
    running = r.balance;
  }
  return { checked: true, opening, closing: running, deposits, withdrawals, breaks };
}
