const inr = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Money is stored as integer paise (ADR-005); this is for display only. */
export function formatPaise(paise: number): string {
  return inr.format(paise / 100);
}

/** Tally dates are YYYYMMDD; accountants read DD-MM-YYYY. */
export function formatTallyDate(yyyymmdd: string): string {
  return `${yyyymmdd.slice(6, 8)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(0, 4)}`;
}

/** Tally signs balances: negative is Debit, positive is Credit. Zero shows as a dash. */
export function formatDrCr(paise: number): string {
  if (paise === 0) return "–";
  return `${formatPaise(Math.abs(paise))} ${paise < 0 ? "Dr" : "Cr"}`;
}

/** YYYYMMDD <-> the YYYY-MM-DD an <input type="date"> uses. */
export const tallyToIsoDate = (ymd: string) => `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
export const isoToTallyDate = (iso: string) => iso.replace(/-/g, "");
