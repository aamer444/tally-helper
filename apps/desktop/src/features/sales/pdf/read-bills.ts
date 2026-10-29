import { errorMessage } from "../../../lib/errors";
import { readPdfBill } from "./bills";
import type { PdfBill } from "./parse-bill";
import { PdfLockedError } from "./pdf-text";

export interface LockedPdf {
  file: File;
  wrongPassword: boolean;
}

/** The result of reading a set of PDF bills: some read, some waiting for a password, some unreadable. */
export interface BillBatch {
  bills: PdfBill[];
  locked: LockedPdf[];
  failed: { fileName: string; message: string }[];
}

export async function readBills(files: File[]): Promise<BillBatch> {
  const batch: BillBatch = { bills: [], locked: [], failed: [] };
  for (const file of files) {
    try {
      batch.bills.push(await readPdfBill(file));
    } catch (e) {
      if (e instanceof PdfLockedError) batch.locked.push({ file, wrongPassword: false });
      else batch.failed.push({ fileName: file.name, message: errorMessage(e) });
    }
  }
  return batch;
}

/**
 * Opens `target` with the password, then tries the same password on the other locked files,
 * since files from one sender usually share it. The password is not kept anywhere.
 */
export async function unlockBills(batch: BillBatch, target: File, password: string): Promise<BillBatch> {
  const bills = [...batch.bills];
  const failed = [...batch.failed];
  const locked: LockedPdf[] = [];

  for (const entry of batch.locked) {
    const isTarget = entry.file === target;
    try {
      bills.push(await readPdfBill(entry.file, password));
    } catch (e) {
      if (e instanceof PdfLockedError) locked.push(isTarget ? { file: entry.file, wrongPassword: true } : entry);
      else failed.push({ fileName: entry.file.name, message: errorMessage(e) });
    }
  }
  return { bills, locked, failed };
}
