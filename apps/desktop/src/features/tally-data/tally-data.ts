import { parseAmount, type Paise } from "../../lib/money";
import { childText } from "../../lib/xml";
import { collectionRequest, nameOf, rejectLineError } from "../tally/masters";
import { postToTally } from "../tally/tally-client";

// Read-only views of a company's books. Tally signs amounts: negative is Debit, positive is Credit.

const BIG_TIMEOUT_MS = 120_000;

export interface LedgerRow {
  name: string;
  group: string;
  gstin: string;
  stateName: string;
  opening: Paise;
  closing: Paise;
}

export interface GroupRow {
  name: string;
  parent: string;
}

export interface StockItemRow {
  name: string;
  group: string;
  unit: string;
  closingQty: string;
  closingRate: string;
  closingValue: Paise;
}

export interface VoucherLine {
  ledger: string;
  amount: Paise;
}

export interface InventoryLine {
  item: string;
  qty: string;
  rate: string;
  amount: Paise;
}

export interface VoucherRow {
  id: string;
  date: string; // YYYYMMDD
  type: string;
  number: string;
  party: string;
  narration: string;
  cancelled: boolean;
  amount: Paise; // total of the debit side
  lines: VoucherLine[];
  items: InventoryLine[];
}

const amountOf = (el: Element, tag: string): Paise => parseAmount(childText(el, tag)) ?? 0;

/** Direct child lists only, so bill and bank allocations nested inside a line are not counted twice. */
function childLists(el: Element, ...tags: string[]): Element[] {
  for (const tag of tags) {
    const found = [...el.children].filter((c) => c.tagName === tag);
    if (found.length) return found;
  }
  return [];
}

export function parseLedgers(doc: Document): LedgerRow[] {
  return [...doc.getElementsByTagName("LEDGER")]
    .map((el) => ({
      name: nameOf(el),
      group: childText(el, "PARENT"),
      gstin: childText(el, "PARTYGSTIN").toUpperCase(),
      stateName: childText(el, "LEDSTATENAME"),
      opening: amountOf(el, "OPENINGBALANCE"),
      closing: amountOf(el, "CLOSINGBALANCE"),
    }))
    .filter((l) => l.name)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function parseGroups(doc: Document): GroupRow[] {
  return [...doc.getElementsByTagName("GROUP")]
    .map((el) => ({ name: nameOf(el), parent: childText(el, "PARENT") }))
    .filter((g) => g.name)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function parseStockItems(doc: Document): StockItemRow[] {
  return [...doc.getElementsByTagName("STOCKITEM")]
    .map((el) => ({
      name: nameOf(el),
      group: childText(el, "PARENT"),
      unit: childText(el, "BASEUNITS"),
      closingQty: childText(el, "CLOSINGBALANCE"),
      closingRate: childText(el, "CLOSINGRATE"),
      closingValue: Math.abs(amountOf(el, "CLOSINGVALUE")),
    }))
    .filter((s) => s.name)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function parseVoucher(el: Element, index: number): VoucherRow {
  const lines = childLists(el, "ALLLEDGERENTRIES.LIST", "LEDGERENTRIES.LIST").map((l) => ({
    ledger: childText(l, "LEDGERNAME"),
    amount: amountOf(l, "AMOUNT"),
  }));
  const items = childLists(el, "ALLINVENTORYENTRIES.LIST", "INVENTORYENTRIES.LIST").map((l) => ({
    item: childText(l, "STOCKITEMNAME"),
    qty: childText(l, "ACTUALQTY") || childText(l, "BILLEDQTY"),
    rate: childText(l, "RATE"),
    amount: Math.abs(amountOf(l, "AMOUNT")),
  }));
  return {
    id: childText(el, "GUID") || el.getAttribute("REMOTEID") || `row-${index}`,
    date: childText(el, "DATE"),
    type: childText(el, "VOUCHERTYPENAME") || el.getAttribute("VCHTYPE") || "",
    number: childText(el, "VOUCHERNUMBER"),
    party: childText(el, "PARTYLEDGERNAME"),
    narration: childText(el, "NARRATION"),
    cancelled: childText(el, "ISCANCELLED") === "Yes",
    amount: -lines.reduce((sum, l) => sum + Math.min(l.amount, 0), 0),
    lines,
    items,
  };
}

export function parseVouchers(doc: Document): VoucherRow[] {
  return [...doc.getElementsByTagName("VOUCHER")]
    .filter((el) => el.parentElement?.tagName !== "CMPINFO")
    .map(parseVoucher)
    .sort((a, b) => a.date.localeCompare(b.date) || a.number.localeCompare(b.number, undefined, { numeric: true }));
}

async function exportCollection(url: string, company: string, type: string, fetch: string, staticVars = "") {
  const doc = await postToTally(url, collectionRequest(company, `TH${type}List`, type, fetch, staticVars), BIG_TIMEOUT_MS);
  rejectLineError(doc);
  return doc;
}

export async function fetchLedgerBook(url: string, company: string): Promise<LedgerRow[]> {
  const fetch = "Name, Parent, PartyGSTIN, LedStateName, OpeningBalance, ClosingBalance";
  return parseLedgers(await exportCollection(url, company, "Ledger", fetch));
}

export async function fetchGroups(url: string, company: string): Promise<GroupRow[]> {
  return parseGroups(await exportCollection(url, company, "Group", "Name, Parent"));
}

export async function fetchStockItems(url: string, company: string): Promise<StockItemRow[]> {
  const fetch = "Name, Parent, BaseUnits, ClosingBalance, ClosingRate, ClosingValue";
  return parseStockItems(await exportCollection(url, company, "StockItem", fetch));
}

/** Vouchers dated from..to (YYYYMMDD, inclusive). Without a period Tally returns only the current one. */
export async function fetchVouchers(url: string, company: string, from: string, to: string): Promise<VoucherRow[]> {
  const fetch = [
    "GUID, Date, VoucherTypeName, VoucherNumber, PartyLedgerName, Narration, IsCancelled",
    "AllLedgerEntries.LedgerName, AllLedgerEntries.Amount",
    "AllInventoryEntries.StockItemName, AllInventoryEntries.ActualQty, AllInventoryEntries.Rate, AllInventoryEntries.Amount",
  ].join(", ");
  const period = `\n   <SVFROMDATE>${from}</SVFROMDATE><SVTODATE>${to}</SVTODATE>`;
  return parseVouchers(await exportCollection(url, company, "Voucher", fetch, period));
}
