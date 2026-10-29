import { parseDateCell } from "../../../lib/dates";
import { parseAmount } from "../../../lib/money";
import { parseItems, unitIn, type BillItems } from "./parse-items";
import type { TextItem } from "./pdf-text";

/**
 * What we could read from one supplier bill. Values stay as printed, so the user can correct them
 * in the Check Bills step; empty means "not found".
 */
export interface PdfBill {
  fileName: string;
  supplierName: string;
  /** Every GSTIN printed on the bill, in reading order (supplier's and ours). */
  gstins: string[];
  /** The supplier's GSTIN when the user picked one; empty lets it be matched to Tally's ledgers. */
  gstin: string;
  invoiceNo: string;
  date: string;
  taxable: string;
  cgst: string;
  sgst: string;
  igst: string;
  total: string;
  /** Product lines found on the bill; empty when it has none we can read. */
  items: BillItems;
}

// Every supplier designs their bill differently, so fields are found by the label printed next to
// them, never by position on the page.
const LABELS = {
  invoiceNo: /^(?:tax\s+)?(?:invoice|inv|bill)\s*\.?\s*(?:no\b|number\b|num\b|#)\.?/i,
  invoiceDate: /^(?:invoice|inv|bill)\s*\.?\s*date\b/i,
  date: /^(?:dated|date)\b(?!\s*of)/i,
  taxable: /^(?:total\s+)?(?:taxable\s+(?:amount|value|amt)|assessable\s+value)\b/i,
  cgst: /^(?:add\s*:?\s*)?(?:cgst|central\s+(?:gst|tax))/i,
  sgst: /^(?:add\s*:?\s*)?(?:sgst|utgst|state\s+(?:gst|tax)|state\s*\/\s*ut\s+tax)/i,
  igst: /^(?:add\s*:?\s*)?(?:igst|integrated\s+(?:gst|tax))/i,
  total: /^(?:gross\s+amount|grand\s+total|invoice\s+(?:total|value|amount)|total\s+invoice\s+(?:value|amount)|net\s+(?:amount|payable|total)|bill\s+amount|total\s+amount(?:\s+after\s+tax)?|amount\s+payable|total\s+payable)\b/i,
};
/** "Bill Amount In Words", "Total Amount Before Tax" and "CGST Rate" are labels of something else. */
const NOT_A_VALUE_LABEL = /in\s+words|before\s+tax|\brate\b/i;
const NOT_A_NAME =
  /\b(?:invoice|original|duplicate|triplicate|copy|recipient|bill of supply|challan|estimate|gstin|gst\s*no|cin|pan|phone|ph|mob(?:ile)?\s*(?:no|:)|e-?mail)\b|www\.|@|\d{4,}/i;
const GSTIN_IN_TEXT = /\b\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/g;
const GSTIN_SHAPE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i;
const SEPARATORS = /^[\s:.\-–=]+/;
const TAX_RATE = /^\s*@?\s*\d{1,2}(?:\.\d+)?\s*%?(?=\s|$|[:\-])/;
const MIN_HEIGHT = 6;

const height = (t: TextItem) => Math.max(t.h, MIN_HEIGHT);
const sameLine = (a: TextItem, b: TextItem) => a.page === b.page && Math.abs(a.y - b.y) <= Math.max(height(a), height(b)) * 0.6;
const readingOrder = (a: TextItem, b: TextItem) => a.page - b.page || b.y - a.y || a.x - b.x;

/** Words a PDF stores separately ("Invoice", "No.") become one phrase; wide gaps keep columns apart. */
export function toPhrases(items: TextItem[]): TextItem[] {
  return phraseLines(items).flat();
}

/** The page's text as lines in reading order, each line's phrases from left to right. */
export function phraseLines(items: TextItem[]): TextItem[][] {
  const lines: TextItem[][] = [];
  for (const item of [...items].sort(readingOrder)) {
    const line = lines.find((l) => sameLine(l[0], item));
    if (line) line.push(item);
    else lines.push([item]);
  }
  return lines.map((line) => {
    const phrases: TextItem[] = [];
    for (const item of line.sort((a, b) => a.x - b.x)) {
      const prev = phrases.at(-1);
      const gap = prev ? item.x - (prev.x + prev.w) : Infinity;
      if (prev && gap <= height(item) * 0.35) {
        const text = `${prev.text}${gap > height(item) * 0.1 ? " " : ""}${item.text}`;
        phrases[phrases.length - 1] = { ...prev, text, w: item.x + item.w - prev.x, h: Math.max(prev.h, item.h) };
      } else {
        phrases.push(item);
      }
    }
    return phrases;
  });
}

function moneyIn(text: string): string | null {
  const t = text.replace(/^(?:₹|rs\.?|inr)\s*/i, "").replace(/\s*(?:dr|cr)\.?$/i, "").trim();
  if (!/^\(?-?\d[\d,]*(?:\.\d{1,2})?\)?$/.test(t)) return null;
  return parseAmount(t) === null ? null : t;
}

const hasPaise = (s: string) => /\.\d{2}\)?$/.test(s);

/** Phrases printed to the right of `label` on the same line, nearest first. */
function rightOf(label: TextItem, phrases: TextItem[]): TextItem[] {
  return phrases.filter((p) => p !== label && sameLine(p, label) && p.x >= label.x + label.w - 1).sort((a, b) => a.x - b.x);
}

type Extract = (rest: string, label: TextItem, phrases: TextItem[]) => string | null;

/** Tries every phrase that starts with `label`; the bill's summary is at the end, so amounts search from the bottom. */
function find(phrases: TextItem[], label: RegExp, extract: Extract, from: "top" | "bottom"): string {
  const ordered = from === "top" ? phrases : [...phrases].reverse();
  for (const p of ordered) {
    const m = label.exec(p.text);
    if (!m || NOT_A_VALUE_LABEL.test(p.text)) continue;
    const value = extract(p.text.slice(m[0].length), p, phrases);
    if (value) return value;
  }
  return "";
}

/** "IGST @ 18% 1,800.00", "igst5 | 101499.46", "Gross Amount ... 2131488.61" on a slightly lower baseline. */
const amount =
  (isTax: boolean): Extract =>
  (rest, label, phrases) => {
    const inline = (isTax ? rest.replace(TAX_RATE, "") : rest).replace(SEPARATORS, "").trim();
    if (inline) {
      const value = moneyIn(inline) ?? moneyIn(inline.split(/\s+/).at(-1)!);
      if (value) return value;
    }
    const values = rightOf(label, phrases)
      .map((p) => moneyIn(p.text))
      .filter((v): v is string => v !== null);
    return values.find(hasPaise) ?? values[0] ?? null;
  };

/** The first thing after the label, inline ("Invoice No: 123") or in the next column. */
function firstValue(rest: string, label: TextItem, phrases: TextItem[]): string | null {
  const inline = rest.replace(SEPARATORS, "").trim();
  if (inline) return inline;
  const next = rightOf(label, phrases).find((p) => p.text.replace(SEPARATORS, "").trim());
  return next ? next.text.replace(SEPARATORS, "").trim() : null;
}

const invoiceNo: Extract = (rest, label, phrases) => {
  const token = firstValue(rest, label, phrases)?.split(/\s+/)[0].replace(/[,;]$/, "");
  if (!token || token.length > 40 || !/\d/.test(token) || GSTIN_SHAPE.test(token)) return null;
  return token;
};

/** Keeps the date as printed ("07/09/2026", "5 Apr 2026") once it is known to be a real date. */
const date: Extract = (rest, label, phrases) => {
  const value = firstValue(rest, label, phrases);
  if (!value) return null;
  const words = value.split(/\s+/);
  return [words.slice(0, 3).join(" "), words[0], value].find((c) => parseDateCell(c) !== null) ?? null;
};

/** The supplier's name is usually the biggest text near the top of the first page. */
function supplierName(phrases: TextItem[]): string {
  const first = phrases.filter((p) => p.page === 1);
  if (!first.length) return "";
  const ys = first.map((p) => p.y);
  const top = Math.min(...ys) + (Math.max(...ys) - Math.min(...ys)) * 0.6;
  const candidates = first.filter((p) => p.y >= top && /[a-z]{3}/i.test(p.text) && !NOT_A_NAME.test(p.text));
  candidates.sort((a, b) => b.h - a.h || b.y - a.y);
  return candidates[0]?.text ?? "";
}

function gstinsIn(phrases: TextItem[]): string[] {
  const found = phrases.flatMap((p) => p.text.toUpperCase().match(GSTIN_IN_TEXT) ?? []);
  return [...new Set(found)];
}

export function parseBill(items: TextItem[], fileName: string): PdfBill {
  const lines = phraseLines(items);
  const phrases = lines.flat();
  return {
    items: { lines: parseItems(lines), unit: unitIn(phrases) },
    fileName,
    supplierName: supplierName(phrases),
    gstins: gstinsIn(phrases),
    gstin: "",
    invoiceNo: find(phrases, LABELS.invoiceNo, invoiceNo, "top"),
    date: find(phrases, LABELS.invoiceDate, date, "top") || find(phrases, LABELS.date, date, "top"),
    taxable: find(phrases, LABELS.taxable, amount(false), "bottom"),
    cgst: find(phrases, LABELS.cgst, amount(true), "bottom"),
    sgst: find(phrases, LABELS.sgst, amount(true), "bottom"),
    igst: find(phrases, LABELS.igst, amount(true), "bottom"),
    total: find(phrases, LABELS.total, amount(false), "bottom"),
  };
}
