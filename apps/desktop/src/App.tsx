import { useState } from "react";
import { navLabel, type PageId } from "./app/navigation";
import { useSidebar } from "./app/useSidebar";
import { useAppUpdate } from "./app/useAppUpdate";
import { UpdateBanner } from "./components/layout/UpdateBanner";
import { Sidebar } from "./components/layout/Sidebar";
import { TopBar } from "./components/layout/TopBar";
import { useTallyStatus, type TallyConnection } from "./features/connection/useTallyStatus";
import { HomePage } from "./features/home/HomePage";
import { ComingSoon } from "./features/placeholder/ComingSoon";
import { InvoiceImportPage } from "./features/sales/InvoiceImportPage";
import { BankImportPage } from "./features/bank/BankImportPage";
import { JournalImportPage } from "./features/journal/JournalImportPage";
import { NotesPage } from "./features/notes/NotesPage";
import { TallyDataPage } from "./features/tally-data/TallyDataPage";
import { useCompanies } from "./features/tally/useCompanies";
import type { Company } from "./features/tally/types";

const IMPORT_PAGES = ["sales", "purchase"] as const;
const KEPT_PAGES: readonly PageId[] = [...IMPORT_PAGES, "bank", "notes", "journals"];

function renderPage(page: PageId, tally: TallyConnection, company: Company | null) {
  if (page === "home") return <HomePage tally={tally} />;
  if (page === "masters") return <TallyDataPage tally={tally} company={company} />;
  return <ComingSoon title={navLabel(page)} />;
}

export default function App() {
  const [page, setPage] = useState<PageId>("home");
  const tally = useTallyStatus();
  const company = useCompanies(tally);
  const sidebar = useSidebar();
  const appUpdate = useAppUpdate();

  return (
    <div className="flex h-screen">
      {sidebar.open && <Sidebar active={page} onNavigate={setPage} />}
      <div className="flex min-w-0 flex-1 flex-col">
        <UpdateBanner state={appUpdate.state} onInstall={() => void appUpdate.install()} />
        <TopBar tally={tally} company={company} onToggleSidebar={sidebar.toggle} />
        <main className="min-h-0 flex-1 overflow-auto bg-slate-50">
          {/* Kept mounted so an import in progress survives a visit to another page. */}
          {IMPORT_PAGES.map((kind) => (
            <div key={kind} hidden={page !== kind} className="h-full">
              <InvoiceImportPage kind={kind} tally={tally} company={company.selected} />
            </div>
          ))}
          <div hidden={page !== "bank"} className="h-full">
            <BankImportPage tally={tally} company={company.selected} />
          </div>
          <div hidden={page !== "notes"} className="h-full">
            <NotesPage tally={tally} company={company.selected} />
          </div>
          <div hidden={page !== "journals"} className="h-full">
            <JournalImportPage tally={tally} company={company.selected} />
          </div>
          {!KEPT_PAGES.includes(page) && renderPage(page, tally, company.selected)}
        </main>
      </div>
    </div>
  );
}
