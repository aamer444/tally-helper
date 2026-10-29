const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);
const DAY_MS = 86_400_000;
const MAX_EXCEL_SERIAL = 2_958_465; // 31-12-9999

const pad = (n: number) => String(n).padStart(2, "0");
const fullYear = (y: string) => (y.length === 2 ? 2000 + Number(y) : Number(y));

/** Returns YYYYMMDD, or null when the parts do not form a real calendar date. */
function ymd(year: number, month: number, day: number): string | null {
  const t = new Date(Date.UTC(year, month - 1, day));
  if (t.getUTCFullYear() !== year || t.getUTCMonth() !== month - 1 || t.getUTCDate() !== day) return null;
  return `${year}${pad(month)}${pad(day)}`;
}

function fromExcelSerial(serial: number): string | null {
  if (serial < 1 || serial > MAX_EXCEL_SERIAL) return null;
  const t = new Date(EXCEL_EPOCH_MS + Math.floor(serial) * DAY_MS);
  return ymd(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/**
 * Reads a date cell from Excel or CSV into Tally's YYYYMMDD.
 * Slash and dash dates are read day-first (05/04/2025 = 5 April), as Indian registers write them.
 */
export function parseDateCell(value: unknown): string | null {
  if (typeof value === "number") {
    const asText = String(value);
    return /^\d{8}$/.test(asText) ? parseDateCell(asText) : fromExcelSerial(value);
  }
  const s = String(value ?? "").trim();
  if (!s) return null;

  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T].*)?$/);
  if (m) return ymd(Number(m[1]), Number(m[2]), Number(m[3]));

  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/);
  if (m) return ymd(fullYear(m[3]), Number(m[2]), Number(m[1]));

  m = s.match(/^(\d{1,2})[-/ ]([a-z]{3})[a-z]*[-/ ,]+(\d{2}|\d{4})$/i);
  if (m) {
    const month = MONTHS.indexOf(m[2].toLowerCase()) + 1;
    return month ? ymd(fullYear(m[3]), month, Number(m[1])) : null;
  }

  m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return ymd(Number(m[1]), Number(m[2]), Number(m[3]));

  return /^\d{4,5}$/.test(s) ? fromExcelSerial(Number(s)) : null;
}

export function todayYmd(now = new Date()): string {
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
}
