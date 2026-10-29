import { useState, type ChangeEvent } from "react";
import { formatPaise, formatTallyDate, isoToTallyDate, tallyToIsoDate } from "../../lib/format";
import { DataTable } from "./DataTable";
import type { VoucherRow } from "./tally-data";
import type { TallyQuery } from "./useTallyQuery";

export interface Period {
  from: string; // YYYYMMDD
  to: string;
}

interface VouchersTabProps {
  query: TallyQuery<VoucherRow[]>;
  period: Period;
  onPeriodChange: (period: Period) => void;
}

const INPUT = "rounded-md border border-slate-200 px-2 py-1.5 text-sm";

function PeriodPicker({ period, onChange }: { period: Period; onChange: (p: Period) => void }) {
  const set = (field: keyof Period) => (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) onChange({ ...period, [field]: isoToTallyDate(e.target.value) });
  };
  return (
    <span className="flex items-center gap-2 text-sm text-slate-700">
      From <input type="date" className={INPUT} value={tallyToIsoDate(period.from)} onChange={set("from")} />
      to <input type="date" className={INPUT} value={tallyToIsoDate(period.to)} onChange={set("to")} />
    </span>
  );
}

function VoucherDetail({ v }: { v: VoucherRow }) {
  return (
    <div className="space-y-3">
      {v.narration && <p className="text-sm text-slate-700">Narration: {v.narration}</p>}
      <table className="w-full max-w-3xl text-sm">
        <thead className="text-slate-600">
          <tr>
            <th className="py-1 text-left font-medium">Ledger</th>
            <th className="py-1 text-right font-medium">Debit (₹)</th>
            <th className="py-1 text-right font-medium">Credit (₹)</th>
          </tr>
        </thead>
        <tbody>
          {v.lines.map((l, i) => (
            <tr key={i} className="border-t border-slate-200">
              <td className="py-1">{l.ledger}</td>
              <td className="py-1 text-right tabular-nums">{l.amount < 0 ? formatPaise(-l.amount) : ""}</td>
              <td className="py-1 text-right tabular-nums">{l.amount > 0 ? formatPaise(l.amount) : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {v.items.length > 0 && (
        <table className="w-full max-w-3xl text-sm">
          <thead className="text-slate-600">
            <tr>
              <th className="py-1 text-left font-medium">Stock item</th>
              <th className="py-1 text-right font-medium">Qty</th>
              <th className="py-1 text-right font-medium">Rate</th>
              <th className="py-1 text-right font-medium">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            {v.items.map((it, i) => (
              <tr key={i} className="border-t border-slate-200">
                <td className="py-1">{it.item}</td>
                <td className="py-1 text-right">{it.qty}</td>
                <td className="py-1 text-right">{it.rate}</td>
                <td className="py-1 text-right tabular-nums">{formatPaise(it.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function VouchersTab({ query, period, onPeriodChange }: VouchersTabProps) {
  const [type, setType] = useState("");
  const types = [...new Set((query.data ?? []).map((v) => v.type))].sort();

  return (
    <DataTable
      query={query}
      noun="vouchers"
      rowKey={(v) => v.id}
      searchText={(v) => [v.number, v.party, v.narration, ...v.lines.map((l) => l.ledger)]}
      filter={(v) => !type || v.type === type}
      filters={
        <>
          <PeriodPicker period={period} onChange={onPeriodChange} />
          <select value={type} onChange={(e) => setType(e.target.value)} className={INPUT} aria-label="Voucher type">
            <option value="">All voucher types</option>
            {types.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </>
      }
      columns={[
        { header: "Date", cell: (v) => formatTallyDate(v.date) },
        { header: "Type", cell: (v) => v.type },
        { header: "No.", cell: (v) => v.number || "–" },
        {
          header: "Party / Particulars",
          cell: (v) => (
            <span className={v.cancelled ? "text-slate-400 line-through" : ""}>
              {v.party || v.lines[0]?.ledger || "–"}
              {v.cancelled && " (cancelled)"}
            </span>
          ),
        },
        { header: "Amount (₹)", align: "right", cell: (v) => formatPaise(v.amount) },
      ]}
      footer={(rows) => (
        <tr>
          <td colSpan={4} className="px-3 py-2.5">
            Total of {rows.length} vouchers
          </td>
          <td className="px-3 py-2.5 text-right tabular-nums">{formatPaise(rows.reduce((n, v) => n + v.amount, 0))}</td>
        </tr>
      )}
      detail={(v) => <VoucherDetail v={v} />}
    />
  );
}
