import { useRef, useState, type ReactNode } from "react";
import { ArrowLeft, CircleStop, Play, RotateCcw, ShieldAlert, Upload } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { formatPaise, formatTallyDate } from "../../../lib/format";
import type { Paise } from "../../../lib/money";
import type { PushResult } from "../import/push";
import { StepFooter } from "./StepFooter";

type Phase = "confirm" | "running" | "finished";

/** What the results table shows for one item being pushed. */
export interface PushRow {
  date: string | null;
  reference: string;
  party: string;
  amount: Paise;
}

interface PushStepProps<T extends { id: string }> {
  items: T[];
  describe: (item: T) => PushRow;
  /** Sends one item to Tally. Writes to the user's books: called only after they confirm. */
  push: (item: T) => Promise<PushResult>;
  /** What will be created where, shown before anything is sent. */
  confirm: ReactNode;
  referenceLabel: string;
  onBack: () => void;
  onNewImport: () => void;
}

const RESULT_LABEL: Record<PushResult["state"], { text: string; className: string }> = {
  created: { text: "Created", className: "text-green-700" },
  altered: { text: "Updated (was already in Tally)", className: "text-blue-700" },
  failed: { text: "Failed", className: "text-red-700" },
  unknown: { text: "Not sure", className: "text-amber-700" },
};

/** Confirm, then send one item at a time with progress, stop, continue and retry; shared by every import. */
export function PushStep<T extends { id: string }>({ items: vouchers, describe, push, confirm, referenceLabel, onBack, onNewImport }: PushStepProps<T>) {
  const [phase, setPhase] = useState<Phase>("confirm");
  const [results, setResults] = useState<ReadonlyMap<string, PushResult>>(new Map());
  const stopRequested = useRef(false);

  const done = vouchers.filter((v) => results.has(v.id)).length;
  const count = (state: PushResult["state"]) => [...results.values()].filter((r) => r.state === state).length;
  const failed = vouchers.filter((v) => results.get(v.id)?.state === "failed");

  async function run(list: T[]) {
    stopRequested.current = false;
    setPhase("running");
    for (const v of list) {
      if (stopRequested.current) break;
      const result = await push(v);
      setResults((prev) => new Map(prev).set(v.id, result));
    }
    setPhase("finished");
  }

  return (
    <>
      <div className="flex-1 space-y-4 px-6 pb-4">
        {phase === "confirm" ? (
          <section className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <ShieldAlert size={20} /> Check before pushing
            </h2>
            <p className="mt-2">{confirm}</p>
            <p className="mt-2">
              Take a backup in Tally first (<b>Data → Backup</b>). Keep Tally open until this finishes.
            </p>
          </section>
        ) : (
          <Progress done={done} total={vouchers.length} created={count("created")} altered={count("altered")} failed={count("failed")} unknown={count("unknown")} />
        )}
        <ResultsTable rows={vouchers.map((v) => ({ id: v.id, ...describe(v) }))} results={results} referenceLabel={referenceLabel} />
      </div>

      <StepFooter info={phase === "running" ? "Pushing… you can stop after the current voucher." : undefined}>
        {phase === "confirm" && (
          <>
            <Button onClick={onBack}>
              <ArrowLeft size={16} /> Back to review
            </Button>
            <Button variant="primary" onClick={() => void run(vouchers)}>
              <Play size={16} /> Yes, push {vouchers.length} vouchers
            </Button>
          </>
        )}
        {phase === "running" && (
          <Button variant="danger" onClick={() => (stopRequested.current = true)}>
            <CircleStop size={16} /> Stop
          </Button>
        )}
        {phase === "finished" && (
          <>
            <Button onClick={onBack}>
              <ArrowLeft size={16} /> Back to review
            </Button>
            {done < vouchers.length && (
              <Button onClick={() => void run(vouchers.filter((v) => !results.has(v.id)))}>
                <Play size={16} /> Continue ({vouchers.length - done} left)
              </Button>
            )}
            {failed.length > 0 && (
              <Button onClick={() => void run(failed)}>
                <RotateCcw size={16} /> Try failed again ({failed.length})
              </Button>
            )}
            <Button variant="primary" onClick={onNewImport}>
              <Upload size={16} /> New import
            </Button>
          </>
        )}
      </StepFooter>
    </>
  );
}

function Progress(p: { done: number; total: number; created: number; altered: number; failed: number; unknown: number }) {
  const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">
          {p.done} of {p.total} vouchers sent
        </h2>
        <span className="text-sm text-slate-600">{pct}%</span>
      </div>
      <div className="mt-3 h-2 rounded-full bg-slate-100">
        <div className="h-2 rounded-full bg-green-600 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-3 flex flex-wrap gap-x-6 text-sm">
        <span className="text-green-700">{p.created} created</span>
        {p.altered > 0 && <span className="text-blue-700">{p.altered} updated</span>}
        <span className="text-red-700">{p.failed} failed</span>
        {p.unknown > 0 && <span className="text-amber-700">{p.unknown} not sure, check in Tally</span>}
      </p>
    </section>
  );
}

interface ResultsTableProps {
  rows: (PushRow & { id: string })[];
  results: ReadonlyMap<string, PushResult>;
  referenceLabel: string;
}

function ResultsTable({ rows, results, referenceLabel }: ResultsTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-700">
          <tr>
            {["Date", referenceLabel, "Party / Ledger", "Amount (₹)", "Result"].map((h) => (
              <th key={h} className={`px-3 py-2.5 font-medium whitespace-nowrap ${h.startsWith("Amount") ? "text-right" : "text-left"}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((v) => {
            const r = results.get(v.id);
            const label = r && RESULT_LABEL[r.state];
            return (
              <tr key={v.id} className="border-t border-slate-100">
                <td className="px-3 py-2 whitespace-nowrap">{v.date ? formatTallyDate(v.date) : "–"}</td>
                <td className="px-3 py-2 whitespace-nowrap">{v.reference}</td>
                <td className="px-3 py-2">{v.party}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatPaise(v.amount)}</td>
                <td className="px-3 py-2">
                  {label ? (
                    <span className={label.className}>
                      {label.text}
                      {"message" in r ? `: ${r.message}` : ""}
                    </span>
                  ) : (
                    <span className="text-slate-400">Waiting</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
