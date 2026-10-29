import { useState } from "react";
import type { TallyConnection } from "../connection/useTallyStatus";
import { InvoiceImportPage } from "../sales/InvoiceImportPage";
import { KINDS } from "../sales/import/kind";
import type { Company } from "../tally/types";

const NOTE_KINDS = ["credit-note", "debit-note"] as const;
type NoteKind = (typeof NOTE_KINDS)[number];

const HINT: Record<NoteKind, string> = {
  "credit-note": "Sales return or discount given to a customer",
  "debit-note": "Purchase return or discount received from a supplier",
};

interface NotesPageProps {
  tally: TallyConnection;
  company: Company | null;
}

/** Credit and debit notes share one page; each keeps its own import while the user switches. */
export function NotesPage({ tally, company }: NotesPageProps) {
  const [kind, setKind] = useState<NoteKind>("credit-note");

  return (
    <div className="flex min-h-full flex-col">
      <div role="tablist" aria-label="Note type" className="flex gap-2 px-6 pt-4">
        {NOTE_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={k === kind}
            onClick={() => setKind(k)}
            title={HINT[k]}
            className={`rounded-md border px-4 py-1.5 text-sm ${k === kind ? "border-blue-700 bg-blue-50 font-semibold text-blue-700" : "border-slate-200 bg-white text-slate-600"}`}
          >
            {KINDS[k].title}
          </button>
        ))}
      </div>
      {NOTE_KINDS.map((k) => (
        <div key={k} hidden={k !== kind} className="flex-1">
          <InvoiceImportPage kind={k} tally={tally} company={company} />
        </div>
      ))}
    </div>
  );
}
