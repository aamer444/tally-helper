import { autoMap, cellText, findHeaderRow, type Mapping } from "./fields";
import type { Sheet, Workbook } from "./read-sheet";

/** The uploaded file plus the user's choices about how to read it. */
export interface ImportFile {
  workbook: Workbook;
  sheetIndex: number;
  headerRow: number; // 0-based
  mapping: Mapping;
}

export const sheetOf = (f: ImportFile): Sheet => f.workbook.sheets[f.sheetIndex];
export const headersOf = (f: ImportFile): string[] => (sheetOf(f).rows[f.headerRow] ?? []).map(cellText);

export function withHeaderRow(f: ImportFile, headerRow: number): ImportFile {
  const next = { ...f, headerRow };
  return { ...next, mapping: autoMap(headersOf(next)) };
}

export function openSheet(workbook: Workbook, sheetIndex = 0): ImportFile {
  const headerRow = findHeaderRow(workbook.sheets[sheetIndex].rows);
  return withHeaderRow({ workbook, sheetIndex, headerRow, mapping: {} }, headerRow);
}

/** Excel's column letters: 0 → A, 26 → AA. */
export function columnLetter(index: number): string {
  let s = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}
