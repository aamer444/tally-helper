import { useRef, useState, type DragEvent } from "react";
import { FileSpreadsheet, Upload } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { errorMessage } from "../../../lib/errors";
import type { KindConfig } from "../import/kind";
import { readWorkbook, type Workbook } from "../import/read-sheet";
import type { PdfBill } from "../pdf/parse-bill";
import { readBills, unlockBills, type BillBatch } from "../pdf/read-bills";
import { PdfBatchPanel } from "./PdfBatchPanel";

const SHEET_TYPES = ".xlsx,.xlsm,.xls,.csv";
const IS_PDF = /\.pdf$/i;

interface UploadStepProps {
  kind: KindConfig;
  onWorkbook: (workbook: Workbook) => void;
  onBills: (bills: PdfBill[]) => void;
}

export function UploadStep({ kind, onWorkbook, onBills }: UploadStepProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batch, setBatch] = useState<BillBatch | null>(null);

  async function work(task: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await task();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function open(chosen: File[]) {
    // The same bill picked twice would be joined into one voucher with doubled amounts.
    const files = chosen.filter((f, i) => chosen.findIndex((g) => g.name === f.name && g.size === f.size && g.lastModified === f.lastModified) === i);
    if (!files.length) return;
    const pdfs = files.filter((f) => IS_PDF.test(f.name));
    if (!kind.acceptsPdf || !pdfs.length) {
      if (files.length > 1) return setError("Choose one Excel or CSV file.");
      return void work(async () => onWorkbook(await readWorkbook(files[0])));
    }
    if (pdfs.length !== files.length) return setError("Choose either one Excel/CSV file or PDF bills, not both.");
    void work(async () => {
      const read = await readBills(pdfs);
      if (read.locked.length || read.failed.length) setBatch(read);
      else onBills(read.bills);
    });
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    open([...e.dataTransfer.files]);
  }

  if (batch) {
    return (
      <div className="flex-1 space-y-4 px-6 pb-4">
        <PdfBatchPanel
          batch={batch}
          busy={busy}
          onUnlock={(file, password) => void work(async () => setBatch(await unlockBills(batch, file, password)))}
          onContinue={() => onBills(batch.bills)}
          onCancel={() => setBatch(null)}
        />
        {error && <p className="text-sm font-medium text-red-700">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 px-6 pb-4">
      <section
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex flex-col items-center rounded-lg border-2 border-dashed px-6 py-6 text-center ${
          dragging ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-white"
        }`}
      >
        <div className="grid size-11 place-items-center rounded-full bg-blue-50 text-blue-700">
          <FileSpreadsheet size={22} />
        </div>
        <h2 className="mt-2 font-semibold">
          {kind.acceptsPdf ? `Drop supplier PDF bills or your ${kind.mainRole.toLowerCase()} register here` : `Drop your ${kind.mainRole.toLowerCase()} register here`}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {kind.acceptsPdf ? "PDF bills (several at once), or one Excel (.xlsx, .xls) or CSV file, up to 20 MB each" : "Excel (.xlsx, .xls) or CSV, up to 20 MB"}
        </p>
        <Button variant="primary" className="mt-3" disabled={busy} onClick={() => inputRef.current?.click()}>
          <Upload size={16} /> {busy ? "Reading…" : kind.acceptsPdf ? "Choose files" : "Choose file"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={kind.acceptsPdf ? `${SHEET_TYPES},.pdf` : SHEET_TYPES}
          multiple={kind.acceptsPdf}
          hidden
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = ""; // lets the same file be chosen again after fixing it
            open(files);
          }}
        />
        {error && <p className="mt-4 text-sm font-medium text-red-700">{error}</p>}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white px-5 py-3 text-xs">
        <h3 className="text-sm font-semibold">What the file needs</h3>
        <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-slate-700">
          {kind.acceptsPdf && (
            <li>
              <b>PDF bills</b>: the bill as the supplier sent it (not a scan). We read the bill number, date, GSTIN, taxable value, tax and
              total from any layout, and you check them in the next step. Password-protected PDFs can be unlocked here.
            </li>
          )}
          <li>
            <b>Excel or CSV</b>: one row per {kind.documentWord} (or per line; rows with the same {kind.invoiceNoLabel} are joined), with
            columns for <b>Date</b>, <b>{kind.invoiceNoLabel}</b>, <b>Party name</b> and <b>Taxable value</b> (or the total).
          </li>
          <li>Optional: GSTIN, Place of Supply, GST rate %, CGST / SGST / IGST amounts, Narration.</li>
          <li>Column names do not need to match exactly. You will check them in the next step.</li>
          <li>Party names must already exist as ledgers in Tally.</li>
        </ul>
      </section>
    </div>
  );
}
