import { useMemo, useState } from "react";
import { ArrowLeft, CircleCheck, CircleX, FileSpreadsheet, Play, ReceiptText, RefreshCw, Search, TriangleAlert } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { StatCard } from "../../../components/ui/StatCard";
import type { ReviewStatus } from "../../../components/ui/StatusBadge";
import { formatPaise } from "../../../lib/format";
import type { Masters } from "../../tally/useMasters";
import type { InvoiceVoucher } from "../import/build-vouchers";
import { headersOf, sheetOf, type ImportFile } from "../import/import-file";
import type { KindConfig } from "../import/kind";
import { VoucherPanel, type MasterActions } from "../VoucherPanel";
import { VoucherTable } from "../VoucherTable";
import { StepFooter } from "./StepFooter";

type Filter = "all" | ReviewStatus;

interface ReviewStepProps {
  kind: KindConfig;
  vouchers: InvoiceVoucher[];
  file: ImportFile;
  voucherType: string;
  masters: Masters;
  onBack: () => void;
  onPush: (selected: InvoiceVoucher[]) => void;
  actions: MasterActions | null;
}

function summarise(vouchers: InvoiceVoucher[]) {
  const count = (s: ReviewStatus) => vouchers.filter((v) => v.status === s).length;
  return {
    rows: vouchers.reduce((n, v) => n + v.rowNumbers.length, 0),
    vouchers: vouchers.length,
    ready: count("ready"),
    warnings: count("warning"),
    errors: count("error"),
  };
}

function matches(v: InvoiceVoucher, filter: Filter, query: string): boolean {
  if (filter !== "all" && v.status !== filter) return false;
  const q = query.trim().toLowerCase();
  return !q || [v.invoiceNo, v.party, v.gstin, ...v.lines.map((l) => l.ledger)].some((s) => s.toLowerCase().includes(q));
}

export function ReviewStep({ kind, vouchers, file, voucherType, masters, onBack, onPush, actions }: ReviewStepProps) {
  const stats = useMemo(() => summarise(vouchers), [vouchers]);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(vouchers[0]?.id ?? null);
  // Store what the user unticked, so vouchers that become pushable after a fix are ticked by default.
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(new Set());

  const shown = vouchers.filter((v) => matches(v, filter, query));
  const isChecked = (v: InvoiceVoucher) => v.status !== "error" && !excluded.has(v.id);
  const toPush = vouchers.filter(isChecked);
  const pushTotal = toPush.reduce((n, v) => n + v.total, 0);
  const selected = vouchers.find((v) => v.id === selectedId);
  const allShownChecked = shown.some(isChecked) && shown.every((v) => v.status === "error" || isChecked(v));

  const toggle = (v: InvoiceVoucher) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(v.id)) next.delete(v.id);
      else next.add(v.id);
      return next;
    });
  const toggleAll = () =>
    setExcluded((prev) => {
      const next = new Set(prev);
      for (const v of shown) {
        if (allShownChecked) next.add(v.id);
        else next.delete(v.id);
      }
      return next;
    });

  const tabs: [Filter, string, number][] = [
    ["all", "All", stats.vouchers],
    ["ready", "Ready", stats.ready],
    ["warning", "Warnings", stats.warnings],
    ["error", "Errors", stats.errors],
  ];

  return (
    <>
      <div className="flex-1 space-y-4 px-6 pb-4">
        <div className="grid grid-cols-5 gap-4">
          <StatCard icon={FileSpreadsheet} tone="blue" label="Rows Read" value={stats.rows} hint={`from ${file.workbook.fileName}`} />
          <StatCard icon={ReceiptText} tone="blue" label="Vouchers" value={stats.vouchers} hint={`${stats.rows} rows joined by ${kind.invoiceNoLabel}`} />
          <StatCard icon={CircleCheck} tone="green" label="Ready to Push" value={stats.ready} hint="No issues" />
          <StatCard icon={TriangleAlert} tone="amber" label="Warnings" value={stats.warnings} hint="Check, can still push" />
          <StatCard icon={CircleX} tone="red" label="Errors" value={stats.errors} hint={stats.errors ? "Fix in file or Tally" : "None"} />
        </div>

        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white">
            <div className="space-y-3 border-b border-slate-200 px-4 pt-3 pb-3">
              <div className="flex items-center gap-6 text-sm">
                {tabs.map(([id, label, n]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setFilter(id)}
                    className={id === filter ? "font-semibold text-blue-700" : "text-slate-600 hover:text-slate-900"}
                  >
                    {label} <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs">{n}</span>
                  </button>
                ))}
                <Button className="ml-auto px-3 py-1.5" disabled={masters.refreshing} onClick={() => void masters.reload()}>
                  <RefreshCw size={14} className={masters.refreshing ? "animate-spin" : ""} /> Refresh from Tally
                </Button>
              </div>
              <div className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-1.5 text-sm">
                <Search size={16} className="shrink-0 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by invoice, party, GSTIN, ledger…"
                  className="w-full outline-none"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <VoucherTable
                kind={kind}
                vouchers={shown}
                selectedId={selectedId}
                isChecked={isChecked}
                onSelect={setSelectedId}
                onToggle={toggle}
                allChecked={allShownChecked}
                onToggleAll={toggleAll}
              />
            </div>
            {!shown.length && <p className="p-6 text-center text-sm text-slate-500">No vouchers match.</p>}
          </div>
          {selected && (
            <VoucherPanel
              key={selected.id}
              voucher={selected}
              headers={headersOf(file)}
              sheetRows={sheetOf(file).rows}
              voucherType={voucherType}
              actions={actions}
              onClose={() => setSelectedId(null)}
            />
          )}
        </div>
      </div>

      <StepFooter
        info={
          <>
            <b>{toPush.length}</b> of {stats.vouchers} vouchers selected · ₹{formatPaise(pushTotal)}
            {stats.errors > 0 && <span className="text-red-700"> · {stats.errors} with errors will not be pushed</span>}
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
