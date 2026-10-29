import { read, utils, type WorkSheet } from "xlsx";

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const ACCEPTED = /\.(xlsx|xlsm|xls|csv)$/i;

export interface Sheet {
  name: string;
  rows: unknown[][];
}

export interface Workbook {
  fileName: string;
  sheets: Sheet[];
}

/**
 * Reads from A1 and keeps blank rows, so rows[i] is Excel row i + 1 and column 0 is A.
 * The row numbers we show then match what the user sees in Excel.
 */
function sheetRows(ws: WorkSheet): unknown[][] {
  if (!ws["!ref"]) return [];
  const range = utils.decode_range(ws["!ref"]);
  range.s = { r: 0, c: 0 };
  return utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: "", blankrows: true, range });
}

/** Reads every sheet as raw cell values; dates stay Excel serial numbers and are converted later. */
export async function readWorkbook(file: File): Promise<Workbook> {
  if (!ACCEPTED.test(file.name)) throw new Error("Please choose an Excel (.xlsx, .xls) or CSV file.");
  if (file.size > MAX_FILE_BYTES) throw new Error("This file is larger than 20 MB. Split it into smaller files.");

  let sheets: Sheet[];
  try {
    const book = read(await file.arrayBuffer(), { type: "array", raw: true });
    sheets = book.SheetNames.map((name) => ({ name, rows: sheetRows(book.Sheets[name]) }));
  } catch {
    throw new Error("This file could not be opened. If it has a password, remove it and save again.");
  }

  sheets = sheets.filter((s) => s.rows.filter((r) => r.some((c) => c !== "")).length > 1);
  if (!sheets.length) throw new Error("This file has no rows to import.");
  return { fileName: file.name, sheets };
}
