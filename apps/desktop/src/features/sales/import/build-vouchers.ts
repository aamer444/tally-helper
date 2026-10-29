import type { ReviewStatus } from "../../../components/ui/StatusBadge";
import { parseDateCell } from "../../../lib/dates";
import { formatPaise, formatTallyDate } from "../../../lib/format";
import { parseAmount, type Paise } from "../../../lib/money";
import type { Company, Ledger } from "../../tally/types";
import { cellText, FIELDS, type FieldId, type Mapping } from "./fields";
import { GST_RATES, isValidGstin, stateCodeOf } from "./gst";

const MAX_ROUND_OFF: Paise = 100; // a gap of up to ₹1 between the file's total and taxable + tax
const TOTAL_ROW = /^(grand\s*)?(sub\s*)?total\b/i;

export interface SalesSettings {
  voucherType: string;
  salesLedger: string;
  cgstLedger: string;
  sgstLedger: string;
  igstLedger: string;
  roundOffLedger: string;
}

export interface LedgerLine {
  role: "Party" | "Sales" | "CGST" | "SGST" | "IGST" | "Round Off";
  ledger: string;
  debit: Paise;
  credit: Paise;
  /** Set on the party line when its ledger keeps bill-wise details. */
  billRef?: string;
}

export interface Issue {
  level: "error" | "warning";
  message: string;
}

export interface SalesVoucher {
  id: string;
  remoteId: string;
  rowNumbers: number[]; // as the user sees them in Excel, starting at 1
  date: string | null; // YYYYMMDD
  invoiceNo: string;
  party: string; // Tally's ledger name when matched, otherwise what the file says
  gstin: string;
  placeOfSupply: string;
  narration: string;
  taxable: Paise;
  cgst: Paise;
  sgst: Paise;
  igst: Paise;
  roundOff: Paise;
  total: Paise;
  lines: LedgerLine[];
  issues: Issue[];
  status: ReviewStatus;
}

export interface BuildInput {
  rows: unknown[][];
  headerRow: number; // 0-based index of the header in rows
  mapping: Mapping;
  settings: SalesSettings;
  company: Company;
  ledgers: Ledger[];
  today: string; // YYYYMMDD
}

interface ParsedRow {
  rowNumber: number;
  date: string | null;
  rawDate: string;
  invoiceNo: string;
  party: string;
  gstin: string;
  placeOfSupply: string;
  narration: string;
  taxable: Paise | null;
  rate: number | null;
  cgst: Paise | null;
  sgst: Paise | null;
  igst: Paise | null;
  total: Paise | null;
  badCells: string[];
}

const LABEL = Object.fromEntries(FIELDS.map((f) => [f.id, f.label])) as Record<FieldId, string>;
const normaliseName = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

function parseRate(value: unknown): number | null {
  const s = cellText(value).replace("%", "");
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return Number.NaN;
  // Excel percentage cells hold 0.18 for 18%.
  return Math.round((n > 0 && n < 1 ? n * 100 : n) * 100) / 100;
}

function parseRow(cells: unknown[], rowNumber: number, mapping: Mapping): ParsedRow {
  const badCells: string[] = [];
  const raw = (f: FieldId) => (mapping[f] === undefined ? "" : cells[mapping[f]!]);
  const text = (f: FieldId) => cellText(raw(f));
  const amount = (f: FieldId) => {
    const value = parseAmount(typeof raw(f) === "number" ? raw(f) : text(f));
    if (value === null && text(f)) badCells.push(LABEL[f]);
    return value;
  };
  const rate = parseRate(raw("gstRate"));
  if (Number.isNaN(rate)) badCells.push(LABEL.gstRate);

  return {
    rowNumber,
    date: parseDateCell(raw("date")),
    rawDate: text("date"),
    invoiceNo: text("invoiceNo"),
    party: text("party"),
    gstin: text("gstin").toUpperCase().replace(/\s/g, ""),
    placeOfSupply: text("placeOfSupply"),
    narration: text("narration"),
    taxable: amount("taxable"),
    rate: Number.isNaN(rate) ? null : rate,
    cgst: amount("cgst"),
    sgst: amount("sgst"),
    igst: amount("igst"),
    total: amount("total"),
    badCells,
  };
}

function isSkippable(r: ParsedRow): boolean {
  const empty = !r.rawDate && !r.invoiceNo && !r.party && r.taxable === null && r.total === null;
  return empty || TOTAL_ROW.test(r.invoiceNo) || TOTAL_ROW.test(r.party) || TOTAL_ROW.test(r.rawDate);
}

/** Rows with the same invoice number become one voucher, in the order they first appear. */
function groupRows(rows: ParsedRow[]): ParsedRow[][] {
  const groups = new Map<string, ParsedRow[]>();
  for (const r of rows) {
    const key = r.invoiceNo ? `inv:${r.invoiceNo.toLowerCase()}` : `row:${r.rowNumber}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  return [...groups.values()];
}

/** 32-bit FNV-1a; enough to keep REMOTEIDs short and stable for the same company and invoice. */
function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function remoteIdFor(company: Company, invoiceNo: string): string {
  return `th-sales-${hash(`${company.guid || company.name}|${invoiceNo.toLowerCase()}`)}`;
}

interface Context {
  input: BuildInput;
  ledgerNames: Set<string>;
  byName: Map<string, Ledger>;
  byGstin: Map<string, Ledger>;
  companyState: string | null;
}

function matchParty(name: string, gstin: string, ctx: Context): Ledger | null {
  return (gstin && ctx.byGstin.get(gstin)) || ctx.byName.get(normaliseName(name)) || null;
}

function isInterState(r: ParsedRow, party: Ledger | null, ctx: Context): boolean {
  const partyState =
    stateCodeOf(r.placeOfSupply) ?? (/^\d{2}/.test(r.gstin) ? r.gstin.slice(0, 2) : null) ?? stateCodeOf(party?.stateName ?? "");
  return Boolean(ctx.companyState && partyState && partyState !== ctx.companyState);
}

type Amounts = Pick<SalesVoucher, "taxable" | "cgst" | "sgst" | "igst">;

function rowAmounts(r: ParsedRow, interState: boolean, issues: Issue[]): Amounts {
  const hasTaxColumns = r.cgst !== null || r.sgst !== null || r.igst !== null;
  const taxOnFile = (r.cgst ?? 0) + (r.sgst ?? 0) + (r.igst ?? 0);
  let taxable = r.taxable;
  if (taxable === null && r.total !== null) {
    if (hasTaxColumns) taxable = r.total - taxOnFile;
    else if (r.rate) taxable = Math.round((r.total * 100) / (100 + r.rate));
    else taxable = r.total;
  }
  if (taxable === null) {
    issues.push({ level: "error", message: `Row ${r.rowNumber}: taxable value is empty` });
    return { taxable: 0, cgst: 0, sgst: 0, igst: 0 };
  }
  if (r.rate !== null && !GST_RATES.includes(r.rate)) {
    issues.push({ level: "warning", message: `Row ${r.rowNumber}: GST rate ${r.rate}% is not a standard rate` });
  }
  if (hasTaxColumns) return { taxable, cgst: r.cgst ?? 0, sgst: r.sgst ?? 0, igst: r.igst ?? 0 };
  if (!r.rate) return { taxable, cgst: 0, sgst: 0, igst: 0 };

  // When only the total was given, the tax is whatever is left after the taxable value.
  const tax = r.taxable === null ? r.total! - taxable : Math.round((taxable * r.rate) / 100);
  if (interState) return { taxable, cgst: 0, sgst: 0, igst: tax };
  const cgst = r.taxable === null ? Math.round(tax / 2) : Math.round((taxable * r.rate) / 200);
  return { taxable, cgst, sgst: r.taxable === null ? tax - cgst : cgst, igst: 0 };
}

/** The file's invoice total; multi-line invoices may repeat it on every row instead of splitting it. */
function fileTotal(rows: ParsedRow[], computed: Paise): Paise | null {
  const totals = rows.map((r) => r.total).filter((t): t is Paise => t !== null);
  if (!totals.length) return null;
  const summed = totals.reduce((a, b) => a + b, 0);
  const repeated = totals.length === rows.length && rows.length > 1 && totals.every((t) => t === totals[0]);
  if (repeated && Math.abs(totals[0] - computed) < Math.abs(summed - computed)) return totals[0];
  return summed;
}

function checkHeader(rows: ParsedRow[], ctx: Context, issues: Issue[]): void {
  const [first] = rows;
  const error = (message: string) => issues.push({ level: "error", message });
  const rowList = rows.map((r) => r.rowNumber).join(", ");

  if (rows.some((r) => r.date !== first.date)) error(`Invoice No repeats with different dates (rows ${rowList})`);
  if (rows.some((r) => normaliseName(r.party) !== normaliseName(first.party))) {
    error(`Invoice No repeats with different parties (rows ${rowList})`);
  }
  if (!first.invoiceNo) error("Invoice No is empty");
  for (const r of rows) for (const label of r.badCells) error(`Row ${r.rowNumber}: ${label} is not a number`);

  const { company, today } = ctx.input;
  if (!first.date) error(first.rawDate ? `Date "${first.rawDate}" is not a date` : "Date is empty");
  else if (company.booksFrom && first.date < company.booksFrom) {
    error(`Date is before the company's books begin (${formatTallyDate(company.booksFrom)})`);
  } else if (first.date > today) issues.push({ level: "warning", message: "Date is in the future" });

  if (first.gstin && !isValidGstin(first.gstin)) {
    issues.push({ level: "warning", message: `GSTIN ${first.gstin} is not valid (check for a typo)` });
  }
}

function buildLines(v: Amounts & { roundOff: Paise; total: Paise }, party: Ledger | null, partyName: string, invoiceNo: string, settings: SalesSettings): LedgerLine[] {
  const lines: LedgerLine[] = [
    { role: "Party", ledger: partyName, debit: v.total, credit: 0, billRef: party?.isBillWise ? invoiceNo : undefined },
    { role: "Sales", ledger: settings.salesLedger, debit: 0, credit: v.taxable },
    { role: "CGST", ledger: settings.cgstLedger, debit: 0, credit: v.cgst },
    { role: "SGST", ledger: settings.sgstLedger, debit: 0, credit: v.sgst },
    { role: "IGST", ledger: settings.igstLedger, debit: 0, credit: v.igst },
    { role: "Round Off", ledger: settings.roundOffLedger, debit: Math.max(-v.roundOff, 0), credit: Math.max(v.roundOff, 0) },
  ];
  return lines.filter((l, i) => i < 2 || l.debit !== 0 || l.credit !== 0);
}

/** The party line is checked separately, with a friendlier message. */
function checkLines(lines: LedgerLine[], ctx: Context, issues: Issue[]): void {
  for (const l of lines.slice(1)) {
    if (!l.ledger) issues.push({ level: "error", message: `Choose a ${l.role} ledger in step 2 (Map Columns)` });
    else if (!ctx.ledgerNames.has(l.ledger)) issues.push({ level: "error", message: `Ledger "${l.ledger}" is not in Tally` });
  }
}

function toVoucher(rows: ParsedRow[], index: number, ctx: Context): SalesVoucher {
  const [first] = rows;
  const issues: Issue[] = [];
  checkHeader(rows, ctx, issues);

  const party = matchParty(first.party, first.gstin, ctx);
  if (!first.party && !party) issues.push({ level: "error", message: "Party name is empty" });
  else if (!party) {
    issues.push({ level: "error", message: `Party "${first.party}" is not a ledger in Tally. Create it in Tally, then click Refresh from Tally.` });
  }

  const interState = isInterState(first, party, ctx);
  const parts = rows.map((r) => rowAmounts(r, interState, issues));
  const sum = (k: keyof Amounts) => parts.reduce((acc, p) => acc + p[k], 0);
  const amounts: Amounts = { taxable: sum("taxable"), cgst: sum("cgst"), sgst: sum("sgst"), igst: sum("igst") };
  const computed = amounts.taxable + amounts.cgst + amounts.sgst + amounts.igst;

  if (interState && amounts.cgst + amounts.sgst > 0) {
    issues.push({ level: "warning", message: "CGST/SGST charged, but the customer is in another state (should be IGST)" });
  } else if (!interState && amounts.igst > 0 && ctx.companyState) {
    issues.push({ level: "warning", message: "IGST charged, but the customer is in the same state (should be CGST + SGST)" });
  }

  const onFile = fileTotal(rows, computed);
  let roundOff = onFile === null ? 0 : onFile - computed;
  if (Math.abs(roundOff) > MAX_ROUND_OFF) {
    issues.push({
      level: "error",
      message: `Total ₹${formatPaise(onFile!)} does not match taxable + tax ₹${formatPaise(computed)} (difference ₹${formatPaise(roundOff)})`,
    });
    roundOff = 0;
  }
  const total = computed + roundOff;
  if (total <= 0) issues.push({ level: "error", message: "Invoice total is zero or negative" });

  const partyName = party?.name ?? first.party;
  const lines = buildLines({ ...amounts, roundOff, total }, party, partyName, first.invoiceNo, ctx.input.settings);
  checkLines(lines, ctx, issues);

  const hasError = issues.some((i) => i.level === "error");
  return {
    id: `v${index}`,
    remoteId: remoteIdFor(ctx.input.company, first.invoiceNo || `row-${first.rowNumber}`),
    rowNumbers: rows.map((r) => r.rowNumber),
    date: first.date,
    invoiceNo: first.invoiceNo,
    party: partyName,
    gstin: first.gstin || party?.gstin || "",
    placeOfSupply: first.placeOfSupply,
    narration: first.narration || `Sales as per invoice ${first.invoiceNo}`,
    ...amounts,
    roundOff,
    total,
    lines,
    issues,
    status: hasError ? "error" : issues.length ? "warning" : "ready",
  };
}

export function buildSalesVouchers(input: BuildInput): SalesVoucher[] {
  const ctx: Context = {
    input,
    ledgerNames: new Set(input.ledgers.map((l) => l.name)),
    byName: new Map(input.ledgers.map((l) => [normaliseName(l.name), l])),
    byGstin: new Map(input.ledgers.filter((l) => l.gstin).map((l) => [l.gstin, l])),
    companyState: stateCodeOf(input.company.stateName),
  };
  const parsed = input.rows
    .slice(input.headerRow + 1)
    .map((cells, i) => parseRow(cells, input.headerRow + i + 2, input.mapping))
    .filter((r) => !isSkippable(r));
  return groupRows(parsed).map((rows, i) => toVoucher(rows, i, ctx));
}
