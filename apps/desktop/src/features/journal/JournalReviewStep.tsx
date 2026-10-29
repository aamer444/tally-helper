import { Fragment, useState } from "react";
import { ArrowLeft, BookPlus, ChevronDown, ChevronRight, CircleCheck, CircleX, NotebookPen, Play, RefreshCw } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { StatCard } from "../../components/ui/StatCard";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { errorMessage } from "../../lib/errors";
import { formatPaise, formatTallyDate } from "../../lib/format";
import { partyKey, similarity } from "../sales/import/party-match";
import { StepFooter } from "../sales/steps/StepFooter";
import { CARD, SELECT } from "../sales/steps/styles";
import { EducationalBanner } from "../tally/EducationalBanner";
import type { Masters } from "../tally/useMasters";
import { groupChoices, unknownLedgers, type JournalVoucher } from "./journal";

interface JournalReviewStepProps {
  vouchers: JournalVoucher[];
  masters: Masters;
  voucherType: string;
  onVoucherTypeChange: (type: string) => void;
  /** A name in the file means this Tally ledger; remembered for later files. */
  onLink: (fileName: string, ledger: string) => void;
  onCreate: (name: string, group: string) => Promise<void>;
  moveToFirst: boolean;
  onMoveToFirstChange: (on: boolean) => void;
  onBack: () => void;
  onPush: (vouchers: JournalVoucher[]) => void;
}

export function JournalReviewStep(props: JournalReviewStepProps) {
  const { vouchers, masters, onBack, onPush } = props;
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);

  const isChecked = (v: JournalVoucher) => v.status !== "error" && !excluded.has(v.id);
  const toPush = vouchers.filter(isChecked);
  const count = (s: JournalVoucher["status"]) => vouchers.filter((v) => v.status === s).length;
  const toggle = (v: JournalVoucher) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(v.id)) next.delete(v.id);
      else next.add(v.id);
      return next;
    });

  return (
    <>
      <div className="flex-1 space-y-4 px-6 pb-4">
        {masters.educational && <EducationalBanner moveToFirst={props.moveToFirst} onMoveToFirstChange={props.onMoveToFirstChange} />}
        <div className="grid grid-cols-4 gap-4">
          <StatCard icon={NotebookPen} tone="blue" label="Journals" value={vouchers.length} hint={`${vouchers.reduce((n, v) => n + v.lines.length, 0)} lines`} />
          <StatCard icon={CircleCheck} tone="green" label="Ready to Push" value={count("ready") + count("warning")} hint="Debit equals credit" />
          <StatCard icon={CircleX} tone="red" label="Errors" value={count("error")} hint={count("error") ? "Fix before pushing" : "None"} />
          <StatCard icon={NotebookPen} tone="blue" label="Total" value={`₹${formatPaise(toPush.reduce((n, v) => n + v.debitTotal, 0))}`} hint="Of the selected journals" />
        </div>

        <section className={`${CARD} flex items-center gap-3 text-sm`}>
          <span className="font-medium">
            Voucher type<span className="text-red-600"> *</span>
          </span>
          <select aria-label="Voucher type" className={`${SELECT} max-w-xs`} value={props.voucherType} onChange={(e) => props.onVoucherTypeChange(e.target.value)}>
            {(masters.voucherTypes.length ? masters.voucherTypes : ["Journal"]).map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <Button className="ml-auto px-3 py-1.5" disabled={masters.refreshing} onClick={() => void masters.reload()}>
            <RefreshCw size={14} className={masters.refreshing ? "animate-spin" : ""} /> Refresh from Tally
          </Button>
        </section>

        <UnknownLedgersCard vouchers={vouchers} masters={masters} onLink={props.onLink} onCreate={props.onCreate} />

        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="w-8 px-3 py-2" />
                <th className="w-8" />
                <th className="px-2 py-2 text-left font-medium">Date</th>
                <th className="px-2 py-2 text-left font-medium">Voucher No</th>
                <th className="px-2 py-2 text-left font-medium">Narration</th>
                <th className="px-2 py-2 text-right font-medium">Lines</th>
                <th className="px-2 py-2 text-right font-medium">Amount (₹)</th>
                <th className="px-2 py-2 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {vouchers.map((v) => (
                <Fragment key={v.id}>
                  <tr className="cursor-pointer border-t border-slate-100 align-top hover:bg-slate-50" onClick={() => setOpen(open === v.id ? null : v.id)}>
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Push journal ${v.voucherNo || v.id}`}
                        checked={isChecked(v)}
                        disabled={v.status === "error"}
                        onChange={() => toggle(v)}
                        className="size-4 accent-blue-700"
                      />
                    </td>
                    <td className="py-2 text-slate-500">{open === v.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</td>
                    <td className="px-2 py-2 whitespace-nowrap">{v.date ? formatTallyDate(v.date) : "–"}</td>
                    <td className="px-2 py-2 whitespace-nowrap">{v.voucherNo || "–"}</td>
                    <td className="max-w-72 truncate px-2 py-2" title={v.narration}>
                      {v.narration || "–"}
                    </td>
                    <td className="px-2 py-2 text-right">{v.lines.length}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatPaise(v.debitTotal)}</td>
                    <td className="px-2 py-2">
                      <StatusBadge status={v.status} />
                      {v.issues.map((i, n) => (
                        <p key={n} className={`mt-1 text-xs ${i.level === "error" ? "text-red-700" : "text-amber-700"}`}>
                          {i.message}
                        </p>
                      ))}
                    </td>
                  </tr>
                  {open === v.id && <LinesRow voucher={v} />}
                </Fragment>
              ))}
            </tbody>
          </table>
          {!vouchers.length && <p className="p-6 text-center text-sm text-slate-500">No journal lines were found in the file.</p>}
        </div>
      </div>

      <StepFooter
        info={
          <>
            <b>{toPush.length}</b> of {vouchers.length} journals selected
            {count("error") > 0 && <span className="text-red-700"> · {count("error")} with errors will not be pushed</span>}
          </>
        }
      >
        <Button onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </Button>
        <Button variant="primary" disabled={!toPush.length} onClick={() => onPush(toPush)}>
          <Play size={16} /> Push to Tally ({toPush.length})
        </Button>
      </StepFooter>
    </>
  );
}

function LinesRow({ voucher }: { voucher: JournalVoucher }) {
  return (
    <tr className="bg-slate-50">
      <td colSpan={8} className="px-12 pb-3">
        <table className="w-full max-w-3xl text-sm">
          <thead className="text-slate-500">
            <tr>
              <th className="py-1 text-left font-medium">Row</th>
              <th className="py-1 text-left font-medium">Ledger in file</th>
              <th className="py-1 text-left font-medium">Tally ledger</th>
              <th className="py-1 text-right font-medium">Debit</th>
              <th className="py-1 text-right font-medium">Credit</th>
            </tr>
          </thead>
          <tbody>
            {voucher.lines.map((l) => (
              <tr key={l.rowNumber} className="border-t border-slate-200">
                <td className="py-1">{l.rowNumber}</td>
                <td className="py-1">{l.fileLedger || "–"}</td>
                <td className={`py-1 ${l.ledger ? "" : "text-red-700"}`}>{l.ledger || "not in Tally"}</td>
                <td className="py-1 text-right tabular-nums">{l.debit ? formatPaise(l.debit) : ""}</td>
                <td className="py-1 text-right tabular-nums">{l.credit ? formatPaise(l.credit) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </td>
    </tr>
  );
}

interface UnknownLedgersCardProps {
  vouchers: JournalVoucher[];
  masters: Masters;
  onLink: (fileName: string, ledger: string) => void;
  onCreate: (name: string, group: string) => Promise<void>;
}

/** Names the file uses that Tally does not have: link each to an existing ledger, or create it in a group. */
function UnknownLedgersCard({ vouchers, masters, onLink, onCreate }: UnknownLedgersCardProps) {
  const unknown = unknownLedgers(vouchers);
  if (!unknown.length) return null;
  return (
    <section className={`${CARD} border-blue-200 bg-blue-50 text-sm`}>
      <h3 className="flex items-center gap-2 font-semibold text-blue-900">
        <BookPlus size={16} /> {unknown.length === 1 ? "A ledger name in the file is" : `${unknown.length} ledger names in the file are`} not in Tally
      </h3>
      <p className="mt-1 text-slate-700">Pick the Tally ledger each one means (remembered for next time), or create it.</p>
      <div className="mt-3 space-y-2">
        {unknown.map((u) => (
          <UnknownLedgerRow key={u.name} name={u.name} uses={u.uses} masters={masters} onLink={onLink} onCreate={onCreate} />
        ))}
      </div>
    </section>
  );
}

function UnknownLedgerRow({ name, uses, masters, onLink, onCreate }: { name: string; uses: number } & Omit<UnknownLedgersCardProps, "vouchers">) {
  const groups = groupChoices(masters.ledgers);
  const [group, setGroup] = useState(groups[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Closest names first, so "Salary A/c" offers "Salaries" before the rest.
  const key = partyKey(name);
  const ranked = [...masters.ledgers].sort((a, b) => similarity(key, partyKey(b.name)) - similarity(key, partyKey(a.name)));

  async function create() {
    setBusy(true);
    setError(null);
    try {
      await onCreate(name, group);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-[200px_1fr_auto] items-center gap-3 rounded-md bg-white p-2">
      <span className="truncate font-medium" title={name}>
        {name} <span className="font-normal text-slate-500">({uses} line{uses > 1 ? "s" : ""})</span>
      </span>
      <select aria-label={`Tally ledger for ${name}`} className={SELECT} value="" onChange={(e) => e.target.value && onLink(name, e.target.value)}>
        <option value="">Use an existing ledger…</option>
        {ranked.map((l) => (
          <option key={l.name} value={l.name}>
            {l.name} ({l.parent.replace(/[\u0000-\u001f]/g, "").trim()})
          </option>
        ))}
      </select>
      <div className="flex items-center gap-2">
        <span className="text-slate-500">or create under</span>
        <select aria-label={`Group for ${name}`} className={`${SELECT} w-52`} value={group} onChange={(e) => setGroup(e.target.value)}>
          {groups.map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
        <Button variant="primary" className="px-3 py-1.5" disabled={busy} onClick={() => void create()}>
          {busy ? "Creating…" : "Create"}
        </Button>
      </div>
      {error && <p className="col-span-3 text-red-700">{error}</p>}
    </div>
  );
}
