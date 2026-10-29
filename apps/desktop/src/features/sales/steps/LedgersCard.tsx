import { useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import type { Masters } from "../../tally/useMasters";
import type { InvoiceSettings } from "../import/build-vouchers";
import type { KindConfig } from "../import/kind";
import { ledgersFor, roleFor, standardLedger, type LedgerKey } from "../import/standard-ledgers";
import { errorMessage } from "../../../lib/errors";
import { CARD, SELECT } from "./styles";

const REQUIRED = <span className="text-red-600"> *</span>;

function ledgerFields(kind: KindConfig): { key: LedgerKey; label: string; hint: string; required?: boolean }[] {
  const what = kind.documentWord;
  const side = (kind.side === "purchase") !== kind.isReturn ? "debited" : "credited";
  return [
    { key: "mainLedger", label: `${kind.mainLabel} ledger`, hint: `Taxable value is ${side} here`, required: true },
    { key: "cgstLedger", label: "CGST ledger", hint: `Same-state ${what}` },
    { key: "sgstLedger", label: "SGST ledger", hint: `Same-state ${what}` },
    { key: "igstLedger", label: "IGST ledger", hint: `Other-state ${what}` },
    { key: "roundOffLedger", label: "Round off ledger", hint: "Up to ₹1 difference" },
  ];
}

interface LedgersCardProps {
  kind: KindConfig;
  settings: InvoiceSettings;
  onSettingsChange: (patch: Partial<InvoiceSettings>) => void;
  masters: Masters;
  /** Creates the standard ledger for an empty setting in Tally and selects it. */
  onCreateLedger: (key: LedgerKey) => Promise<void>;
}

export function LedgersCard({ kind, settings, onSettingsChange, masters, onCreateLedger }: LedgersCardProps) {
  const [creating, setCreating] = useState<LedgerKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Only ledgers of the right group, plus whatever is chosen now so the box never shows blank.
  const choicesFor = (key: LedgerKey) => {
    const fit = ledgersFor(roleFor(kind.kind, key), masters.ledgers);
    const current = masters.ledgers.find((l) => l.name === settings[key]);
    return current && !fit.includes(current) ? [...fit, current] : fit;
  };

  async function create(keys: LedgerKey[]) {
    setError(null);
    try {
      for (const key of keys) {
        setCreating(key);
        await onCreateLedger(key);
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setCreating(null);
    }
  }
  const empty = ledgerFields(kind)
    .map((f) => f.key)
    .filter((key) => !settings[key]);

  return (
    <section className={CARD}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Tally ledgers</h2>
          <p className="mt-1 text-sm text-slate-600">Where each amount goes in Tally.</p>
        </div>
        <div className="flex gap-2">
          {masters.status === "ready" && empty.length > 1 && (
            <Button
              variant="primary"
              className="px-3 py-1.5"
              disabled={creating !== null}
              title="Creates every empty ledger below in Tally, in its proper group"
              onClick={() => void create(empty)}
            >
              <Plus size={14} /> {creating ? "Setting up…" : `Set up all ${empty.length} in Tally`}
            </Button>
          )}
          <Button className="px-3 py-1.5" disabled={masters.refreshing} onClick={() => void masters.reload()}>
            <RefreshCw size={14} className={masters.refreshing ? "animate-spin" : ""} /> Refresh from Tally
          </Button>
        </div>
      </div>

      {masters.status === "idle" && <p className="mt-4 text-sm text-amber-700">Open a company in Tally and select it at the top.</p>}
      {masters.status === "loading" && <p className="mt-4 text-sm text-slate-600">Reading ledgers from Tally…</p>}
      {masters.status === "error" && <p className="mt-4 text-sm text-red-700">{masters.error}</p>}

      {masters.status === "ready" && (
        <div className="mt-4 grid grid-cols-[150px_1fr] items-center gap-x-3 gap-y-2 text-sm">
          <span>
            Voucher type{REQUIRED}
          </span>
          <select className={SELECT} value={settings.voucherType} onChange={(e) => onSettingsChange({ voucherType: e.target.value })}>
            {(masters.voucherTypes.length ? masters.voucherTypes : [kind.voucherParent]).map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          {ledgerFields(kind).map(({ key, label, hint, required }) => (
            <div key={key} className="contents">
              <span title={hint}>
                {label}
                {required && REQUIRED}
              </span>
              <div className="flex gap-2">
                <select className={SELECT} value={settings[key]} onChange={(e) => onSettingsChange({ [key]: e.target.value })}>
                  <option value="">— None —</option>
                  {choicesFor(key).map((l) => (
                    <option key={l.name} value={l.name}>
                      {l.name}
                      {l.parent ? `  (${l.parent})` : ""}
                    </option>
                  ))}
                </select>
                {!settings[key] && (
                  <Button
                    className="shrink-0 px-2 py-1"
                    disabled={creating !== null}
                    title={`Create "${standardLedger(kind.kind, roleFor(kind.kind, key)).name}" in Tally`}
                    onClick={() => void create([key])}
                  >
                    <Plus size={14} /> {creating === key ? "Creating…" : "Create"}
                  </Button>
                )}
              </div>
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
          {error && <p className="col-span-2 text-red-700">{error}</p>}
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
  return settings.mainLedger ? [] : [`Choose the ${kind.mainLabel} ledger`];
}
