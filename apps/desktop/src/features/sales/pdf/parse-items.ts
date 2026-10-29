import type { TextItem } from "./pdf-text";

/** One product line of a bill, as printed. */
export interface BillItem {
  description: string;
  hsn: string;
  qty: string;
  rate: string;
  amount: string;
}

/** A discount the user typed for a bill: a % of its products, or a rupee amount. */
export interface BillDiscount {
  value: string;
  mode: "percent" | "amount";
}

/** A bill's products and the unit its quantities are in (e.g. "PAIR"; empty when not printed). */
export interface BillItems {
  lines: BillItem[];
  unit: string;
  /** Left out (or blank) to take the discount from the bill: products total less taxable value. */
  discount?: BillDiscount;
}

const NUMBER = /^\(?(-?\d[\d,]*(?:\.\d+)?)\)?(?:\s*[a-z]{2,6}\.?)?$/i;
const MONEY = /^-?\d[\d,]*\.\d{2}$/;
const HSN = /^\d{4,8}$/;
const UNIT_IN_HEADING = /\(\s*(pairs?|prs|pcs|nos|kgs?|box(?:es)?|doz(?:en)?|mtrs?|ltrs?|sets?|units?)\s*\)/i;
const LINE_ALIGN = 3; // points: a wrapped description starts where the description above started
const MATCH_TOLERANCE = 0.001; // qty × rate may differ from the amount by rounding

const numberIn = (text: string): number | null => {
  const m = NUMBER.exec(text.trim());
  return m ? Number(m[1].replace(/,/g, "")) : null;
};
const hasLetters = (text: string) => /[a-z]{2}/i.test(text);

interface Found {
  item: BillItem;
  descriptionX: number;
}

/**
 * A product line is a row where some quantity × rate equals the row's amount (its rightmost
 * money value). That holds whatever the columns are called or in which order they come, so the
 * same rule reads every supplier's layout.
 */
function readRow(line: TextItem[]): Found | null {
  let amountAt = line.length - 1;
  while (amountAt >= 0 && !MONEY.test(line[amountAt].text.trim())) amountAt--;
  if (amountAt < 2) return null;
  const amount = numberIn(line[amountAt].text)!;
  if (amount <= 0) return null;

  for (let r = amountAt - 1; r > 0; r--) {
    const rate = numberIn(line[r].text);
    if (rate === null || rate <= 0) continue;
    for (let q = r - 1; q >= 0; q--) {
      const qty = numberIn(line[q].text);
      if (qty === null || qty <= 0 || Math.abs(qty * rate - amount) > Math.max(1, amount * MATCH_TOLERANCE)) continue;
      const description = line.slice(0, q).filter((p) => hasLetters(p.text)).sort((a, b) => b.text.length - a.text.length)[0];
      if (!description) return null;
      const hsn = line.slice(0, line.indexOf(description)).find((p) => HSN.test(p.text.trim()));
      return {
        item: { description: description.text.trim(), hsn: hsn?.text.trim() ?? "", qty: line[q].text.trim(), rate: line[r].text.trim(), amount: line[amountAt].text.trim() },
        descriptionX: description.x,
      };
    }
  }
  return null;
}

/** Product lines of a bill, with descriptions that wrap onto the next line joined back together. */
export function parseItems(lines: TextItem[][]): BillItem[] {
  const items: BillItem[] = [];
  let last: Found | null = null;
  for (const line of lines) {
    const found = readRow(line);
    if (found) {
      items.push(found.item);
      last = found;
      continue;
    }
    // Section headings ("HAWAI FOOTWEARS") are centred; the rest of a wrapped description is not.
    const [only] = line;
    // Size ranges like "8X10" carry a single letter, so any letter marks it as text.
    const wrapped = last && line.length === 1 && /[a-z]/i.test(only.text) && Math.abs(only.x - last.descriptionX) <= LINE_ALIGN;
    if (wrapped) last!.item.description = `${last!.item.description} ${only.text.trim()}`;
    else last = null;
  }
  return items;
}

/** The unit printed in the column headings, e.g. "Rate / (PAIR)". */
export function unitIn(phrases: TextItem[]): string {
  for (const p of phrases) {
    const m = UNIT_IN_HEADING.exec(p.text);
    if (m) return m[1].toUpperCase();
  }
  return "";
}
