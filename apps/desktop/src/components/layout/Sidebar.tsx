import { NAV_SECTIONS, type PageId } from "../../app/navigation";

interface SidebarProps {
  active: PageId;
  onNavigate: (page: PageId) => void;
}

export function Sidebar({ active, onNavigate }: SidebarProps) {
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-slate-50">
      <Brand />
      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {NAV_SECTIONS.map((section, i) => (
          <div key={section.title ?? i} className="mt-4 first:mt-1">
            {section.title && (
              <p className="px-3 pb-1.5 text-[11px] font-medium tracking-wide text-slate-500 uppercase">
                {section.title}
              </p>
            )}
            {section.items.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => onNavigate(id)}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm ${
                  id === active
                    ? "bg-blue-100/70 font-semibold text-blue-800"
                    : "text-slate-700 hover:bg-slate-200/60"
                }`}
              >
                <Icon size={18} strokeWidth={1.75} />
                {label}
              </button>
            ))}
          </div>
        ))}
      </nav>
      <p className="my-3 text-center text-xs text-slate-500">
        Press <kbd className="rounded border border-slate-300 bg-white px-1.5 py-0.5 font-sans text-[11px] text-slate-700">Ctrl</kbd> +{" "}
        <kbd className="rounded border border-slate-300 bg-white px-1.5 py-0.5 font-sans text-[11px] text-slate-700">B</kbd> to hide this menu
      </p>
    </aside>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-3 px-5 py-4">
      <div className="grid size-9 place-items-center rounded-lg bg-blue-700 text-lg font-bold text-white">
        T
      </div>
      <div className="leading-tight">
        <p className="font-semibold">TallyHelper</p>
        <p className="text-xs text-slate-500">For Accountants</p>
      </div>
    </div>
  );
}

