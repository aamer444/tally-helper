import { Fragment, useState, type ReactNode } from "react";
import { RefreshCw, Search } from "lucide-react";
import { Button } from "../../components/ui/Button";
import type { TallyQuery } from "./useTallyQuery";

/** Rendering tens of thousands of rows freezes the window; search narrows big books instead. */
const ROW_LIMIT = 1000;

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  align?: "right";
}

interface DataTableProps<T> {
  query: TallyQuery<T[]>;
  columns: Column<T>[];
  rowKey: (row: T) => string;
  searchText: (row: T) => string[];
  noun: string;
  filters?: ReactNode;
  filter?: (row: T) => boolean;
  footer?: (rows: T[]) => ReactNode;
  detail?: (row: T) => ReactNode;
}

const TH = "px-3 py-2.5 font-medium whitespace-nowrap";

export function DataTable<T>({ query, columns, rowKey, searchText, noun, filters, filter, footer, detail }: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const all = query.data ?? [];
  const q = search.trim().toLowerCase();
  const matched = all.filter((r) => (!filter || filter(r)) && (!q || searchText(r).some((s) => s.toLowerCase().includes(q))));
  const shown = matched.slice(0, ROW_LIMIT);

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-3">
        <label className="flex min-w-64 flex-1 items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm">
          <Search size={16} className="text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${noun}`} className="w-full outline-none" />
        </label>
        {filters}
        <span className="text-sm text-slate-600">
          {query.data ? `${matched.length} of ${all.length} ${noun}` : ""}
        </span>
        <Button onClick={query.reload} disabled={query.loading} className="px-3 py-2">
          <RefreshCw size={16} className={query.loading ? "animate-spin" : ""} />
          {query.loading ? "Reading Tally…" : "Refresh"}
        </Button>
      </div>

      {query.error && <p className="m-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{query.error}</p>}
      {!query.data && query.loading && <p className="p-6 text-sm text-slate-500">Reading from Tally…</p>}
      {query.data && matched.length === 0 && (
        <p className="p-6 text-sm text-slate-500">{all.length ? `No ${noun} match your search.` : `Tally has no ${noun} here yet.`}</p>
      )}

      {shown.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr className="border-b border-slate-200">
                {columns.map((c) => (
                  <th key={c.header} className={`${TH} ${c.align === "right" ? "text-right" : "text-left"}`}>
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => {
                const key = rowKey(row);
                const open = detail && openKey === key;
                return (
                  <Fragment key={key}>
                    <tr
                      onClick={detail ? () => setOpenKey(open ? null : key) : undefined}
                      className={`border-b border-slate-100 ${detail ? "cursor-pointer" : ""} ${open ? "bg-blue-50" : "hover:bg-slate-50"}`}
                    >
                      {columns.map((c) => (
                        <td key={c.header} className={`px-3 py-2 ${c.align === "right" ? "text-right tabular-nums" : ""}`}>
                          {c.cell(row)}
                        </td>
                      ))}
                    </tr>
                    {open && (
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <td colSpan={columns.length} className="px-6 py-3">
                          {detail(row)}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
            {footer && <tfoot className="border-t-2 border-slate-200 font-semibold">{footer(matched)}</tfoot>}
          </table>
        </div>
      )}
      {matched.length > ROW_LIMIT && (
        <p className="border-t border-slate-200 p-3 text-sm text-slate-600">
          Showing the first {ROW_LIMIT}. Search to find the rest.
        </p>
      )}
    </div>
  );
}
