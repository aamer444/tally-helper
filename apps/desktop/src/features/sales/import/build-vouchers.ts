import type { ReviewStatus } from "../../../components/ui/StatusBadge";
import { parseDateCell } from "../../../lib/dates";
import { formatPaise, formatTallyDate } from "../../../lib/format";
import { parseAmount, type Paise } from "../../../lib/money";
import type { Company, Ledger, StockItem } from "../../tally/types";
import type { BillItems } from "../pdf/parse-items";
import { cellText, fieldsFor, type FieldId, type Mapping } from "./fields";
import { GST_RATES, isValidGstin, stateCodeOf } from "./gst";
import { KINDS, type InvoiceKind, type KindConfig } from "./kind";
import { partyKey, suggestParties } from "./party-match";

const MAX_ROUND_OFF: Paise = 100; // a gap of up to ₹1 between the file's total and taxable + tax
const TOTAL_ROW = /^(grand\s*)?(sub\s*)?total\b/i;

export interface InvoiceSettings {
  voucherType: string;
  mainLedger: string;
  cgstLedger: string;
  sgstLedger: string;
  igstLedger: string;
  roundOffLedger: string;
  /** Takes a bill's discount when its product lines add up to more than the taxable value. */
  discountLedger: string;
  /** Enter bills that list products as item invoices, so Tally updates stock. */
  withStock: boolean;
}

export interface LedgerLine {
  role: "Party" | "Sales" | "Purchase" | "CGST" | "SGST" | "IGST" | "Discount" | "Round Off";
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

export interface InvoiceVoucher {
  kind: InvoiceKind;
  id: string;
  remoteId: string;
  rowNumbers: number[]; // as the user sees them in Excel, starting at 1
  date: string | null; // YYYYMMDD
  invoiceNo: string;
  party: string; // Tally's ledger name when matched, otherwise what the file says
  /** The file names a party that has no ledger in Tally yet; the user can create it from review. */
  partyMissing: boolean;
  /** The party's name exactly as the file or bill prints it. */
  partyOnBill: string;
  /** Existing ledgers whose names look like the missing party's, closest first. */
  partySuggestions: string[];
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
  /** Stock lines of an item invoice; empty for an accounting invoice. */
  items: VoucherItem[];
  /** Products on the bill that have no stock item in Tally yet. */
  missingItems: MissingItem[];
  discount: Paise;
  issues: Issue[];
  status: ReviewStatus;
}

export interface VoucherItem {
  name: string; // Tally's stock item name when matched, otherwise the bill's description
  qty: number;
  unit: string;
  rate: number;
  amount: Paise;
}

export interface MissingItem {
  name: string;
  hsn: string;
  unit: string;
}

export interface BuildInput {
  kind: InvoiceKind;
  rows: unknown[][];
  headerRow: number; // 0-based index of the header in rows
  mapping: Mapping;
  settings: InvoiceSettings;
  company: Company;
  ledgers: Ledger[];
  today: string; // YYYYMMDD
  /** Product lines of PDF bills, by row number; see ImportFile.items. */
  items?: ReadonlyMap<number, BillItems>;
  stockItems?: StockItem[];
  /** The user's earlier choices: a party name as bills print it (partyKey) → the Tally ledger it is. */
  partyAliases?: ReadonlyMap<string, string>;
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

const normaliseName = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

function parseRate(value: unknown): number | null {
  const s = cellText(value).replace("%", "");
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return Number.NaN;
  // Excel percentage cells hold 0.18 for 18%.
  return Math.round((n > 0 && n < 1 ? n * 100 : n) * 100) / 100;
}

function parseRow(cells: unknown[], rowNumber: number, mapping: Mapping, kind: KindConfig): ParsedRow {
  const LABEL = Object.fromEntries(fieldsFor(kind).map((f) => [f.id, f.label])) as Record<FieldId, string>;
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

/**
 * Rows with the same invoice number become one voucher, in the order they first appear.
 * Different suppliers can use the same bill number, so purchases group by supplier too: by the
 * Tally ledger when it matches (the same identity the REMOTEID uses), otherwise as the file names it.
 */
function groupRows(rows: ParsedRow[], ctx: Context): ParsedRow[][] {
  const groups = new Map<string, ParsedRow[]>();
  for (const r of rows) {
    const supplier = () => matchParty(r.party, r.gstin, ctx)?.name.toLowerCase() ?? (r.gstin || normaliseName(r.party));
    const party = ctx.kind.kind === "purchase" ? `${supplier()}|` : "";
    const key = r.invoiceNo ? `inv:${party}${r.invoiceNo.toLowerCase()}` : `row:${r.rowNumber}`;
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

/**
 * A supplier's bill is only unique together with the supplier, so `party` (the Tally ledger name,
 * which stays the same however the bill was imported) is part of a purchase's ID.
 */
export function remoteIdFor(company: Company, invoiceNo: string, kind: KindConfig = KINDS.sales, party = ""): string {
  const key = kind.kind === "purchase" ? `${party.toLowerCase()}|${invoiceNo.toLowerCase()}` : invoiceNo.toLowerCase();
  return `${kind.remoteIdPrefix}-${hash(`${company.guid || company.name}|${key}`)}`;
}

interface Context {
  input: BuildInput;
  kind: KindConfig;
  ledgerNames: Set<string>;
  byName: Map<string, Ledger>;
  byGstin: Map<string, Ledger>;
  stockByName: Map<string, StockItem>;
  companyState: string | null;
}

interface Stock {
  items: VoucherItem[];
  missing: MissingItem[];
  discount: Paise;
}

const quantityIn = (text: string) => Number(text.replace(/,/g, "").match(/\d+(?:\.\d+)?/)?.[0] ?? Number.NaN);

/**
 * The bill's product lines as stock entries. Product names in Tally are the supplier's, so a
 * product matches a stock item by name. Whatever the products add up to beyond the taxable value
 * is the bill's discount.
 */
function stockLines(rows: ParsedRow[], taxable: Paise, ctx: Context, issues: Issue[]): Stock | null {
  const { items, settings } = ctx.input;
  if (!settings.withStock || !items) return null;
  const lines = rows.flatMap((r) => {
    const bill = items.get(r.rowNumber);
    return bill ? bill.lines.map((line) => ({ line, unit: bill.unit })) : [];
  });
  if (!lines.length) return null;

  const stock: VoucherItem[] = [];
  const missing = new Map<string, MissingItem>();
  for (const { line, unit } of lines) {
    const amount = parseAmount(line.amount);
    const qty = quantityIn(line.qty);
    if (amount === null || !(qty > 0)) {
      issues.push({ level: "error", message: `Product "${line.description}": quantity or amount is not a number` });
      continue;
    }
    const match = ctx.stockByName.get(normaliseName(line.description));
    if (!match && !missing.has(normaliseName(line.description))) {
      missing.set(normaliseName(line.description), { name: line.description, hsn: line.hsn, unit });
    }
    stock.push({ name: match?.name ?? line.description, qty, unit: match?.baseUnits || unit, rate: quantityIn(line.rate), amount });
  }

  const productsTotal = stock.reduce((sum, i) => sum + i.amount, 0);
  const discount = productsTotal - taxable;
  if (discount < 0) {
    issues.push({ level: "error", message: `Products add up to ₹${formatPaise(productsTotal)}, less than the taxable value ₹${formatPaise(taxable)}` });
  }
  if (missing.size) {
    const one = missing.size === 1;
    issues.push({
      level: "error",
      message: `${missing.size} ${one ? "product is not a stock item" : "products are not stock items"} in Tally. Create ${one ? "it" : "them"} here.`,
    });
  }
  return { items: stock, missing: [...missing.values()], discount: Math.max(discount, 0) };
}

/** By GSTIN first (the name may be spelled any way), then a name the user linked earlier, then the exact name. */
function matchParty(name: string, gstin: string, ctx: Context): Ledger | null {
  const alias = ctx.input.partyAliases?.get(partyKey(name));
  return (
    (gstin && ctx.byGstin.get(gstin)) || (alias && ctx.byName.get(normaliseName(alias))) || ctx.byName.get(normaliseName(name)) || null
  );
}

/**
 * Sales: the customer's place of supply decides. Purchases: the supplier's own state does,
 * because a bill's "place of supply" is usually our own state. A matched supplier ledger is
 * trusted over the row's GSTIN, which on a PDF bill may be our own.
 */
function isInterState(r: ParsedRow, party: Ledger | null, ctx: Context): boolean {
  const codeOf = (gstin: string) => (/^\d{2}/.test(gstin) ? gstin.slice(0, 2) : null);
  const fromGstin = codeOf(r.gstin);
  const fromLedger = codeOf(party?.gstin ?? "") ?? stateCodeOf(party?.stateName ?? "");
  const partyState =
    ctx.kind.kind === "purchase"
      ? (fromLedger ?? fromGstin ?? stateCodeOf(r.placeOfSupply))
      : (stateCodeOf(r.placeOfSupply) ?? fromGstin ?? fromLedger);
  return Boolean(ctx.companyState && partyState && partyState !== ctx.companyState);
}

type Amounts = Pick<InvoiceVoucher, "taxable" | "cgst" | "sgst" | "igst">;

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

/** Written the sales way (party Dr, income and output tax Cr); a purchase is the mirror image. */
function buildLines(
  v: Amounts & { roundOff: Paise; total: Paise; discount: Paise },
  party: Ledger | null,
  partyName: string,
  invoiceNo: string,
  ctx: Context,
): LedgerLine[] {
  const { settings } = ctx.input;
  // With product lines, the purchase/sales ledger carries the products' full value and the discount sits on its own line.
  const lines: LedgerLine[] = [
    { role: "Party", ledger: partyName, debit: v.total, credit: 0, billRef: party?.isBillWise ? invoiceNo : undefined },
    { role: ctx.kind.mainRole, ledger: settings.mainLedger, debit: 0, credit: v.taxable + v.discount },
    { role: "CGST", ledger: settings.cgstLedger, debit: 0, credit: v.cgst },
    { role: "SGST", ledger: settings.sgstLedger, debit: 0, credit: v.sgst },
    { role: "IGST", ledger: settings.igstLedger, debit: 0, credit: v.igst },
    { role: "Discount", ledger: settings.discountLedger, debit: v.discount, credit: 0 },
    { role: "Round Off", ledger: settings.roundOffLedger, debit: Math.max(-v.roundOff, 0), credit: Math.max(v.roundOff, 0) },
  ];
  const used = lines.filter((l, i) => i < 2 || l.debit !== 0 || l.credit !== 0);
  return ctx.kind.kind === "purchase" ? used.map((l) => ({ ...l, debit: l.credit, credit: l.debit })) : used;
}

/** The party line is checked separately, with a friendlier message. */
function checkLines(lines: LedgerLine[], ctx: Context, issues: Issue[]): void {
  for (const l of lines.slice(1)) {
    if (!l.ledger) issues.push({ level: "error", message: `Choose a ${l.role} ledger in step 2` });
    else if (!ctx.ledgerNames.has(l.ledger)) issues.push({ level: "error", message: `Ledger "${l.ledger}" is not in Tally` });
  }
}

function toVoucher(rows: ParsedRow[], index: number, ctx: Context): InvoiceVoucher {
  const [first] = rows;
  const issues: Issue[] = [];
  checkHeader(rows, ctx, issues);

  const party = matchParty(first.party, first.gstin, ctx);
  if (!first.party && !party) issues.push({ level: "error", message: "Party name is empty" });
  else if (!party) {
    issues.push({ level: "error", message: `Party "${first.party}" is not a ledger in Tally. Create it here, or in Tally and then click Refresh from Tally.` });
  }

  const interState = isInterState(first, party, ctx);
  const parts = rows.map((r) => rowAmounts(r, interState, issues));
  const sum = (k: keyof Amounts) => parts.reduce((acc, p) => acc + p[k], 0);
  const amounts: Amounts = { taxable: sum("taxable"), cgst: sum("cgst"), sgst: sum("sgst"), igst: sum("igst") };
  const computed = amounts.taxable + amounts.cgst + amounts.sgst + amounts.igst;

  const who = ctx.kind.partyWord;
  if (interState && amounts.cgst + amounts.sgst > 0) {
    issues.push({ level: "warning", message: `CGST/SGST charged, but the ${who} is in another state (should be IGST)` });
  } else if (!interState && amounts.igst > 0 && ctx.companyState) {
    issues.push({ level: "warning", message: `IGST charged, but the ${who} is in the same state (should be CGST + SGST)` });
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
  const stock = stockLines(rows, amounts.taxable, ctx, issues);
  const discount = stock?.discount ?? 0;
  const lines = buildLines({ ...amounts, roundOff, total, discount }, party, partyName, first.invoiceNo, ctx);
  checkLines(lines, ctx, issues);

  const hasError = issues.some((i) => i.level === "error");
  const narration = ctx.kind.kind === "purchase" ? `Purchase as per bill ${first.invoiceNo}` : `Sales as per invoice ${first.invoiceNo}`;
  return {
    kind: ctx.kind.kind,
    id: `v${index}`,
    remoteId: remoteIdFor(ctx.input.company, first.invoiceNo || `row-${first.rowNumber}`, ctx.kind, partyName),
    rowNumbers: rows.map((r) => r.rowNumber),
    date: first.date,
    invoiceNo: first.invoiceNo,
    party: partyName,
    partyMissing: Boolean(first.party) && !party,
    partyOnBill: first.party,
    partySuggestions: party || !first.party ? [] : suggestParties(first.party, ctx.input.ledgers),
    gstin: first.gstin || party?.gstin || "",
    placeOfSupply: first.placeOfSupply,
    narration: first.narration || narration,
    ...amounts,
    roundOff,
    total,
    lines,
    items: stock?.items ?? [],
    missingItems: stock?.missing ?? [],
    discount,
    issues,
    status: hasError ? "error" : issues.length ? "warning" : "ready",
  };
}

export function buildVouchers(input: BuildInput): InvoiceVoucher[] {
  const kind = KINDS[input.kind];
  const ctx: Context = {
    input,
    kind,
    ledgerNames: new Set(input.ledgers.map((l) => l.name)),
    byName: new Map(input.ledgers.map((l) => [normaliseName(l.name), l])),
    byGstin: new Map(input.ledgers.filter((l) => l.gstin).map((l) => [l.gstin, l])),
    stockByName: new Map((input.stockItems ?? []).map((s) => [normaliseName(s.name), s])),
    companyState: stateCodeOf(input.company.stateName),
  };
  const parsed = input.rows
    .slice(input.headerRow + 1)
    .map((cells, i) => parseRow(cells, input.headerRow + i + 2, input.mapping, kind))
    .filter((r) => !isSkippable(r));
  return groupRows(parsed, ctx).map((rows, i) => toVoucher(rows, i, ctx));
}
