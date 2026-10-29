import { useRef, useState, type DragEvent } from "react";
import { FileSpreadsheet, Upload } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { errorMessage } from "../../../lib/errors";
import { readWorkbook, type Workbook } from "../import/read-sheet";

const FILE_TYPES = ".xlsx,.xlsm,.xls,.csv";

export function UploadStep({ onLoaded }: { onLoaded: (workbook: Workbook) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open(file: File) {
    setBusy(true);
    setError(null);
    try {
      onLoaded(await readWorkbook(file));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void open(file);
  }

  return (
    <div className="flex-1 space-y-6 px-6 pb-6">
      <section
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex flex-col items-center rounded-lg border-2 border-dashed p-12 text-center ${
          dragging ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-white"
        }`}
      >
        <div className="grid size-14 place-items-center rounded-full bg-blue-50 text-blue-700">
          <FileSpreadsheet size={28} />
        </div>
        <h2 className="mt-4 text-lg font-semibold">Drop your sales register here</h2>
        <p className="mt-1 text-sm text-slate-600">Excel (.xlsx, .xls) or CSV, up to 20 MB</p>
        <Button variant="primary" className="mt-5" disabled={busy} onClick={() => inputRef.current?.click()}>
          <Upload size={16} /> {busy ? "Reading file…" : "Choose file"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={FILE_TYPES}
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = ""; // lets the same file be chosen again after fixing it
            if (file) void open(file);
          }}
        />
        {error && <p className="mt-4 text-sm font-medium text-red-700">{error}</p>}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6 text-sm">
        <h3 className="font-semibold">What the file needs</h3>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-slate-700">
          <li>One row per invoice (or per invoice line; rows with the same Invoice No are joined).</li>
          <li>
            Columns for <b>Date</b>, <b>Invoice No</b>, <b>Party name</b> and <b>Taxable value</b> (or the invoice total).
          </li>
          <li>Optional: GSTIN, Place of Supply, GST rate %, CGST / SGST / IGST amounts, Narration.</li>
          <li>Column names do not need to match exactly. You will check them in the next step.</li>
          <li>Party names must already exist as ledgers in Tally.</li>
        </ul>
      </section>
    </div>
  );
}
