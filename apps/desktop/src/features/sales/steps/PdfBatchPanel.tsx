import { useState } from "react";
import { ArrowLeft, ArrowRight, CircleX, FileCheck2, LockKeyhole } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import type { BillBatch, LockedPdf } from "../pdf/read-bills";

interface PdfBatchPanelProps {
  batch: BillBatch;
  busy: boolean;
  onUnlock: (file: File, password: string) => void;
  onContinue: () => void;
  onCancel: () => void;
}

/** Shown when some PDFs need a password or could not be read; the rest wait here. */
export function PdfBatchPanel({ batch, busy, onUnlock, onContinue, onCancel }: PdfBatchPanelProps) {
  const total = batch.bills.length + batch.locked.length + batch.failed.length;
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 text-sm">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <FileCheck2 size={20} className="text-green-700" /> {batch.bills.length} of {total} bills read
      </h2>

      {batch.locked.length > 0 && (
        <div className="mt-4">
          <h3 className="font-semibold">Protected with a password</h3>
          <p className="mt-1 text-slate-600">
            Enter the password to open each file. Files from the same sender usually share one password, so we try it on the others too.
            The password is only used to open the file; it is not saved.
          </p>
          <ul className="mt-3 space-y-2">
            {batch.locked.map((entry, i) => (
              <LockedRow key={`${i}-${entry.file.name}`} entry={entry} busy={busy} onUnlock={onUnlock} />
            ))}
          </ul>
        </div>
      )}

      {batch.failed.length > 0 && (
        <div className="mt-4">
          <h3 className="font-semibold">Could not be read</h3>
          <ul className="mt-2 space-y-1">
            {batch.failed.map((f, i) => (
              <li key={`${i}-${f.fileName}`} className="flex gap-2 text-red-700">
                <CircleX size={16} className="mt-0.5 shrink-0" />
                <span>
                  <b>{f.fileName}</b>: {f.message}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 flex justify-end gap-3">
        <Button onClick={onCancel}>
          <ArrowLeft size={16} /> Choose other files
        </Button>
        <Button variant="primary" disabled={busy || !batch.bills.length} onClick={onContinue}>
          Continue with {batch.bills.length} {batch.bills.length === 1 ? "bill" : "bills"} <ArrowRight size={16} />
        </Button>
      </div>
    </section>
  );
}

function LockedRow({ entry, busy, onUnlock }: { entry: LockedPdf; busy: boolean; onUnlock: (file: File, password: string) => void }) {
  const [password, setPassword] = useState("");
  const submit = () => {
    if (!password) return;
    onUnlock(entry.file, password);
    setPassword("");
  };

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-md border border-slate-200 px-3 py-2">
      <LockKeyhole size={16} className="shrink-0 text-amber-600" />
      <span className="min-w-0 flex-1 truncate font-medium" title={entry.file.name}>
        {entry.file.name}
      </span>
      {entry.wrongPassword && <span className="text-red-700">Incorrect password</span>}
      <input
        type="password"
        autoComplete="off"
        aria-label={`Password for ${entry.file.name}`}
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        className="w-48 rounded-md border border-slate-200 px-2 py-1.5 outline-none focus:border-blue-500"
      />
      <Button className="px-3 py-1.5" disabled={busy || !password} onClick={submit}>
        Unlock
      </Button>
    </li>
  );
}
