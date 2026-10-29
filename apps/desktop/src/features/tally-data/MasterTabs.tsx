import { formatDrCr, formatPaise } from "../../lib/format";
import { DataTable } from "./DataTable";
import type { GroupRow, LedgerRow, StockItemRow } from "./tally-data";
import type { TallyQuery } from "./useTallyQuery";

const dash = (s: string) => s || "–";

function sumBy<T>(rows: T[], value: (r: T) => number, keep: (n: number) => boolean): number {
  return rows.reduce((total, r) => (keep(value(r)) ? total + value(r) : total), 0);
}

function LedgerTotals({ rows }: { rows: LedgerRow[] }) {
  const dr = sumBy(rows, (l) => l.closing, (n) => n < 0);
  const cr = sumBy(rows, (l) => l.closing, (n) => n > 0);
  return (
    <tr>
      <td colSpan={4} className="px-3 py-2.5">
        Closing total of {rows.length} ledgers
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums">{formatDrCr(dr)}</td>
      <td className="px-3 py-2.5 text-right tabular-nums">{formatDrCr(cr)}</td>
    </tr>
  );
}

export function LedgersTab({ query }: { query: TallyQuery<LedgerRow[]> }) {
  return (
    <DataTable
      query={query}
      noun="ledgers"
      rowKey={(l) => l.name}
      searchText={(l) => [l.name, l.group, l.gstin, l.stateName]}
      columns={[
        { header: "Ledger", cell: (l) => <span className="font-medium">{l.name}</span> },
        { header: "Under (group)", cell: (l) => l.group },
        { header: "GSTIN", cell: (l) => dash(l.gstin) },
        { header: "State", cell: (l) => dash(l.stateName) },
        { header: "Opening balance", align: "right", cell: (l) => formatDrCr(l.opening) },
        { header: "Closing balance", align: "right", cell: (l) => formatDrCr(l.closing) },
      ]}
      footer={(rows) => <LedgerTotals rows={rows} />}
    />
  );
}

export function GroupsTab({ query }: { query: TallyQuery<GroupRow[]> }) {
  return (
    <DataTable
      query={query}
      noun="groups"
      rowKey={(g) => g.name}
      searchText={(g) => [g.name, g.parent]}
      columns={[
        { header: "Group", cell: (g) => <span className="font-medium">{g.name}</span> },
        { header: "Under", cell: (g) => dash(g.parent) },
      ]}
    />
  );
}

export function StockTab({ query }: { query: TallyQuery<StockItemRow[]> }) {
  return (
    <DataTable
      query={query}
      noun="stock items"
      rowKey={(s) => s.name}
      searchText={(s) => [s.name, s.group]}
      columns={[
        { header: "Item", cell: (s) => <span className="font-medium">{s.name}</span> },
        { header: "Under (group)", cell: (s) => dash(s.group) },
        { header: "Unit", cell: (s) => dash(s.unit) },
        { header: "Closing qty", align: "right", cell: (s) => dash(s.closingQty) },
        { header: "Rate", align: "right", cell: (s) => dash(s.closingRate) },
        { header: "Closing value (₹)", align: "right", cell: (s) => (s.closingValue ? formatPaise(s.closingValue) : "–") },
      ]}
    />
  );
}
