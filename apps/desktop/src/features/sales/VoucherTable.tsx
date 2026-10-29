import { StatusBadge } from "../../components/ui/StatusBadge";
import { formatPaise, formatTallyDate } from "../../lib/format";
import type { SalesVoucher } from "./import/build-vouchers";

interface VoucherTableProps {
  vouchers: SalesVoucher[];
  selectedId: string | null;
  isChecked: (v: SalesVoucher) => boolean;
  onSelect: (id: string) => void;
  onToggle: (v: SalesVoucher) => void;
  allChecked: boolean;
  onToggleAll: () => void;
}

const TH = "px-3 py-2.5 text-left font-medium whitespace-nowrap";

function issueSummary(v: SalesVoucher): string {
  if (!v.issues.length) return "–";
  return v.issues.length > 1 ? `${v.issues[0].message} (+${v.issues.length - 1} more)` : v.issues[0].message;
}

export function VoucherTable({ vouchers, selectedId, isChecked, onSelect, onToggle, allChecked, onToggleAll }: VoucherTableProps) {
  return (
    <table className="w-full text-sm">
      <thead className="bg-slate-50 text-slate-700">
        <tr className="border-b border-slate-200">
          <th className={`${TH} w-10`}>
            <input type="checkbox" aria-label="Select all" checked={allChecked} onChange={onToggleAll} className="size-4 accent-blue-700" />
          </th>
          <th className={TH}>Row</th>
          <th className={TH}>Date</th>
          <th className={TH}>Invoice No</th>
          <th className={TH}>Party / Customer</th>
          <th className={`${TH} text-right`}>Total (₹)</th>
          <th className={TH}>Status</th>
          <th className={TH}>Issues</th>
        </tr>
      </thead>
      <tbody>
        {vouchers.map((v) => (
          <tr
            key={v.id}
            onClick={() => onSelect(v.id)}
            className={`cursor-pointer border-b border-slate-100 ${v.id === selectedId ? "bg-blue-50" : "hover:bg-slate-50"}`}
          >
            <td className="px-3 py-2.5">
              <input
                type="checkbox"
                aria-label={`Push ${v.invoiceNo}`}
                checked={isChecked(v)}
                disabled={v.status === "error"}
                onClick={(e) => e.stopPropagation()}
                onChange={() => onToggle(v)}
                className="size-4 accent-blue-700"
              />
            </td>
            <td className="px-3 py-2.5 text-slate-500">{v.rowNumbers[0]}</td>
            <td className="px-3 py-2.5 whitespace-nowrap">{v.date ? formatTallyDate(v.date) : "–"}</td>
            <td className="px-3 py-2.5 whitespace-nowrap">{v.invoiceNo || "–"}</td>
            <td className="px-3 py-2.5">{v.party || "–"}</td>
            <td className="px-3 py-2.5 text-right tabular-nums">{formatPaise(v.total)}</td>
            <td className="px-3 py-2.5">
              <StatusBadge status={v.status} />
            </td>
            <td className="max-w-80 truncate px-3 py-2.5 text-slate-600" title={v.issues.map((i) => i.message).join("\n")}>
              {issueSummary(v)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
