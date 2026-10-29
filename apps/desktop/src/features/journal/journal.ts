import { parseDateCell } from "../../lib/dates";
import { formatPaise, formatTallyDate } from "../../lib/format";
import { paiseToTally, parseAmount, type Paise } from "../../lib/money";
import { escapeXml as e } from "../../lib/xml";
import { hash } from "../sales/import/build-vouchers";
import { autoMapFields, cellText, findHeaderRow } from "../sales/import/fields";
import { pushXml, type PushResult } from "../sales/import/push";
import type { Workbook } from "../sales/import/read-sheet";
import { importVouchersXml } from "../sales/import/voucher-xml";
import { educationalDate } from "../tally/educational";
import type { Company, Ledger } from "../tally/types";

export type JournalFieldId = "date" | "voucherNo" | "ledger" | "debit" | "credit" | "amount" | "drCr" | "narration";

export interface JournalField {
  id: JournalFieldId;
  label: string;
  required: boolean;
  synonyms: string[];
}

export const JOURNAL_FIELDS: JournalField[] = [
  { id: "date", label: "Date", required: true, synonyms: ["date", "voucher date", "vch date", "entry date", "jv date", "txn date"] },
  { id: "voucherNo", label: "Voucher No", required: false, synonyms: ["voucher no", "vch no", "voucher number", "jv no", "journal no", "entry no", "voucher"] },
  { id: "ledger", label: "Ledger", required: true, synonyms: ["ledger", "ledger name", "account", "account name", "account head", "head of account", "particulars", "head"] },
  { id: "debit", label: "Debit", required: false, synonyms: ["debit", "dr", "debit amount", "dr amount", "debit rs", "dr rs"] },
  { id: "credit", label: "Credit", required: false, synonyms: ["credit", "cr", "credit amount", "cr amount", "credit rs", "cr rs"] },
  { id: "amount", label: "Amount (with Dr/Cr)", required: false, synonyms: ["amount", "amount rs"] },
  { id: "drCr", label: "Dr / Cr", required: false, synonyms: ["dr cr", "cr dr", "type", "debit credit", "side"] },
  { id: "narration", label: "Narration", required: false, synonyms: ["narration", "remarks", "description", "notes", "note"] },
];

export type JournalMapping = Partial<Record<JournalFieldId, number>>;

export interface JournalFile {
  workbook: Workbook;
  sheetIndex: number;
  headerRow: number; // 0-based
  mapping: JournalMapping;
}

export const journalRows = (f: JournalFile): unknown[][] => f.workbook.sheets[f.sheetIndex].rows;
export const journalHeaders = (f: JournalFile): string[] => (journalRows(f)[f.headerRow] ?? []).map(cellText);

export function withJournalHeader(f: JournalFile, headerRow: number): JournalFile {
  const next = { ...f, headerRow };
  return { ...next, mapping: autoMapFields(journalHeaders(next), JOURNAL_FIELDS) };
}

export function openJournal(workbook: Workbook, sheetIndex = 0): JournalFile {
  const headerRow = findHeaderRow(workbook.sheets[sheetIndex].rows, JOURNAL_FIELDS);
  return withJournalHeader({ workbook, sheetIndex, headerRow, mapping: {} }, headerRow);
}

export function missingJournalFields(mapping: JournalMapping): string[] {
  const missing = JOURNAL_FIELDS.filter((f) => f.required && mapping[f.id] === undefined).map((f) => f.label);
  if (mapping.debit === undefined && mapping.credit === undefined && mapping.amount === undefined) missing.push("Debit / Credit columns, or an Amount column");
  return missing;
}

/** One ledger line of the file. */
export interface JournalRow {
  rowNumber: number; // as the user sees it in Excel, from 1
  date: string | null;
  rawDate: string;
  voucherNo: string;
  ledger: string;
  debit: Paise;
  credit: Paise;
  narration: string;
  badCells: string[];
}

const TOTAL_ROW = /^(grand\s*)?total\b/i;
const isDebit = (text: string) => /^(d|dr|debit|by)\b/i.test(text.trim());

function readRow(row: unknown[], rowNumber: number, m: JournalMapping): JournalRow | null {
  const cell = (id: JournalFieldId) => (m[id] === undefined ? "" : row[m[id]!]);
  const badCells: string[] = [];
  const money = (id: JournalFieldId, label: string): Paise => {
    const raw = cell(id);
    if (!cellText(raw) || cellText(raw) === "-") return 0;
    const paise = parseAmount(typeof raw === "number" ? raw : cellText(raw).replace(/\s*(dr|cr)\.?$/i, ""));
    if (paise === null) badCells.push(label);
    return paise ?? 0;
  };

  let debit = Math.abs(money("debit", "Debit"));
  let credit = Math.abs(money("credit", "Credit"));
  if (m.amount !== undefined && !debit && !credit) {
    const amount = money("amount", "Amount");
    const side = cellText(cell("amount")).match(/(dr|cr)\.?$/i)?.[1] ?? cellText(cell("drCr"));
    const dr = side ? isDebit(side) : amount > 0;
    if (dr) debit = Math.abs(amount);
    else credit = Math.abs(amount);
  }

  const ledger = cellText(cell("ledger"));
  if (!ledger && !debit && !credit && !badCells.length) return null;
  if (TOTAL_ROW.test(ledger) || TOTAL_ROW.test(cellText(cell("date")))) return null;
  return {
    rowNumber,
    date: parseDateCell(cell("date")),
    rawDate: cellText(cell("date")),
    voucherNo: cellText(cell("voucherNo")),
    ledger,
    debit,
    credit,
    narration: cellText(cell("narration")),
    badCells,
  };
}

export function readJournal(f: JournalFile): JournalRow[] {
  return journalRows(f)
    .map((row, i) => (i > f.headerRow ? readRow(row, i + 1, f.mapping) : null))
    .filter((r): r is JournalRow => r !== null);
}

/**
 * Consecutive rows with the same voucher number form one journal; a blank number continues the
 * one above (merged cells). Without a voucher number column, rows join until debits equal credits.
 */
export function groupJournal(rows: JournalRow[], byNumber: boolean): JournalRow[][] {
  const groups: JournalRow[][] = [];
  let current: JournalRow[] = [];
  const balanced = (g: JournalRow[]) => g.length > 1 && g.reduce((n, r) => n + r.debit - r.credit, 0) === 0;
  for (const r of rows) {
    const head = current[0];
    const startsNew = byNumber
      ? !head || (r.voucherNo !== "" && r.voucherNo !== head.voucherNo)
      : !head || balanced(current) || (r.date !== null && head.date !== null && r.date !== head.date);
    if (startsNew && current.length) {
      groups.push(current);
      current = [];
    }
    current.push(r);
  }
  if (current.length) groups.push(current);
  return groups;
}

export interface JournalLine {
  rowNumber: number;
  /** As the file names it. */
  fileLedger: string;
  /** The Tally ledger it resolved to; empty when there is none yet. */
  ledger: string;
  debit: Paise;
  credit: Paise;
}

export interface JournalIssue {
  level: "error" | "warning";
  message: string;
}

export interface JournalVoucher {
  id: string;
  rowNumbers: number[];
  date: string | null;
  voucherNo: string;
  narration: string;
  lines: JournalLine[];
  debitTotal: Paise;
  creditTotal: Paise;
  remoteId: string;
  issues: JournalIssue[];
  status: "ready" | "warning" | "error";
}

export interface JournalBuildInput {
  company: Company;
  rows: JournalRow[];
  /** Group by the Voucher No column; otherwise rows join until they balance. */
  byNumber: boolean;
  ledgers: Ledger[];
  /** The user's links: a ledger name as the file spells it (ledgerKey) → the Tally ledger. */
  links: ReadonlyMap<string, string>;
  today: string;
  educationalMode?: boolean;
  moveToFirst?: boolean;
}

/** "Salary Payable A/c" and "salary payable a/c " are the same ledger name. */
export const ledgerKey = (name: string) => name.toLowerCase().replace(/\s+/g, " ").trim();

/** Exact name, then the same name in other capitals, then what the user linked it to. */
export function resolveLedger(name: string, ledgers: Ledger[], links: ReadonlyMap<string, string>): string {
  if (!name) return "";
  const exact = ledgers.find((l) => l.name === name) ?? ledgers.find((l) => ledgerKey(l.name) === ledgerKey(name));
  if (exact) return exact.name;
  const linked = links.get(ledgerKey(name));
  return linked && ledgers.some((l) => l.name === linked) ? linked : "";
}

function toVoucher(group: JournalRow[], index: number, input: JournalBuildInput): JournalVoucher {
  const issues: JournalIssue[] = [];
  const error = (message: string) => issues.push({ level: "error", message });
  const first = group[0];
  const dated = group.find((r) => r.date || r.rawDate) ?? first;

  for (const r of group) {
    for (const label of r.badCells) error(`Row ${r.rowNumber}: ${label} is not a number`);
    if (r.debit && r.credit) error(`Row ${r.rowNumber} has both a debit and a credit`);
    if (!r.debit && !r.credit && !r.badCells.length) error(`Row ${r.rowNumber} has no amount`);
    if (!r.ledger) error(`Row ${r.rowNumber}: ledger is empty`);
  }
  if (!dated.date) error(dated.rawDate ? `Date "${dated.rawDate}" is not a date` : "Date is empty");
  else if (input.company.booksFrom && dated.date < input.company.booksFrom) {
    error(`Date is before the company's books begin (${formatTallyDate(input.company.booksFrom)})`);
  } else if (dated.date > input.today) issues.push({ level: "warning", message: "Date is in the future" });

  const lines = group.map((r) => ({
    rowNumber: r.rowNumber,
    fileLedger: r.ledger,
    ledger: resolveLedger(r.ledger, input.ledgers, input.links),
    debit: r.debit,
    credit: r.credit,
  }));
  const unknown = [...new Set(lines.filter((l) => l.fileLedger && !l.ledger).map((l) => l.fileLedger))];
  for (const name of unknown) error(`Ledger "${name}" is not in Tally. Link it to a ledger or create it above.`);

  const debitTotal = lines.reduce((n, l) => n + l.debit, 0);
  const creditTotal = lines.reduce((n, l) => n + l.credit, 0);
  if (lines.length < 2) error("A journal needs at least two lines");
  if (debitTotal !== creditTotal) {
    error(`Debit ₹${formatPaise(debitTotal)} and credit ₹${formatPaise(creditTotal)} do not match (difference ₹${formatPaise(Math.abs(debitTotal - creditTotal))})`);
  }

  const { date, issue } = educationalDate(dated.date, { ...input, booksFrom: input.company.booksFrom });
  if (issue) issues.push(issue);

  const voucherNo = group.find((r) => r.voucherNo)?.voucherNo ?? "";
  const signature = lines.map((l) => `${ledgerKey(l.fileLedger)}:${l.debit}:${l.credit}`).join(",");
  return {
    id: `j${index}`,
    rowNumbers: group.map((r) => r.rowNumber),
    date,
    voucherNo,
    narration: group.find((r) => r.narration)?.narration ?? "",
    lines,
    debitTotal,
    creditTotal,
    remoteId: `th-jrnl-${hash(`${input.company.guid || input.company.name}|${voucherNo || dated.date}|${signature}`)}`,
    issues,
    status: issues.some((i) => i.level === "error") ? "error" : issues.length ? "warning" : "ready",
  };
}

export function buildJournals(input: JournalBuildInput): JournalVoucher[] {
  return groupJournal(input.rows, input.byNumber).map((g, i) => toVoucher(g, i, input));
}

/** Names in the file that match no Tally ledger, with how many lines use each. */
export function unknownLedgers(vouchers: JournalVoucher[]): { name: string; uses: number }[] {
  const uses = new Map<string, number>();
  for (const v of vouchers) for (const l of v.lines) if (l.fileLedger && !l.ledger) uses.set(l.fileLedger, (uses.get(l.fileLedger) ?? 0) + 1);
  return [...uses].map(([name, n]) => ({ name, uses: n }));
}

/** Debits go to Tally as negative amounts with ISDEEMEDPOSITIVE=Yes; credits as positive with No. A bill-wise party is On Account. */
export function journalXml(v: JournalVoucher, voucherType: string, ledgers: Ledger[]): string {
  const billWise = new Set(ledgers.filter((l) => l.isBillWise).map((l) => l.name));
  const lineXml = (l: JournalLine) => {
    const isDebit = l.debit > 0;
    const amount = paiseToTally(isDebit ? -l.debit : l.credit);
    const bill = billWise.has(l.ledger) ? `<BILLALLOCATIONS.LIST><BILLTYPE>On Account</BILLTYPE><AMOUNT>${amount}</AMOUNT></BILLALLOCATIONS.LIST>` : "";
    return `<ALLLEDGERENTRIES.LIST><LEDGERNAME>${e(l.ledger)}</LEDGERNAME><ISDEEMEDPOSITIVE>${isDebit ? "Yes" : "No"}</ISDEEMEDPOSITIVE><AMOUNT>${amount}</AMOUNT>${bill}</ALLLEDGERENTRIES.LIST>`;
  };
  const date = v.date ?? "";
  return [
    `<VOUCHER VCHTYPE="${e(voucherType)}" ACTION="Create" OBJVIEW="Accounting Voucher View" REMOTEID="${e(v.remoteId)}">`,
    `<DATE>${date}</DATE><EFFECTIVEDATE>${date}</EFFECTIVEDATE>`,
    `<VOUCHERTYPENAME>${e(voucherType)}</VOUCHERTYPENAME>`,
    ...(v.voucherNo ? [`<VOUCHERNUMBER>${e(v.voucherNo)}</VOUCHERNUMBER>`] : []),
    `<PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>`,
    `<NARRATION>${e(v.narration)}</NARRATION>`,
    ...v.lines.map(lineXml),
    `</VOUCHER>`,
  ].join("\n");
}

/** One voucher per request, so every error points at the right journal. Writes to the user's books. */
export function pushJournal(url: string, company: string, voucherType: string, v: JournalVoucher, ledgers: Ledger[]): Promise<PushResult> {
  return pushXml(url, importVouchersXml(company, journalXml(v, voucherType, ledgers)), "journal");
}

/** Tally's own groups a new ledger can go under, plus any the company made. */
export function groupChoices(ledgers: Ledger[]): string[] {
  const standard = [
    "Indirect Expenses", "Indirect Incomes", "Direct Expenses", "Direct Incomes", "Current Liabilities", "Current Assets", "Provisions",
    "Duties & Taxes", "Loans & Advances (Asset)", "Loans (Liability)", "Fixed Assets", "Investments", "Capital Account", "Reserves & Surplus",
    "Sundry Debtors", "Sundry Creditors", "Deposits (Asset)", "Suspense A/c",
  ];
  const own = ledgers.map((l) => l.parent.replace(/[\u0000-\u001f]/g, "").trim()).filter((g) => g && g !== "Primary");
  return [...new Set([...standard, ...own])];
}
