import { useState } from "react";
import { BookOpen, Boxes, FolderTree, ReceiptText, type LucideIcon } from "lucide-react";
import { StatCard } from "../../components/ui/StatCard";
import { todayYmd } from "../../lib/dates";
import { formatTallyDate } from "../../lib/format";
import type { TallyConnection } from "../connection/useTallyStatus";
import type { Company } from "../tally/types";
import { GroupsTab, LedgersTab, StockTab } from "./MasterTabs";
import { fetchGroups, fetchLedgerBook, fetchStockItems, fetchVouchers } from "./tally-data";
import { useTallyQuery, type TallyQuery } from "./useTallyQuery";
import { VouchersTab, type Period } from "./VouchersTab";

type Tab = "vouchers" | "ledgers" | "groups" | "stock";

interface TallyDataPageProps {
  tally: TallyConnection;
  company: Company | null;
}

function defaultPeriod(company: Company): Period {
  const today = todayYmd();
  const from = company.booksFrom || today;
  return { from, to: today > from ? today : from };
}

const countOf = (q: TallyQuery<unknown[]>) => (q.data ? q.data.length : q.loading ? "…" : "–");

export function TallyDataPage({ tally, company }: TallyDataPageProps) {
  const [tab, setTab] = useState<Tab>("vouchers");
  const [periods, setPeriods] = useState<Record<string, Period>>({});
  const name = company?.name ?? null;
  const period = company ? (periods[company.name] ?? defaultPeriod(company)) : null;

  const ledgers = useTallyQuery(name, () => fetchLedgerBook(tally.url, name!));
  const groups = useTallyQuery(name, () => fetchGroups(tally.url, name!));
  const stock = useTallyQuery(name, () => fetchStockItems(tally.url, name!));
  const vouchers = useTallyQuery(name && period && `${name}|${period.from}|${period.to}`, () =>
    fetchVouchers(tally.url, name!, period!.from, period!.to),
  );

  const tabs: { id: Tab; label: string; icon: LucideIcon; query: TallyQuery<unknown[]>; hint: string }[] = [
    { id: "vouchers", label: "Vouchers", icon: ReceiptText, query: vouchers, hint: period ? `${formatTallyDate(period.from)} to ${formatTallyDate(period.to)}` : "" },
    { id: "ledgers", label: "Ledgers", icon: BookOpen, query: ledgers, hint: "With opening and closing balances" },
    { id: "groups", label: "Groups", icon: FolderTree, query: groups, hint: "Chart of accounts" },
    { id: "stock", label: "Stock Items", icon: Boxes, query: stock, hint: "Closing stock" },
  ];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Tally Data</h1>
        <p className="mt-1 text-slate-600">
          Everything in {name ? <b>{name}</b> : "your company"}, read live from TallyPrime. Nothing here changes your books.
        </p>
      </div>

      {!company ? (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          {"ok" in tally.status && tally.status.ok
            ? "No company is open in Tally. Open your company in TallyPrime; it will appear at the top."
            : "Tally is not connected. Open TallyPrime, then press Retry at the bottom left."}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-4">
            {tabs.map((t) => (
              <button key={t.id} type="button" onClick={() => setTab(t.id)} className={`rounded-lg text-left ${tab === t.id ? "ring-2 ring-blue-600" : ""}`}>
                <StatCard icon={t.icon} tone="blue" label={t.label} value={countOf(t.query)} hint={t.hint} />
              </button>
            ))}
          </div>

          {tab === "vouchers" && period && (
            <VouchersTab query={vouchers} period={period} onPeriodChange={(p) => setPeriods((prev) => ({ ...prev, [company.name]: p }))} />
          )}
          {tab === "ledgers" && <LedgersTab query={ledgers} />}
          {tab === "groups" && <GroupsTab query={groups} />}
          {tab === "stock" && <StockTab query={stock} />}
        </>
      )}
    </div>
  );
}
