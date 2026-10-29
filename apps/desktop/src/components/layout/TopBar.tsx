import type { ReactNode } from "react";
import { Bell, Building2, PanelLeft, Search, Settings } from "lucide-react";
import { formatTallyDate } from "../../lib/format";
import { RetryButton } from "../../features/connection/RetryButton";
import {
  describeStatus,
  isDisconnected,
  type TallyConnection,
} from "../../features/connection/useTallyStatus";
import type { CompanyState } from "../../features/tally/useCompanies";

interface TopBarProps {
  tally: TallyConnection;
  company: CompanyState;
  onToggleSidebar: () => void;
}

export function TopBar({ tally, company, onToggleSidebar }: TopBarProps) {
  const { label, dotClass } = describeStatus(tally.status);

  return (
    <header className="flex h-16 shrink-0 items-center gap-5 border-b border-slate-200 bg-white px-4 whitespace-nowrap">
      <button
        type="button"
        aria-label="Show or hide the menu"
        title="Show or hide the menu (Ctrl+B)"
        onClick={onToggleSidebar}
        className="-mr-2 grid size-9 place-items-center rounded-md text-slate-600 hover:bg-slate-100"
      >
        <PanelLeft size={18} />
      </button>
      <CompanyPicker company={company} />

      <div className="flex items-center gap-2 border-l border-slate-200 pl-5 text-sm leading-tight">
        <span className={`size-2.5 rounded-full ${dotClass}`} />
        <div>
          <p className="font-medium">{label}</p>
          <p className="text-xs text-slate-500">{tally.url.replace("http://", "")}</p>
        </div>
        {isDisconnected(tally.status) && <RetryButton tally={tally} className="ml-2" />}
      </div>

      <div className="ml-auto flex w-56 min-w-0 shrink items-center gap-2 rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-500">
        <Search size={16} />
        <input
          placeholder="Search (Ctrl+K)"
          className="w-full bg-transparent outline-none placeholder:text-slate-500"
        />
      </div>
      <IconButton label="Notifications">
        <Bell size={18} />
      </IconButton>
      <IconButton label="Settings">
        <Settings size={18} />
      </IconButton>
    </header>
  );
}

/** The list is re-read from Tally when opened, so a company opened in Tally just now shows up. */
function CompanyPicker({ company }: { company: CompanyState }) {
  const { companies, selected } = company;
  return (
    <div className="flex min-w-0 items-center gap-3">
      <label
        title={selected ? `The Tally company vouchers go into${selected.booksFrom ? ` (books from ${formatTallyDate(selected.booksFrom)})` : ""}` : undefined}
        className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium"
      >
        <Building2 size={16} className="shrink-0 text-blue-700" />
        {companies.length ? (
          <select
            aria-label="Company"
            value={selected?.name ?? ""}
            onChange={(e) => company.select(e.target.value)}
            onFocus={() => void company.reload()}
            className="max-w-64 truncate bg-transparent outline-none"
          >
            {companies.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-slate-500">No company open in Tally</span>
        )}
      </label>
    </div>
  );
}

function IconButton({ label, children }: { label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="grid size-9 place-items-center rounded-md text-slate-600 hover:bg-slate-100"
    >
      {children}
    </button>
  );
}
