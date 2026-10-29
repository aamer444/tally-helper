import { useRef, useState, type DragEvent } from "react";
import { FileSpreadsheet, Lock, Plus, Upload } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { errorMessage } from "../../lib/errors";
import type { Ledger } from "../tally/types";
import { readWorkbook, type Workbook } from "../sales/import/read-sheet";
import { PdfLockedError } from "../sales/pdf/pdf-text";
import { CARD, SELECT } from "../sales/steps/styles";
import { readPdfStatement } from "./pdf-statement";

const IS_PDF = /\.pdf$/i;
const REQUIRED = <span className="text-red-600"> *</span>;

interface BankUploadStepProps {
  bankLedgers: Ledger[];
  bankLedger: string;
  onBankLedgerChange: (name: string) => void;
  /** Creates a ledger under Bank Accounts in Tally and selects it. */
  onCreateBankLedger: (name: string) => Promise<void>;
  /** Ledgers have been read from Tally, so the bank ledger list is real. */
  ready: boolean;
  onWorkbook: (workbook: Workbook) => void;
}

export function BankUploadStep({ bankLedgers, bankLedger, onBankLedgerChange, onCreateBankLedger, ready, onWorkbook }: BankUploadStepProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Kept only while the box is open; the password is never saved.
  const [locked, setLocked] = useState<{ file: File; wrong: boolean } | null>(null);
  const [password, setPassword] = useState("");

  async function read(file: File, pdfPassword?: string) {
    setBusy(true);
    setError(null);
    try {
      onWorkbook(IS_PDF.test(file.name) ? await readPdfStatement(file, pdfPassword) : await readWorkbook(file));
      setLocked(null);
    } catch (e) {
      if (e instanceof PdfLockedError) setLocked({ file, wrong: e.wrongPassword });
      else setError(errorMessage(e));
    } finally {
      setPassword("");
      setBusy(false);
    }
  }

  function open(files: File[]) {
    if (files.length !== 1) return setError("Choose one statement file.");
    void read(files[0]);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    open([...e.dataTransfer.files]);
  }

  return (
    <div className="flex-1 space-y-4 px-6 pb-4">
      <BankLedgerCard bankLedgers={bankLedgers} bankLedger={bankLedger} onChange={onBankLedgerChange} onCreate={onCreateBankLedger} ready={ready} />

      <section
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`rounded-lg border-2 border-dashed p-10 text-center ${dragging ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-white"}`}
      >
        <FileSpreadsheet size={40} className="mx-auto text-blue-700" />
        <h2 className="mt-3 text-lg font-semibold">Drop your bank statement here</h2>
        <p className="mt-1 text-sm text-slate-600">Excel or CSV downloaded from net banking works best. Text PDFs work too; scanned PDFs do not.</p>
        <Button variant="primary" className="mx-auto mt-4" disabled={busy} onClick={() => inputRef.current?.click()}>
          <Upload size={16} /> {busy ? "Reading…" : "Choose file"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xlsm,.xls,.csv,.pdf"
          className="hidden"
          onChange={(e) => {
            open([...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      </section>

      {locked && (
        <section className={`${CARD} border-amber-200 bg-amber-50`}>
          <h2 className="flex items-center gap-2 font-semibold text-amber-900">
            <Lock size={16} /> {locked.file.name} is protected with a password
          </h2>
          <p className="mt-1 text-sm text-amber-900">
            Banks usually use part of your name, date of birth or customer ID; the bank's email says which. We do not save it.
          </p>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (password) void read(locked.file, password);
            }}
          >
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="PDF password"
              aria-label="PDF password"
              className="w-72 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-500"
            />
            <Button type="submit" variant="primary" className="px-4 py-1.5" disabled={busy || !password}>
              Unlock
            </Button>
          </form>
          {locked.wrong && <p className="mt-2 text-sm text-red-700">That password did not open it. Try again.</p>}
        </section>
      )}
    </div>
  );
}

interface BankLedgerCardProps {
  bankLedgers: Ledger[];
  bankLedger: string;
  onChange: (name: string) => void;
  onCreate: (name: string) => Promise<void>;
  ready: boolean;
}

/** The statement's own ledger in Tally; a new company often has none, so one can be made here. */
function BankLedgerCard({ bankLedgers, bankLedger, onChange, onCreate, ready }: BankLedgerCardProps) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      await onCreate(name.trim());
      setAdding(false);
      setName("");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={CARD}>
      <h2 className="font-semibold">
        Which bank account is this statement for?{REQUIRED}
      </h2>
      <p className="mt-1 text-sm text-slate-600">Every line is entered against this ledger in Tally.</p>
      {!ready ? (
        <p className="mt-3 text-sm text-amber-700">Open the company in Tally and select it at the top; its bank ledgers will show here.</p>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          {bankLedgers.length > 0 && (
            <select aria-label="Bank ledger" className={`${SELECT} max-w-md`} value={bankLedger} onChange={(e) => onChange(e.target.value)}>
              {bankLedgers.map((l) => (
                <option key={l.name} value={l.name}>
                  {l.name} ({l.parent})
                </option>
              ))}
            </select>
          )}
          {!bankLedgers.length && !adding && <span className="text-amber-700">This company has no bank ledger yet.</span>}
          {adding ? (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (name.trim()) void create();
              }}
            >
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. SBI Current A/c"
                aria-label="New bank ledger name"
                className="w-64 rounded-md border border-slate-200 px-3 py-1.5 outline-none focus:border-blue-500"
              />
              <Button type="submit" variant="primary" className="px-3 py-1.5" disabled={busy || !name.trim()}>
                {busy ? "Creating…" : "Create under Bank Accounts"}
              </Button>
              <Button className="px-3 py-1.5" onClick={() => setAdding(false)}>
                Cancel
              </Button>
            </form>
          ) : (
            <Button className="px-3 py-1.5" onClick={() => setAdding(true)}>
              <Plus size={14} /> New bank ledger
            </Button>
          )}
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </section>
  );
}
