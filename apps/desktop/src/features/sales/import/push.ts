import { errorMessage } from "../../../lib/errors";
import { postToTally, TallyUnreachableError } from "../../tally/tally-client";
import type { InvoiceVoucher } from "./build-vouchers";
import { importVouchersXml, voucherXml } from "./voucher-xml";
import { KINDS } from "./kind";

const IMPORT_TIMEOUT_MS = 60_000;

export type PushResult =
  | { state: "created" | "altered" }
  | { state: "failed"; message: string }
  /** No reply arrived, so Tally may or may not have saved it. */
  | { state: "unknown"; message: string };

/** Reads Tally's IMPORTRESULT block; LINEERROR carries the reason when a voucher is rejected. */
export function readImportResult(doc: Document): PushResult {
  const count = (tag: string) => Number(doc.getElementsByTagName(tag)[0]?.textContent ?? 0);
  const lineErrors = [...doc.getElementsByTagName("LINEERROR")].map((el) => el.textContent?.trim()).filter(Boolean);
  if (lineErrors.length) return { state: "failed", message: lineErrors.join("; ") };
  if (count("ERRORS") || count("EXCEPTIONS")) return { state: "failed", message: "Tally rejected this voucher." };
  if (count("CREATED")) return { state: "created" };
  if (count("ALTERED")) return { state: "altered" };
  return { state: "failed", message: "Tally did not save this voucher." };
}

/**
 * One voucher per request, so every error points at the right invoice.
 * Writes to the user's books: only call this after they confirm.
 */
export async function pushVoucher(url: string, company: string, voucherType: string, v: InvoiceVoucher): Promise<PushResult> {
  return pushXml(url, importVouchersXml(company, voucherXml(v, voucherType)), KINDS[v.kind].documentWord);
}

/** Sends one import request; `what` names the thing in the message when Tally does not answer. */
export async function pushXml(url: string, xml: string, what: string): Promise<PushResult> {
  try {
    return readImportResult(await postToTally(url, xml, IMPORT_TIMEOUT_MS));
  } catch (e) {
    if (e instanceof TallyUnreachableError) {
      return { state: "unknown", message: `No reply from Tally. Check the Day Book in Tally before pushing this ${what} again.` };
    }
    return { state: "unknown", message: errorMessage(e) };
  }
}
