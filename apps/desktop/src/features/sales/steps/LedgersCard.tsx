import { RefreshCw } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import type { Masters } from "../../tally/useMasters";
import type { InvoiceSettings } from "../import/build-vouchers";
import type { KindConfig } from "../import/kind";
import { CARD, SELECT } from "./styles";

type LedgerKey = Exclude<keyof InvoiceSettings, "voucherType" | "withStock">;

function ledgerFields(kind: KindConfig): { key: LedgerKey; label: string; hint: string }[] {
  const what = kind.mainRole.toLowerCase();
  const side = kind.kind === "purchase" ? "debited" : "credited";
  return [
    { key: "mainLedger", label: `${kind.mainRole} ledger *`, hint: `Taxable value is ${side} here` },
    { key: "cgstLedger", label: "CGST ledger", hint: `Same-state ${what}` },
    { key: "sgstLedger", label: "SGST ledger", hint: `Same-state ${what}` },
    { key: "igstLedger", label: "IGST ledger", hint: `Other-state ${what}` },
    { key: "roundOffLedger", label: "Round off ledger", hint: "Up to ₹1 difference" },
    ...(kind.acceptsPdf ? [{ key: "discountLedger" as const, label: "Discount ledger", hint: "A bill's trade discount on products" }] : []),
  ];
}

interface LedgersCardProps {
  kind: KindConfig;
  settings: InvoiceSettings;
  onSettingsChange: (patch: Partial<InvoiceSettings>) => void;
  masters: Masters;
}

export function LedgersCard({ kind, settings, onSettingsChange, masters }: LedgersCardProps) {
  return (
    <section className={CARD}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Tally ledgers</h2>
          <p className="mt-1 text-sm text-slate-600">Where each amount goes in Tally.</p>
        </div>
        <Button className="px-3 py-1.5" disabled={masters.refreshing} onClick={() => void masters.reload()}>
          <RefreshCw size={14} className={masters.refreshing ? "animate-spin" : ""} /> Refresh from Tally
        </Button>
      </div>

      {masters.status === "idle" && <p className="mt-4 text-sm text-amber-700">Open a company in Tally and select it at the top.</p>}
      {masters.status === "loading" && <p className="mt-4 text-sm text-slate-600">Reading ledgers from Tally…</p>}
      {masters.status === "error" && <p className="mt-4 text-sm text-red-700">{masters.error}</p>}

      {masters.status === "ready" && (
        <div className="mt-4 grid grid-cols-[150px_1fr] items-center gap-x-3 gap-y-2 text-sm">
          <span>Voucher type *</span>
          <select className={SELECT} value={settings.voucherType} onChange={(e) => onSettingsChange({ voucherType: e.target.value })}>
            {(masters.voucherTypes.length ? masters.voucherTypes : [kind.voucherParent]).map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          {ledgerFields(kind).map(({ key, label, hint }) => (
            <div key={key} className="contents">
              <span title={hint}>{label}</span>
              <select className={SELECT} value={settings[key]} onChange={(e) => onSettingsChange({ [key]: e.target.value })}>
                <option value="">— None —</option>
                {masters.ledgers.map((l) => (
                  <option key={l.name} value={l.name}>
                    {l.name}
                    {l.parent ? `  (${l.parent})` : ""}
                  </option>
                ))}
              </select>
            </div>
          ))}
          {kind.acceptsPdf && (
            <label className="col-span-2 mt-1 flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.withStock}
                onChange={(e) => onSettingsChange({ withStock: e.target.checked })}
                className="size-4 accent-blue-700"
              />
              Record products on PDF bills as stock (item invoice)
            </label>
          )}
          <p className="col-span-2 mt-1 text-xs text-slate-500">
            {masters.ledgers.length} ledgers and {masters.stockItems.length} stock items read from Tally.
          </p>
        </div>
      )}
    </section>
  );
}

/** What stops the user from reviewing, shared by the column-mapping and bill-checking steps. */
export function ledgerBlockers(kind: KindConfig, settings: InvoiceSettings, masters: Masters): string[] {
  if (masters.status !== "ready") return ["Ledgers have not been read from Tally yet"];
  return settings.mainLedger ? [] : [`Choose the ${kind.mainRole} ledger`];
}
