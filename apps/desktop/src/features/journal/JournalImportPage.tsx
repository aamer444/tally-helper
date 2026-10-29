import { useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, FileSpreadsheet, Upload } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Stepper } from "../../components/ui/Stepper";
import { todayYmd } from "../../lib/dates";
import { errorMessage } from "../../lib/errors";
import { formatPaise } from "../../lib/format";
import type { TallyConnection } from "../connection/useTallyStatus";
import { createLedger } from "../sales/import/create-party";
import { cellText } from "../sales/import/fields";
import { columnLetter } from "../sales/import/import-file";
import { readWorkbook } from "../sales/import/read-sheet";
import { PushStep } from "../sales/steps/PushStep";
import { StepFooter } from "../sales/steps/StepFooter";
import { CARD, SELECT } from "../sales/steps/styles";
import type { Company } from "../tally/types";
import { useMasters } from "../tally/useMasters";
import {
  buildJournals,
  JOURNAL_FIELDS,
  journalHeaders,
  journalRows,
  missingJournalFields,
  openJournal,
  pushJournal,
  readJournal,
  withJournalHeader,
  type JournalFieldId,
  type JournalFile,
  type JournalVoucher,
} from "./journal";
import { JournalReviewStep } from "./JournalReviewStep";
import { useLedgerLinks } from "./useLedgerLinks";

const [UPLOAD, MAP, REVIEW, PUSH] = [0, 1, 2, 3];
const STEPS = ["Upload", "Map Columns", "Review", "Push to Tally"];

interface JournalImportPageProps {
  tally: TallyConnection;
  company: Company | null;
}

export function JournalImportPage({ tally, company }: JournalImportPageProps) {
  const masters = useMasters(tally.url, company, "Journal");
  const { links, link } = useLedgerLinks(company);
  const [step, setStep] = useState(UPLOAD);
  const [file, setFile] = useState<JournalFile | null>(null);
  const [chosenType, setChosenType] = useState("");
  const [moveToFirst, setMoveToFirst] = useState(false);
  // A snapshot: a busy Tally can miss a connection check mid-push, and that must not end the push.
  const [pushJob, setPushJob] = useState<{ vouchers: JournalVoucher[]; company: Company; voucherType: string } | null>(null);

  const voucherType = masters.voucherTypes.includes(chosenType) ? chosenType : (masters.voucherTypes[0] ?? "Journal");
  const rows = useMemo(() => (file ? readJournal(file) : []), [file]);
  const vouchers = useMemo(() => {
    if (!company || masters.status !== "ready" || !file) return [];
    return buildJournals({
      company,
      rows,
      byNumber: file.mapping.voucherNo !== undefined,
      ledgers: masters.ledgers,
      links: new Map(Object.entries(links)),
      today: todayYmd(),
      educationalMode: masters.educational,
      moveToFirst,
    });
  }, [company, masters.status, masters.ledgers, masters.educational, file, rows, links, moveToFirst]);

  const startOver = () => {
    setFile(null);
    setPushJob(null);
    setStep(UPLOAD);
  };

  async function createJournalLedger(name: string, group: string) {
    await createLedger(tally.url, company!.name, { name, group });
    await masters.reload();
  }

  const blocked = !company || masters.status !== "ready";
  const effectiveStep = step === REVIEW && blocked ? MAP : step;

  return (
    <div className="flex min-h-full flex-col">
      <div className="space-y-4 px-6 pt-4 pb-4">
        <div>
          <h1 className="text-2xl font-bold">Journal Entries</h1>
          <p className="text-sm text-slate-600">
            Year-end adjustments, depreciation, TDS and salary provisions from Excel/CSV: one row per ledger line, rows of one voucher together.
          </p>
        </div>
        <div className="px-8">
          <Stepper steps={STEPS} current={effectiveStep} />
        </div>
        {!company && (
          <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
            {"ok" in tally.status && tally.status.ok
              ? "No company is open in Tally. Open your company in TallyPrime; it will appear at the top."
              : "Tally is not connected. You can upload and map a file now; checking and pushing need Tally."}
          </p>
        )}
      </div>

      {effectiveStep === UPLOAD && (
        <JournalUpload
          onFile={(f) => {
            setFile(f);
            setStep(MAP);
          }}
        />
      )}
      {effectiveStep === MAP && file && (
        <JournalMap
          file={file}
          onFileChange={setFile}
          rows={rows.length}
          vouchers={vouchers.length}
          blocker={blocked ? (company ? "Ledgers have not been read from Tally yet" : "Select the company at the top") : ""}
          onBack={startOver}
          onNext={() => setStep(REVIEW)}
        />
      )}
      {effectiveStep === REVIEW && (
        <JournalReviewStep
          vouchers={vouchers}
          masters={masters}
          voucherType={voucherType}
          onVoucherTypeChange={setChosenType}
          onLink={link}
          onCreate={createJournalLedger}
          moveToFirst={moveToFirst}
          onMoveToFirstChange={setMoveToFirst}
          onBack={() => setStep(MAP)}
          onPush={(selected) => {
            if (!company) return;
            setPushJob({ vouchers: selected, company, voucherType });
            setStep(PUSH);
          }}
        />
      )}
      {effectiveStep === PUSH && pushJob && (
        <PushStep
          items={pushJob.vouchers}
          describe={(v) => ({ date: v.date, reference: v.voucherNo || `Rows ${v.rowNumbers[0]}–${v.rowNumbers.at(-1)}`, party: v.lines.map((l) => l.ledger).join(", "), amount: v.debitTotal })}
          push={(v) => pushJournal(tally.url, pushJob.company.name, pushJob.voucherType, v, masters.ledgers)}
          referenceLabel="Voucher No"
          confirm={
            <>
              This will create <b>{pushJob.vouchers.length}</b> journals worth <b>₹{formatPaise(pushJob.vouchers.reduce((n, v) => n + v.debitTotal, 0))}</b> in the
              Tally company <b>{pushJob.company.name}</b>, using voucher type <b>{pushJob.voucherType}</b>.
            </>
          }
          onBack={() => setStep(REVIEW)}
          onNewImport={startOver}
        />
      )}
    </div>
  );
}

function JournalUpload({ onFile }: { onFile: (f: JournalFile) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open(files: File[]) {
    if (files.length !== 1) return setError("Choose one Excel or CSV file.");
    setBusy(true);
    setError(null);
    try {
      onFile(openJournal(await readWorkbook(files[0])));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex-1 px-6 pb-4">
      <section
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void open([...e.dataTransfer.files]);
        }}
        className={`rounded-lg border-2 border-dashed p-10 text-center ${dragging ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-white"}`}
      >
        <FileSpreadsheet size={40} className="mx-auto text-blue-700" />
        <h2 className="mt-3 text-lg font-semibold">Drop your journal sheet here</h2>
        <p className="mt-1 text-sm text-slate-600">Columns like Date · Voucher No · Ledger · Debit · Credit · Narration. Excel or CSV.</p>
        <Button variant="primary" className="mx-auto mt-4" disabled={busy} onClick={() => inputRef.current?.click()}>
          <Upload size={16} /> {busy ? "Reading…" : "Choose file"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xlsm,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            void open([...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      </section>
    </div>
  );
}

interface JournalMapProps {
  file: JournalFile;
  onFileChange: (f: JournalFile) => void;
  rows: number;
  vouchers: number;
  blocker: string;
  onBack: () => void;
  onNext: () => void;
}

function JournalMap({ file, onFileChange, rows, vouchers, blocker, onBack, onNext }: JournalMapProps) {
  const headers = journalHeaders(file);
  const missing = missingJournalFields(file.mapping);
  const problem = missing.length ? `Choose a column for: ${missing.join(", ")}` : !rows ? "No journal lines found with these columns" : blocker;
  const setColumn = (field: JournalFieldId, value: string) => {
    const mapping = { ...file.mapping };
    if (value === "") delete mapping[field];
    else mapping[field] = Number(value);
    onFileChange({ ...file, mapping });
  };
  const sample = (col: number) => cellText(journalRows(file).slice(file.headerRow + 1).find((r) => cellText(r[col]))?.[col]);

  return (
    <>
      <div className="flex-1 space-y-4 px-6 pb-4">
        <section className={CARD}>
          <h2 className="font-semibold">Match your columns</h2>
          <p className="mt-1 text-sm text-slate-600">
            We guessed from the headings. Without a Voucher No column, rows are joined into one journal until debit equals credit.
          </p>
          <div className="mt-3 flex items-center gap-2 text-sm">
            <span>Headings are on row</span>
            <input
              type="number"
              min={1}
              max={journalRows(file).length}
              value={file.headerRow + 1}
              onChange={(e) => onFileChange(withJournalHeader(file, Math.max(0, Number(e.target.value) - 1)))}
              className="w-20 rounded-md border border-slate-200 px-2 py-1 outline-none focus:border-blue-500"
              aria-label="Heading row"
            />
          </div>
          <div className="mt-3 grid max-w-3xl grid-cols-[150px_1fr_160px] items-center gap-x-3 gap-y-2 text-sm">
            {JOURNAL_FIELDS.map((f) => {
              const col = file.mapping[f.id];
              return (
                <div key={f.id} className="contents">
                  <span className={f.required ? "font-medium" : "text-slate-700"}>
                    {f.label}
                    {f.required && <span className="text-red-600"> *</span>}
                  </span>
                  <select aria-label={f.label} className={SELECT} value={col ?? ""} onChange={(e) => setColumn(f.id, e.target.value)}>
                    <option value="">— Not in file —</option>
                    {headers.map((h, i) => (
                      <option key={i} value={i}>
                        {columnLetter(i)} · {h || "(no heading)"}
                      </option>
                    ))}
                  </select>
                  <span className="truncate text-xs text-slate-500">{col === undefined ? "" : sample(col)}</span>
                </div>
              );
            })}
          </div>
        </section>
      </div>
      <StepFooter info={problem ? <span className="text-amber-700">{problem}</span> : `${rows} lines read, forming ${vouchers} journals`}>
        <Button onClick={onBack}>
          <ArrowLeft size={16} /> Choose another file
        </Button>
        <Button variant="primary" disabled={Boolean(problem)} onClick={onNext}>
          Review journals <ArrowRight size={16} />
        </Button>
      </StepFooter>
    </>
  );
}
