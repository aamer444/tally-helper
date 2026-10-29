import { useState } from "react";
import { navLabel, type PageId } from "./app/navigation";
import { Sidebar } from "./components/layout/Sidebar";
import { TopBar } from "./components/layout/TopBar";
import { useTallyStatus, type TallyConnection } from "./features/connection/useTallyStatus";
import { HomePage } from "./features/home/HomePage";
import { ComingSoon } from "./features/placeholder/ComingSoon";
import { SalesImportPage } from "./features/sales/SalesImportPage";
import { TallyDataPage } from "./features/tally-data/TallyDataPage";
import { useCompanies } from "./features/tally/useCompanies";
import type { Company } from "./features/tally/types";

function renderPage(page: PageId, tally: TallyConnection, company: Company | null) {
  if (page === "home") return <HomePage tally={tally} />;
  if (page === "masters") return <TallyDataPage tally={tally} company={company} />;
  return <ComingSoon title={navLabel(page)} />;
}

export default function App() {
  const [page, setPage] = useState<PageId>("home");
  const tally = useTallyStatus();
  const company = useCompanies(tally);

  return (
    <div className="flex h-screen">
      <Sidebar active={page} onNavigate={setPage} tally={tally} company={company.selected} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar tally={tally} company={company} />
        <main className="min-h-0 flex-1 overflow-auto bg-slate-50">
          {/* Kept mounted so an import in progress survives a visit to another page. */}
          <div hidden={page !== "sales"} className="h-full">
            <SalesImportPage tally={tally} company={company.selected} />
          </div>
          {page !== "sales" && renderPage(page, tally, company.selected)}
        </main>
      </div>
    </div>
  );
}
