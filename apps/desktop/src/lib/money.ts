/** Integer paise, 100 = ₹1.00 (ADR-005). */
export type Paise = number;

/**
 * Reads an amount the way accountants type it: "12,980.00", "₹ 500", "(250)" for negative.
 * Returns null for an empty cell or text that is not a number.
 */
export function parseAmount(value: unknown): Paise | null {
  if (typeof value === "number") return Number.isFinite(value) ? Math.round(value * 100) : null;
  if (typeof value !== "string") return null;
  let s = value.trim().replace(/^(rs\.?|inr)/i, "").replace(/[₹,\s]/g, "");
  if (s === "" || s === "-") return null;
  const bracketed = /^\(.*\)$/.test(s);
  if (bracketed) s = s.slice(1, -1);
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const paise = Math.round(Number(s) * 100);
  return bracketed ? -paise : paise;
}

/** Tally wants plain decimals with two places and no grouping: -11800.00 */
export function paiseToTally(paise: Paise): string {
  const sign = paise < 0 ? "-" : "";
  const abs = Math.abs(paise);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}
