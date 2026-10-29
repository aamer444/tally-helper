import { getDocument, GlobalWorkerOptions, PasswordResponses } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = workerUrl;

const MAX_PAGES = 30;

/** One run of text on a page, in PDF points with y growing upwards (as pdf.js reports it). */
export interface TextItem {
  text: string;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Banks and some suppliers send password-protected PDFs. */
export class PdfLockedError extends Error {
  constructor(readonly wrongPassword: boolean) {
    super(wrongPassword ? "Incorrect password." : "This PDF is protected with a password.");
  }
}

function isPasswordError(e: unknown): e is { name: string; code: number } {
  return typeof e === "object" && e !== null && (e as { name?: string }).name === "PasswordException";
}

/**
 * Reads the text layer of a PDF. The password is used for this call only and is never stored.
 * pdf.js takes ownership of `data`, so pass a fresh copy on every attempt.
 */
export async function readPdfText(data: Uint8Array, password?: string): Promise<{ items: TextItem[]; pages: number }> {
  const task = getDocument({ data, password, isEvalSupported: false, verbosity: 0 });
  let doc;
  try {
    doc = await task.promise;
  } catch (e) {
    void task.destroy();
    if (isPasswordError(e)) throw new PdfLockedError(e.code === PasswordResponses.INCORRECT_PASSWORD);
    throw new Error("This PDF could not be opened. It may be damaged.");
  }

  try {
    if (doc.numPages > MAX_PAGES) throw new Error(`This PDF has ${doc.numPages} pages. A bill can have at most ${MAX_PAGES}.`);
    const items: TextItem[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const content = await (await doc.getPage(n)).getTextContent();
      for (const item of content.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        items.push({ text: item.str.trim(), page: n, x: item.transform[4], y: item.transform[5], w: item.width, h: item.height });
      }
    }
    return { items, pages: doc.numPages };
  } finally {
    await doc.destroy();
  }
}
