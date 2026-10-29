import { parseDateCell } from "../../lib/dates";
import { formatPaise } from "../../lib/format";
import { parseAmount, type Paise } from "../../lib/money";
import { phraseLines } from "../sales/pdf/parse-bill";
import { readPdfText, type TextItem } from "../sales/pdf/pdf-text";
import type { Workbook } from "../sales/import/read-sheet";

const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const STATEMENT_HEADERS = ["Date", "Narration", "Ref No", "Withdrawal", "Deposit", "Balance"];

const MONEY = /^-?\d[\d,]*\.\d{2}(?:\s*(cr|dr)\.?)?$/i;
const LEADING_DATE = /^(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{1,2}[-\s][A-Za-z]{3,9}[-\s,]+\d{2,4}|\d{4}-\d{2}-\d{2})\b\s*/;
const OPENING = /opening\s+balance|balance\s+b\/?f|brought\s+forward/i;
const REF = /^(?:\d{6,}|[A-Z]{4}[A-Z0-9]?\d{8,})$/;

interface Money {
  item: TextItem;
  paise: Paise;
}

interface Columns {
  withdrawal: number | null; // right edge of the heading
  deposit: number | null;
}

interface Txn {
  date: string;
  narration: string[];
  ref: string;
  amount: Money;
  balance: Money | null;
  page: number;
  y: number;
  h: number;
}

const right = (t: TextItem) => t.x + t.w;

function moneyOf(item: TextItem): Money | null {
  const m = MONEY.exec(item.text.trim());
  if (!m) return null;
  const paise = parseAmount(item.text.replace(/\s*(cr|dr)\.?$/i, ""));
  if (paise === null) return null;
  return { item, paise: m[1]?.toLowerCase() === "dr" ? -Math.abs(paise) : paise };
}

/** Where the Withdrawal and Deposit headings sit, for statements where the balance cannot tell. */
function findColumns(lines: TextItem[][]): Columns {
  for (const line of lines) {
    const w = line.find((p) => /withdrawal|debit|\bdr\b/i.test(p.text));
    const d = line.find((p) => /deposit|credit|\bcr\b/i.test(p.text));
    if (w && d && line.some((p) => /balance/i.test(p.text))) return { withdrawal: right(w), deposit: right(d) };
  }
  return { withdrawal: null, deposit: null };
}

/** The date a line starts with, and what follows it in the same phrase. */
function leadingDate(first: TextItem): { date: string; rest: string } | null {
  const m = LEADING_DATE.exec(first.text.trim());
  if (!m) return null;
  const date = parseDateCell(m[1].replace(/\s*,\s*/, " ").replace(/\s+/g, " ").replace(/ /g, "-"));
  return date ? { date, rest: first.text.trim().slice(m[0].length) } : null;
}

function toTxn(line: TextItem[], start: { date: string; rest: string }): Txn | null {
  const amounts: Money[] = [];
  for (let i = line.length - 1; i > 0; i--) {
    const money = moneyOf(line[i]);
    if (!money) break;
    amounts.unshift(money);
  }
  if (!amounts.length) return null;
  const amount = amounts.length > 1 ? amounts[amounts.length - 2] : amounts[0];
  const balance = amounts.length > 1 ? amounts[amounts.length - 1] : null;

  const middle = line.slice(1, line.length - amounts.length).map((p) => p.text.trim());
  const ref = middle.find((t) => REF.test(t)) ?? "";
  const narration = [start.rest, ...middle.filter((t) => t !== ref && !parseDateCell(t))].filter(Boolean);
  const first = line[0];
  return { date: start.date, narration, ref, amount, balance, page: first.page, y: first.y, h: first.h };
}

/** Deposit when the balance went up by the amount, withdrawal when it went down; otherwise by column. */
function isDeposit(t: Txn, previous: Paise | null, columns: Columns): boolean {
  const amount = Math.abs(t.amount.paise);
  if (previous !== null && t.balance) {
    if (t.balance.paise - previous === amount) return true;
    if (previous - t.balance.paise === amount) return false;
  }
  if (columns.withdrawal !== null && columns.deposit !== null) {
    const edge = right(t.amount.item);
    return Math.abs(edge - columns.deposit) < Math.abs(edge - columns.withdrawal);
  }
  return t.amount.paise > 0 && /\bcr\b/i.test(t.amount.item.text);
}

/**
 * A text bank statement as rows the column mapper understands. Every bank lays its PDF out
 * differently, so nothing depends on a layout: a transaction line starts with a date and ends with
 * amounts (the last being the balance), and lines below it without a date continue its narration.
 */
export function statementFromText(items: TextItem[], fileName: string): Workbook {
  const lines = phraseLines(items);
  const columns = findColumns(lines);
  const txns: Txn[] = [];
  let opening: Paise | null = null;

  for (const line of lines) {
    const start = leadingDate(line[0]);
    const txn = start && toTxn(line, start);
    if (txn) {
      txns.push(txn);
      continue;
    }
    const text = line.map((p) => p.text).join(" ");
    if (OPENING.test(text)) {
      const money = line.map(moneyOf).filter((m): m is Money => m !== null).at(-1);
      if (money && opening === null && !txns.length) opening = money.paise;
      continue;
    }
    // A wrapped narration sits just under its transaction, on the same page, with no amounts.
    const last = txns.at(-1);
    const near = last && line[0].page === last.page && last.y - line[0].y > 0 && last.y - line[0].y < last.h * 3.5;
    if (near && /[a-z]{2}/i.test(text) && !line.some((p) => moneyOf(p))) {
      last.narration.push(text.trim());
      last.y = line[0].y;
    }
  }

  let previous = opening;
  const rows = txns.map((t) => {
    const deposit = isDeposit(t, previous, columns);
    previous = t.balance ? t.balance.paise : previous === null ? null : previous + (deposit ? 1 : -1) * Math.abs(t.amount.paise);
    const amount = formatPaise(Math.abs(t.amount.paise));
    const balance = t.balance ? `${formatPaise(Math.abs(t.balance.paise))}${t.balance.paise < 0 ? " Dr" : ""}` : "";
    return [t.date, t.narration.join(" "), t.ref, deposit ? "" : amount, deposit ? amount : "", balance];
  });
  return { fileName, sheets: [{ name: "Statement", rows: [STATEMENT_HEADERS, ...rows] }] };
}

export async function readPdfStatement(file: File, password?: string): Promise<Workbook> {
  if (file.size > MAX_FILE_BYTES) throw new Error("This PDF is larger than 20 MB.");
  const { items } = await readPdfText(new Uint8Array(await file.arrayBuffer()), password);
  if (!items.length) throw new Error("This PDF has no text in it (it is probably a scan). Scanned statements cannot be read yet.");
  const workbook = statementFromText(items, file.name);
  if (workbook.sheets[0].rows.length < 2) throw new Error("No transactions were found in this PDF. Download the statement as Excel or CSV from your bank instead.");
  return workbook;
}
