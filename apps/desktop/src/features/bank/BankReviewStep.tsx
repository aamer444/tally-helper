import { useEffect, useState } from "react";
import { ArrowLeft, BookPlus, CircleCheck, CircleX, Landmark, Play, RefreshCw, Search, TriangleAlert } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { StatCard } from "../../components/ui/StatCard";
import { errorMessage } from "../../lib/errors";
import { formatPaise, formatTallyDate } from "../../lib/format";
import { StepFooter } from "../sales/steps/StepFooter";
import { CARD } from "../sales/steps/styles";
import type { Ledger } from "../tally/types";
import type { BankEntry } from "./bank-vouchers";
import { STANDARD_BANK_LEDGERS } from "./classify";
import { BalanceCard } from "./BankMapStep";
import { EducationalBanner } from "../tally/EducationalBanner";
import type { BalanceCheck, StatementRow } from "./statement";

type Filter = "all" | "push" | "suspense" | "in-tally" | "error";

const SOURCE_LABEL: Record<BankEntry["source"], { text: string; className: string }> = {
  learned: { text: "Remembered", className: "bg-green-50 text-green-800" },
  manual: { text: "Your choice", className: "bg-green-50 text-green-800" },
  contra: { text: "Own transfer", className: "bg-blue-50 text-blue-800" },
  rule: { text: "Bank rule", className: "bg-blue-50 text-blue-800" },
  party: { text: "Name match", className: "bg-amber-50 text-amber-800" },
  suspense: { text: "Not found", className: "bg-amber-100 text-amber-900" },
};

export interface InTallyState {
  status: "loading" | "ready" | "error";
  error?: string;
}

interface BankReviewStepProps {
  entries: BankEntry[];
  rows: StatementRow[];
  balance: BalanceCheck;
  bankLedger: string;
  ledgers: Ledger[];
  inTally: InTallyState;
  onRecheckTally: () => void;
  /** The user picked a ledger for a line; it is remembered for lines with the same narration. */
  onChoose: (entry: BankEntry, ledger: string) => void;
  onCreateLedgers: (names: string[]) => Promise<void>;
  educational: boolean;
  moveToFirst: boolean;
  onMoveToFirstChange: (on: boolean) => void;
  onBack: () => void;
  onPush: (entries: BankEntry[]) => void;
}

const pushable = (e: BankEntry) => e.status === "ready" || e.status === "warning";

function matches(e: BankEntry, filter: Filter, query: string): boolean {
  if (filter === "push" && !pushable(e)) return false;
  if (filter === "suspense" && e.source !== "suspense") return false;
  if (filter === "in-tally" && e.status !== "in-tally") return false;
  if (filter === "error" && e.status !== "error") return false;
  const q = query.trim().toLowerCase();
  return !q || [e.row.narration, e.ledger, e.instrument.number, String(e.amount / 100)].some((s) => s.toLowerCase().includes(q));
}

export function BankReviewStep(props: BankReviewStepProps) {
  const { entries, balance, rows, bankLedger, ledgers, inTally, onBack, onPush } = props;
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  // What the user ticked or unticked; the rest follow their status.
  const [toggles, setToggles] = useState<ReadonlyMap<string, boolean>>(new Map());
  const [acknowledged, setAcknowledged] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const isChecked = (e: BankEntry) => e.status !== "error" && (toggles.get(e.id) ?? pushable(e));
  const toPush = entries.filter(isChecked);
  const shown = entries.filter((e) => matches(e, filter, query));
  const count = (f: Filter) => entries.filter((e) => matches(e, f, "")).length;
  const blockedByBalance = balance.breaks.length > 0 && !acknowledged;
  const choices = ledgers.filter((l) => l.name !== bankLedger).map((l) => l.name);

  const toggle = (e: BankEntry) => setToggles((prev) => new Map(prev).set(e.id, !isChecked(e)));
  const choose = (e: BankEntry, ledger: string) => {
    const similar = entries.filter((x) => x !== e && x.key && x.key === e.key && x.source !== "manual").length;
    setNote(similar ? `Also used for ${similar} other line${similar > 1 ? "s" : ""} with "${e.key}", and remembered for next time.` : null);
    props.onChoose(e, ledger);
  };

  const tabs: [Filter, string][] = [
    ["all", "All"],
    ["push", "To push"],
    ["suspense", "Not found"],
    ["in-tally", "Already in Tally"],
    ["error", "Errors"],
  ];

  return (
    <>
      <div className="flex-1 space-y-4 px-6 pb-4">
        {props.educational && <EducationalBanner moveToFirst={props.moveToFirst} onMoveToFirstChange={props.onMoveToFirstChange} />}

        <div className="grid grid-cols-5 gap-4">
          <StatCard icon={Landmark} tone="blue" label="Lines" value={entries.length} hint={bankLedger} />
          <StatCard icon={CircleCheck} tone="green" label="Ready to Push" value={entries.filter(pushable).length} hint="Receipts, payments, contras" />
          <StatCard icon={TriangleAlert} tone="amber" label="Not found" value={count("suspense")} hint="Going to Suspense A/c" />
          <StatCard
            icon={RefreshCw}
            tone="blue"
            label="Already in Tally"
            value={inTally.status === "loading" ? "…" : count("in-tally")}
            hint={inTally.status === "error" ? "Could not check" : "Will be skipped"}
          />
          <StatCard icon={CircleX} tone="red" label="Errors" value={count("error")} hint={count("error") ? "Fix before pushing" : "None"} />
        </div>

        {balance.breaks.length > 0 && (
          <div className="space-y-2">
            <BalanceCard balance={balance} rows={rows} />
            <label className="flex items-center gap-2 text-sm font-medium text-red-900">
              <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} className="size-4 accent-red-700" />
              I have checked these lines against the statement; push anyway
            </label>
          </div>
        )}
        {inTally.status === "error" && (
          <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
            Could not read this period's vouchers from Tally ({inTally.error}), so lines already entered are not marked.{" "}
            <button type="button" className="font-medium underline" onClick={props.onRecheckTally}>
              Try again
            </button>
          </p>
        )}
        <MissingLedgersCard entries={entries} ledgers={ledgers} onCreate={props.onCreateLedgers} />

        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="space-y-3 border-b border-slate-200 px-4 pt-3 pb-3">
            <div className="flex items-center gap-6 text-sm">
              {tabs.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilter(id)}
                  className={id === filter ? "font-semibold text-blue-700" : "text-slate-600 hover:text-slate-900"}
                >
                  {label} <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs">{count(id)}</span>
                </button>
              ))}
              <Button className="ml-auto px-3 py-1.5" disabled={inTally.status === "loading"} onClick={props.onRecheckTally}>
                <RefreshCw size={14} className={inTally.status === "loading" ? "animate-spin" : ""} /> Check Tally again
              </Button>
            </div>
            <div className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-1.5 text-sm">
              <Search size={16} className="shrink-0 text-slate-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search narration, ledger, UTR, amount…" className="w-full outline-none" />
            </div>
            {note && <p className="text-sm text-green-800">{note}</p>}
          </div>
          <datalist id="bank-ledger-choices">
            {choices.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="w-8 px-3 py-2" />
                  <th className="px-2 py-2 text-left font-medium">Date</th>
                  <th className="px-2 py-2 text-left font-medium">Narration</th>
                  <th className="px-2 py-2 text-right font-medium">Withdrawal</th>
                  <th className="px-2 py-2 text-right font-medium">Deposit</th>
                  <th className="px-2 py-2 text-left font-medium">Type</th>
                  <th className="px-2 py-2 text-left font-medium">Ledger</th>
                  <th className="px-2 py-2 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((e) => (
                  <EntryRow key={e.id} entry={e} checked={isChecked(e)} onToggle={() => toggle(e)} onChoose={(l) => choose(e, l)} />
                ))}
              </tbody>
            </table>
            {!shown.length && <p className="p-6 text-center text-sm text-slate-500">No lines match.</p>}
          </div>
        </div>
      </div>

      <StepFooter
        info={
          <>
            <b>{toPush.length}</b> of {entries.length} lines selected · ₹{formatPaise(toPush.reduce((n, e) => n + e.amount, 0))}
            {blockedByBalance && <span className="text-red-700"> · confirm the balance check above first</span>}
          </>
        }
      >
        <Button onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </Button>
        <Button variant="primary" disabled={!toPush.length || blockedByBalance} onClick={() => onPush(toPush)}>
          <Play size={16} /> Push to Tally ({toPush.length})
        </Button>
      </StepFooter>
    </>
  );
}

function EntryRow({ entry: e, checked, onToggle, onChoose }: { entry: BankEntry; checked: boolean; onToggle: () => void; onChoose: (ledger: string) => void }) {
  const [draft, setDraft] = useState(e.ledger);
  useEffect(() => setDraft(e.ledger), [e.ledger]);
  const commit = () => {
    const value = draft.trim();
    if (value && value !== e.ledger) onChoose(value);
    else setDraft(e.ledger);
  };
  const source = SOURCE_LABEL[e.source];
  const muted = e.status === "in-tally" ? "text-slate-400" : "";

  return (
    <tr className={`border-t border-slate-100 align-top ${muted}`}>
      <td className="px-3 py-2">
        <input type="checkbox" aria-label={`Push row ${e.row.rowNumber}`} checked={checked} disabled={e.status === "error"} onChange={onToggle} className="size-4 accent-blue-700" />
      </td>
      <td className="px-2 py-2 whitespace-nowrap">{e.date ? formatTallyDate(e.date) : e.row.rawDate || "–"}</td>
      <td className="max-w-80 px-2 py-2">
        <p className="truncate" title={e.row.narration}>
          {e.row.narration || "–"}
        </p>
        {e.instrument.number && (
          <p className="text-xs text-slate-500">
            {e.instrument.isCheque ? "Cheque" : "UTR / Ref"} {e.instrument.number}
          </p>
        )}
      </td>
      <td className="px-2 py-2 text-right tabular-nums">{e.side === "withdrawal" ? formatPaise(e.amount) : ""}</td>
      <td className="px-2 py-2 text-right tabular-nums">{e.side === "deposit" ? formatPaise(e.amount) : ""}</td>
      <td className="px-2 py-2">{e.type}</td>
      <td className="px-2 py-2">
        <input
          aria-label={`Ledger for row ${e.row.rowNumber}`}
          list="bank-ledger-choices"
          value={draft}
          onChange={(ev) => setDraft(ev.target.value)}
          onBlur={commit}
          onKeyDown={(ev) => ev.key === "Enter" && commit()}
          className={`w-56 rounded-md border px-2 py-1 outline-none focus:border-blue-500 ${e.source === "suspense" ? "border-amber-400 bg-amber-50" : "border-slate-200"}`}
        />
        <span className={`ml-2 rounded px-1.5 py-0.5 text-xs whitespace-nowrap ${source.className}`}>{source.text}</span>
      </td>
      <td className="px-2 py-2 text-xs">
        {e.status === "in-tally" && e.inTally ? (
          <span>
            Already in Tally: {e.inTally.type} {e.inTally.number} of {formatTallyDate(e.inTally.date)}
          </span>
        ) : (
          e.issues.map((i, n) => (
            <p key={n} className={i.level === "error" ? "text-red-700" : "text-amber-700"}>
              {i.message}
            </p>
          ))
        )}
        {e.status === "ready" && <span className="text-green-700">Ready</span>}
      </td>
    </tr>
  );
}

/** Ledgers the suggestions use that this company does not have yet; the usual ones can be made here. */
function MissingLedgersCard({ entries, ledgers, onCreate }: { entries: BankEntry[]; ledgers: Ledger[]; onCreate: (names: string[]) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const existing = new Set(ledgers.map((l) => l.name));
  const missing = [...new Set(entries.filter((e) => e.status !== "in-tally" && e.ledger && !existing.has(e.ledger)).map((e) => e.ledger))];
  if (!missing.length) return null;
  const standard = missing.filter((n) => STANDARD_BANK_LEDGERS.some((s) => s.name === n));
  const other = missing.filter((n) => !standard.includes(n));

  async function create() {
    setBusy(true);
    setError(null);
    try {
      await onCreate(standard);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={`${CARD} border-blue-200 bg-blue-50 text-sm`}>
      <h3 className="flex items-center gap-2 font-semibold text-blue-900">
        <BookPlus size={16} /> {missing.length === 1 ? "A ledger is" : `${missing.length} ledgers are`} not in Tally yet
      </h3>
      {standard.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span>
            {standard
              .map((n) => {
                const s = STANDARD_BANK_LEDGERS.find((x) => x.name === n)!;
                return `${s.name} (${s.group})`;
              })
              .join(", ")}
          </span>
          <Button variant="primary" className="px-3 py-1.5" disabled={busy} onClick={() => void create()}>
            <BookPlus size={14} /> {busy ? "Creating…" : `Create ${standard.length} in Tally`}
          </Button>
        </div>
      )}
      {other.length > 0 && <p className="mt-2 text-slate-700">Not a ledger in Tally: {other.join(", ")}. Choose an existing ledger on those lines.</p>}
      {error && <p className="mt-2 text-red-700">{error}</p>}
    </section>
  );
}
